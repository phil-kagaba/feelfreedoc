"use client";

import { useState } from "react";
import { imagesToPdf, type ImagesToPdfOptions } from "@/lib/pdf-ops";
import { extractText, renderPageToCanvas } from "@/lib/pdfjs";
import type { ToolDef } from "@/lib/tools";
import { baseName, formatBytes, parseRanges } from "@/lib/utils";
import { FileGrid } from "../workspace/file-grid";
import { getDoc, usePdfDoc } from "../workspace/pdf-hooks";
import { Alert, PanelTitle, ProcessButton, RangeField, ResultView, Segmented, Toggle, UploadStage, Workspace } from "../workspace/ui";
import { useToolState } from "../workspace/use-tool-state";

// ── PDF → JPG / PNG ─────────────────────────────────────────────────

export function PdfToImagesTool({ tool }: { tool: ToolDef }) {
  const s = useToolState(tool);
  const png = tool.slug === "pdf-to-png";
  const [dpi, setDpi] = useState("150");
  const [quality, setQuality] = useState(85);
  const [pages, setPages] = useState("");
  const file = s.files[0]?.file;
  const { numPages, error } = usePdfDoc(file);

  if (s.result) return <ResultView state={s} />;
  if (!file) return <UploadStage state={s} />;

  return (
    <Workspace
      state={s}
      main={
        <>
          {error && <Alert>{error}</Alert>}
          <FileGrid state={s} sortable={false} />
        </>
      }
      side={
        <>
          <PanelTitle sub={numPages ? `${numPages} page${numPages > 1 ? "s" : ""} detected` : "Reading document…"}>Image options</PanelTitle>
          <Segmented
            label="Resolution"
            value={dpi}
            onChange={setDpi}
            options={[
              { value: "72", label: "72 DPI", sub: "Screen" },
              { value: "150", label: "150 DPI", sub: "Balanced" },
              { value: "300", label: "300 DPI", sub: "Print" },
            ]}
          />
          {!png && <RangeField label="JPG quality" value={quality} onChange={setQuality} min={40} max={100} suffix="%" />}
          <label className="block">
            <span className="label">Pages (optional)</span>
            <input className="input" value={pages} onChange={(e) => setPages(e.target.value)} placeholder={`All pages, or e.g. 1-3, 5`} />
          </label>
          <ProcessButton
            state={s}
            disabled={!numPages}
            onClick={() =>
              s.run(async (progress) => {
                const doc = await getDoc(file);
                const list = pages.trim() ? parseRanges(pages, doc.numPages).flat() : Array.from({ length: doc.numPages }, (_, i) => i);
                const scale = Number(dpi) / 72;
                const outputs = [];
                const name = baseName(file.name);
                for (let k = 0; k < list.length; k++) {
                  progress(k / list.length, `Rendering page ${k + 1} of ${list.length}`);
                  const canvas = await renderPageToCanvas(doc, list[k], scale);
                  const blob = await new Promise<Blob>((res, rej) =>
                    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Image encoding failed — try a lower resolution."))), png ? "image/png" : "image/jpeg", quality / 100),
                  );
                  canvas.width = canvas.height = 0;
                  outputs.push({ blob, name: `${name}-page-${list[k] + 1}.${png ? "png" : "jpg"}` });
                }
                return {
                  outputs,
                  zipName: `${name}-${png ? "png" : "jpg"}.zip`,
                  stats: [
                    { label: "Images", value: String(outputs.length), highlight: true },
                    { label: "Resolution", value: `${dpi} DPI` },
                  ],
                };
              })
            }
          />
        </>
      }
    />
  );
}

// ── Images → PDF ────────────────────────────────────────────────────

