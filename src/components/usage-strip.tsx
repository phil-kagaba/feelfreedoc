"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { recentTools } from "@/lib/client-store";
import { getTool, TOOLS, type ToolDef } from "@/lib/tools";
import { ToolCard } from "./tool-card";

/** "Popular" and "Recently used" rows. Recent list comes from localStorage only. */
export function UsageStrip() {
  const [recent, setRecent] = useState<ToolDef[]>([]);
  useEffect(() => {
    setRecent(recentTools(4).map(getTool).filter((t): t is ToolDef => !!t));
  }, []);
  const popular = TOOLS.filter((t) => t.popular).slice(0, 8);

  return (
    <div className="space-y-12">
      {recent.length > 0 && (
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-ink">
            <Clock className="h-4 w-4 text-brand-ink" /> Recently used
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {recent.map((t) => (
              <ToolCard key={t.slug} tool={t} compact />
            ))}
          </div>
        </div>
      )}
      <div>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-ink">Most popular tools</h2>
            <p className="mt-1 text-sm text-muted">The tools people reach for every day.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-4">
          {popular.map((t) => (
            <ToolCard key={t.slug} tool={t} />
          ))}
        </div>
      </div>
    </div>
  );
}
