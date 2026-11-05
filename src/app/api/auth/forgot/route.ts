import { NextResponse } from "next/server";
import { createResetToken, normalizeEmail } from "@/lib/server/auth";
import { config } from "@/lib/server/config";
import { q } from "@/lib/server/db";
import { sendMail } from "@/lib/server/mail";
import { jsonError, limited, sameOrigin } from "@/lib/server/security";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError("Cross-site request blocked.", 403);
  const rl = limited(req, "forgot", 5, 15 * 60_000);
  if (rl) return rl;
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  if (!email) return jsonError("Please enter a valid email address.");
  const rows = await q<{ id: string; name: string }>("SELECT id, name FROM users WHERE email = $1", [email]);
  if (rows[0]) {
    const token = await createResetToken(rows[0].id);
    const link = `${config.siteUrl.replace(/\/$/, "")}/reset-password?token=${token}`;
    await sendMail(
      email,
      "Reset your feelfreedoc password",
      `Hi ${rows[0].name || "there"},\n\nSomeone (hopefully you) asked to reset your feelfreedoc password.\nOpen this link within 1 hour to choose a new one:\n\n${link}\n\nIf you didn't ask for this, you can ignore this email.\n`,
    ).catch((e) => console.error("[forgot] mail failed", e));
  }
  // Same response either way so the endpoint can't be used to discover accounts.
  return NextResponse.json({ ok: true });
}
