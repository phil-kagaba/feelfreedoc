"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { CATEGORIES, TOOLS, type CategoryId } from "@/lib/tools";
import { ToolCard } from "./tool-card";
import { CATEGORY_ICONS } from "./tool-icon";
import { cn } from "@/lib/utils";

export function ToolsExplorer({
  initialCategory = "all",
  showHeading = true,
}: {
  initialCategory?: CategoryId | "all";
  showHeading?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<CategoryId | "all">(initialCategory);

  useEffect(() => setCat(initialCategory), [initialCategory]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TOOLS.filter(
      (t) =>
        (cat === "all" || t.category === cat) &&
        (!q || [t.name, t.short, ...t.keywords].some((v) => v.toLowerCase().includes(q))),
    );
  }, [query, cat]);

  const grouped = cat === "all" && !query.trim();

  return (
    <section id="tools" className="scroll-mt-24">
      {showHeading && (
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Every tool you need, in one place</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted">
            {TOOLS.length} tools to organize, convert, edit and protect documents. Most run entirely in your browser.
          </p>
        </div>
      )}

      <div className="mb-8 flex flex-col gap-4">
        <div className="relative mx-auto w-full max-w-xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools — e.g. compress, sign, Word…"
            className="input h-12 rounded-2xl pl-11 pr-10 text-[15px]"
            aria-label="Search tools"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:text-ink"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0" role="tablist" aria-label="Tool categories">
          <button type="button" role="tab" aria-selected={cat === "all"} onClick={() => setCat("all")} className={cn("chip shrink-0", cat === "all" && "chip-active")}>
            All tools
          </button>
          {CATEGORIES.map((c) => {
            const Icon = CATEGORY_ICONS[c.id];
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={cat === c.id}
                onClick={() => setCat(c.id)}
                className={cn("chip shrink-0", cat === c.id && "chip-active")}
              >
                <Icon className="h-3.5 w-3.5" />
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card mx-auto max-w-md p-10 text-center">
          <p className="font-medium text-ink">No tools match “{query}”.</p>
          <p className="mt-1 text-sm text-muted">Try another word, like “convert” or “password”.</p>
        </div>
      ) : grouped ? (
        <div className="space-y-14">
          {CATEGORIES.map((c) => (
            <div key={c.id}>
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-ink">{c.name}</h3>
                  <p className="text-sm text-muted">{c.blurb}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {TOOLS.filter((t) => t.category === c.id).map((t) => (
                  <ToolCard key={t.slug} tool={t} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((t) => (
            <ToolCard key={t.slug} tool={t} />
          ))}
        </div>
      )}
    </section>
  );
}
