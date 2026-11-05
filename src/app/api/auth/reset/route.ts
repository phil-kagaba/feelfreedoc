import { NextResponse } from "next/server";
import { consumeResetToken, destroyAllSessions, hashPassword, passwordProblem } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { jsonError, limited, sameOrigin } from "@/lib/server/security";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError("Cross-site request blocked.", 403);
  const rl = limited(req, "reset", 10, 15 * 60_000);
  if (rl) return rl;
  const body = await req.json().catch(() => ({}));
  if (typeof body.token !== "string" || body.token.length > 100) return jsonError("This reset link is invalid.");
  const pwErr = passwordProblem(body.password);
  if (pwErr) return jsonError(pwErr);
  const userId = await consumeResetToken(body.token);
  if (!userId) return jsonError("This reset link is invalid or has expired. Request a new one.", 410);
  await q("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2", [await hashPassword(body.password), userId]);
  await destroyAllSessions(userId);
  return NextResponse.json({ ok: true });
}
