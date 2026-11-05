"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Activity, CalendarDays, HardDrive, LoaderCircle, Settings, Trash2 } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { ToolCard } from "@/components/tool-card";
import { ToolIcon } from "@/components/tool-icon";
import { frequentTools } from "@/lib/client-store";
import { TOOLS, getTool, type ToolDef } from "@/lib/tools";
import { formatBytes } from "@/lib/utils";

interface HistoryItem {
  id: string;
  tool: string;
  file_names: string;
  file_count: number;
  input_bytes: number;
  output_bytes: number;
  created_at: string;
}

interface HistoryData {
  items: HistoryItem[];
  top: { tool: string; uses: number }[];
  totals: { jobs: number; bytes: number };
}

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString();
}

export function Dashboard() {
  return <RequireAuth>{(user) => <DashboardInner name={user.name} since={user.createdAt} />}</RequireAuth>;
}

function DashboardInner({ name, since }: { name: string; since: string }) {
  const [data, setData] = useState<HistoryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localTop, setLocalTop] = useState<ToolDef[]>([]);

  const load = useCallback(() => {
    fetch("/api/history?limit=100", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message || "Could not load your history."));
  }, []);

  useEffect(() => {
    load();
    setLocalTop(frequentTools(4).map(getTool).filter((t): t is ToolDef => !!t));
  }, [load]);

  const favourite = (data?.top.length ? data.top.map((t) => getTool(t.tool)).filter((t): t is ToolDef => !!t) : localTop).slice(0, 4);
  const suggestions = favourite.length ? favourite : TOOLS.filter((t) => t.popular).slice(0, 4);

  async function clearHistory() {
    if (!confirm("Delete your entire processing history? This can't be undone.")) return;
    await fetch("/api/history", { method: "DELETE" });
    load();
  }

  return (
    <div className="container-page py-10 sm:py-14">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-muted">Dashboard</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">Hi, {name.split(" ")[0] || "there"} 👋</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/settings" className="btn-ghost"><Settings className="h-4 w-4" /> Settings</Link>
          <Link href="/tools" className="btn-primary">New task</Link>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { icon: Activity, label: "Jobs completed", value: data ? String(data.totals.jobs) : "—" },
          { icon: HardDrive, label: "Data processed", value: data ? formatBytes(data.totals.bytes) : "—" },
          { icon: CalendarDays, label: "Member since", value: new Date(since).toLocaleDateString(undefined, { month: "short", year: "numeric" }) },
        ].map((s) => (
          <div key={s.label} className="card flex items-center gap-4 p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand-ink"><s.icon className="h-5 w-5" /></span>
            <div>
              <p className="text-sm text-muted">{s.label}</p>
              <p className="text-xl font-semibold text-ink">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-ink">{favourite.length ? "Your most-used tools" : "Popular tools to try"}</h2>
        <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-4">
          {suggestions.map((t) => <ToolCard key={t.slug} tool={t} />)}
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Recent activity</h2>
          {!!data?.items.length && (
            <button type="button" onClick={() => void clearHistory()} className="chip"><Trash2 className="h-4 w-4" /> Clear history</button>
          )}
        </div>
        <div className="card overflow-hidden">
          {error ? (
            <p className="p-6 text-sm text-danger">{error}</p>
          ) : !data ? (
            <div className="flex h-40 items-center justify-center"><LoaderCircle className="h-5 w-5 animate-spin text-muted" /></div>
          ) : data.items.length === 0 ? (
            <div className="p-10 text-center">
              <p className="font-medium text-ink">No activity yet</p>
              <p className="mt-1 text-sm text-muted">Jobs you complete while logged in will appear here. We store file names and sizes — never the files.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {data.items.map((h) => {
                const t = getTool(h.tool);
                return (
                  <li key={h.id} className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
                      <ToolIcon slug={h.tool} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{t?.name ?? h.tool}</p>
                      <p className="truncate text-xs text-muted" title={h.file_names}>{h.file_names || "—"}</p>
                    </div>
                    <div className="hidden text-right text-xs text-muted sm:block">
                      <p>{formatBytes(h.input_bytes)} → {formatBytes(h.output_bytes)}</p>
                    </div>
                    <div className="w-20 shrink-0 text-right text-xs text-muted">{timeAgo(h.created_at)}</div>
                    {t && <Link href={`/${t.slug}`} className="hidden rounded-lg px-2 py-1 text-xs font-semibold text-brand-ink hover:bg-brand-soft md:block">Open</Link>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
