"use client";

// In-browser PDF operations built on pdf-lib. Nothing here uploads data.

import {
  BlendMode, PDFDocument, PDFFont, PDFHexString, PDFImage, PDFName, PDFPage, StandardFonts, degrees, rgb,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { extOf, hexToRgb01 } from "./utils";

export class PdfError extends Error {}

export async function loadPdf(file: File | ArrayBuffer | Uint8Array): Promise<PDFDocument> {
  const bytes = file instanceof File ? await file.arrayBuffer() : file;
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (e) {
    const msg = String((e as Error)?.message || e);
    if (/encrypt/i.test(msg)) {
      throw new PdfError("This PDF is encrypted. Remove the password with Unlock PDF, then try again.");
    }
    throw new PdfError("This PDF could not be read. It may be damaged — try Repair PDF first.");
  }
}

export function pdfBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

export async function savePdf(doc: PDFDocument): Promise<Blob> {
  doc.setProducer("feelfreedoc");
  doc.setModificationDate(new Date());
  return pdfBlob(await doc.save({ useObjectStreams: true }));
}

// ── Geometry helpers: work in the *visual* page space (what the user sees) ──

export interface PageFrame {
  /** visual width/height in points */
  vw: number;
  vh: number;
  rotation: number;
  /** map a visual point (origin bottom-left, y up) to PDF user space */
  toUser: (vx: number, vy: number) => { x: number; y: number };
}

export function pageFrame(page: PDFPage): PageFrame {
  const box = page.getCropBox();
  const r = (((page.getRotation().angle ?? 0) % 360) + 360) % 360;
  const W = box.width;
  const H = box.height;
  const vw = r % 180 ? H : W;
  const vh = r % 180 ? W : H;
  const toUser = (vx: number, vy: number) => {
    switch (r) {
      case 90: return { x: box.x + W - vy, y: box.y + vx };
      case 180: return { x: box.x + W - vx, y: box.y + H - vy };
      case 270: return { x: box.x + vy, y: box.y + H - vx };
      default: return { x: box.x + vx, y: box.y + vy };
    }
  };
  return { vw, vh, rotation: r, toUser };
}

function rotateVec(x: number, y: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) };
}

// ── Fonts ────────────────────────────────────────────────────────────

let unicodeFontBytes: Promise<ArrayBuffer> | null = null;

/** Helvetica when the text is WinAnsi-encodable, otherwise an embedded Unicode font. */
export async function fontFor(doc: PDFDocument, text: string, bold = false): Promise<PDFFont> {
  const std = await doc.embedFont(bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica);
  try {
    std.encodeText(text);
    return std;
  } catch {
    doc.registerFontkit(fontkit);
    unicodeFontBytes ??= fetch("/fonts/DejaVuSans.ttf").then((r) => r.arrayBuffer());
    return doc.embedFont(await unicodeFontBytes, { subset: true });
  }
}

// ── Images ───────────────────────────────────────────────────────────

/** Convert any browser-decodable image to PNG bytes via canvas. */
async function toPngBytes(blob: Blob): Promise<Uint8Array> {
  const bmp = await createImageBitmap(blob);
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext("2d")!.drawImage(bmp, 0, 0);
  const out = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), "image/png"));
  return new Uint8Array(await out.arrayBuffer());
}

export async function embedImage(doc: PDFDocument, file: Blob, name = ""): Promise<PDFImage> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
  try {
    if (isJpg) return await doc.embedJpg(bytes);
    if (isPng) return await doc.embedPng(bytes);
  } catch {
    /* fall through to canvas re-encode (e.g. CMYK or progressive quirks) */
  }
  try {
    return await doc.embedPng(await toPngBytes(file));
  } catch {
    throw new PdfError(`The image ${name || ""} could not be read.`);
  }
}

// ── Organize ─────────────────────────────────────────────────────────

