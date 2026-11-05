"use client";

import { mergePdfs } from "@/lib/pdf-ops";
import type { ToolDef } from "@/lib/tools";
import { formatBytes } from "@/lib/utils";
import { FileGrid } from "../workspace/file-grid";
import { PanelTitle, ProcessButton, ResultView, UploadStage, Workspace } from "../workspace/ui";
import { useToolState } from "../workspace/use-tool-state";

export default function MergeTool({ tool }: { tool: ToolDef }) {
  const s = useToolState(tool);
  if (s.result) return <ResultView state={s} />;
  if (!s.files.length) return <UploadStage state={s} hint="Select two or more PDF files" />;

  const total = s.files.reduce((n, f) => n + f.file.size, 0);
  const need = (tool.minFiles ?? 1) - s.files.length;

  return (
    <Workspace
      state={s}
      main={<FileGrid state={s} />}
      side={
        <>
          <PanelTitle sub="Files are merged in the order shown.">Merge options</PanelTitle>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-surface-2 p-3"><dt className="text-muted">Files</dt><dd className="text-lg font-semibold">{s.files.length}</dd></div>
            <div className="rounded-xl bg-surface-2 p-3"><dt className="text-muted">Total size</dt><dd className="text-lg font-semibold">{formatBytes(total)}</dd></div>
          </dl>
          {need > 0 && <p className="text-sm text-muted">Add {need} more PDF{need > 1 ? "s" : ""} to merge.</p>}
          <ProcessButton
            state={s}
            disabled={need > 0}
            onClick={() =>
              s.run(async (progress) => {
                const blob = await mergePdfs(s.files.map((f) => f.file), (p) => progress(p, `Merging ${Math.round(p * 100)}%`));
                return {
                  outputs: [{ blob, name: "merged.pdf" }],
                  stats: [
                    { label: "Files merged", value: String(s.files.length) },
                    { label: "Output size", value: formatBytes(blob.size), highlight: true },
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
