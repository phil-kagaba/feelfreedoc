import { aiConfigured, runAi } from "@/lib/server/ai";
import { getUser } from "@/lib/server/auth";
import { jsonError, limited, sameOrigin } from "@/lib/server/security";

export const runtime = "nodejs";
export const maxDuration = 300;

const TASKS = new Set(["ai-summarizer", "ai-translator", "ai-extractor", "ai-assistant"]);

export async function POST(req: Request, ctx: { params: Promise<{ task: string }> }) {
  const { task } = await ctx.params;
  if (!TASKS.has(task)) return jsonError("Unknown AI tool.", 404);
  if (!sameOrigin(req)) return jsonError("Cross-site request blocked.", 403);
  if (!aiConfigured()) {
    return jsonError("AI features are not configured on this server. The site owner needs to set ANTHROPIC_API_KEY.", 503);
  }
  const rl = limited(req, "ai", 20, 10 * 60_000) ?? limited(req, "ai-day", 200, 86_400_000);
  if (rl) return rl;

  const body = await req.json().catch(() => null);
  if (!body || typeof body.text !== "string") return jsonError("Missing document text.");
  if (body.text.length > 5_000_000) return jsonError("This document is too large for the AI tools.", 413);
  if (body.text.replace(/\s+/g, "").length < 20) return jsonError("The document has no readable text. Run OCR PDF first.");

  // Keep the user identified only for abuse prevention; nothing is stored.
  await getUser(req).catch(() => null);

  const enc = new TextEncoder();
  const ctl = new AbortController();
  req.signal.addEventListener("abort", () => ctl.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await runAi(
          { task, text: body.text, fileName: body.fileName, options: body.options ?? {}, messages: body.messages },
          (t) => controller.enqueue(enc.encode(t)),
          ctl.signal,
        );
      } catch (e) {
        if (!ctl.signal.aborted) {
          const status = (e as { status?: number }).status;
          const msg =
            status === 401 ? "The AI provider rejected the API key. Check ANTHROPIC_API_KEY."
            : status === 429 ? "The AI provider is rate-limiting requests. Please try again shortly."
            : status === 529 || status === 503 ? "The AI provider is overloaded. Please try again shortly."
            : (e as Error).message === "Ask a question first." ? "Ask a question first."
            : "The AI request failed. Please try again.";
          console.error(`[ai:${task}]`, status ?? "", (e as Error).message);
          controller.enqueue(enc.encode(`\u0000ERROR:${msg}`));
        }
      } finally {
        controller.close();
      }
    },
    cancel() {
      ctl.abort();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
