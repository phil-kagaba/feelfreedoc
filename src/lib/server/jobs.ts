import "server-only";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config";

// ── File type sniffing (never trust the extension alone) ───────────────

async function zipEntries(buf: Buffer): Promise<string> {
  // Cheap check: Office Open XML files are ZIPs whose central directory lists these names.
  return buf.subarray(0, Math.min(buf.length, 2_000_000)).toString("latin1") + buf.subarray(Math.max(0, buf.length - 200_000)).toString("latin1");
}

export async function sniff(buf: Buffer, ext: string): Promise<boolean> {
  const head = buf.subarray(0, 8);
  const isZip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
  const isOle = head.toString("hex", 0, 8) === "d0cf11e0a1b11ae1";
  switch (ext) {
    case ".pdf":
      return buf.subarray(0, 1024).toString("latin1").includes("%PDF-");
    case ".png":
      return head.toString("hex", 0, 8) === "89504e470d0a1a0a";
    case ".jpg":
    case ".jpeg":
      return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    case ".docx":
      return isZip && (await zipEntries(buf)).includes("word/");
    case ".xlsx":
      return isZip && (await zipEntries(buf)).includes("xl/");
    case ".pptx":
      return isZip && (await zipEntries(buf)).includes("ppt/");
    case ".odt":
    case ".ods":
    case ".odp":
      return isZip && buf.subarray(30, 120).toString("latin1").includes("application/vnd.oasis.opendocument");
    case ".doc":
    case ".xls":
    case ".ppt":
      return isOle;
    case ".rtf":
      return buf.subarray(0, 5).toString("latin1") === "{\\rtf";
    case ".csv":
    case ".html":
    case ".htm": {
      // Text formats: reject binary content (NUL bytes) in the first 64 KB.
      return !buf.subarray(0, 65536).includes(0);
    }
    default:
      return false;
  }
}

// ── Job directories ────────────────────────────────────────────────────

export async function createJobDir(): Promise<string> {
  await fs.mkdir(config.jobsDir, { recursive: true, mode: 0o700 });
  return fs.mkdtemp(path.join(config.jobsDir, "job-"));
}

export async function removeJobDir(dir: string) {
  if (!dir.startsWith(config.jobsDir)) return;
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
}

let lastSweep = 0;
/** Deletes any job directory older than 15 minutes (e.g. left by a crash). */
export async function sweepOldJobs() {
  const now = Date.now();
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  try {
    for (const name of await fs.readdir(config.jobsDir)) {
      const p = path.join(config.jobsDir, name);
      const st = await fs.stat(p).catch(() => null);
      if (st && now - st.mtimeMs > 15 * 60_000) await removeJobDir(p);
    }
  } catch {
    /* directory may not exist yet */
  }
}

// ── Concurrency-limited worker execution ───────────────────────────────

let running = 0;
const waiters: (() => void)[] = [];

async function acquire() {
  if (running < config.maxConcurrentJobs) {
    running++;
    return;
  }
  await new Promise<void>((r) => waiters.push(r));
  running++;
}
function release() {
  running--;
  waiters.shift()?.();
}

export function queueDepth() {
  return waiters.length;
}

export interface WorkerResult {
  output: string;
  info: Record<string, unknown>;
}

export class WorkerError extends Error {
  constructor(message: string, public status = 422) {
    super(message);
  }
}