export async function mergePdfs(files: File[], onProgress?: (p: number) => void): Promise<Blob> {
  const out = await PDFDocument.create();
  for (let i = 0; i < files.length; i++) {
    const src = await loadPdf(files[i]).catch((e) => {
      throw new PdfError(`${files[i].name}: ${(e as Error).message}`);
    });
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
    onProgress?.((i + 1) / files.length);
  }
  return savePdf(out);
}

export interface PageSpec {
  /** index into `sources`, or -1 for a blank page */
  source: number;
  page: number;
  /** extra rotation to add, in degrees */
  rotation: number;
}

/** Assemble a new PDF from pages of one or more sources (organize/reorder/rotate/delete/extract). */
export async function assemblePages(sources: File[], specs: PageSpec[]): Promise<Blob> {
  const docs = await Promise.all(sources.map((f) => loadPdf(f)));
  const out = await PDFDocument.create();
  const first = docs[0]?.getPage(0)?.getSize() ?? { width: 595.28, height: 841.89 };
  const cache = new Map<number, PDFPage[]>();
  for (let s = 0; s < docs.length; s++) {
    const needed = specs.some((p) => p.source === s);
    if (needed) cache.set(s, await out.copyPages(docs[s], docs[s].getPageIndices()));
  }
  // copyPages returns fresh copies; duplicated pages need their own copy
  const used = new Set<PDFPage>();
  for (const spec of specs) {
    let page: PDFPage;
    if (spec.source < 0) {
      page = out.addPage([first.width, first.height]);
    } else {
      let p = cache.get(spec.source)![spec.page];
      if (used.has(p)) [p] = await out.copyPages(docs[spec.source], [spec.page]);
      used.add(p);
      page = out.addPage(p);
    }
    if (spec.rotation) page.setRotation(degrees((page.getRotation().angle + spec.rotation + 360) % 360));
  }
  if (!specs.length) throw new PdfError("The document must keep at least one page.");
  const title = docs[0]?.getTitle();
  if (title) out.setTitle(title);
  return savePdf(out);
}

export async function splitPdf(file: File, groups: number[][]): Promise<Blob[]> {
  const src = await loadPdf(file);
  const outs: Blob[] = [];
  for (const g of groups) {
    const doc = await PDFDocument.create();
    const pages = await doc.copyPages(src, g);
    pages.forEach((p) => doc.addPage(p));
    outs.push(await savePdf(doc));
  }
  return outs;
}

// ── Watermark ────────────────────────────────────────────────────────

export type Position = "tl" | "tc" | "tr" | "ml" | "mc" | "mr" | "bl" | "bc" | "br";

export interface WatermarkOptions {
  kind: "text" | "image";
  text: string;
  fontSize: number;
  bold: boolean;
  color: string;
  image?: File | null;
  imageScale: number; // fraction of page width
  opacity: number; // 0..1
  rotation: number; // degrees, counter-clockwise visual
  position: Position;
  tile: boolean;
  pages?: number[]; // zero-based; undefined = all
}

function anchor(pos: Position, vw: number, vh: number, w: number, h: number, margin: number) {
  const col = pos[1] === "l" ? 0 : pos[1] === "c" ? 1 : 2;
  const row = pos[0] === "t" ? 0 : pos[0] === "m" ? 1 : 2;
  const cx = [margin + w / 2, vw / 2, vw - margin - w / 2][col];
  const cy = [vh - margin - h / 2, vh / 2, margin + h / 2][row];
  return { cx, cy };
}

