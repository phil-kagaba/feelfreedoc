"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { LoaderCircle } from "lucide-react";
import { getTool, type ToolDef } from "@/lib/tools";

const Loading = () => (
  <div className="flex min-h-64 items-center justify-center text-muted">
    <LoaderCircle className="h-6 w-6 animate-spin" />
  </div>
);

type ToolComp = ComponentType<{ tool: ToolDef }>;

// Each tool UI is code-split so heavy libraries load only when needed.
const Merge = dynamic(() => import("./merge-tool"), { ssr: false, loading: Loading });
const Pages = dynamic(() => import("./pages-tool"), { ssr: false, loading: Loading });
const Server = dynamic(() => import("./server-tool"), { ssr: false, loading: Loading });
const Images = dynamic(() => import("./image-tools").then((m) => m.PdfToImagesTool), { ssr: false, loading: Loading });
const ImgToPdf = dynamic(() => import("./image-tools").then((m) => m.ImagesToPdfTool), { ssr: false, loading: Loading });
const Text = dynamic(() => import("./image-tools").then((m) => m.PdfToTextTool), { ssr: false, loading: Loading });
const Stamp = dynamic(() => import("./stamp-tools"), { ssr: false, loading: Loading });
const Editor = dynamic(() => import("./editor-tool"), { ssr: false, loading: Loading });
const Meta = dynamic(() => import("./metadata-tool"), { ssr: false, loading: Loading });
const Compare = dynamic(() => import("./compare-tool"), { ssr: false, loading: Loading });
const Ai = dynamic(() => import("./ai-tool"), { ssr: false, loading: Loading });

const MAP: Record<string, ToolComp> = {
  "merge-pdf": Merge,
  "split-pdf": Pages, "extract-pages": Pages, "rotate-pdf": Pages, "reorder-pages": Pages, "delete-pages": Pages, "organize-pdf": Pages,
  "compress-pdf": Server, "optimize-pdf": Server, "repair-pdf": Server,
  "pdf-to-word": Server, "word-to-pdf": Server, "pdf-to-excel": Server, "excel-to-pdf": Server,
  "pdf-to-powerpoint": Server, "powerpoint-to-pdf": Server, "html-to-pdf": Server,
  "protect-pdf": Server, "unlock-pdf": Server, "ocr-pdf": Server,
  "pdf-to-jpg": Images, "pdf-to-png": Images, "jpg-to-pdf": ImgToPdf, "pdf-to-text": Text,
  "watermark-pdf": Stamp, "page-numbers": Stamp,
  "edit-pdf": Editor, "add-images": Editor, "add-shapes": Editor, "sign-pdf": Editor, "annotate-pdf": Editor, "redact-pdf": Editor,
  "pdf-metadata": Meta, "compare-pdf": Compare,
  "ai-summarizer": Ai, "ai-translator": Ai, "ai-extractor": Ai, "ai-assistant": Ai,
};

export function ToolLoader({ slug }: { slug: string }) {
  const tool = getTool(slug)!;
  const Comp = MAP[slug];
  return <Comp tool={tool} />;
}
