"use client";

import { useState } from "react";
import { diffWords, type Change } from "diff";
import { extractText } from "@/lib/pdfjs";
import type { ToolDef } from "@/lib/tools";
import { FileGrid } from "../workspace/file-grid";
import { getDoc } from "../workspace/pdf-hooks";
import { PanelTitle, ProcessButton, ResultView, Toggle, UploadStage, Workspace } from "../workspace/ui";
import { useToolState } from "../workspace/use-tool-state";

interface PageDiff {
  page: number;
  parts: Change[];
  added: number;
  removed: number;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function reportHtml(a: string, b: string, pages: PageDiff[]) {
  const body = pages
    .map(
      (p) =>
        `<section><h2>Page ${p.page} <small>+${p.added} / −${p.removed} words</small></h2><div class="t">${p.parts
          .map((x) => (x.added ? `<ins>${escapeHtml(x.value)}</ins>` : x.removed ? `<del>${escapeHtml(x.value)}</del>` : escapeHtml(x.value)))
          .join("")}</div></section>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Comparison report</title><style>body{font:15px/1.6 system-ui,sans-serif;max-width:860px;margin:40px auto;padding:0 16px;color:#171717}h1{font-size:22px}h2{font-size:16px;margin-top:32px;border-bottom:1px solid #eaeaea;padding-bottom:6px}small{color:#737373;font-weight:400}.t{white-space:pre-wrap}ins{background:#ddf5e2;color:#14532d;text-decoration:none;border-radius:3px}del{background:#fee2e2;color:#991b1b;border-radius:3px}</style></head><body><h1>Comparison report</h1><p><del>${escapeHtml(a)}</del> → <ins>${escapeHtml(b)}</ins></p>${body}</body></html>`;
}

export default function CompareTool({ tool }: { tool: ToolDef }) {
  const s = useToolState(tool);
  const [onlyChanged, setOnlyChanged] = useState(true);
  const [ignoreSpace, setIgnoreSpace] = useState(true);

  if (s.result) return <ResultView state={s} />;
  if (!s.files.length) return <UploadStage state={s} hint="Select the original and the revised PDF" />;

  const [fa, fb] = s.files.map((f) => f.file);

  return (
    <Workspace
      state={s}
      main={<FileGrid state={s} labels={["Original", "Revised"]} />}
      side={
        <>
          <PanelTitle sub="The first file is treated as the original. Drag to swap.">Compare</PanelTitle>
          {s.files.length > 2 && <p className="text-sm text-danger">Only the first two files are compared.</p>}
          <Toggle checked={ignoreSpace} onChange={setIgnoreSpace} label="Ignore whitespace" sub="Line breaks and spacing differences" />
          <Toggle checked={onlyChanged} onChange={setOnlyChanged} label="Only pages with changes" />
          <ProcessButton
            state={s}
            disabled={s.files.length < 2}
            onClick={() =>
              s.run(async (progress) => {
                progress(null, "Reading the original…");
                const ta = await extractText(await getDoc(fa));
                progress(null, "Reading the revision…");
                const tb = await extractText(await getDoc(fb));
                const n = Math.max(ta.length, tb.length);
                const pages: PageDiff[] = [];
                for (let i = 0; i < n; i++) {
                  const norm = (t: string) => (ignoreSpace ? t.replace(/\s+/g, " ").trim() : t);
                  const parts = diffWords(norm(ta[i]?.text ?? ""), norm(tb[i]?.text ?? ""));
                  const count = (pred: (c: Change) => boolean) =>
                    parts.filter(pred).reduce((k, c) => k + c.value.split(/\s+/).filter(Boolean).length, 0);
                  pages.push({ page: i + 1, parts, added: count((c) => !!c.added), removed: count((c) => !!c.removed) });
                }
                const changed = pages.filter((p) => p.added || p.removed);
                const shown = onlyChanged ? changed : pages;
                const totalA = pages.reduce((k, p) => k + p.added, 0);
                const totalR = pages.reduce((k, p) => k + p.removed, 0);
                const noText = ta.every((p) => !p.text) && tb.every((p) => !p.text);
                const html = reportHtml(fa.name, fb.name, shown);
                return {
                  outputs: [{ blob: new Blob([html], { type: "text/html" }), name: "comparison-report.html" }],
                  stats: [
                    { label: "Pages changed", value: `${changed.length} / ${n}`, highlight: true },
                    { label: "Words added", value: String(totalA) },
                    { label: "Words removed", value: String(totalR) },
                  ],
                  message: noText
                    ? "Neither document contains selectable text. Run OCR PDF on scanned files first."
                    : ta.length !== tb.length
                      ? `The documents have different page counts (${ta.length} vs ${tb.length}).`
                      : changed.length === 0
                        ? "No text differences found."
                        : undefined,
                  extra: shown.length ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
                        <span className="rounded bg-brand-soft px-1.5 text-brand-ink">added text</span>
                        <span className="rounded bg-danger-soft px-1.5 text-danger line-through">removed text</span>
                      </div>
                      {shown.slice(0, 50).map((p) => (
                        <section key={p.page} className="card p-5">
                          <h3 className="mb-3 flex items-center justify-between text-sm font-semibold text-ink">
                            Page {p.page}
                            <span className="text-xs font-normal text-muted">+{p.added} / −{p.removed} words</span>
                          </h3>
                          <p className="max-h-96 overflow-auto whitespace-pre-wrap text-sm leading-7 text-ink">
                            {p.parts.map((x, i) =>
                              x.added ? (
                                <ins key={i} className="rounded bg-brand-soft text-brand-ink no-underline">{x.value}</ins>
                              ) : x.removed ? (
                                <del key={i} className="rounded bg-danger-soft text-danger">{x.value}</del>
                              ) : (
                                <span key={i} className="text-muted">{x.value}</span>
                              ),
                            )}
                          </p>
                        </section>
                      ))}
                    </div>
                  ) : undefined,
                };
              })
            }
          />
        </>
      }
    />
  );
}
