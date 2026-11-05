import { NextResponse } from "next/server";
import { getUser, normalizeEmail, publicUser, verifyPassword, type User } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { jsonError, limited, sameOrigin } from "@/lib/server/security";

export const runtime = "nodejs";

export async function PATCH(req: Request) {
  if (!sameOrigin(req)) return jsonError("Cross-site request blocked.", 403);
  const rl = limited(req, "profile", 20, 15 * 60_000);
  if (rl) return rl;
  const user = await getUser(req);
  if (!user) return jsonError("Please log in.", 401);
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : user.name;
  if (!name) return jsonError("Name can't be empty.");
  let email = user.email;
  if (body.email !== undefined && body.email !== user.email) {
    const e = normalizeEmail(body.email);
    if (!e) return jsonError("Please enter a valid email address.");
    const [row] = await q<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [user.id]);
    if (!(await verifyPassword(String(body.currentPassword ?? ""), row.password_hash))) {
      return jsonError("Enter your current password to change your email.", 401);
    }
    if ((await q("SELECT 1 FROM users WHERE email = $1 AND id <> $2", [e, user.id])).length) {
      return jsonError("That email is already in use.", 409);
    }
    email = e;
  }
  const [updated] = await q<User>(
    "UPDATE users SET name = $1, email = $2, updated_at = now() WHERE id = $3 RETURNING id, email, name, created_at",
    [name, email, user.id],
  );
  return NextResponse.json({ user: publicUser(updated) });
}
