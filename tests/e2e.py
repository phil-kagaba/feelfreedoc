"""End-to-end browser tests for feelfreedoc tools (headless Chromium via Playwright)."""
import io, json, os, sys, time, traceback, zipfile
from pathlib import Path
import pymupdf
from playwright.sync_api import sync_playwright, expect

B = "http://localhost:3000"
SP = Path(__file__).parent
FX = SP / "fx"
OUT = SP / "e2e"
OUT.mkdir(exist_ok=True)
results = []


def wait_done(page, timeout=120_000):
    page.get_by_text("Done! Your file").wait_for(timeout=timeout)


def download(page, label_regex="Download"):
    with page.expect_download(timeout=60_000) as d:
        page.get_by_role("button", name=__import__("re").compile(label_regex)).first.click()
    dl = d.value
    path = OUT / dl.suggested_filename
    dl.save_as(path)
    return path


def upload(page, *files):
    page.locator('input[type="file"]').first.set_input_files([str(FX / f) for f in files])


def process(page, name=None):
    btn = page.locator("aside button.btn-primary").first if name is None else page.get_by_role("button", name=name)
    btn.click()


def pdf_info(path):
    d = pymupdf.open(path)
    return d


def check(name, fn, page):
    t = time.time()
    try:
        msg = fn(page)
        results.append((name, "PASS", msg or "", round(time.time() - t, 1)))
    except Exception as e:
        page.screenshot(path=str(OUT / f"FAIL-{name}.png"), full_page=True)
        results.append((name, "FAIL", f"{type(e).__name__}: {str(e)[:300]}", round(time.time() - t, 1)))


def ready(page):
    page.wait_for_function("() => !document.querySelector('aside fieldset[disabled]')", timeout=30_000)


def goto(page, slug):
    page.goto(f"{B}/{slug}")
    page.locator('input[type="file"]').first.wait_for(state="attached", timeout=30_000)


# Run tests/make_fixtures.py first to create tests/fx.

# ── individual tests ─────────────────────────────────────────────────

def t_merge(page):
    goto(page, "merge-pdf")
    upload(page, "report.pdf", "rotated.pdf")
    page.get_by_text("rotated.pdf").first.wait_for()
    process(page)
    wait_done(page)
    p = download(page)
    d = pdf_info(p)
    assert d.page_count == 6, d.page_count
    return f"{p.name}: {d.page_count} pages"


def t_split(page):
    goto(page, "split-pdf")
    upload(page, "report.pdf")
    page.get_by_text("Creates").wait_for()
    process(page)
    wait_done(page)
    p = download(page, "Download all")
    z = zipfile.ZipFile(p)
    names = z.namelist()
    counts = [pymupdf.open("pdf", z.read(n)).page_count for n in names]
    assert counts == [2, 1], counts
    return f"zip {names} pages={counts}"


def t_extract(page):
    goto(page, "extract-pages")
    upload(page, "report.pdf")
    ready(page)
    page.get_by_placeholder("e.g. 1, 3-5").fill("1, 3")
    process(page)
    wait_done(page)
    p = download(page)
    d = pdf_info(p)
    assert d.page_count == 2
    assert "Page 3" in d[1].get_text()
    return f"{d.page_count} pages; second is original page 3"


def t_rotate(page):
    goto(page, "rotate-pdf")
    upload(page, "report.pdf")
    ready(page)
    page.get_by_role("button", name="Right", exact=True).click()
    process(page)
    wait_done(page)
    d = pdf_info(download(page))
    rots = [pg.rotation for pg in d]
    assert rots == [90, 90, 90], rots
    return f"rotations {rots}"


def t_reorder(page):
    goto(page, "reorder-pages")
    upload(page, "report.pdf")
    ready(page)
    page.get_by_role("button", name="Reverse order").click()
    process(page)
    wait_done(page)
    d = pdf_info(download(page))
    first = d[0].get_text().splitlines()[0]
    assert "Page 3" in first, first
    return f"first page now: {first}"


def t_delete(page):
    goto(page, "delete-pages")
    upload(page, "report.pdf")
    page.locator('[role="checkbox"]').nth(1).click()
    process(page)
    wait_done(page)
    d = pdf_info(download(page))
    texts = [pg.get_text().splitlines()[0] for pg in d]
    assert d.page_count == 2 and "Page 2" not in " ".join(texts), texts
    return f"remaining: {texts}"


