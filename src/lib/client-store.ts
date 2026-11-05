"use client";

// Lightweight client-side state that survives client-side navigation:
// - files dropped on the homepage, handed to the tool page the user picks
// - recently / frequently used tools (localStorage, never leaves the device)

let pendingFiles: File[] = [];

export function setPendingFiles(files: File[]) {
  pendingFiles = files;
}

export function takePendingFiles(): File[] {
  const f = pendingFiles;
  pendingFiles = [];
  return f;
}

const USAGE_KEY = "ffd:tool-usage";

type Usage = Record<string, { count: number; last: number }>;

function readUsage(): Usage {
  try {
    return JSON.parse(localStorage.getItem(USAGE_KEY) || "{}") as Usage;
  } catch {
    return {};
  }
}

export function recordToolUse(slug: string) {
  try {
    const u = readUsage();
    u[slug] = { count: (u[slug]?.count ?? 0) + 1, last: Date.now() };
    localStorage.setItem(USAGE_KEY, JSON.stringify(u));
  } catch {
    /* storage unavailable — ignore */
  }
}

export function recentTools(limit = 6): string[] {
  const u = readUsage();
  return Object.entries(u).sort((a, b) => b[1].last - a[1].last).slice(0, limit).map(([k]) => k);
}

export function frequentTools(limit = 6): string[] {
  const u = readUsage();
  return Object.entries(u).sort((a, b) => b[1].count - a[1].count).slice(0, limit).map(([k]) => k);
}

/** Records successful use locally and, for signed-in users, in account history. */
export async function logHistory(entry: {
  tool: string;
  files: { name: string; size: number }[];
  outputBytes?: number;
}) {
  recordToolUse(entry.tool);
  try {
    await fetch("/api/history", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(entry),
    });
  } catch {
    /* history is best-effort */
  }
}