export async function applyWatermark(doc: PDFDocument, o: WatermarkOptions): Promise<void> {
  const [r, g, b] = hexToRgb01(o.color);
  const font = o.kind === "text" ? await fontFor(doc, o.text, o.bold) : null;
  const img = o.kind === "image" && o.image ? await embedImage(doc, o.image, o.image.name) : null;
  if (o.kind === "text" && !o.text.trim()) throw new PdfError("Enter the watermark text.");
  if (o.kind === "image" && !img) throw new PdfError("Choose an image for the watermark.");

  doc.getPages().forEach((page, idx) => {
    if (o.pages && !o.pages.includes(idx)) return;
    const f = pageFrame(page);
    let w: number, h: number;
    if (font) {
      w = font.widthOfTextAtSize(o.text, o.fontSize);
      h = font.heightAtSize(o.fontSize, { descender: false });
    } else {
      w = f.vw * o.imageScale;
      h = (img!.height / img!.width) * w;
    }
    const centers: { cx: number; cy: number }[] = [];
    if (o.tile) {
      const stepX = Math.max(w * 0.9, 80) + 60;
      const stepY = Math.max(h * 3, 60) + 40;
      for (let y = stepY / 2; y < f.vh + stepY; y += stepY)
        for (let x = (Math.round(y / stepY) % 2 ? stepX / 2 : 0); x < f.vw + stepX; x += stepX) centers.push({ cx: x, cy: y });
    } else {
      centers.push(anchor(o.position, f.vw, f.vh, w, h, 36));
    }
    for (const { cx, cy } of centers) {
      // bottom-left of the rotated box, in visual space
      const off = rotateVec(-w / 2, -h / 2, o.rotation);
      const p = f.toUser(cx + off.x, cy + off.y);
      const rot = degrees(f.rotation + o.rotation);
      if (font) {
        page.drawText(o.text, { x: p.x, y: p.y, size: o.fontSize, font, color: rgb(r, g, b), opacity: o.opacity, rotate: rot });
      } else {
        page.drawImage(img!, { x: p.x, y: p.y, width: w, height: h, opacity: o.opacity, rotate: rot });
      }
    }
  });
}

// ── Page numbers ─────────────────────────────────────────────────────

export interface PageNumberOptions {
  position: Position;
  format: string; // uses {n} and {total}
  start: number;
  fontSize: number;
  margin: number;
  color: string;
  skipFirst: boolean;
}

export async function applyPageNumbers(doc: PDFDocument, o: PageNumberOptions): Promise<void> {
  const pages = doc.getPages();
  const counted = o.skipFirst ? pages.length - 1 : pages.length;
  const total = counted + o.start - 1;
  const sample = o.format.replace("{n}", String(total)).replace("{total}", String(total));
  const font = await fontFor(doc, sample);
  const [r, g, b] = hexToRgb01(o.color);
  pages.forEach((page, i) => {
    if (o.skipFirst && i === 0) return;
    const n = (o.skipFirst ? i : i + 1) + o.start - 1;
    const label = o.format.replaceAll("{n}", String(n)).replaceAll("{total}", String(total));
    const f = pageFrame(page);
    const w = font.widthOfTextAtSize(label, o.fontSize);
    const h = font.heightAtSize(o.fontSize, { descender: false });
    const { cx, cy } = anchor(o.position, f.vw, f.vh, w, h, o.margin);
    const p = f.toUser(cx - w / 2, cy - h / 2);
    page.drawText(label, { x: p.x, y: p.y, size: o.fontSize, font, color: rgb(r, g, b), rotate: degrees(f.rotation) });
  });
}

// ── Images → PDF ─────────────────────────────────────────────────────

export interface ImagesToPdfOptions {
  pageSize: "fit" | "a4" | "letter";
  orientation: "auto" | "portrait" | "landscape";
  margin: number; // points
}

const SIZES = { a4: [595.28, 841.89], letter: [612, 792] } as const;

export async function imagesToPdf(files: File[], o: ImagesToPdfOptions, onProgress?: (p: number) => void): Promise<Blob> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < files.length; i++) {
    const img = await embedImage(doc, files[i], files[i].name);
    let pw: number, ph: number;
    if (o.pageSize === "fit") {
      pw = img.width * 0.75 + o.margin * 2; // 96 dpi px → pt
      ph = img.height * 0.75 + o.margin * 2;
    } else {
      [pw, ph] = SIZES[o.pageSize];
      const landscape = o.orientation === "landscape" || (o.orientation === "auto" && img.width > img.height);
      if (landscape) [pw, ph] = [ph, pw];
    }
    const page = doc.addPage([pw, ph]);
    const maxW = pw - o.margin * 2;
    const maxH = ph - o.margin * 2;
    const s = Math.min(maxW / img.width, maxH / img.height);
    const w = img.width * s;
    const h = img.height * s;
    page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    onProgress?.((i + 1) / files.length);
  }
  doc.setTitle(files[0]?.name.replace(/\.[^.]+$/, "") ?? "Images");
  return savePdf(doc);
}

