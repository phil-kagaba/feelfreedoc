"use client";

import { useEffect, useState } from "react";
import type { PDFDocument } from "pdf-lib";
import { Eraser, LoaderCircle } from "lucide-react";
import { loadPdf, readMeta, writeMeta, type PdfMeta } from "@/lib/pdf-ops";
import type { ToolDef } from "@/lib/tools";
import { baseName, errorMessage, formatBytes } from "@/lib/utils";
import { Alert, PanelTitle, ProcessButton, ResultView, UploadStage, Workspace } from "../workspace/ui";
import { useToolState } from "../workspace/use-tool-state";

const FIELDS: { key: keyof PdfMeta; label: string; type?: string; multiline?: boolean }[] = [
  { key: "title", label: "Title" },
  { key: "author", label: "Author" },
  { key: "subject", label: "Subject" },
  { key: "keywords", label: "Keywords (comma-separated)" },
  { key: "creator", label: "Creator application" },
  { key: "producer", label: "Producer" },
  { key: "creationDate", label: "Created", type: "datetime-local" },
  { key: "modificationDate", label: "Modified", type: "datetime-local" },
];

export default function MetadataTool({ tool }: { tool: ToolDef }) {
  const s = useToolState(tool);
  const file = s.files[0]?.file;
  const [doc, setDoc] = useState<PDFDocument | null>(null);
  const [meta, setMeta] = useState<PdfMeta | null>(null);
  const [info, setInfo] = useState<{ pages: number; version: string; size: { w: number; h: number } } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    let alive = true;
    setErr(null);
    (async () => {
      try {
        const d = await loadPdf(file);
        const head = new TextDecoder("latin1").decode(new Uint8Array(await file.slice(0, 1024).arrayBuffer()));
        const v = head.match(/%PDF-(\d\.\d)/)?.[1] ?? "?";
        const p = d.getPage(0).getSize();
        if (!alive) return;
        setDoc(d);
        setMeta(readMeta(d));
        setInfo({ pages: d.getPageCount(), version: v, size: { w: p.width, h: p.height } });
      } catch (e) {
        if (alive) setErr(errorMessage(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [file]);

  if (s.result) return <ResultView state={s} />;
  if (!file) return <UploadStage state={s} />;

  const main = (
    <div className="card p-5 sm:p-6">
      {err && <Alert>{err}</Alert>}
      {!meta && !err && <div className="flex h-40 items-center justify-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}
      {meta && (
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <label key={f.key} className={f.key === "title" || f.key === "keywords" ? "block sm:col-span-2" : "block"}>
              <span className="label">{f.label}</span>
              <input
                type={f.type ?? "text"}
                className="input"
                value={meta[f.key]}
                onChange={(e) => setMeta({ ...meta, [f.key]: e.target.value })}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );

  const side = (
    <>
      <PanelTitle sub={file.name}>Document info</PanelTitle>
      {info && (
        <dl className="grid grid-cols-2 gap-2 text-sm">
          {[
            ["Pages", String(info.pages)],
            ["PDF version", info.version],
            ["File size", formatBytes(file.size)],
            ["Page size", `${Math.round(info.size.w)} × ${Math.round(info.size.h)} pt`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-surface-2 p-3">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="font-semibold text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <button
        type="button"
        className="btn-ghost w-full"
        disabled={!meta}
        onClick={() => setMeta({ title: "", author: "", subject: "", keywords: "", creator: "", producer: "", creationDate: "", modificationDate: "" })}
      >
        <Eraser className="h-4 w-4" /> Clear all fields
      </button>
      <ProcessButton
        state={s}
        disabled={!doc || !meta}
        onClick={() =>
          s.run(async () => {
            const blob = await writeMeta(doc!, meta!);
            // reload so further edits start from the saved state
            setDoc(await loadPdf(await blob.arrayBuffer()));
            return { outputs: [{ blob, name: `${baseName(file.name)}.pdf` }], message: "Document properties updated." };
          })
        }
      />
      <button type="button" className="chip w-full justify-center" onClick={s.reset}>Use a different file</button>
    </>
  );

  return <Workspace state={s} main={main} side={side} />;
}
