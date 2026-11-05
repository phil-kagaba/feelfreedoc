"use client";

import { useEffect, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import {
  applyPageNumbers, applyWatermark, loadPdf, savePdf,
  type PageNumberOptions, type Position, type WatermarkOptions,
} from "@/lib/pdf-ops";
import { openPdf, renderThumb } from "@/lib/pdfjs";
import type { ToolDef } from "@/lib/tools";
import { baseName, cn, errorMessage, parseRanges } from "@/lib/utils";
import { Alert, PanelTitle, ProcessButton, RangeField, ResultView, Segmented, SelectField, Toggle, UploadStage, Workspace } from "../workspace/ui";
import { useToolState } from "../workspace/use-tool-state";

type Apply = (doc: PDFDocument, pageIndex: number) => Promise<void>;

/** Renders the real output for a single page so the preview is exactly what you'll get. */
function LivePreview({ file, apply, deps }: { file: File; apply: Apply; deps: unknown[] }) {
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(0);
  const [img, setImg] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const src = useRef<PDFDocument | null>(null);
  const applyRef = useRef(apply);
  useEffect(() => {
    applyRef.current = apply;
  });

  useEffect(() => {
    let alive = true;
    loadPdf(file).then(
      (d) => {
        if (!alive) return;
        src.current = d;
        setCount(d.getPageCount());
      },
      (e) => alive && setErr(errorMessage(e)),
    );
    return () => {
      alive = false;
    };
  }, [file]);

  useEffect(() => {
    if (!count || !src.current) return;
    let alive = true;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const one = await PDFDocument.create();
        const [p] = await one.copyPages(src.current!, [page]);
        one.addPage(p);
        await applyRef.current(one, page);
        const bytes = await (await savePdf(one)).arrayBuffer();
        const d = await openPdf(bytes);
        const url = await renderThumb(d, 0, 520);
        await d.loadingTask.destroy();
        if (alive) {
          setImg(url);
          setErr(null);
        }
      } catch (e) {
        if (alive) setErr(errorMessage(e));
      } finally {
        if (alive) setBusy(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, page, ...deps]);

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">Live preview</span>
        {count > 1 && (
          <span className="flex items-center gap-1 text-sm text-muted">
            <button type="button" className="rounded-md p-1.5 hover:bg-brand-soft disabled:opacity-40" onClick={() => setPage((p) => p - 1)} disabled={page === 0} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
            Page {page + 1} / {count}
            <button type="button" className="rounded-md p-1.5 hover:bg-brand-soft disabled:opacity-40" onClick={() => setPage((p) => p + 1)} disabled={page >= count - 1} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
          </span>
        )}
      </div>
      {err && <Alert>{err}</Alert>}
      <div className="checker relative flex min-h-80 items-center justify-center rounded-xl p-4">
        {img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="Preview of the result" className={cn("max-h-[70vh] max-w-full rounded shadow-lift transition-opacity", busy && "opacity-60")} />
        )}
        {busy && <LoaderCircle className="absolute h-6 w-6 animate-spin text-muted" />}
      </div>
    </div>
  );
}

const POSITIONS: Position[] = ["tl", "tc", "tr", "ml", "mc", "mr", "bl", "bc", "br"];

