import "server-only";
import { NextResponse } from "next/server";

/** Best-effort client IP (behind a trusted reverse proxy set TRUST_PROXY=1). */
export function clientIp(req: Request): string {
  if (process.env.TRUST_PROXY === "1") {
    const xf = req.headers.get("x-forwarded-for");
    if (xf) return xf.split(",")[0].trim();
    const xr = req.headers.get("x-real-ip");
    if (xr) return xr.trim();
  }
  return req.headers.get("x-forwarded-for")?.split(",").pop()?.trim() || "local";
}

/**
 * CSRF defence for state-changing requests: the Origin (or Referer) must match
 * the Host. Combined with SameSite=Lax cookies this blocks cross-site posts.
 */
export function sameOrigin(req: Request): boolean {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const origin = req.headers.get("origin") || req.headers.get("referer");
  if (!origin) return req.headers.get("sec-fetch-site") !== "cross-site";
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function jsonError(message: string, status = 400, headers?: Record<string, string>) {
  return NextResponse.json({ error: message }, { status, headers });
}

// ── Rate limiting (in-memory sliding window, per process) ─────────────
// For multi-instance deployments put a shared limiter (e.g. Redis) or your
// reverse proxy's rate limiting in front; this keeps a single node safe.

const buckets = new Map<string, number[]>();
let lastSweep = Date.now();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, v] of buckets) if (!v.length || now - v[v.length - 1] > 3_600_000) buckets.delete(k);
  }
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - hits[0])) / 1000) };
  }
  hits.push(now);
  buckets.set(key, hits);
  return { ok: true, retryAfter: 0 };
}

export function limited(req: Request, bucket: string, limit: number, windowMs: number) {
  const r = rateLimit(`${bucket}:${clientIp(req)}`, limit, windowMs);
  if (r.ok) return null;
  return jsonError("Too many requests — please wait a moment and try again.", 429, { "Retry-After": String(r.retryAfter) });
}
