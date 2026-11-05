import { NextResponse } from "next/server";
import { destroySession, getUser, verifyPassword } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { jsonError, limited, sameOrigin } from "@/lib/server/security";

export const runtime = "nodejs";

/** Permanently deletes the account, its sessions and its history. */
export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return jsonError("Cross-site request blocked.", 403);
  const rl = limited(req, "delete-account", 5, 15 * 60_000);
  if (rl) return rl;
  const user = await getUser(req);
  if (!user) return jsonError("Please log in.", 401);
  const body = await req.json().catch(() => ({}));
  const [row] = await q<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [user.id]);
  if (!(await verifyPassword(String(body.password ?? ""), row.password_hash))) return jsonError("Incorrect password.", 401);
  const res = NextResponse.json({ ok: true });
  await destroySession(req, res);
  await q("DELETE FROM users WHERE id = $1", [user.id]);
  return res;
}
