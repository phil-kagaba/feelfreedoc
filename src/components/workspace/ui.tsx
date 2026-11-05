"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import JSZip from "jszip";
import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, CheckCircle2, Download, Info, LoaderCircle, RotateCcw } from "lucide-react";
import { Dropzone } from "@/components/dropzone";
import { ToolIcon } from "@/components/tool-icon";
import { TOOLS } from "@/lib/tools";
import { cn, downloadBlob, formatBytes } from "@/lib/utils";
import type { ToolState } from "./use-tool-state";

export function Alert({ kind = "error", children, onClose }: { kind?: "error" | "info" | "warn"; children: ReactNode; onClose?: () => void }) {
  const styles = {
    error: "border-danger/30 bg-danger-soft text-danger",
    info: "border-brand-strong/50 bg-brand-soft text-ink",
    warn: "border-amber-400/40 bg-warn-soft text-ink",
  }[kind];
  const Icon = kind === "error" ? AlertCircle : Info;
  return (
    <div role={kind === "error" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-6", styles)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">{children}</div>
      {onClose && (
        <button type="button" onClick={onClose} className="text-xs font-semibold underline-offset-2 hover:underline" aria-label="Dismiss">
          Dismiss
        </button>
      )}
    </div>
  );
}

/** First screen of every tool: large dropzone. */
export function UploadStage({ state, hint, extra }: { state: ToolState; hint?: string; extra?: ReactNode }) {
  const { tool } = state;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Dropzone accept={tool.accept} multiple={tool.multiple} onFiles={state.addFiles} onError={state.setError} hint={hint} />
      {state.error && <Alert onClose={() => state.setError(null)}>{state.error}</Alert>}
      {extra}
    </div>
  );
}

/** Two-column workspace: main content + sticky options panel (stacked on mobile). */
export function Workspace({ main, side, state }: { main: ReactNode; side: ReactNode; state: ToolState }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        {main}
      </div>
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="card space-y-5 p-5">
          {side}
          {state.error && <Alert onClose={() => state.setError(null)}>{state.error}</Alert>}
          {state.notice && <Alert kind="info" onClose={() => state.setNotice(null)}>{state.notice}</Alert>}
        </div>
      </aside>
    </div>
  );
}

export function PanelTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-ink">{children}</h2>
      {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
    </div>
  );
}

