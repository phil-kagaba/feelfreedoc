import { NextResponse } from "next/server";
import { destroyAllSessions, getUser, hashPassword, passwordProblem, verifyPassword } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { jsonError, limited, sameOrigin } from "@/lib/server/security";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError("Cross-site request blocked.", 403);
  const rl = limited(req, "password", 10, 15 * 60_000);
  if (rl) return rl;
  const user = await getUser(req);
  if (!user) return jsonError("Please log in.", 401);
  const body = await req.json().catch(() => ({}));
  const [row] = await q<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [user.id]);
  if (!(await verifyPassword(String(body.currentPassword ?? ""), row.password_hash))) {
    return jsonError("Your current password is incorrect.", 401);
  }
  const pwErr = passwordProblem(body.newPassword);
  if (pwErr) return jsonError(pwErr);
  await q("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2", [await hashPassword(body.newPassword), user.id]);
  await destroyAllSessions(user.id, req); // sign out other devices
  return NextResponse.json({ ok: true });
}
