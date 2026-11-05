import { NextResponse } from "next/server";
import { getTool } from "@/lib/tools";
import { getUser } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { recordHistory } from "@/lib/server/history";
import { jsonError, limited, sameOrigin } from "@/lib/server/security";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user) return jsonError("Please log in.", 401);
  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200);
  const items = await q(
    `SELECT id::text, tool, file_names, file_count, input_bytes::float8 AS input_bytes, output_bytes::float8 AS output_bytes, created_at
       FROM history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [user.id, limit],
  );
  const top = await q<{ tool: string; uses: number }>(
    "SELECT tool, count(*)::int AS uses FROM history WHERE user_id = $1 GROUP BY tool ORDER BY uses DESC LIMIT 6",
    [user.id],
  );
  const totals = await q<{ jobs: number; bytes: number }>(
    "SELECT count(*)::int AS jobs, coalesce(sum(input_bytes),0)::float8 AS bytes FROM history WHERE user_id = $1",
    [user.id],
  );
  return NextResponse.json({ items, top, totals: totals[0] });
}

/** Called by in-browser tools after a successful job (metadata only). Anonymous calls are ignored. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError("Cross-site request blocked.", 403);
  const rl = limited(req, "history", 120, 60_000);
  if (rl) return rl;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ ok: true, stored: false });
  const body = await req.json().catch(() => null);
  if (!body || !getTool(String(body.tool))) return jsonError("Invalid entry.");
  const files = Array.isArray(body.files) ? body.files.slice(0, 50) : [];
  await recordHistory(user.id, body.tool, files, Number(body.outputBytes) || 0);
  return NextResponse.json({ ok: true, stored: true });
}

export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return jsonError("Cross-site request blocked.", 403);
  const user = await getUser(req);
  if (!user) return jsonError("Please log in.", 401);
  await q("DELETE FROM history WHERE user_id = $1", [user.id]);
  return NextResponse.json({ ok: true });
}
