import "server-only";
import { config } from "./config";

export function mailConfigured() {
  return !!config.smtp.host;
}

/**
 * Sends an email via SMTP when configured. Without SMTP, messages are logged to the
 * server console in development (or when MAIL_LOG=1) so password reset can be
 * tested locally, and skipped in production.
 */
export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  if (!mailConfigured()) {
    if (!config.isProd || process.env.MAIL_LOG === "1") console.info(`\n[mail:dev] To: ${to}\nSubject: ${subject}\n\n${text}\n`);
    else console.warn("[mail] SMTP is not configured; email not sent.");
    return false;
  }
  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
  await transport.sendMail({ from: config.smtp.from, to, subject, text });
  return true;
}