function PositionGrid({ value, onChange, allowMiddle = true }: { value: Position; onChange: (p: Position) => void; allowMiddle?: boolean }) {
  return (
    <div>
      <span className="label">Position</span>
      <div className="grid w-32 grid-cols-3 gap-1.5 rounded-xl border border-line p-2">
        {POSITIONS.map((p) => {
          const disabled = !allowMiddle && p[0] === "m";
          return (
            <button
              key={p}
              type="button"
              disabled={disabled}
              onClick={() => onChange(p)}
              aria-label={`Position ${p}`}
              aria-pressed={value === p}
              className={cn("h-8 rounded-md border transition disabled:opacity-20", value === p ? "border-brand-ink bg-brand" : "border-line hover:bg-brand-soft")}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function StampTool({ tool }: { tool: ToolDef }) {
  const s = useToolState(tool);
  const file = s.files[0]?.file;
  const isWatermark = tool.slug === "watermark-pdf";

  const [wm, setWm] = useState<WatermarkOptions>({
    kind: "text", text: "CONFIDENTIAL", fontSize: 54, bold: true, color: "#dc2626", image: null,
    imageScale: 0.4, opacity: 0.25, rotation: 45, position: "mc", tile: false,
  });
  const [wmPages, setWmPages] = useState("");
  const [pn, setPn] = useState<PageNumberOptions>({
    position: "bc", format: "Page {n} of {total}", start: 1, fontSize: 11, margin: 28, color: "#171717", skipFirst: false,
  });

  if (s.result) return <ResultView state={s} />;
  if (!file) return <UploadStage state={s} />;

  const applyWm: Apply = async (doc) => applyWatermark(doc, { ...wm, pages: undefined });
  // Page numbers depend on total pages; for preview, emulate with the real total.
  const applyPn: Apply = async (doc, idx) => {
    const src = await loadPdf(file);
    const total = src.getPageCount();
    const n = (pn.skipFirst ? idx : idx + 1) + pn.start - 1;
    const totalNumbered = (pn.skipFirst ? total - 1 : total) + pn.start - 1;
    if (pn.skipFirst && idx === 0) return;
    await applyPageNumbers(doc, {
      ...pn,
      skipFirst: false,
      start: n,
      format: pn.format.replaceAll("{total}", String(totalNumbered)),
    });
  };

  async function run() {
    await s.run(async (progress) => {
      progress(null, isWatermark ? "Adding watermark…" : "Numbering pages…");
      const doc = await loadPdf(file);
      if (isWatermark) {
        const pages = wmPages.trim() ? parseRanges(wmPages, doc.getPageCount()).flat() : undefined;
        await applyWatermark(doc, { ...wm, pages });
      } else {
        await applyPageNumbers(doc, pn);
      }
      const blob = await savePdf(doc);
      return { outputs: [{ blob, name: `${baseName(file.name)}-${isWatermark ? "watermarked" : "numbered"}.pdf` }] };
    });
  }

  const side = isWatermark ? (
    <>
      <PanelTitle>Watermark</PanelTitle>
      <Segmented value={wm.kind} onChange={(v) => setWm({ ...wm, kind: v })} options={[{ value: "text", label: "Text" }, { value: "image", label: "Image" }]} />
      {wm.kind === "text" ? (
        <>
          <label className="block">
            <span className="label">Text</span>
            <input className="input" value={wm.text} onChange={(e) => setWm({ ...wm, text: e.target.value })} maxLength={120} />
          </label>
          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <RangeField label="Font size" value={wm.fontSize} onChange={(v) => setWm({ ...wm, fontSize: v })} min={8} max={160} suffix="pt" />
            <input type="color" value={wm.color} onChange={(e) => setWm({ ...wm, color: e.target.value })} className="h-11 w-12 cursor-pointer rounded-xl border border-line bg-surface p-1" aria-label="Text color" />
          </div>
          <Toggle checked={wm.bold} onChange={(v) => setWm({ ...wm, bold: v })} label="Bold" />
        </>
      ) : (
        <>
          <label className="block">
            <span className="label">Image (PNG or JPG)</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" className="input file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-1 file:text-sm" onChange={(e) => setWm({ ...wm, image: e.target.files?.[0] ?? null })} />
          </label>
          <RangeField label="Width" value={Math.round(wm.imageScale * 100)} onChange={(v) => setWm({ ...wm, imageScale: v / 100 })} min={5} max={100} suffix="% of page" />
        </>
      )}
      <RangeField label="Opacity" value={Math.round(wm.opacity * 100)} onChange={(v) => setWm({ ...wm, opacity: v / 100 })} min={5} max={100} suffix="%" />
      <RangeField label="Rotation" value={wm.rotation} onChange={(v) => setWm({ ...wm, rotation: v })} min={-90} max={90} suffix="°" />
      <Toggle checked={wm.tile} onChange={(v) => setWm({ ...wm, tile: v })} label="Tile across page" sub="Repeat the watermark in a grid" />
      {!wm.tile && <PositionGrid value={wm.position} onChange={(p) => setWm({ ...wm, position: p })} />}
      <label className="block">
        <span className="label">Pages (optional)</span>
        <input className="input" value={wmPages} onChange={(e) => setWmPages(e.target.value)} placeholder="All pages, or e.g. 1-3" />
      </label>
      <ProcessButton state={s} onClick={() => void run()} disabled={wm.kind === "image" && !wm.image} />
    </>
  ) : (
    <>
      <PanelTitle>Page numbers</PanelTitle>
      <PositionGrid value={pn.position} onChange={(p) => setPn({ ...pn, position: p })} allowMiddle={false} />
      <SelectField
        label="Format"
        value={pn.format}
        onChange={(v) => setPn({ ...pn, format: v })}
        options={[
          { value: "{n}", label: "1" },
          { value: "Page {n}", label: "Page 1" },
          { value: "Page {n} of {total}", label: "Page 1 of 10" },
          { value: "{n} / {total}", label: "1 / 10" },
          { value: "- {n} -", label: "- 1 -" },
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Start at</span>
          <input type="number" min={0} className="input" value={pn.start} onChange={(e) => setPn({ ...pn, start: Math.max(0, Number(e.target.value)) })} />
        </label>
        <label className="block">
          <span className="label">Color</span>
          <input type="color" value={pn.color} onChange={(e) => setPn({ ...pn, color: e.target.value })} className="h-11 w-full cursor-pointer rounded-xl border border-line bg-surface p-1" />
        </label>
      </div>
      <RangeField label="Font size" value={pn.fontSize} onChange={(v) => setPn({ ...pn, fontSize: v })} min={6} max={36} suffix="pt" />
      <RangeField label="Margin" value={pn.margin} onChange={(v) => setPn({ ...pn, margin: v })} min={8} max={72} suffix="pt" />
      <Toggle checked={pn.skipFirst} onChange={(v) => setPn({ ...pn, skipFirst: v })} label="Skip first page" sub="Useful for cover pages" />
      <ProcessButton state={s} onClick={() => void run()} />
    </>
  );

  return (
    <Workspace
      state={s}
      main={
        <>
          <div className="flex items-center justify-between">
            <p className="truncate text-sm text-muted"><strong className="text-ink">{file.name}</strong></p>
            <button type="button" className="chip" onClick={s.reset}>Change file</button>
          </div>
          <LivePreview file={file} apply={isWatermark ? applyWm : applyPn} deps={isWatermark ? [JSON.stringify({ ...wm, image: wm.image?.name }), wm.image] : [JSON.stringify(pn)]} />
        </>
      }
      side={side}
    />
  );
}