export async function runWorker(op: string, input: string, outDir: string, options: object, timeoutSec: number): Promise<WorkerResult> {
  if (waiters.length > 50) throw new WorkerError("The server is busy right now. Please try again in a minute.", 503);
  await acquire();
  try {
    return await new Promise<WorkerResult>((resolve, reject) => {
      const child = spawn(config.pythonBin, ["-I", "-W", "ignore", config.workerScript, op, input, outDir, JSON.stringify(options)], {
        cwd: outDir,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1", HOME: outDir, OMP_THREAD_LIMIT: "1" },
        stdio: ["ignore", "pipe", "pipe"],
        detached: true, // own process group, so a timeout can kill LibreOffice/Chromium children too
      });
      let out = "";
      let err = "";
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => {
        if (err.length < 20_000) err += d;
      });
      const timer = setTimeout(() => {
        try {
          if (child.pid) process.kill(-child.pid, "SIGKILL");
        } catch {
          child.kill("SIGKILL");
        }
        reject(new WorkerError("Processing took too long and was stopped. Try a smaller file.", 504));
      }, timeoutSec * 1000);
      child.on("error", () => {
        clearTimeout(timer);
        reject(new WorkerError("The document engine is not available on this server.", 503));
      });
      child.on("close", () => {
        clearTimeout(timer);
        const line = out.trim().split("\n").pop() || "";
        try {
          const data = JSON.parse(line);
          if (data.error) return reject(new WorkerError(data.error));
          const resolved = path.resolve(data.output);
          if (!resolved.startsWith(outDir)) return reject(new WorkerError("Processing failed.", 500));
          resolve({ output: resolved, info: data.info ?? {} });
        } catch {
          console.error(`[worker:${op}] unexpected output`, err.slice(-2000));
          reject(new WorkerError("Processing failed unexpectedly. Please try again.", 500));
        }
      });
    });
  } finally {
    release();
  }
}

// ── Capability detection (cached) ──────────────────────────────────────

export interface Capabilities {
  python: boolean;
  pymupdf?: boolean;
  pikepdf?: boolean;
  pdf2docx?: boolean;
  pdfplumber?: boolean;
  pptx?: boolean;
  openpyxl?: boolean;
  libreoffice?: boolean;
  chromium?: boolean;
  tesseract?: boolean;
  ocrLanguages?: string[];
}

let capsCache: { at: number; caps: Capabilities } | null = null;

export async function capabilities(): Promise<Capabilities> {
  if (capsCache && Date.now() - capsCache.at < 5 * 60_000) return capsCache.caps;
  const caps = await new Promise<Capabilities>((resolve) => {
    const child = spawn(config.pythonBin, ["-I", "-W", "ignore", config.workerScript, "capabilities"], { stdio: ["ignore", "pipe", "ignore"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.on("error", () => resolve({ python: false }));
    child.on("close", () => {
      try {
        resolve(JSON.parse(out.trim().split("\n").pop() || "{}"));
      } catch {
        resolve({ python: false });
      }
    });
  });
  capsCache = { at: Date.now(), caps };
  return caps;
}

/** Which capabilities each server tool requires. */
export const REQUIREMENTS: Record<string, (keyof Capabilities)[]> = {
  "compress-pdf": ["pymupdf"],
  "optimize-pdf": ["pikepdf"],
  "repair-pdf": ["pikepdf", "pymupdf"],
  "word-to-pdf": ["libreoffice", "pymupdf"],
  "excel-to-pdf": ["libreoffice", "pymupdf"],
  "powerpoint-to-pdf": ["libreoffice", "pymupdf"],
  "pdf-to-word": ["pdf2docx", "pymupdf"],
  "pdf-to-excel": ["pdfplumber", "openpyxl", "pymupdf"],
  "pdf-to-powerpoint": ["pptx", "pymupdf"],
  "html-to-pdf": ["chromium", "pymupdf"],
  "ocr-pdf": ["tesseract", "pymupdf"],
  "protect-pdf": ["pikepdf"],
  "unlock-pdf": ["pikepdf"],
  "redact-pdf": ["pymupdf"],
};

const LABELS: Partial<Record<keyof Capabilities, string>> = {
  python: "Python 3", pymupdf: "PyMuPDF", pikepdf: "pikepdf", pdf2docx: "pdf2docx", pdfplumber: "pdfplumber",
  pptx: "python-pptx", openpyxl: "openpyxl", libreoffice: "LibreOffice", chromium: "Chromium", tesseract: "Tesseract OCR",
};

export async function missingFor(tool: string): Promise<string[]> {
  const caps = await capabilities();
  if (!caps.python) return ["Python 3 with the worker dependencies"];
  return (REQUIREMENTS[tool] ?? []).filter((k) => !caps[k]).map((k) => LABELS[k] ?? String(k));
}

export function randomId() {
  return crypto.randomBytes(6).toString("hex");
}
