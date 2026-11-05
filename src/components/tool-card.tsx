import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ToolIcon } from "./tool-icon";
import type { ToolDef } from "@/lib/tools";

const ENGINE_LABEL: Record<ToolDef["engine"], string> = {
  browser: "In your browser",
  server: "Secure server",
  ai: "AI",
};

export function ToolCard({ tool, compact = false }: { tool: ToolDef; compact?: boolean }) {
  return (
    <Link
      href={`/${tool.slug}`}
      className="group relative flex h-full flex-col rounded-2xl border border-line bg-surface p-5 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-brand-strong hover:shadow-lift focus-visible:-translate-y-1"
    >
      <div className="flex items-start justify-between">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand-ink transition-colors duration-200 group-hover:bg-brand group-hover:text-[#171717]">
          <ToolIcon slug={tool.slug} className="h-5 w-5" />
        </span>
        <ArrowUpRight className="h-4 w-4 text-muted opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
      </div>
      <h3 className="mt-4 text-[15px] font-semibold text-ink">{tool.name}</h3>
      {!compact && <p className="mt-1.5 flex-1 text-sm leading-6 text-muted">{tool.short}</p>}
      {!compact && (
        <span className="mt-4 inline-flex w-fit items-center rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-muted">
          {ENGINE_LABEL[tool.engine]}
        </span>
      )}
    </Link>
  );
}