export function ProcessButton({ state, onClick, disabled, label }: { state: ToolState; onClick: () => void; disabled?: boolean; label?: string }) {
  const { busy, progress, tool } = state;
  return (
    <div className="space-y-2.5">
      <button type="button" className="btn-primary h-12 w-full text-[15px]" onClick={onClick} disabled={busy || disabled}>
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ToolIcon slug={tool.slug} className="h-4 w-4" />}
        {busy ? progress.label || "Processing…" : label ?? tool.action}
      </button>
      {busy && (
        <div className="h-1.5 overflow-hidden rounded-full bg-brand-soft" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.value != null ? Math.round(progress.value * 100) : undefined}>
          {progress.value != null ? (
            <div className="h-full rounded-full bg-brand-strong transition-[width] duration-300" style={{ width: `${Math.max(4, progress.value * 100)}%` }} />
          ) : (
            <div className="h-full w-1/3 animate-[ffdslide_1.1s_ease-in-out_infinite] rounded-full bg-brand-strong" />
          )}
        </div>
      )}
      <style>{`@keyframes ffdslide{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
    </div>
  );
}

const NEXT_STEPS: Record<string, string[]> = {
  default: ["compress-pdf", "protect-pdf", "sign-pdf", "page-numbers"],
  "compress-pdf": ["protect-pdf", "merge-pdf", "sign-pdf"],
  "merge-pdf": ["compress-pdf", "page-numbers", "protect-pdf"],
  "word-to-pdf": ["compress-pdf", "sign-pdf", "merge-pdf"],
};

export function ResultView({ state }: { state: ToolState }) {
  const { result, tool } = state;
  const [zipping, setZipping] = useState(false);
  if (!result) return null;
  const multiple = result.outputs.length > 1;

  async function downloadAll() {
    if (!result) return;
    if (!multiple) {
      downloadBlob(result.outputs[0].blob, result.outputs[0].name);
      return;
    }
    setZipping(true);
    const zip = new JSZip();
    const used = new Set<string>();
    for (const o of result.outputs) {
      let n = o.name;
      for (let i = 2; used.has(n); i++) n = o.name.replace(/(\.[^.]+)?$/, `-${i}$1`);
      used.add(n);
      zip.file(n, o.blob);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    setZipping(false);
    downloadBlob(blob, result.zipName ?? `${tool.slug}.zip`);
  }

  const next = (NEXT_STEPS[tool.slug] ?? NEXT_STEPS.default).filter((s) => s !== tool.slug).map((s) => TOOLS.find((t) => t.slug === s)!).slice(0, 3);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-3xl space-y-6">
      <div className="card overflow-hidden">
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-[#171717]">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <h2 className="mt-4 text-2xl font-semibold text-ink">Done! Your file{multiple ? "s are" : " is"} ready.</h2>
          {result.message && <div className="mt-2 max-w-lg text-sm text-muted">{result.message}</div>}

          {result.stats && result.stats.length > 0 && (
            <dl className="mt-6 grid w-full max-w-lg grid-cols-2 gap-3 sm:grid-cols-3">
              {result.stats.map((s) => (
                <div key={s.label} className={cn("rounded-xl border border-line p-3", s.highlight && "border-brand-strong bg-brand-soft")}>
                  <dt className="text-xs text-muted">{s.label}</dt>
                  <dd className="mt-0.5 text-lg font-semibold text-ink">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}

          <button type="button" onClick={() => void downloadAll()} className="btn-primary mt-7 h-12 px-8 text-[15px]" disabled={zipping}>
            {zipping ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {multiple ? `Download all (${result.outputs.length}) as ZIP` : "Download"}
          </button>
          {!multiple && (
            <p className="mt-2 text-xs text-muted">
              {result.outputs[0].name} · {formatBytes(result.outputs[0].blob.size)}
            </p>
          )}
        </div>
        {multiple && (
          <ul className="max-h-72 divide-y divide-line overflow-y-auto border-t border-line">
            {result.outputs.map((o, i) => (
              <li key={o.name + i} className="flex items-center justify-between gap-3 px-5 py-3">
                <span className="min-w-0 truncate text-sm text-ink">{o.name}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-muted">{formatBytes(o.blob.size)}</span>
                  <button type="button" className="rounded-lg p-2 text-brand-ink hover:bg-brand-soft" onClick={() => downloadBlob(o.blob, o.name)} aria-label={`Download ${o.name}`}>
                    <Download className="h-4 w-4" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col justify-center gap-2 border-t border-line bg-surface-2 p-4 sm:flex-row">
          <button type="button" className="btn-ghost" onClick={state.backToEdit}>
            <ArrowLeft className="h-4 w-4" /> Back to options
          </button>
          <button type="button" className="btn-ghost" onClick={state.reset}>
            <RotateCcw className="h-4 w-4" /> Start over
          </button>
        </div>
      </div>

      {result.extra}

      <div>
        <p className="mb-3 text-center text-sm font-medium text-muted">Continue with</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {next.map((t) => (
            <Link key={t.slug} href={`/${t.slug}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 transition hover:border-brand-strong hover:bg-brand-soft">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
                <ToolIcon slug={t.slug} className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium text-ink">{t.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Small form controls ─────────────────────────────────────────────

export function Segmented<T extends string>({ value, onChange, options, label }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; sub?: string }[];
  label?: string;
}) {
  return (
    <fieldset>
      {label && <legend className="label">{label}</legend>}
      <div className={cn("grid gap-2", options.length <= 3 ? `grid-cols-${options.length}` : "grid-cols-2")} style={{ gridTemplateColumns: `repeat(${Math.min(options.length, 3)}, minmax(0, 1fr))` }}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={cn(
              "rounded-xl border px-2.5 py-2 text-left text-sm transition min-h-11",
              value === o.value ? "border-brand-strong bg-brand-soft font-semibold text-ink" : "border-line text-muted hover:border-brand-strong hover:text-ink",
            )}
          >
            {o.label}
            {o.sub && <span className="mt-0.5 block text-[11px] font-normal text-muted">{o.sub}</span>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function Toggle({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3">
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {sub && <span className="block text-xs text-muted">{sub}</span>}
      </span>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-line transition peer-checked:bg-brand-strong peer-focus-visible:ring-2 peer-focus-visible:ring-brand-ink after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
    </label>
  );
}

export function RangeField({ label, value, onChange, min, max, step = 1, suffix = "" }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; suffix?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium text-ink">{label}</span>
        <span className="text-sm tabular-nums text-muted">{value}{suffix}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#7fd492]"
        aria-label={label}
      />
    </div>
  );
}

export function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