// ── Metadata ─────────────────────────────────────────────────────────

export interface PdfMeta {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
  creationDate: string;
  modificationDate: string;
}

function dateStr(d?: Date) {
  return d && !isNaN(d.getTime()) ? d.toISOString().slice(0, 16) : "";
}

export function readMeta(doc: PDFDocument): PdfMeta {
  return {
    title: doc.getTitle() ?? "",
    author: doc.getAuthor() ?? "",
    subject: doc.getSubject() ?? "",
    keywords: doc.getKeywords() ?? "",
    creator: doc.getCreator() ?? "",
    producer: doc.getProducer() ?? "",
    creationDate: dateStr(doc.getCreationDate()),
    modificationDate: dateStr(doc.getModificationDate()),
  };
}

export async function writeMeta(doc: PDFDocument, m: PdfMeta): Promise<Blob> {
  doc.setTitle(m.title);
  doc.setAuthor(m.author);
  doc.setSubject(m.subject);
  doc.setKeywords(m.keywords ? m.keywords.split(/\s*[,;]\s*/).filter(Boolean) : []);
  doc.setCreator(m.creator);
  doc.setProducer(m.producer);
  if (m.creationDate) doc.setCreationDate(new Date(m.creationDate));
  doc.setModificationDate(m.modificationDate ? new Date(m.modificationDate) : new Date());
  // Drop XMP metadata so readers don't show stale values that contradict the Info dictionary.
  doc.catalog.delete(PDFName.of("Metadata"));
  return pdfBlob(await doc.save({ useObjectStreams: true }));
}

// ── Editor export ────────────────────────────────────────────────────

export type EditorObject =
  | { id: string; type: "text"; page: number; x: number; y: number; w: number; h: number; text: string; size: number; color: string; bold: boolean }
  | { id: string; type: "image"; page: number; x: number; y: number; w: number; h: number; src: Blob; url: string; ratio: number; label?: string }
  | { id: string; type: "rect" | "ellipse" | "highlight" | "redact"; page: number; x: number; y: number; w: number; h: number; stroke: string; fill: string | null; width: number; opacity: number }
  | { id: string; type: "line" | "arrow" | "underline"; page: number; x: number; y: number; w: number; h: number; x2: number; y2: number; x1: number; y1: number; stroke: string; width: number }
  | { id: string; type: "ink"; page: number; x: number; y: number; w: number; h: number; points: [number, number][]; stroke: string; width: number }
  | { id: string; type: "note"; page: number; x: number; y: number; w: number; h: number; text: string; author: string };

/**
 * Burn editor objects into the PDF. Coordinates are visual-space points with
 * the origin at the TOP-LEFT of the page (as on screen).
 */