export function ImagesToPdfTool({ tool }: { tool: ToolDef }) {
  const s = useToolState(tool);
  const [opts, setOpts] = useState<ImagesToPdfOptions>({ pageSize: "a4", orientation: "auto", margin: 18 });

  if (s.result) return <ResultView state={s} />;
  if (!s.files.length) return <UploadStage state={s} hint="JPG, PNG or WebP images" />;

  return (
    <Workspace
      state={s}
      main={<FileGrid state={s} />}
      side={
        <>
          <PanelTitle sub="Each image becomes one page, in the order shown.">PDF options</PanelTitle>
          <Segmented
            label="Page size"
            value={opts.pageSize}
            onChange={(v) => setOpts({ ...opts, pageSize: v })}
            options={[
              { value: "fit", label: "Fit image" },
              { value: "a4", label: "A4" },
              { value: "letter", label: "Letter" },
            ]}
          />
          {opts.pageSize !== "fit" && (
            <Segmented
              label="Orientation"
              value={opts.orientation}
              onChange={(v) => setOpts({ ...opts, orientation: v })}
              options={[
                { value: "auto", label: "Auto" },
                { value: "portrait", label: "Portrait" },
                { value: "landscape", label: "Landscape" },
              ]}
            />
          )}
          <Segmented
            label="Margin"
            value={String(opts.margin)}
            onChange={(v) => setOpts({ ...opts, margin: Number(v) })}
            options={[
              { value: "0", label: "None" },
              { value: "18", label: "Small" },
              { value: "40", label: "Large" },
            ]}
          />
          <ProcessButton
            state={s}
            onClick={() =>
              s.run(async (progress) => {
                const blob = await imagesToPdf(s.files.map((f) => f.file), opts, (p) => progress(p, `Adding images ${Math.round(p * 100)}%`));
                return {
                  outputs: [{ blob, name: `${baseName(s.files[0].file.name)}.pdf` }],
                  stats: [
                    { label: "Pages", value: String(s.files.length) },
                    { label: "Size", value: formatBytes(blob.size), highlight: true },
                  ],
                };
              })
            }
          />
        </>
      }
    />
  );
}

// ── PDF → Text ──────────────────────────────────────────────────────

export function PdfToTextTool({ tool }: { tool: ToolDef }) {
  const s = useToolState(tool);
  const [markers, setMarkers] = useState(true);
  const file = s.files[0]?.file;
  const { numPages, error } = usePdfDoc(file);

  if (s.result) return <ResultView state={s} />;
  if (!file) return <UploadStage state={s} />;

  return (
    <Workspace
      state={s}
      main={
        <>
          {error && <Alert>{error}</Alert>}
          <FileGrid state={s} sortable={false} />
        </>
      }
      side={
        <>
          <PanelTitle sub={numPages ? `${numPages} pages` : "Reading document…"}>Text options</PanelTitle>
          <Toggle checked={markers} onChange={setMarkers} label="Page markers" sub="Insert “— Page N —” between pages" />
          <ProcessButton
            state={s}
            disabled={!numPages}
            onClick={() =>
              s.run(async (progress) => {
                const doc = await getDoc(file);
                const pages = await extractText(doc, (p) => progress(p, `Reading page ${Math.ceil(p * doc.numPages)} of ${doc.numPages}`));
                const chars = pages.reduce((n, p) => n + p.text.length, 0);
                const text = pages.map((p) => (markers ? `— Page ${p.page} —\n\n${p.text}` : p.text)).join("\n\n");
                const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
                const preview = text.slice(0, 4000);
                return {
                  outputs: [{ blob, name: `${baseName(file.name)}.txt` }],
                  stats: [
                    { label: "Pages", value: String(pages.length) },
                    { label: "Characters", value: chars.toLocaleString(), highlight: true },
                  ],
                  message:
                    chars < 20 * pages.length
                      ? "Very little text was found — this looks like a scanned document. Run OCR PDF first to make the text extractable."
                      : undefined,
                  extra: (
                    <div className="card p-5">
                      <h3 className="mb-3 text-sm font-semibold text-ink">Preview</h3>
                      <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-surface-2 p-4 font-mono text-xs leading-5 text-ink">{preview || "(no text found)"}{text.length > 4000 ? "\n…" : ""}</pre>
                    </div>
                  ),
                };
              })
            }
          />
        </>
      }
    />
  );
}
