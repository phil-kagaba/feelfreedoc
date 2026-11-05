import { NextResponse } from "next/server";
import { createSession, hashPassword, normalizeEmail, passwordProblem, publicUser, type User } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { jsonError, limited, sameOrigin } from "@/lib/server/security";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError("Cross-site request blocked.", 403);
  const rl = limited(req, "signup", 5, 15 * 60_000);
  if (rl) return rl;
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  if (!name) return jsonError("Please enter your name.");
  if (!email) return jsonError("Please enter a valid email address.");
  const pwErr = passwordProblem(body.password);
  if (pwErr) return jsonError(pwErr);
  const existing = await q("SELECT 1 FROM users WHERE email = $1", [email]);
  if (existing.length) return jsonError("An account with this email already exists. Try logging in.", 409);
  const hash = await hashPassword(body.password);
  const [user] = await q<User>(
    "INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name, created_at",
    [email, name, hash],
  );
  const res = NextResponse.json({ user: publicUser(user) }, { status: 201 });
  await createSession(res, user.id, req.headers.get("user-agent") ?? "");
  return res;
}