def t_organize(page):
    goto(page, "organize-pdf")
    upload(page, "report.pdf")
    ready(page)
    page.get_by_role("button", name="Add blank page").click()
    page.get_by_role("button", name="Duplicate page").first.click(force=True)
    process(page)
    wait_done(page)
    d = pdf_info(download(page))
    assert d.page_count == 5, d.page_count
    assert d[-1].get_text().strip() == ""
    return f"{d.page_count} pages incl. duplicate + blank"


def t_compress_ui(page):
    goto(page, "compress-pdf")
    upload(page, "scanned.pdf")
    page.get_by_role("button", name="High Smallest file").click()
    process(page)
    wait_done(page)
    stats = page.locator("dl").inner_text()
    p = download(page)
    assert p.stat().st_size < (FX / "scanned.pdf").stat().st_size
    return f"{(FX / 'scanned.pdf').stat().st_size}B → {p.stat().st_size}B | " + stats.replace("\n", " ")


def t_pdf_to_jpg(page):
    goto(page, "pdf-to-jpg")
    upload(page, "report.pdf")
    page.get_by_text("3 pages detected").wait_for()
    process(page)
    wait_done(page)
    p = download(page, "Download all")
    names = zipfile.ZipFile(p).namelist()
    assert len(names) == 3 and names[0].endswith(".jpg"), names
    return f"{names}"


def t_pdf_to_png(page):
    goto(page, "pdf-to-png")
    upload(page, "report.pdf")
    page.get_by_placeholder("All pages, or e.g. 1-3, 5").fill("2")
    page.get_by_text("3 pages detected").wait_for()
    process(page)
    wait_done(page)
    p = download(page)
    assert p.read_bytes()[:4] == b"\x89PNG"
    return f"{p.name} {p.stat().st_size}B"


def t_jpg_to_pdf(page):
    goto(page, "jpg-to-pdf")
    upload(page, "scan.png")
    process(page)
    wait_done(page)
    d = pdf_info(download(page))
    assert d.page_count == 1 and len(d[0].get_images()) == 1
    return f"A4 page {d[0].rect}"


def t_pdf_to_text(page):
    goto(page, "pdf-to-text")
    upload(page, "report.pdf")
    page.get_by_text("3 pages").first.wait_for()
    process(page)
    wait_done(page)
    p = download(page)
    txt = p.read_text()
    assert "john.smith@example.com" in txt and "— Page 3 —" in txt
    return f"{len(txt)} chars"


def t_watermark(page):
    goto(page, "watermark-pdf")
    upload(page, "rotated.pdf")
    page.get_by_alt_text("Preview of the result").wait_for(timeout=30_000)
    page.locator('input[value="CONFIDENTIAL"]').fill("DRAFT COPY")
    process(page)
    wait_done(page)
    d = pdf_info(download(page))
    ok = all("DRAFT COPY" in pg.get_text() for pg in d)
    assert ok
    return "watermark text on all 3 pages (incl. rotated page)"


def t_page_numbers(page):
    goto(page, "page-numbers")
    upload(page, "report.pdf")
    page.get_by_alt_text("Preview of the result").wait_for(timeout=30_000)
    process(page)
    wait_done(page)
    d = pdf_info(download(page))
    assert "Page 3 of 3" in d[2].get_text()
    return "‘Page 3 of 3’ found on last page"


def t_edit(page):
    goto(page, "edit-pdf")
    upload(page, "report.pdf")
    pg = page.locator('img[alt="Page 1"]')
    pg.wait_for(timeout=30_000)
    box = page.locator("div.relative.mx-auto.select-none").bounding_box()
    page.mouse.click(box["x"] + box["width"] * 0.3, box["y"] + 260)
    ta = page.get_by_label("Text content")
    ta.fill("Approved by feelfreedoc")
    # draw a rectangle
    page.get_by_role("button", name="Rectangle").click()
    page.mouse.move(box["x"] + 50, box["y"] + 50)
    page.mouse.down()
    page.mouse.move(box["x"] + 200, box["y"] + 120, steps=5)
    page.mouse.up()
    page.screenshot(path=str(OUT / "editor.png"))
    process(page)
    wait_done(page)
    d = pdf_info(download(page))
    assert "Approved by feelfreedoc" in d[0].get_text()
    return "text + rectangle burned into page 1"


