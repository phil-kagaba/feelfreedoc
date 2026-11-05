import { NextResponse } from "next/server";
import { config } from "@/lib/server/config";
import { q } from "@/lib/server/db";
import { sendMail } from "@/lib/server/mail";
import { jsonError, limited, sameOrigin } from "@/lib/server/security";
import { normalizeEmail } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError("Cross-site request blocked.", 403);
  const rl = limited(req, "contact", 3, 10 * 60_000);
  if (rl) return rl;
  const body = await req.json().catch(() => ({}));
  if (body.website) return NextResponse.json({ ok: true }); // honeypot field for bots
  const name = String(body.name ?? "").trim().slice(0, 100);
  const email = normalizeEmail(body.email);
  const subject = String(body.subject ?? "").trim().slice(0, 150);
  const message = String(body.message ?? "").trim().slice(0, 5000);
  if (!name) return jsonError("Please enter your name.");
  if (!email) return jsonError("Please enter a valid email address.");
  if (message.length < 10) return jsonError("Please write a message of at least 10 characters.");
  await q("INSERT INTO contact_messages (name, email, subject, message) VALUES ($1, $2, $3, $4)", [name, email, subject, message]);
  if (config.contactEmail) {
    await sendMail(config.contactEmail, `[feelfreedoc contact] ${subject || "New message"}`, `From: ${name} <${email}>\n\n${message}`).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
