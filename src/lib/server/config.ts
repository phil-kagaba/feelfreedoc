import "server-only";
import path from "node:path";
import os from "node:os";

export const config = {
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 50),
  maxFilesPerJob: 20,
  pythonBin: process.env.PYTHON_BIN || "python3",
  workerScript: path.join(process.cwd(), "worker", "docworker.py"),
  jobsDir: process.env.JOBS_DIR || path.join(os.tmpdir(), "feelfreedoc-jobs"),
  /** Max simultaneous server-side conversions (LibreOffice/OCR are CPU heavy). */
  maxConcurrentJobs: Number(process.env.MAX_CONCURRENT_JOBS || Math.max(1, Math.min(4, os.cpus().length))),
  jobTimeoutSec: Number(process.env.JOB_TIMEOUT_SEC || 180),
  ocrTimeoutSec: Number(process.env.OCR_TIMEOUT_SEC || 600),
  anthropicKey: process.env.ANTHROPIC_API_KEY || "",
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
  aiMaxInputChars: Number(process.env.AI_MAX_INPUT_CHARS || 400_000),
  databaseUrl: process.env.DATABASE_URL || "",
  pgliteDir: process.env.PGLITE_DIR || path.join(process.cwd(), ".data", "pglite"),
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  isProd: process.env.NODE_ENV === "production",
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "feelfreedoc <no-reply@feelfreedoc.local>",
  },
  contactEmail: process.env.CONTACT_EMAIL || "",
};
