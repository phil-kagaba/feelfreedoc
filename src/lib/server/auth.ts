import "server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { q } from "./db";
import { config } from "./config";

export const SESSION_COOKIE = "ffd_session";
const SESSION_DAYS = 30;

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}

export function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

/** Returns an error message or null. */
export function passwordProblem(pw: string): string | null {
  if (typeof pw !== "string" || pw.length < 8) return "Password must be at least 8 characters.";
  if (pw.length > 128) return "Password is too long.";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "Use at least one letter and one number.";
  return null;
}

export function normalizeEmail(e: unknown): string | null {
  if (typeof e !== "string") return null;
  const v = e.trim().toLowerCase();
  return /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(v) && v.length <= 254 ? v : null;
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export async function createSession(res: NextResponse, userId: string, userAgent = "") {
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await q("INSERT INTO sessions (id, user_id, expires_at, user_agent) VALUES ($1, $2, $3, $4)", [
    sha256(token), userId, expires.toISOString(), userAgent.slice(0, 300),
  ]);
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.isProd && config.siteUrl.startsWith("https"),
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function getUser(req: Request): Promise<User | null> {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token || token.length > 100) return null;
  const rows = await q<User & { expires_at: string }>(
    `SELECT u.id, u.email, u.name, u.created_at, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = $1 AND s.expires_at > now()`,
    [sha256(token)],
  );
  return rows[0] ?? null;
}

export async function destroySession(req: Request, res: NextResponse) {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) await q("DELETE FROM sessions WHERE id = $1", [sha256(token)]);
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function destroyAllSessions(userId: string, exceptReq?: Request) {
  const keep = exceptReq ? readCookie(exceptReq, SESSION_COOKIE) : null;
  if (keep) await q("DELETE FROM sessions WHERE user_id = $1 AND id <> $2", [userId, sha256(keep)]);
  else await q("DELETE FROM sessions WHERE user_id = $1", [userId]);
}

export async function createResetToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  await q("DELETE FROM password_resets WHERE user_id = $1", [userId]);
  await q("INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '1 hour')", [
    sha256(token), userId,
  ]);
  return token;
}

export async function consumeResetToken(token: string): Promise<string | null> {
  const rows = await q<{ user_id: string }>(
    `UPDATE password_resets SET used_at = now()
      WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
      RETURNING user_id`,
    [sha256(token)],
  );
  return rows[0]?.user_id ?? null;
}

export function publicUser(u: User) {
  return { id: u.id, email: u.email, name: u.name, createdAt: u.created_at };
}
