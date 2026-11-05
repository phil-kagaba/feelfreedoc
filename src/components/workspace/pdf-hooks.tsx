"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { FileText, LoaderCircle } from "lucide-react";
import { openPdf, renderThumb } from "@/lib/pdfjs";
import { cn, errorMessage, extOf } from "@/lib/utils";

const docCache = new WeakMap<File, Promise<PDFDocumentProxy>>();

export function getDoc(file: File): Promise<PDFDocumentProxy> {
  let p = docCache.get(file);
  if (!p) {
    p = openPdf(file);
    docCache.set(file, p);
    p.catch(() => docCache.delete(file));
  }
  return p;
}

export function usePdfDoc(file: File | null | undefined) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setDoc(null);
    setError(null);
    if (!file || extOf(file.name) !== ".pdf") return;
    getDoc(file).then(
      (d) => alive && setDoc(d),
      (e) => alive && setError(errorMessage(e)),
    );
    return () => {
      alive = false;
    };
  }, [file]);
  return { doc, error, numPages: doc?.numPages ?? 0 };
}

const thumbCache = new Map<string, string>();
let renderQueue: Promise<unknown> = Promise.resolve();

/** Lazily rendered page thumbnail. Rotation is applied with CSS. */
export function PageThumb({
  doc, docKey, index, rotation = 0, width = 160, className,
}: {
  doc: PDFDocumentProxy | null;
  docKey: string;
  index: number;
  rotation?: number;
  width?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const key = `${docKey}:${index}:${width}`;
  const [src, setSrc] = useState<string | null>(thumbCache.get(key) ?? null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setVisible(true), { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!doc || !visible || src) return;
    let alive = true;
    // Serialize rendering so many thumbnails don't starve the main thread.
    renderQueue = renderQueue.then(async () => {
      if (!alive) return;
      try {
        const url = await renderThumb(doc, index, width);
        thumbCache.set(key, url);
        if (alive) setSrc(url);
      } catch {
        /* ignore failed thumbnail */
      }
    });
    return () => {
      alive = false;
    };
  }, [doc, visible, src, index, width, key]);

  return (
    <div ref={ref} className={cn("relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-lg bg-surface-2", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`Page ${index + 1}`}
          className="max-h-full max-w-full object-contain shadow-sm transition-transform duration-300"
          style={{ transform: `rotate(${rotation}deg)`, ...(rotation % 180 ? { maxWidth: "75%", maxHeight: "75%" } : {}) }}
          draggable={false}
        />
      ) : (
        <LoaderCircle className="h-5 w-5 animate-spin text-muted" />
      )}
    </div>
  );
}

/** Thumbnail for an uploaded file: first page of a PDF, the image itself, or an icon. */
export function FileThumb({ file, className }: { file: File; className?: string }) {
  const ext = extOf(file.name);
  const { doc, error } = usePdfDoc(ext === ".pdf" ? file : null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  useEffect(() => {
    if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) return;
    const u = URL.createObjectURL(file);
    setImgUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file, ext]);

  if (imgUrl) {
    return (
      <div className={cn("flex aspect-[3/4] items-center justify-center overflow-hidden rounded-lg bg-surface-2", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imgUrl} alt="" className="max-h-full max-w-full object-contain" draggable={false} />
      </div>
    );
  }
  if (ext === ".pdf" && !error) {
    return <PageThumb doc={doc} docKey={`${file.name}:${file.size}:${file.lastModified}`} index={0} className={className} />;
  }
  return (
    <div className={cn("flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-lg bg-surface-2 text-muted", className)}>
      <FileText className="h-8 w-8" strokeWidth={1.5} />
      <span className="text-xs font-semibold uppercase">{ext.slice(1)}</span>
      {error && <span className="px-2 text-center text-[10px] text-danger">Can&apos;t preview</span>}
    </div>
  );
}

export function fileKey(f: File) {
  return `${f.name}:${f.size}:${f.lastModified}`;
}
