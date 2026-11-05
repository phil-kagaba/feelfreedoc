"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";

type PdfJs = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfJs> | null = null;

export function getPdfjs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((m) => {
      m.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return m;
    });
  }
  return pdfjsPromise;
}

export class PdfOpenError extends Error {}

/** Open a PDF with PDF.js. Data is copied because PDF.js transfers the buffer to its worker. */
export async function openPdf(data: ArrayBuffer | Uint8Array | File, password?: string): Promise<PDFDocumentProxy> {
  const pdfjs = await getPdfjs();
  const bytes = data instanceof File ? new Uint8Array(await data.arrayBuffer()) : new Uint8Array(data).slice();
  try {
    return await pdfjs.getDocument({ data: bytes, password }).promise;
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (name === "PasswordException") {
      throw new PdfOpenError("This PDF is password-protected. Remove the password with Unlock PDF first.");
    }
    if (name === "InvalidPDFException") {
      throw new PdfOpenError("This file is not a valid PDF or is damaged. Try Repair PDF.");
    }
    throw new PdfOpenError("Could not open this PDF. It may be damaged — try Repair PDF.");
  }
}

/** Render one page (0-based) into a new canvas. `scale` is relative to 72 dpi. */
export async function renderPageToCanvas(doc: PDFDocumentProxy, index: number, scale: number, rotation = 0): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(index + 1);
  const viewport = page.getViewport({ scale, rotation: (page.rotate + rotation) % 360 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  page.cleanup();
  return canvas;
}

/** Render a page so that its width is `targetWidth` CSS pixels (hi-dpi aware). */
export async function renderThumb(doc: PDFDocumentProxy, index: number, targetWidth: number, rotation = 0): Promise<string> {
  const page = await doc.getPage(index + 1);
  const base = page.getViewport({ scale: 1, rotation: (page.rotate + rotation) % 360 });
  const scale = (targetWidth * Math.min(window.devicePixelRatio || 1, 2)) / base.width;
  const canvas = await renderPageToCanvas(doc, index, scale, rotation);
  const url = canvas.toDataURL("image/jpeg", 0.82);
  canvas.width = canvas.height = 0;
  return url;
}

export interface PageText {
  page: number;
  text: string;
}

/** Extract text page by page, rebuilding line breaks from item positions. */
export async function extractText(doc: PDFDocumentProxy, onProgress?: (p: number) => void): Promise<PageText[]> {
  const out: PageText[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    let line = "";
    const lines: string[] = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        lines.push(line.trimEnd());
        line = "";
      }
      line += item.str;
      if (item.hasEOL) {
        lines.push(line.trimEnd());
        line = "";
        lastY = null;
        continue;
      }
      lastY = y;
    }
    if (line) lines.push(line.trimEnd());
    out.push({ page: i, text: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() });
    page.cleanup();
    onProgress?.(i / doc.numPages);
  }
  return out;
}
