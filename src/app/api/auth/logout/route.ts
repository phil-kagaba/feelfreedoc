import { NextResponse } from "next/server";
import { destroySession } from "@/lib/server/auth";
import { jsonError, sameOrigin } from "@/lib/server/security";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError("Cross-site request blocked.", 403);
  const res = NextResponse.json({ ok: true });
  await destroySession(req, res);
  return res;
}
