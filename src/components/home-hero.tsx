"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FileText, ShieldCheck, X, Zap, Globe } from "lucide-react";
import { Dropzone } from "./dropzone";
import { ToolIcon } from "./tool-icon";
import { setPendingFiles } from "@/lib/client-store";
import { TOOLS } from "@/lib/tools";
import { extOf, formatBytes } from "@/lib/utils";

const ALL_ACCEPT = Array.from(new Set(TOOLS.flatMap((t) => t.accept)));

function HeroIllustration() {
  return (
    <svg viewBox="0 0 420 320" className="h-auto w-full max-w-md" aria-hidden="true">
      <defs>
        <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#171717" floodOpacity="0.08" />
        </filter>
      </defs>
      <g filter="url(#sh)">
        <rect x="70" y="58" width="170" height="220" rx="16" fill="var(--surface)" stroke="var(--line)" transform="rotate(-8 155 168)" />
        <rect x="170" y="40" width="180" height="232" rx="16" fill="var(--surface)" stroke="var(--line)" />
      </g>
      <rect x="192" y="64" width="48" height="20" rx="6" fill="#A3E4B0" />
      <text x="216" y="78" textAnchor="middle" fontSize="11" fontWeight="700" fill="#171717" fontFamily="sans-serif">PDF</text>
      {[100, 118, 136, 154].map((y, i) => (
        <rect key={y} x="192" y={y} width={i === 3 ? 90 : 136} height="7" rx="3.5" fill="var(--line)" />
      ))}
      <rect x="192" y="176" width="136" height="64" rx="10" fill="var(--brand-soft)" />
      <path d="M204 228l22-24 16 16 12-10 22 18" fill="none" stroke="#7fd492" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="302" cy="194" r="7" fill="#7fd492" />
      {[96, 112, 128].map((y) => (
        <rect key={y} x="92" y={y} width="104" height="6" rx="3" fill="var(--line)" transform="rotate(-8 155 168)" />
      ))}
      <g transform="translate(300 214)">
        <circle r="30" fill="#A3E4B0" />
        <path d="M-11 0l7 7 14-15" fill="none" stroke="#171717" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g transform="translate(40 210)">
        <rect width="92" height="34" rx="17" fill="var(--surface)" stroke="var(--line)" />
        <circle cx="18" cy="17" r="8" fill="var(--brand-soft)" />
        <text x="34" y="21.5" fontSize="12" fontWeight="600" fill="var(--ink)" fontFamily="sans-serif">Merged</text>
      </g>
      <g transform="translate(296 28)">
        <rect width="104" height="34" rx="17" fill="var(--surface)" stroke="var(--line)" />
        <circle cx="18" cy="17" r="8" fill="var(--brand-soft)" />
        <text x="34" y="21.5" fontSize="12" fontWeight="600" fill="var(--ink)" fontFamily="sans-serif">−62% size</text>
      </g>
    </svg>
  );
}

export function HomeHero() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const suggestions = useMemo(() => {
    if (!files.length) return [];
    const exts = new Set(files.map((f) => extOf(f.name)));
    return TOOLS.filter((t) => [...exts].every((e) => t.accept.includes(e)) && (files.length === 1 || t.multiple));
  }, [files]);

  function openTool(slug: string) {
    setPendingFiles(files);
    router.push(`/${slug}`);
  }

  return (
    <section className="bg-hero relative overflow-hidden border-b border-line">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
      <div className="container-page relative grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
        <div>
          <motion.span
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-brand-strong" /> {TOOLS.length} free document tools · no install
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-[3.4rem]"
          >
            Everything You Need to Work With Documents,{" "}
            <span className="relative whitespace-nowrap">
              <span className="relative z-10">All in One Place.</span>
              <span className="absolute inset-x-0 bottom-1 z-0 h-3 rounded bg-brand/70 sm:h-4" />
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-5 max-w-xl text-lg leading-8 text-muted"
          >
            Merge, split, compress, convert, edit, and secure your documents effortlessly with our powerful online tools.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-8">
            {files.length === 0 ? (
              <Dropzone
                accept={ALL_ACCEPT}
                multiple
                onFiles={(f) => {
                  setError(null);
                  setFiles(f);
                }}
                onError={setError}
                hint="PDF, Word, Excel, PowerPoint, JPG, PNG, HTML, TXT"
                className="shadow-soft"
              />
            ) : (
              <div className="card p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      {files.length === 1 ? "1 file ready" : `${files.length} files ready`} — what would you like to do?
                    </p>
                    <ul className="mt-2 space-y-1">
                      {files.slice(0, 3).map((f) => (
                        <li key={f.name + f.size} className="flex items-center gap-2 text-sm text-muted">
                          <FileText className="h-4 w-4 shrink-0 text-brand-ink" />
                          <span className="truncate">{f.name}</span>
                          <span className="shrink-0 text-xs">{formatBytes(f.size)}</span>
                        </li>
                      ))}
                      {files.length > 3 && <li className="text-xs text-muted">+{files.length - 3} more</li>}
                    </ul>
                  </div>
                  <button type="button" onClick={() => setFiles([])} className="rounded-lg p-2 text-muted hover:bg-brand-soft hover:text-ink" aria-label="Clear files">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {suggestions.length ? (
                  <div className="mt-4 grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                    {suggestions.map((t) => (
                      <button
                        key={t.slug}
                        type="button"
                        onClick={() => openTool(t.slug)}
                        className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-left transition hover:border-brand-strong hover:bg-brand-soft"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
                          <ToolIcon slug={t.slug} className="h-4 w-4" />
                        </span>
                        <span className="text-sm font-medium text-ink">{t.name}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl bg-warn-soft p-3 text-sm text-ink">
                    No single tool accepts this mix of files. Try uploading files of one type.
                  </p>
                )}
              </div>
            )}
            {error && (
              <p role="alert" className="mt-3 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
                {error}
              </p>
            )}
          </motion.div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand-ink" /> Auto-deleted files</li>
            <li className="flex items-center gap-2"><Zap className="h-4 w-4 text-brand-ink" /> Most tools run in-browser</li>
            <li className="flex items-center gap-2"><Globe className="h-4 w-4 text-brand-ink" /> Works on any device</li>
          </ul>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="hidden justify-center lg:flex"
        >
          <HeroIllustration />
        </motion.div>
      </div>
    </section>
  );
}
