"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { logHistory, takePendingFiles } from "@/lib/client-store";
import { validateFile } from "@/components/dropzone";
import type { ToolDef } from "@/lib/tools";
import { errorMessage, uid } from "@/lib/utils";
import type { ReactNode } from "react";

export interface UploadedFile {
  id: string;
  file: File;
}

export interface OutputFile {
  blob: Blob;
  name: string;
}

export interface ToolResult {
  outputs: OutputFile[];
  /** Optional name of a ZIP bundling all outputs when there are several. */
  zipName?: string;
  stats?: { label: string; value: string; highlight?: boolean }[];
  message?: ReactNode;
  /** Optional custom content rendered in the result view (e.g. a diff report). */
  extra?: ReactNode;
}

export type Progress = (fraction: number | null, label?: string) => void;

export function useToolState(tool: ToolDef) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ value: number | null; label: string }>({ value: null, label: "" });
  const [result, setResult] = useState<ToolResult | null>(null);
  const took = useRef(false);

  const addFiles = useCallback(
    (incoming: File[]) => {
      setError(null);
      const wrapped = incoming.map((file) => ({ id: uid(), file }));
      setFiles((prev) => (tool.multiple ? [...prev, ...wrapped] : wrapped.slice(0, 1)));
    },
    [tool.multiple],
  );

  // Pick up files dropped on the homepage.
  useEffect(() => {
    if (took.current) return;
    took.current = true;
    const pending = takePendingFiles();
    if (!pending.length) return;
    void (async () => {
      const ok: File[] = [];
      for (const f of pending) if (!(await validateFile(f, tool.accept))) ok.push(f);
      if (ok.length) addFiles(tool.multiple ? ok : ok.slice(0, 1));
    })();
  }, [addFiles, tool.accept, tool.multiple]);

  const removeFile = useCallback((id: string) => setFiles((prev) => prev.filter((f) => f.id !== id)), []);

  const run = useCallback(
    async (fn: (progress: Progress) => Promise<ToolResult>) => {
      setBusy(true);
      setError(null);
      setProgress({ value: null, label: "Processing…" });
      try {
        const res = await fn((value, label) => setProgress((p) => ({ value, label: label ?? p.label })));
        setResult(res);
        void logHistory({
          tool: tool.slug,
          files: files.map((f) => ({ name: f.file.name, size: f.file.size })),
          outputBytes: res.outputs.reduce((n, o) => n + o.blob.size, 0),
        });
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setBusy(false);
      }
    },
    [files, tool.slug],
  );

  const reset = useCallback(() => {
    setFiles([]);
    setResult(null);
    setError(null);
    setNotice(null);
  }, []);

  const backToEdit = useCallback(() => setResult(null), []);

  return {
    tool, files, setFiles, addFiles, removeFile, error, setError, notice, setNotice,
    busy, progress, result, run, reset, backToEdit,
  };
}

export type ToolState = ReturnType<typeof useToolState>;
