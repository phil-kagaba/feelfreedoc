export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function formatBytes(bytes: number, digits = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const v = bytes / 1024 ** i;
  return `${v.toFixed(i === 0 ? 0 : digits)} ${units[i]}`;
}

export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export function baseName(name: string): string {
  const i = name.lastIndexOf(".");
  return (i > 0 ? name.slice(0, i) : name).replace(/[^\p{L}\p{N}._ -]+/gu, "_").slice(0, 120) || "document";
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/**
 * Parse a page-range expression such as "1-3, 5, 8-" into zero-based indexes.
 * Throws a readable Error for invalid input.
 */
export function parseRanges(expr: string, pageCount: number): number[][] {
  const groups: number[][] = [];
  const parts = expr.split(",").map((s) => s.trim()).filter(Boolean);
  if (!parts.length) throw new Error("Enter at least one page or range, e.g. 1-3, 5");
  for (const part of parts) {
    const m = part.match(/^(\d*)\s*-\s*(\d*)$/);
    let start: number, end: number;
    if (m) {
      start = m[1] ? parseInt(m[1], 10) : 1;
      end = m[2] ? parseInt(m[2], 10) : pageCount;
    } else if (/^\d+$/.test(part)) {
      start = end = parseInt(part, 10);
    } else {
      throw new Error(`“${part}” is not a valid page or range.`);
    }
    if (start < 1 || end > pageCount || start > end) {
      throw new Error(`Range “${part}” is outside 1–${pageCount}.`);
    }
    const g: number[] = [];
    for (let p = start; p <= end; p++) g.push(p - 1);
    groups.push(g);
  }
  return groups;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function hexToRgb01(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return typeof e === "string" ? e : "Something went wrong.";
}