def t_sign(page):
    goto(page, "sign-pdf")
    upload(page, "report.pdf")
    page.get_by_role("dialog").wait_for(state="detached", timeout=5000) if False else None
    page.locator('img[alt="Page 1"]').wait_for(timeout=30_000)
    page.get_by_role("button", name="Signature").click()
    page.get_by_role("dialog").wait_for()
    page.get_by_role("button", name="Type").click()
    page.get_by_placeholder("Your full name").fill("Jane Doe")
    page.get_by_role("button", name="Use signature").click()
    page.get_by_role("dialog").wait_for(state="detached")
    page.screenshot(path=str(OUT / "sign.png"))
    process(page)
    wait_done(page)
    d = pdf_info(download(page))
    imgs = len(d[0].get_images())
    assert imgs >= 2, imgs  # original image + signature
    return f"page 1 images: {imgs}"


def t_annotate(page):
    goto(page, "annotate-pdf")
    upload(page, "report.pdf")
    page.locator('img[alt="Page 1"]').wait_for(timeout=30_000)
    box = page.locator("div.relative.mx-auto.select-none").bounding_box()
    page.mouse.move(box["x"] + 90, box["y"] + 130)
    page.mouse.down()
    page.mouse.move(box["x"] + 300, box["y"] + 145, steps=5)
    page.mouse.up()
    page.get_by_role("button", name="Comment").click()
    page.mouse.click(box["x"] + box["width"] - 40, box["y"] + 40)
    page.get_by_placeholder("Write your comment…").fill("Please double-check this figure.")
    process(page)
    wait_done(page)
    d = pdf_info(download(page))
    annots = [(a.type[1], a.info.get("content")) for a in d[0].annots()]
    assert any(t == "Text" and "double-check" in (c or "") for t, c in annots), annots
    return f"annotations: {annots}"


def t_shapes(page):
    goto(page, "add-shapes")
    upload(page, "report.pdf")
    page.locator('img[alt="Page 1"]').wait_for(timeout=30_000)
    box = page.locator("div.relative.mx-auto.select-none").bounding_box()
    for tool, dy in (("Ellipse", 0), ("Arrow", 120)):
        page.get_by_role("button", name=tool).click()
        page.mouse.move(box["x"] + 60, box["y"] + 300 + dy)
        page.mouse.down()
        page.mouse.move(box["x"] + 220, box["y"] + 380 + dy, steps=5)
        page.mouse.up()
    process(page)
    wait_done(page)
    d = pdf_info(download(page))
    n = len(d[0].get_drawings())
    return f"page 1 vector drawings: {n}"


def t_images(page):
    goto(page, "add-images")
    upload(page, "report.pdf")
    page.locator('img[alt="Page 1"]').wait_for(timeout=30_000)
    page.locator('input[type="file"][accept="image/png,image/jpeg,image/webp"]').set_input_files(str(FX / "scan.png"))
    page.get_by_text("1 item added").wait_for()
    process(page)
    wait_done(page)
    d = pdf_info(download(page))
    return f"page 1 images: {len(d[0].get_images())}"


def t_redact(page):
    goto(page, "redact-pdf")
    upload(page, "report.pdf")
    page.locator('img[alt="Page 1"]').wait_for(timeout=30_000)
    page.get_by_placeholder("One term per line", exact=False).fill("555-0142")
    box = page.locator("div.relative.mx-auto.select-none").bounding_box()
    page.mouse.move(box["x"] + 60, box["y"] + 60)
    page.mouse.down()
    page.mouse.move(box["x"] + 400, box["y"] + 110, steps=5)
    page.mouse.up()
    process(page)
    wait_done(page)
    d = pdf_info(download(page))
    all_text = "".join(p.get_text() for p in d)
    assert "555-0142" not in all_text and "Quarterly Report - Page 1" not in all_text
    return "phone number + title area permanently removed"


