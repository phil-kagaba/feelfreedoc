"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bot, Check, Copy, Download, KeyRound, LoaderCircle, RotateCcw, Send, Sparkles, Square, User } from "lucide-react";
import { logHistory } from "@/lib/client-store";
import { markdownToHtml } from "@/lib/markdown";
import { extractText } from "@/lib/pdfjs";
import type { ToolDef } from "@/lib/tools";
import { baseName, cn, downloadBlob, errorMessage, extOf } from "@/lib/utils";
import { getDoc } from "../workspace/pdf-hooks";
import { Alert, PanelTitle, ProcessButton, Segmented, SelectField, UploadStage, Workspace } from "../workspace/ui";
import { useToolState } from "../workspace/use-tool-state";

const LANGUAGES = [
  "English", "French", "Spanish", "German", "Portuguese", "Italian", "Dutch", "Swahili", "Kinyarwanda", "Arabic",
  "Chinese (Simplified)", "Japanese", "Korean", "Hindi", "Russian", "Turkish", "Polish", "Indonesian", "Vietnamese", "Ukrainian",
];

const EXTRACT_PRESETS = [
  { value: "key_facts", label: "Key facts" },
  { value: "dates", label: "Dates & deadlines" },
  { value: "entities", label: "People & organizations" },
  { value: "amounts", label: "Amounts & figures" },
  { value: "actions", label: "Action items" },
  { value: "custom", label: "Custom fields" },
];

interface Msg {
  role: "user" | "assistant";
  content: string;
}

function Markdown({ text }: { text: string }) {
  return (
    <div
      className="md-body text-[15px] leading-7 text-ink [&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1 [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:font-semibold [&_h4]:mt-3 [&_h4]:font-semibold [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_table]:w-full [&_table]:text-sm [&_td]:border [&_td]:border-line [&_td]:px-2 [&_td]:py-1.5 [&_th]:border [&_th]:border-line [&_th]:bg-surface-2 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_.md-table]:my-3 [&_.md-table]:overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: markdownToHtml(text) }}
    />
  );
}

