import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getTool } from "@/lib/tools";
import { config } from "@/lib/server/config";
import { capabilities, createJobDir, missingFor, removeJobDir, runWorker, sniff, sweepOldJobs, WorkerError } from "@/lib/server/jobs";
import { jsonError, limited, sameOrigin } from "@/lib/server/security";
import { getUser } from "@/lib/server/auth";
import { recordHistory } from "@/lib/server/history";

export const runtime = "nodejs";
export const maxDuration = 600;

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain; charset=utf-8",
};

const SUFFIX: Record<string, string> = {
  "compress-pdf": "-compressed",
  "optimize-pdf": "-optimized",
  "repair-pdf": "-repaired",
  "protect-pdf": "-protected",
  "unlock-pdf": "-unlocked",
  "redact-pdf": "-redacted",
  "ocr-pdf": "-ocr",
};

function safeBase(name: string) {
  return (name.replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N}._ -]+/gu, "_").trim().slice(0, 100)) || "document";
}

function serverTool(slug: string) {
  const t = getTool(slug);
  return t && (t.engine === "server" || slug === "redact-pdf") ? t : null;
}

/** Capability check so the UI can tell users honestly when a tool can't run here. */
export async function GET(_req: Request, ctx: { params: Promise<{ tool: string }> }) {
  const { tool: slug } = await ctx.params;
  if (!serverTool(slug)) return jsonError("Unknown tool.", 404);
  const missing = await missingFor(slug);
  const caps = await capabilities();
  return NextResponse.json({
    available: missing.length === 0,
    missing,
    ...(slug === "ocr-pdf" ? { ocrLanguages: caps.ocrLanguages ?? [] } : {}),
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ tool: string }> }) {
  const { tool: slug } = await ctx.params;
  const tool = serverTool(slug);
  if (!tool) return jsonError("Unknown tool.", 404);
  if (!sameOrigin(req)) return jsonError("Cross-site request blocked.", 403);
  const rl = limited(req, "process", 30, 60_000) ?? limited(req, "process-hour", 300, 3_600_000);
  if (rl) return rl;

  const maxBytes = config.maxUploadMb * 1024 * 1024;
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > maxBytes + 1024 * 1024) return jsonError(`Files are limited to ${config.maxUploadMb} MB.`, 413);

  const missing = await missingFor(slug);
  if (missing.length) return jsonError(`This tool isn't available on this server (missing: ${missing.join(", ")}).`, 503);

  void sweepOldJobs();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("The upload could not be read. Please try again.");
  }
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  let options: Record<string, unknown> = {};
  try {
    const raw = form.get("options");
    if (typeof raw === "string" && raw.length < 200_000) options = JSON.parse(raw) ?? {};
  } catch {
    return jsonError("Invalid options.");
  }
  if (files.length !== 1) return jsonError("Upload exactly one file for this tool.");
  const file = files[0];
  const ext = path.extname(file.name).toLowerCase();
  if (!tool.accept.includes(ext)) return jsonError(`Unsupported file type. Accepted: ${tool.accept.join(", ")}`, 415);
  if (file.size === 0) return jsonError("The file is empty.");
  if (file.size > maxBytes) return jsonError(`Files are limited to ${config.maxUploadMb} MB.`, 413);

  const buf = Buffer.from(await file.arrayBuffer());
  if (!(await sniff(buf, ext))) return jsonError(`This doesn't look like a valid ${ext.slice(1).toUpperCase()} file.`, 415);

  const dir = await createJobDir();
  try {
    // The original filename never touches the filesystem — only a fixed, safe name.
    const input = path.join(dir, `input${ext}`);
    await fs.writeFile(input, buf, { mode: 0o600 });
    const outDir = path.join(dir, "out");
    await fs.mkdir(outDir);
    const timeout = slug === "ocr-pdf" ? config.ocrTimeoutSec : config.jobTimeoutSec;
    const result = await runWorker(slug, input, outDir, { ...options, _timeout: timeout - 10 }, timeout);
    const data = await fs.readFile(result.output);
    const outExt = path.extname(result.output).toLowerCase();
    const name = `${safeBase(file.name)}${SUFFIX[slug] ?? ""}${outExt}`;

    const user = await getUser(req).catch(() => null);
    if (user) void recordHistory(user.id, slug, [{ name: file.name, size: file.size }], data.length);

    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": MIME[outExt] ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${name.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Content-Length": String(data.length),
        "Cache-Control": "no-store",
        "X-FFD-Info": encodeURIComponent(JSON.stringify(result.info)),
      },
    });
  } catch (e) {
    if (e instanceof WorkerError) return jsonError(e.message, e.status);
    console.error(`[process:${slug}]`, e);
    return jsonError("Processing failed. Please try again.", 500);
  } finally {
    await removeJobDir(dir);
  }
}
