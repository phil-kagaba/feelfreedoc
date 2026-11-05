import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSession, normalizeEmail, publicUser, verifyPassword, type User } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { jsonError, limited, rateLimit, sameOrigin } from "@/lib/server/security";

export const runtime = "nodejs";

// Constant-time-ish dummy hash so unknown emails take as long as known ones.
let DUMMY: string | null = null;

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError("Cross-site request blocked.", 403);
  const rl = limited(req, "login", 10, 15 * 60_000);
  if (rl) return rl;
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) return jsonError("Enter your email and password.");
  // Per-account limit as well as per-IP, to slow credential stuffing.
  if (!rateLimit(`login-acct:${email}`, 10, 15 * 60_000).ok) {
    return jsonError("Too many attempts for this account. Try again in 15 minutes.", 429);
  }
  const rows = await q<User & { password_hash: string }>(
    "SELECT id, email, name, created_at, password_hash FROM users WHERE email = $1",
    [email],
  );
  const user = rows[0];
  const ok = await verifyPassword(password, user?.password_hash ?? (DUMMY ??= bcrypt.hashSync("not-a-real-password", 12)));
  if (!user || !ok) return jsonError("Incorrect email or password.", 401);
  const res = NextResponse.json({ user: publicUser(user) });
  await createSession(res, user.id, req.headers.get("user-agent") ?? "");
  return res;
}
