#!/usr/bin/env python3
"""
feelfreedoc document worker.

Usage:  docworker.py <operation> <input_path> <output_dir> <options_json>

Prints a single JSON object on stdout:
  success → {"output": "<path>", "info": {...}}
  failure → {"error": "<user-facing message>"}   (exit code 2)

Each invocation runs in its own throwaway job directory created by the
Node.js API, which deletes it afterwards.
"""
from __future__ import annotations

import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from html.parser import HTMLParser
from pathlib import Path


class UserError(Exception):
    """An error whose message is safe and useful to show to the user."""


def done(output: Path, **info) -> None:
    print(json.dumps({"output": str(output), "info": info}))
    sys.exit(0)


def fail(msg: str) -> None:
    print(json.dumps({"error": msg}))
    sys.exit(2)


# ── helpers ──────────────────────────────────────────────────────────────

def open_pdf(path: Path):
    import pymupdf

    try:
        doc = pymupdf.open(path)
    except Exception:
        raise UserError("This file is not a readable PDF. Try Repair PDF first.")
    if doc.needs_pass:
        raise UserError("This PDF is password-protected. Unlock it first with Unlock PDF.")
    if doc.page_count == 0:
        raise UserError("This PDF has no pages.")
    return doc


def which(*names: str) -> str | None:
    for n in names:
        if not n:
            continue
        p = shutil.which(n)
        if p:
            return p
    return None


def run(cmd: list[str], timeout: int, env: dict | None = None, cwd: str | None = None) -> subprocess.CompletedProcess:
    """Run a command in its own process group so that a timeout kills every child (Chromium, LibreOffice)."""
    import signal

    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env, cwd=cwd, start_new_session=True)
    try:
        out, err = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        proc.communicate()
        raise
    return subprocess.CompletedProcess(cmd, proc.returncode, out, err)


# ── compress / optimize / repair ─────────────────────────────────────────

LEVELS = {
    "low": dict(dpi_threshold=250, dpi_target=200, quality=85),
    "recommended": dict(dpi_threshold=170, dpi_target=144, quality=68),
    "high": dict(dpi_threshold=110, dpi_target=96, quality=45),
}


def op_compress(src: Path, out: Path, opts: dict):
    level = LEVELS.get(opts.get("level", "recommended"), LEVELS["recommended"])
    doc = open_pdf(src)
    try:
        doc.rewrite_images(lossy=True, lossless=True, bitonal=False, color=True, gray=True, **level)
    except Exception:
        pass  # some image types can't be rewritten; continue with structural compression
    try:
        doc.subset_fonts()
    except Exception:
        pass
    try:
        doc.scrub(metadata=False, xml_metadata=False, thumbnails=True, embedded_files=False,
                  attached_files=False, clean_pages=True, hidden_text=False, javascript=False,
                  redactions=False, redact_images=0, remove_links=False, reset_fields=False,
                  reset_responses=False)
    except Exception:
        pass
    target = out / "result.pdf"
    doc.save(target, garbage=4, deflate=True, deflate_images=True, deflate_fonts=True, clean=True, use_objstms=1)
    pages = doc.page_count
    doc.close()
    if target.stat().st_size >= src.stat().st_size:
        shutil.copyfile(src, target)
    done(target, pages=pages)


def op_optimize(src: Path, out: Path, opts: dict):
    import pikepdf

    try:
        pdf = pikepdf.open(src)
    except pikepdf.PasswordError:
        raise UserError("This PDF is password-protected. Unlock it first with Unlock PDF.")
    except Exception:
        raise UserError("This PDF could not be read. Try Repair PDF first.")
    pdf.remove_unreferenced_resources()
    target = out / "result.pdf"
    pdf.save(target, linearize=True, object_stream_mode=pikepdf.ObjectStreamMode.generate,
             compress_streams=True, recompress_flate=True)
    pages = len(pdf.pages)
    pdf.close()
    done(target, pages=pages, note="Linearized for fast web view with compressed object streams.")


