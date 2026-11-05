import {
  ArrowDownUp, Code, EyeOff, FileOutput, FileSpreadsheet, FileText, FileType, Gauge, GitCompare,
  Hash, Highlighter, Image, ImagePlus, Images, Languages, LayoutGrid, ListChecks, Lock, LockOpen,
  Merge, MessagesSquare, Minimize2, PenLine, Presentation, RotateCw, ScanText, Scissors, Shapes,
  Signature, Sparkles, Stamp, Tags, Trash2, Type, Wrench, type LucideIcon,
} from "lucide-react";
import type { CategoryId } from "@/lib/tools";

const ICONS: Record<string, LucideIcon> = {
  "merge-pdf": Merge,
  "split-pdf": Scissors,
  "extract-pages": FileOutput,
  "rotate-pdf": RotateCw,
  "reorder-pages": ArrowDownUp,
  "delete-pages": Trash2,
  "organize-pdf": LayoutGrid,
  "compress-pdf": Minimize2,
  "optimize-pdf": Gauge,
  "repair-pdf": Wrench,
  "pdf-to-word": FileText,
  "word-to-pdf": FileType,
  "pdf-to-excel": FileSpreadsheet,
  "excel-to-pdf": FileSpreadsheet,
  "pdf-to-powerpoint": Presentation,
  "powerpoint-to-pdf": Presentation,
  "pdf-to-jpg": Image,
  "jpg-to-pdf": Images,
  "pdf-to-png": Image,
  "html-to-pdf": Code,
  "pdf-to-text": Type,
  "edit-pdf": PenLine,
  "add-images": ImagePlus,
  "add-shapes": Shapes,
  "watermark-pdf": Stamp,
  "page-numbers": Hash,
  "sign-pdf": Signature,
  "annotate-pdf": Highlighter,
  "protect-pdf": Lock,
  "unlock-pdf": LockOpen,
  "redact-pdf": EyeOff,
  "ocr-pdf": ScanText,
  "pdf-metadata": Tags,
  "compare-pdf": GitCompare,
  "ai-summarizer": Sparkles,
  "ai-translator": Languages,
  "ai-extractor": ListChecks,
  "ai-assistant": MessagesSquare,
};

export const CATEGORY_ICONS: Record<CategoryId, LucideIcon> = {
  organize: LayoutGrid,
  optimize: Minimize2,
  convert: FileOutput,
  edit: PenLine,
  security: Lock,
  ai: Sparkles,
};

export function ToolIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon = ICONS[slug] ?? FileText;
  return <Icon className={className} aria-hidden="true" strokeWidth={1.75} />;
}
