"use client";

import { useCallback, useRef, useState } from "react";
import { FilePlus2, UploadCloud } from "lucide-react";
import { cn, extOf, formatBytes } from "@/lib/utils";

export const MAX_FILE_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB || 50);

const SIGNATURES: Record<string, (b: Uint8Array) => boolean> = {
  ".pdf": (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
  ".png": (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  ".jpg": (b) => b[0] === 0xff && b[1] === 0xd8,
  ".jpeg": (b) => b[0] === 0xff && b[1] === 0xd8,
  ".webp": (b) => b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45,
};

/** Validate extension, size and (where cheap) magic bytes. Returns an error message or null. */
export async function validateFile(file: File, accept: string[], maxMb = MAX_FILE_MB): Promise<string | null> {
  const ext = extOf(file.name);
  if (!accept.includes(ext)) {
    return `“${file.name}” isn't supported here. Accepted: ${accept.join(", ")}`;
  }
  if (file.size === 0) return `“${file.name}” is empty.`;
  if (file.size > maxMb * 1024 * 1024) {
    return `“${file.name}” is ${formatBytes(file.size)} — the limit is ${maxMb} MB.`;
  }
  const check = SIGNATURES[ext];
  if (check) {
    const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
    // PDFs may have a little junk before the header; search the first KB.
    const ok =
      ext === ".pdf"
        ? new TextDecoder("latin1").decode(head).includes("%PDF-")
        : check(head);
    if (!ok) return `“${file.name}” doesn't look like a valid ${ext.slice(1).toUpperCase()} file.`;
  }
  return null;
}

interface DropzoneProps {
  accept: string[];
  multiple: boolean;
  onFiles: (files: File[]) => void;
  onError: (msg: string) => void;
  compact?: boolean;
  hint?: string;
  maxMb?: number;
  className?: string;
}

export function Dropzone({ accept, multiple, onFiles, onError, compact, hint, maxMb = MAX_FILE_MB, className }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const handle = useCallback(
    async (list: FileList | null) => {
      if (!list || !list.length) return;
      let files = Array.from(list);
      if (!multiple && files.length > 1) {
        onError("This tool works on one file at a time — using the first file.");
        files = files.slice(0, 1);
      }
      const good: File[] = [];
      const errors: string[] = [];
      for (const f of files) {
        const err = await validateFile(f, accept, maxMb);
        if (err) errors.push(err);
        else good.push(f);
      }
      if (errors.length) onError(errors.join(" "));
      if (good.length) onFiles(good);
    },
    [accept, multiple, onFiles, onError, maxMb],
  );

  const label = accept.map((a) => a.slice(1).toUpperCase()).filter((v, i, arr) => arr.indexOf(v) === i && v !== "JPEG").join(", ");

  return (
    <div
      className={cn(
        "relative rounded-2xl border-2 border-dashed bg-surface transition-all duration-200",
        over ? "border-brand-ink bg-brand-soft" : "border-line hover:border-brand-strong",
        compact ? "p-5" : "p-8 sm:p-12",
        className,
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void handle(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={accept.join(",")}
        multiple={multiple}
        onChange={(e) => {
          void handle(e.target.files);
          e.target.value = "";
        }}
        aria-label="Choose files"
        tabIndex={-1}
      />
      {compact ? (
        <button type="button" onClick={() => inputRef.current?.click()} className="flex w-full items-center justify-center gap-2 text-sm font-medium text-ink">
          <FilePlus2 className="h-4 w-4 text-brand-ink" />
          Add {multiple ? "more files" : "a different file"}
          <span className="hidden text-muted sm:inline">or drop here</span>
        </button>
      ) : (
        <div className="flex flex-col items-center text-center">
          <span className={cn("flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink transition-transform duration-200", over && "scale-110")}>
            <UploadCloud className="h-8 w-8" strokeWidth={1.6} />
          </span>
          <p className="mt-5 text-lg font-semibold text-ink">
            Drop {multiple ? "your files" : "your file"} here
          </p>
          <p className="mt-1 text-sm text-muted">or</p>
          <button type="button" onClick={() => inputRef.current?.click()} className="btn-primary mt-3 px-6">
            Browse Files
          </button>
          <p className="mt-4 text-xs text-muted">
            {hint ?? `Supported: ${label}`} · Up to {maxMb} MB per file
          </p>
        </div>
      )}
    </div>
  );
}