def op_repair(src: Path, out: Path, opts: dict):
    import pikepdf
    import pymupdf

    target = out / "result.pdf"
    notes = []
    try:
        pdf = pikepdf.open(src, attempt_recovery=True)
        warnings = pdf.get_warnings()
        pdf.save(target, object_stream_mode=pikepdf.ObjectStreamMode.generate)
        pages = len(pdf.pages)
        pdf.close()
        notes.append(f"Rebuilt the file structure ({len(warnings)} problem{'s' if len(warnings) != 1 else ''} fixed)."
                     if warnings else "No structural damage found; the file was rebuilt cleanly.")
    except pikepdf.PasswordError:
        raise UserError("This PDF is password-protected. Unlock it first with Unlock PDF.")
    except Exception:
        try:
            doc = pymupdf.open(src, filetype="pdf")
            if doc.page_count == 0:
                raise RuntimeError
            doc.save(target, garbage=4, deflate=True, clean=True)
            pages = doc.page_count
            doc.close()
            notes.append("Recovered readable pages with the fallback engine.")
        except Exception:
            raise UserError("Sorry — this file is too badly damaged to recover.")
    # Verify the result opens.
    check = pymupdf.open(target)
    pages = check.page_count
    check.close()
    done(target, pages=pages, note=" ".join(notes))


# ── conversions ──────────────────────────────────────────────────────────

LO_PROFILE = """<?xml version="1.0" encoding="UTF-8"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item>
<item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="DisableMacrosExecution" oor:op="fuse"><value>true</value></prop></item>
<item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="BlockUntrustedRefererLinks" oor:op="fuse"><value>true</value></prop></item>
<item oor:path="/org.openoffice.Office.Common/Misc"><prop oor:name="UseOpenCL" oor:op="fuse"><value>false</value></prop></item>
</oor:items>
"""


def op_office_to_pdf(src: Path, out: Path, opts: dict):
    soffice = which(os.environ.get("SOFFICE_PATH", ""), "soffice", "libreoffice")
    if not soffice:
        raise UserError("LibreOffice is not installed on the server.")
    profile = out / "lo-profile"
    (profile / "user").mkdir(parents=True, exist_ok=True)
    (profile / "user" / "registrymodifications.xcu").write_text(LO_PROFILE)
    env = dict(os.environ)
    # Any network access attempted by a document goes to a dead proxy.
    env.update(http_proxy="http://127.0.0.1:9", https_proxy="http://127.0.0.1:9", HOME=str(out))
    res = run([soffice, f"-env:UserInstallation={profile.as_uri()}", "--headless", "--norestore", "--nolockcheck",
               "--nodefault", "--nologo", "--convert-to", "pdf", "--outdir", str(out), str(src)],
              timeout=int(opts.get("_timeout", 170)), env=env)
    produced = out / (src.stem + ".pdf")
    if res.returncode != 0 or not produced.exists():
        raise UserError("The document could not be converted. It may be damaged, password-protected or in an unsupported format.")
    import pymupdf
    d = pymupdf.open(produced)
    pages = d.page_count
    d.close()
    done(produced, pages=pages)


def op_pdf_to_word(src: Path, out: Path, opts: dict):
    doc = open_pdf(src)
    pages = doc.page_count
    has_text = any(p.get_text().strip() for p in doc)
    doc.close()
    from pdf2docx import Converter

    target = out / "result.docx"
    try:
        cv = Converter(str(src))
        cv.convert(str(target), multi_processing=False)
        cv.close()
    except Exception:
        raise UserError("This PDF could not be converted to Word.")
    note = None if has_text else "This PDF has no text layer (scanned?). Pages were converted as images — run OCR PDF first for editable text."
    done(target, pages=pages, **({"note": note} if note else {}))