async function streamAi(
  task: string,
  body: Record<string, unknown>,
  onDelta: (t: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch(`/api/ai/${task}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `AI request failed (${res.status}).`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = dec.decode(value, { stream: true });
    const errIdx = chunk.indexOf("\u0000ERROR:");
    if (errIdx >= 0) {
      if (errIdx > 0) onDelta(chunk.slice(0, errIdx));
      throw new Error(chunk.slice(errIdx + 7));
    }
    onDelta(chunk);
  }
}

export default function AiTool({ tool }: { tool: ToolDef }) {
  const s = useToolState(tool);
  const slug = tool.slug;
  const file = s.files[0]?.file;
  const [status, setStatus] = useState<{ configured: boolean; model?: string } | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [pages, setPages] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // options
  const [length, setLength] = useState<"short" | "medium" | "detailed">("medium");
  const [format, setFormat] = useState<"bullets" | "paragraphs">("bullets");
  const [outLang, setOutLang] = useState("same");
  const [target, setTarget] = useState("French");
  const [preset, setPreset] = useState("key_facts");
  const [fields, setFields] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [question, setQuestion] = useState("");
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/ai/status", { cache: "no-store" }).then((r) => r.json()).then(setStatus).catch(() => setStatus({ configured: false }));
  }, []);

  useEffect(() => {
    if (!file) {
      setText(null);
      return;
    }
    let alive = true;
    setExtracting(true);
    setOutput("");
    setMessages([]);
    (async () => {
      try {
        if (extOf(file.name) === ".pdf") {
          const doc = await getDoc(file);
          const p = await extractText(doc);
          if (!alive) return;
          setPages(p.length);
          setText(p.map((x) => `[Page ${x.page}]\n${x.text}`).join("\n\n"));
        } else {
          const t = await file.text();
          if (!alive) return;
          setPages(0);
          setText(t);
        }
      } catch (e) {
        if (alive) s.setError(errorMessage(e));
      } finally {
        if (alive) setExtracting(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  useEffect(() => chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [messages]);

  const contentChars = text ? text.replace(/\[Page \d+\]/g, "").replace(/\s+/g, "").length : 0;
  const noText = text !== null && contentChars < 20;

  async function generate(extra?: { messages: Msg[] }) {
    if (!text) return;
    const ctl = new AbortController();
    abortRef.current = ctl;
    setRunning(true);
    s.setError(null);
    const body = {
      text,
      fileName: file?.name,
      options: { length, format, outLang, target, preset, fields },
      messages: extra?.messages,
    };
    let acc = "";
    try {
      if (extra) {
        setMessages([...extra.messages, { role: "assistant", content: "" }]);
        await streamAi(slug, body, (d) => {
          acc += d;
          setMessages([...extra.messages, { role: "assistant", content: acc }]);
        }, ctl.signal);
      } else {
        setOutput("");
        await streamAi(slug, body, (d) => {
          acc += d;
          setOutput(acc);
        }, ctl.signal);
      }
      void logHistory({ tool: slug, files: file ? [{ name: file.name, size: file.size }] : [], outputBytes: acc.length });
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        s.setError(errorMessage(e));
        if (extra) setMessages(extra.messages);
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  if (!file) {
    return (
      <UploadStage
        state={s}
        hint="PDF, TXT or Markdown"
        extra={status && !status.configured ? <NotConfigured /> : undefined}
      />
    );
  }

  const isChat = slug === "ai-assistant";

  const main = (
    <div className="space-y-4">
      {status && !status.configured && <NotConfigured />}
      {extracting && (
        <div className="card flex items-center gap-3 p-5 text-sm text-muted"><LoaderCircle className="h-4 w-4 animate-spin" /> Reading document text…</div>
      )}
      {noText && (
        <Alert kind="warn">
          No selectable text was found — this looks like a scanned document. Run <Link className="font-semibold underline" href="/ocr-pdf">OCR PDF</Link> first, then use the searchable PDF here.
        </Alert>
      )}

      {isChat ? (
        <div className="card flex h-[min(70vh,640px)] flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink"><Bot className="h-6 w-6" /></span>
                <p className="mt-3 font-medium text-ink">Ask anything about “{file.name}”</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {["What is this document about?", "List the key dates.", "What are the main risks or obligations?"].map((q) => (
                    <button key={q} type="button" className="chip" disabled={!status?.configured || !text || noText || running} onClick={() => void generate({ messages: [{ role: "user", content: q }] })}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", m.role === "user" ? "bg-ink text-bg" : "bg-brand text-[#171717]")}>
                  {m.role === "user" ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                </span>
                <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5", m.role === "user" ? "bg-ink text-bg" : "bg-surface-2")}>
                  {m.role === "user" ? <p className="whitespace-pre-wrap text-[15px]">{m.content}</p> : m.content ? <Markdown text={m.content} /> : <LoaderCircle className="my-1 h-4 w-4 animate-spin text-muted" />}
                </div>
              </div>
            ))}
            <div ref={chatEnd} />
          </div>
          <form
            className="flex gap-2 border-t border-line p-3"
            onSubmit={(e) => {
              e.preventDefault();
              const q = question.trim();
              if (!q || running) return;
              setQuestion("");
              void generate({ messages: [...messages, { role: "user", content: q }] });
            }}
          >
            <input className="input" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask a question about the document…" disabled={!status?.configured || !text || noText} aria-label="Your question" maxLength={2000} />
            {running ? (
              <button type="button" className="btn-ghost shrink-0" onClick={() => abortRef.current?.abort()} aria-label="Stop"><Square className="h-4 w-4" /></button>
            ) : (
              <button type="submit" className="btn-primary shrink-0" disabled={!question.trim() || !status?.configured || !text || noText} aria-label="Send"><Send className="h-4 w-4" /></button>
            )}
          </form>
        </div>
      ) : (
        <div className="card min-h-72 p-5 sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">Result</h2>
            {output && !running && (
              <div className="flex gap-1">
                <button
                  type="button"
                  className="chip"
                  onClick={async () => {
                    await navigator.clipboard.writeText(output);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
                </button>
                <button
                  type="button"
                  className="chip"
                  onClick={() => downloadBlob(new Blob([output], { type: "text/markdown;charset=utf-8" }), `${baseName(file.name)}-${slug.replace("ai-", "")}.md`)}
                >
                  <Download className="h-4 w-4" /> Download
                </button>
              </div>
            )}
          </div>
          {output ? (
            <Markdown text={output} />
          ) : running ? (
            <div className="flex items-center gap-2 text-sm text-muted"><LoaderCircle className="h-4 w-4 animate-spin" /> Thinking…</div>
          ) : (
            <p className="text-sm text-muted">Choose your options and click <strong className="text-ink">{tool.action}</strong>. The result appears here as it&apos;s written.</p>
          )}
        </div>
      )}
    </div>
  );

  const side = (
    <>
      <PanelTitle sub={`${file.name}${pages ? ` · ${pages} pages` : ""}${text ? ` · ${contentChars.toLocaleString()} characters` : ""}`}>{tool.name}</PanelTitle>

      {slug === "ai-summarizer" && (
        <>
          <Segmented label="Length" value={length} onChange={setLength} options={[{ value: "short", label: "Short" }, { value: "medium", label: "Medium" }, { value: "detailed", label: "Detailed" }]} />
          <Segmented label="Format" value={format} onChange={setFormat} options={[{ value: "bullets", label: "Key points" }, { value: "paragraphs", label: "Paragraphs" }]} />
          <SelectField label="Summary language" value={outLang} onChange={setOutLang} options={[{ value: "same", label: "Same as document" }, ...LANGUAGES.map((l) => ({ value: l, label: l }))]} />
        </>
      )}
      {slug === "ai-translator" && (
        <SelectField label="Translate into" value={target} onChange={setTarget} options={LANGUAGES.map((l) => ({ value: l, label: l }))} />
      )}
      {slug === "ai-extractor" && (
        <>
          <SelectField label="What to extract" value={preset} onChange={setPreset} options={EXTRACT_PRESETS} />
          {preset === "custom" && (
            <label className="block">
              <span className="label">Fields</span>
              <textarea className="input min-h-24" value={fields} onChange={(e) => setFields(e.target.value)} placeholder={"invoice number\ntotal amount\ndue date"} />
            </label>
          )}
        </>
      )}
      {isChat && <p className="text-sm text-muted">Answers are based only on this document&apos;s text and cite page numbers where possible.</p>}

      {!isChat && (
        running ? (
          <button type="button" className="btn-ghost h-12 w-full" onClick={() => abortRef.current?.abort()}><Square className="h-4 w-4" /> Stop</button>
        ) : (
          <ProcessButton
            state={s}
            onClick={() => void generate()}
            disabled={!status?.configured || !text || noText || extracting || (preset === "custom" && slug === "ai-extractor" && !fields.trim())}
            label={output ? "Regenerate" : tool.action}
          />
        )
      )}
      {isChat && messages.length > 0 && (
        <button type="button" className="chip w-full justify-center" onClick={() => setMessages([])} disabled={running}><RotateCcw className="h-4 w-4" /> New conversation</button>
      )}
      <button type="button" className="chip w-full justify-center" onClick={s.reset} disabled={running}>Use a different file</button>
      {status?.configured && <p className="text-xs text-muted">AI output can contain mistakes. Check important details against the document.</p>}
    </>
  );

  return <Workspace state={s} main={main} side={side} />;
}

function NotConfigured() {
  return (
    <div className="card border-amber-300/60 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warn-soft text-amber-600"><KeyRound className="h-5 w-5" /></span>
        <div className="text-sm">
          <p className="font-semibold text-ink">AI features need an API key</p>
          <p className="mt-1 leading-6 text-muted">
            This installation doesn&apos;t have an AI provider configured, so AI tools are disabled rather than returning fake results.
            The site owner can enable them by setting <code className="rounded bg-surface-2 px-1">ANTHROPIC_API_KEY</code> in the server environment and restarting.
          </p>
        </div>
      </div>
    </div>
  );
}