export async function applyEditorObjects(doc: PDFDocument, objects: EditorObject[]): Promise<void> {
  const pages = doc.getPages();
  for (const o of objects) {
    const page = pages[o.page];
    if (!page) continue;
    const f = pageFrame(page);
    const rot = degrees(f.rotation);
    const bl = (x: number, yTop: number, h: number) => f.toUser(x, f.vh - yTop - h); // bottom-left of a box
    const pt = (x: number, yTop: number) => f.toUser(x, f.vh - yTop);
    switch (o.type) {
      case "text": {
        const font = await fontFor(doc, o.text, o.bold);
        const lines = o.text.split("\n");
        const lh = o.size * 1.25;
        const [r, g, b] = hexToRgb01(o.color);
        lines.forEach((line, i) => {
          // baseline of line i, measured from the top of the box
          const p = pt(o.x, o.y + o.size * 0.92 + i * lh);
          page.drawText(line, { x: p.x, y: p.y, size: o.size, font, color: rgb(r, g, b), rotate: rot });
        });
        break;
      }
      case "image": {
        const img = await embedImage(doc, o.src, o.label);
        const p = bl(o.x, o.y, o.h);
        page.drawImage(img, { x: p.x, y: p.y, width: o.w, height: o.h, rotate: rot });
        break;
      }
      case "rect":
      case "highlight":
      case "redact": {
        const p = bl(o.x, o.y, o.h);
        const fill = o.fill ? hexToRgb01(o.fill) : null;
        const [sr, sg, sb] = hexToRgb01(o.stroke);
        page.drawRectangle({
          x: p.x, y: p.y, width: o.w, height: o.h, rotate: rot,
          color: fill ? rgb(fill[0], fill[1], fill[2]) : undefined,
          opacity: fill ? o.opacity : undefined,
          borderColor: o.type === "rect" && o.width > 0 ? rgb(sr, sg, sb) : undefined,
          borderWidth: o.type === "rect" ? o.width : 0,
          blendMode: o.type === "highlight" ? BlendMode.Multiply : undefined,
        });
        break;
      }
      case "ellipse": {
        const c = pt(o.x + o.w / 2, o.y + o.h / 2);
        const swap = f.rotation % 180 !== 0;
        const fill = o.fill ? hexToRgb01(o.fill) : null;
        const [sr, sg, sb] = hexToRgb01(o.stroke);
        page.drawEllipse({
          x: c.x, y: c.y,
          xScale: (swap ? o.h : o.w) / 2, yScale: (swap ? o.w : o.h) / 2,
          color: fill ? rgb(fill[0], fill[1], fill[2]) : undefined,
          opacity: fill ? o.opacity : undefined,
          borderColor: o.width > 0 ? rgb(sr, sg, sb) : undefined,
          borderWidth: o.width,
        });
        break;
      }
      case "line":
      case "underline":
      case "arrow": {
        const [r, g, b] = hexToRgb01(o.stroke);
        const a = pt(o.x1, o.y1);
        const z = pt(o.x2, o.y2);
        page.drawLine({ start: a, end: z, thickness: o.width, color: rgb(r, g, b), lineCap: 1 });
        if (o.type === "arrow") {
          const ang = Math.atan2(z.y - a.y, z.x - a.x);
          const len = Math.max(8, o.width * 4);
          for (const d of [Math.PI * 0.85, -Math.PI * 0.85]) {
            page.drawLine({
              start: z,
              end: { x: z.x + len * Math.cos(ang + d), y: z.y + len * Math.sin(ang + d) },
              thickness: o.width, color: rgb(r, g, b), lineCap: 1,
            });
          }
        }
        break;
      }
      case "ink": {
        if (o.points.length < 2) break;
        const [r, g, b] = hexToRgb01(o.stroke);
        const d = o.points.map(([x, y], i) => {
          const p = pt(x, y);
          return `${i ? "L" : "M"}${p.x.toFixed(2)} ${(-p.y).toFixed(2)}`;
        }).join(" ");
        page.drawSvgPath(d, { x: 0, y: 0, borderColor: rgb(r, g, b), borderWidth: o.width, borderLineCap: 1 });
        break;
      }
      case "note": {
        // A real PDF sticky-note annotation, editable in any PDF reader.
        const p = bl(o.x, o.y, 22);
        const annot = doc.context.obj({
          Type: "Annot",
          Subtype: "Text",
          Rect: [p.x, p.y, p.x + 22, p.y + 22],
          Contents: PDFHexString.fromText(o.text),
          T: PDFHexString.fromText(o.author || "feelfreedoc"),
          Name: "Comment",
          C: [1, 0.84, 0.25],
          F: 4,
          Open: false,
          M: PDFHexString.fromText(new Date().toISOString()),
        });
        page.node.addAnnot(doc.context.register(annot));
        break;
      }
    }
  }
}

export function isPdfName(name: string) {
  return extOf(name) === ".pdf";
}