def _cell(v):
    if v is None:
        return None
    v = str(v).strip()
    if re.fullmatch(r"-?\d{1,15}", v):
        return int(v)
    if re.fullmatch(r"-?\d{1,3}(,\d{3})+(\.\d+)?|-?\d+\.\d+", v):
        try:
            return float(v.replace(",", ""))
        except ValueError:
            return v
    return v


def op_pdf_to_excel(src: Path, out: Path, opts: dict):
    open_pdf(src).close()
    import pdfplumber
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter

    wb = Workbook()
    wb.remove(wb.active)
    tables_found = 0
    sheets = 0
    head_fill = PatternFill("solid", fgColor="DDF5E2")
    with pdfplumber.open(src) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            rows: list[list] = []
            header_rows: set[int] = set()
            try:
                tables = page.extract_tables()
            except Exception:
                tables = []
            tables = [t for t in tables if t and any(any(c for c in r) for r in t)]
            if tables:
                for t in tables:
                    tables_found += 1
                    if rows:
                        rows.append([])
                    header_rows.add(len(rows))
                    rows.extend([[_cell(c) for c in r] for r in t])
            else:
                text = page.extract_text() or ""
                for line in text.splitlines():
                    if line.strip():
                        rows.append([_cell(c) for c in re.split(r"\s{2,}", line.strip())])
            if not rows:
                continue
            ws = wb.create_sheet(f"Page {i}")
            sheets += 1
            for r in rows:
                ws.append(r)
            for idx in header_rows:
                for cell in ws[idx + 1]:
                    cell.font = Font(bold=True)
                    cell.fill = head_fill
            for col in range(1, ws.max_column + 1):
                width = max((len(str(c.value)) for c in ws[get_column_letter(col)] if c.value is not None), default=8)
                ws.column_dimensions[get_column_letter(col)].width = min(max(width + 2, 8), 60)
                for c in ws[get_column_letter(col)]:
                    c.alignment = Alignment(wrap_text=True, vertical="top")
    if not sheets:
        raise UserError("No text or tables were found. If this is a scanned PDF, run OCR PDF first.")
    target = out / "result.xlsx"
    wb.save(target)
    done(target, tables=tables_found, sheets=sheets,
         note=f"Exported {tables_found} table{'s' if tables_found != 1 else ''} across {sheets} sheet{'s' if sheets != 1 else ''}."
         if tables_found else "No ruled tables were detected, so each page's text lines were exported row by row.")


def op_pdf_to_pptx(src: Path, out: Path, opts: dict):
    import pymupdf
    from pptx import Presentation
    from pptx.util import Emu

    doc = open_pdf(src)
    dpi = int(opts.get("dpi", 150))
    dpi = max(72, min(dpi, 220))
    first = doc[0].rect
    prs = Presentation()
    prs.slide_width = Emu(int(first.width * 12700))
    prs.slide_height = Emu(int(first.height * 12700))
    blank = prs.slide_layouts[6]
    for i, page in enumerate(doc):
        pix = page.get_pixmap(dpi=dpi, alpha=False)
        img = out / f"p{i}.png"
        pix.save(img)
        slide = prs.slides.add_slide(blank)
        # fit page into slide keeping aspect ratio
        sw, sh = prs.slide_width, prs.slide_height
        pw, ph = page.rect.width * 12700, page.rect.height * 12700
        scale = min(sw / pw, sh / ph)
        w, h = int(pw * scale), int(ph * scale)
        slide.shapes.add_picture(str(img), int((sw - w) / 2), int((sh - h) / 2), width=w, height=h)
        text = page.get_text().strip()
        if text:
            slide.notes_slide.notes_text_frame.text = text[:20000]
        img.unlink()
    target = out / "result.pptx"
    prs.save(target)
    done(target, pages=doc.page_count)


# ── HTML → PDF (sandboxed Chromium) ──────────────────────────────────────

URL_ATTRS = {"src", "href", "srcset", "poster", "data", "background", "action", "formaction", "lowsrc", "dynsrc",
             "cite", "longdesc", "usemap", "ping", "manifest", "icon", "archive", "codebase", "classid", "profile",
             "xlink:href", "imagesrcset"}