def t_metadata(page):
    goto(page, "pdf-metadata")
    upload(page, "report.pdf")
    title = page.locator("label:has-text('Title') input")
    expect(title).to_have_value("Quarterly Report", timeout=20_000)
    title.fill("Annual Report 2026")
    page.locator("label:has-text('Author') input").fill("feelfreedoc QA")
    process(page)
    wait_done(page)
    d = pdf_info(download(page))
    assert d.metadata["title"] == "Annual Report 2026" and d.metadata["author"] == "feelfreedoc QA", d.metadata
    return f"title={d.metadata['title']!r} author={d.metadata['author']!r}"


def t_compare(page):
    goto(page, "compare-pdf")
    upload(page, "report.pdf", "api_redacted.pdf")
    process(page)
    wait_done(page)
    stats = page.locator("dl").inner_text().replace("\n", " ")
    assert page.locator("del").count() > 0
    return stats


def t_protect_ui(page):
    goto(page, "protect-pdf")
    upload(page, "report.pdf")
    page.locator('input[type="password"]').nth(0).fill("s3cret!")
    page.locator('input[type="password"]').nth(1).fill("s3cret!")
    process(page)
    wait_done(page)
    d = pdf_info(download(page))
    assert d.needs_pass
    assert d.authenticate("s3cret!")
    return "encrypted; opens with password"


def t_ai_unconfigured(page):
    page.goto(f"{B}/ai-summarizer")
    page.get_by_text("AI features need an API key").wait_for(timeout=20_000)
    upload(page, "report.pdf")
    page.get_by_text("Result").first.wait_for()
    assert page.locator("aside button.btn-primary").first.is_disabled()
    return "shows configuration notice; action disabled"


def t_home_flow(page):
    page.goto(B)
    upload(page, "report.pdf")
    page.get_by_text("what would you like to do?").wait_for()
    page.get_by_role("button", name="Rotate PDF").click()
    page.wait_for_url("**/rotate-pdf")
    page.get_by_role("button", name="Right", exact=True).wait_for(timeout=20_000)
    return "file carried from homepage into Rotate PDF"


def t_errors(page):
    goto(page, "merge-pdf")
    page.locator('input[type="file"]').first.set_input_files(str(FX / "fake.pdf"))
    al = page.locator('[role="alert"]', has_text="valid PDF")
    al.wait_for()
    msg = al.inner_text()
    assert "doesn't look like a valid PDF" in msg, msg
    goto(page, "unlock-pdf")
    upload(page, "locked.pdf")
    page.locator('input[type="password"]').fill("nope")
    process(page)
    page.get_by_text("That password is incorrect.").wait_for(timeout=30_000)
    return "invalid PDF rejected; wrong password reported"


TESTS = [
    ("home-flow", t_home_flow), ("merge", t_merge), ("split", t_split), ("extract", t_extract), ("rotate", t_rotate),
    ("reorder", t_reorder), ("delete", t_delete), ("organize", t_organize), ("compress(ui)", t_compress_ui),
    ("pdf-to-jpg", t_pdf_to_jpg), ("pdf-to-png", t_pdf_to_png), ("image-to-pdf", t_jpg_to_pdf), ("pdf-to-text", t_pdf_to_text),
    ("watermark", t_watermark), ("page-numbers", t_page_numbers), ("edit", t_edit), ("sign", t_sign), ("annotate", t_annotate),
    ("shapes", t_shapes), ("add-images", t_images), ("redact", t_redact), ("metadata", t_metadata), ("compare", t_compare),
    ("protect(ui)", t_protect_ui), ("ai-unconfigured", t_ai_unconfigured), ("errors", t_errors),
]

only = set(sys.argv[1:])
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    ctx = browser.new_context(accept_downloads=True, viewport={"width": 1366, "height": 900})
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    for name, fn in TESTS:
        if only and name not in only:
            continue
        check(name, fn, page)
    browser.close()

w = max(len(r[0]) for r in results)
for n, s, m, t in results:
    print(f"{s}  {n.ljust(w)}  {t:>5}s  {m}")
print(f"\n{sum(r[1] == 'PASS' for r in results)}/{len(results)} passed")
if errors:
    print("page errors:", errors[:5])
