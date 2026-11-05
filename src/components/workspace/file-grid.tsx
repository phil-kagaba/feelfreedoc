"use client";

import { ArrowDownAZ, GripVertical, X } from "lucide-react";
import { Dropzone } from "@/components/dropzone";
import { SortableGrid } from "./sortable-grid";
import { FileThumb } from "./pdf-hooks";
import type { ToolState, UploadedFile } from "./use-tool-state";
import { formatBytes } from "@/lib/utils";

export function FileGrid({ state, sortable = true, labels }: { state: ToolState; sortable?: boolean; labels?: string[] }) {
  const { files, setFiles, removeFile, tool } = state;

  const card = (f: UploadedFile, i: number, handle?: { attributes: object; listeners: object | undefined }) => (
    <div className="group card relative flex h-full flex-col p-2.5">
      {labels?.[i] && (
        <span className="absolute left-3 top-3 z-10 rounded-md bg-ink px-1.5 py-0.5 text-[11px] font-semibold text-bg">{labels[i]}</span>
      )}
      <div {...(handle?.attributes ?? {})} {...(handle?.listeners ?? {})} className={sortable ? "cursor-grab active:cursor-grabbing" : ""}>
        <FileThumb file={f.file} />
      </div>
      <div className="mt-2 flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-ink" title={f.file.name}>{f.file.name}</p>
          <p className="text-[11px] text-muted">{formatBytes(f.file.size)}</p>
        </div>
        {sortable && <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />}
      </div>
      <button
        type="button"
        onClick={() => removeFile(f.id)}
        className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-muted opacity-100 shadow-soft transition hover:text-danger sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
        aria-label={`Remove ${f.file.name}`}
      >
        <X className="h-4 w-4" />
      </button>
      <span className="absolute bottom-[3.25rem] left-3 rounded-md bg-surface/90 px-1.5 text-[11px] font-semibold text-muted">{i + 1}</span>
    </div>
  );

  const grid = "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4";

  return (
    <div className="space-y-4">
      {sortable && files.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted">Drag files to change their order.</p>
          <button
            type="button"
            className="chip"
            onClick={() => setFiles([...files].sort((a, b) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true })))}
          >
            <ArrowDownAZ className="h-4 w-4" /> Sort by name
          </button>
        </div>
      )}
      {sortable ? (
        <SortableGrid items={files} onChange={setFiles} className={grid} render={(f, i, h) => card(f, i, h)} />
      ) : (
        <div className={grid}>{files.map((f, i) => <div key={f.id}>{card(f, i)}</div>)}</div>
      )}
      {(tool.multiple || files.length === 0) && (
        <Dropzone compact accept={tool.accept} multiple={tool.multiple} onFiles={state.addFiles} onError={state.setError} />
      )}
    </div>
  );
}