DROP_TAGS = {"script", "iframe", "frame", "frameset", "object", "embed", "applet", "base", "portal", "noscript"}


def _safe_url(v: str) -> bool:
    v = v.strip().lower()
    return v.startswith("data:image/") or v.startswith("#") or v == ""


def _clean_css(css: str) -> str:
    css = re.sub(r"@import[^;]*;?", "", css, flags=re.I)
    css = re.sub(r"(-webkit-)?image-set\([^)]*\)", "none", css, flags=re.I)
    def repl(m):
        inner = m.group(1).strip().strip("'\"")
        return m.group(0) if inner.lower().startswith("data:") and "\\" not in inner else "url(about:blank)"
    css = re.sub(r"url\(\s*([^)]*)\)", repl, css, flags=re.I)
    css = re.sub(r"\\", "", css)  # no CSS escapes → no smuggled schemes
    return css


class Sanitizer(HTMLParser):
    """Rebuilds HTML, removing anything that could load a resource that isn't inline data."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self.skip = 0
        self.in_style = False

    def _attrs(self, tag, attrs):
        parts = []
        for k, v in attrs:
            k = k.lower()
            if k.startswith("on") or k in {"http-equiv", "srcdoc"}:
                continue
            if v is None:
                parts.append(k)
                continue
            if k in URL_ATTRS or k.endswith("href") or k.endswith("src"):
                if k in ("srcset", "imagesrcset") or not _safe_url(v):
                    continue
            if k == "style":
                v = _clean_css(v)
            parts.append(f'{k}="{html.escape(v, quote=True)}"')
        return (" " + " ".join(parts)) if parts else ""

    def handle_starttag(self, tag, attrs):
        if tag in DROP_TAGS or (tag == "link") or (tag == "meta" and any(k.lower() == "http-equiv" for k, _ in attrs)):
            if tag not in ("base", "link", "meta"):
                self.skip += 1
            return
        if self.skip:
            return
        if tag == "style":
            self.in_style = True
        self.out.append(f"<{tag}{self._attrs(tag, attrs)}>")

    def handle_startendtag(self, tag, attrs):
        if tag in DROP_TAGS or tag in ("link", "meta") or self.skip:
            return
        self.out.append(f"<{tag}{self._attrs(tag, attrs)}/>")

    def handle_endtag(self, tag):
        if tag in DROP_TAGS:
            if tag not in ("base",):
                self.skip = max(0, self.skip - 1)
            return
        if self.skip or tag in ("link", "meta"):
            return
        if tag == "style":
            self.in_style = False
        self.out.append(f"</{tag}>")

    def handle_data(self, data):
        if self.skip:
            return
        self.out.append(_clean_css(data) if self.in_style else html.escape(data, quote=False))

    def handle_comment(self, data):
        pass


def op_html_to_pdf(src: Path, out: Path, opts: dict):
    chrome = which(os.environ.get("CHROME_PATH", ""), "chromium", "chromium-browser", "google-chrome", "google-chrome-stable")
    if not chrome:
        raise UserError("HTML conversion needs Chromium, which is not installed on the server.")
    raw = src.read_bytes()
    if len(raw) > 15 * 1024 * 1024:
        raise UserError("HTML files are limited to 15 MB.")
    text = raw.decode("utf-8", errors="replace")
    s = Sanitizer()
    s.feed(text)
    s.close()
    size = "Letter" if opts.get("pageSize") == "Letter" else "A4"
    orient = " landscape" if opts.get("landscape") else ""
    bg = "*{-webkit-print-color-adjust:exact;print-color-adjust:exact}" if opts.get("background", True) else ""
    page_css = f"<style>@page{{size:{size}{orient};margin:14mm}}{bg}</style>"
    clean = "<!doctype html><meta charset=\"utf-8\">" + page_css + "".join(s.out)
    sandbox = out / "page"
    sandbox.mkdir()
    page = sandbox / "index.html"
    page.write_text(clean, encoding="utf-8")
    target = out / "result.pdf"
    # Scripts are stripped by the sanitizer above; network is routed to a dead proxy and DNS is disabled.
    cmd = [chrome, "--disable-gpu", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check",
           "--disable-extensions", "--disable-background-networking", "--disable-sync",
           "--proxy-server=http://127.0.0.1:9", "--proxy-bypass-list=<-loopback>",
           "--host-resolver-rules=MAP * ~NOTFOUND", f"--user-data-dir={out / 'chrome-profile'}",
           "--no-pdf-header-footer", "--print-to-pdf-no-header", f"--print-to-pdf={target}", page.as_uri()]
    if "headless-shell" not in Path(chrome).name:
        cmd.insert(1, "--headless=new")
    if hasattr(os, "geteuid") and os.geteuid() == 0:
        cmd.insert(1, "--no-sandbox")
    res = run(cmd, timeout=90, env={**os.environ, "HOME": str(out)})
    if not target.exists() or target.stat().st_size == 0:
        raise UserError("The HTML could not be rendered to PDF.")
    import pymupdf
    d = pymupdf.open(target)
    pages = d.page_count
    d.close()
    done(target, pages=pages)


# ── OCR ──────────────────────────────────────────────────────────────────

def tessdata_dir() -> str | None:
    env = os.environ.get("TESSDATA_PREFIX")
    candidates = [env] if env else []
    candidates += ["/usr/share/tesseract-ocr/5/tessdata", "/usr/share/tesseract-ocr/4.00/tessdata",
                   "/usr/share/tessdata", "/usr/local/share/tessdata", "/opt/homebrew/share/tessdata"]
    for c in candidates:
        if c and Path(c).is_dir() and any(Path(c).glob("*.traineddata")):
            return c
    return None


def op_ocr(src: Path, out: Path, opts: dict):
    import pymupdf

    tess = tessdata_dir()
    if not tess:
        raise UserError("Tesseract language data is not installed on the server.")
    langs = [l for l in opts.get("languages", ["eng"]) if re.fullmatch(r"[a-z_]{3,8}", l)][:3] or ["eng"]
    missing = [l for l in langs if not (Path(tess) / f"{l}.traineddata").exists()]
    if missing:
        raise UserError(f"OCR language not installed: {', '.join(missing)}")
    lang = "+".join(langs)

    if src.suffix.lower() in (".jpg", ".jpeg", ".png"):
        img = pymupdf.open(src)
        pdf_bytes = img.convert_to_pdf()
        img.close()
        doc = pymupdf.open("pdf", pdf_bytes)
    else:
        doc = open_pdf(src)
    if doc.page_count > 300:
        raise UserError("OCR is limited to 300 pages per document.")

    result = pymupdf.open()
    texts: list[str] = []
    skipped = 0
    for i, page in enumerate(doc):
        existing = page.get_text().strip()
        if len(existing) > 40:
            # Page already has real text — keep it untouched.
            result.insert_pdf(doc, from_page=i, to_page=i)
            texts.append(existing)
            skipped += 1
            continue
        zoom = 300 / 72
        pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
        pix.set_dpi(300, 300)  # keeps the original physical page size
        ocr_pdf = pymupdf.open("pdf", pix.pdfocr_tobytes(language=lang, tessdata=tess))
        ocr_page = ocr_pdf[0]
        if page.rotation == 0:
            # Keep the original page untouched and lay an invisible, searchable
            # text layer over it — preserves quality and file size.
            result.insert_pdf(doc, from_page=i, to_page=i)
            target_page = result[-1]
            sx = page.rect.width / ocr_page.rect.width
            sy = page.rect.height / ocr_page.rect.height
            for x0, y0, x1, y1, word, *_ in ocr_page.get_text("words"):
                h = (y1 - y0) * sy
                w = (x1 - x0) * sx
                if h <= 0 or w <= 0 or not word.strip():
                    continue
                size = h * 0.85
                natural = pymupdf.get_text_length(word, fontname="helv", fontsize=size) or 1
                origin = pymupdf.Point(x0 * sx, y1 * sy - h * 0.18)
                try:
                    target_page.insert_text(origin, word, fontsize=size, fontname="helv", render_mode=3,
                                            morph=(origin, pymupdf.Matrix(w / natural, 1)))
                except Exception:
                    continue
        else:
            result.insert_pdf(ocr_pdf)
        texts.append(ocr_page.get_text().strip())
        ocr_pdf.close()
        print(json.dumps({"progress": (i + 1) / doc.page_count}), file=sys.stderr, flush=True)

    pages = doc.page_count
    if opts.get("output") == "txt":
        target = out / "result.txt"
        target.write_text("\n\n".join(f"— Page {i + 1} —\n\n{t}" for i, t in enumerate(texts)), encoding="utf-8")
    else:
        target = out / "result.pdf"
        result.save(target, garbage=3, deflate=True)
    chars = sum(len(t) for t in texts)
    note = f"Recognized {chars:,} characters."
    if skipped:
        note += f" {skipped} page{'s' if skipped != 1 else ''} already had text and {'were' if skipped != 1 else 'was'} kept as-is."
    done(target, pages=pages, note=note)


# ── security ─────────────────────────────────────────────────────────────

def op_protect(src: Path, out: Path, opts: dict):
    import pikepdf
    import secrets

    pw = str(opts.get("password", ""))
    if len(pw) < 4 or len(pw) > 128:
        raise UserError("Use a password between 4 and 128 characters.")
    owner = str(opts.get("ownerPassword") or "") or secrets.token_urlsafe(24)
    try:
        pdf = pikepdf.open(src)
    except pikepdf.PasswordError:
        raise UserError("This PDF already has a password. Unlock it first.")
    except Exception:
        raise UserError("This PDF could not be read. Try Repair PDF first.")
    allow_print = bool(opts.get("allowPrint", True))
    allow_copy = bool(opts.get("allowCopy", False))
    allow_edit = bool(opts.get("allowEdit", False))
    perms = pikepdf.Permissions(
        accessibility=True, extract=allow_copy, modify_annotation=allow_edit, modify_assembly=allow_edit,
        modify_form=allow_edit, modify_other=allow_edit, print_lowres=allow_print, print_highres=allow_print,
    )
    target = out / "result.pdf"
    pdf.save(target, encryption=pikepdf.Encryption(user=pw, owner=owner, R=6, allow=perms))
    done(target, pages=len(pdf.pages), note="Protected with AES-256 encryption.")


def op_unlock(src: Path, out: Path, opts: dict):
    import pikepdf

    pw = str(opts.get("password", ""))
    try:
        pdf = pikepdf.open(src, password=pw)
    except pikepdf.PasswordError:
        raise UserError("That password is incorrect.")
    except Exception:
        raise UserError("This PDF could not be read. Try Repair PDF first.")
    was = pdf.is_encrypted
    target = out / "result.pdf"
    pdf.save(target)
    done(target, pages=len(pdf.pages),
         note="Password and restrictions removed." if was else "This PDF wasn't password-protected — here's an unrestricted copy.")


def op_redact(src: Path, out: Path, opts: dict):
    import pymupdf

    doc = open_pdf(src)
    boxes = opts.get("boxes") or []
    terms = [str(t) for t in (opts.get("terms") or []) if str(t).strip()][:100]
    case = bool(opts.get("caseSensitive"))
    count = 0
    matches = 0
    for b in boxes[:2000]:
        try:
            pno = int(b["page"])
            x, y, w, h = (float(b[k]) for k in ("x", "y", "w", "h"))
        except (KeyError, TypeError, ValueError):
            continue
        if not (0 <= pno < doc.page_count) or w <= 0 or h <= 0:
            continue
        page = doc[pno]
        rect = pymupdf.Rect(x, y, x + w, y + h) * page.derotation_matrix
        page.add_redact_annot(rect, fill=(0, 0, 0))
        count += 1
    for page in doc:
        for term in terms:
            for r in page.search_for(term):
                if case:
                    found = page.get_textbox(r + (-1, -1, 1, 1))
                    if term not in found:
                        continue
                page.add_redact_annot(r, fill=(0, 0, 0))
                count += 1
                matches += 1
    if count == 0:
        raise UserError("Nothing to redact — none of the search terms were found and no boxes were drawn.")
    for page in doc:
        try:
            page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_PIXELS, graphics=pymupdf.PDF_REDACT_LINE_ART_REMOVE_IF_TOUCHED)
        except TypeError:
            page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_PIXELS)
    if opts.get("scrubMetadata", True):
        doc.set_metadata({})
        try:
            doc.del_xml_metadata()
        except Exception:
            pass
    target = out / "result.pdf"
    doc.save(target, garbage=4, deflate=True, clean=True)
    done(target, redactions=count, matches=matches, pages=doc.page_count)


# ── capabilities ─────────────────────────────────────────────────────────

def op_capabilities(*_):
    caps = {"python": True}
    for mod in ("pymupdf", "pikepdf", "pdf2docx", "pdfplumber", "pptx", "openpyxl"):
        try:
            __import__(mod)
            caps[mod] = True
        except Exception:
            caps[mod] = False
    caps["libreoffice"] = bool(which(os.environ.get("SOFFICE_PATH", ""), "soffice", "libreoffice"))
    caps["chromium"] = bool(which(os.environ.get("CHROME_PATH", ""), "chromium", "chromium-browser", "google-chrome", "google-chrome-stable"))
    t = tessdata_dir()
    caps["tesseract"] = bool(t)
    caps["ocrLanguages"] = sorted(p.stem for p in Path(t).glob("*.traineddata") if p.stem != "osd") if t else []
    print(json.dumps(caps))
    sys.exit(0)


OPS = {
    "compress-pdf": op_compress,
    "optimize-pdf": op_optimize,
    "repair-pdf": op_repair,
    "word-to-pdf": op_office_to_pdf,
    "excel-to-pdf": op_office_to_pdf,
    "powerpoint-to-pdf": op_office_to_pdf,
    "pdf-to-word": op_pdf_to_word,
    "pdf-to-excel": op_pdf_to_excel,
    "pdf-to-powerpoint": op_pdf_to_pptx,
    "html-to-pdf": op_html_to_pdf,
    "ocr-pdf": op_ocr,
    "protect-pdf": op_protect,
    "unlock-pdf": op_unlock,
    "redact-pdf": op_redact,
}


def main():
    if len(sys.argv) >= 2 and sys.argv[1] == "capabilities":
        op_capabilities()
    if len(sys.argv) != 5:
        fail("Invalid worker invocation.")
    op, src, outdir, opts = sys.argv[1], Path(sys.argv[2]).resolve(), Path(sys.argv[3]).resolve(), sys.argv[4]
    fn = OPS.get(op)
    if not fn:
        fail("Unknown operation.")
    try:
        options = json.loads(opts) if opts else {}
        if not isinstance(options, dict):
            options = {}
    except json.JSONDecodeError:
        options = {}
    try:
        fn(src, outdir, options)
    except UserError as e:
        fail(str(e))
    except subprocess.TimeoutExpired:
        fail("Processing took too long and was stopped.")
    except MemoryError:
        fail("This document is too large to process.")
    except Exception as e:  # never leak internals to users
        print(f"worker error in {op}: {type(e).__name__}: {e}", file=sys.stderr)
        fail("Processing failed. The file may be damaged or use features we can't handle yet.")


if __name__ == "__main__":
    main()
