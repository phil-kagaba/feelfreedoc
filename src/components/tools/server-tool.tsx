"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, FileCode2 } from "lucide-react";
import { processOnServer } from "@/lib/server-client";
import type { ToolDef } from "@/lib/tools";
import { formatBytes } from "@/lib/utils";
import { FileGrid } from "../workspace/file-grid";
import { Alert, PanelTitle, ProcessButton, ResultView, Segmented, Toggle, UploadStage, Workspace } from "../workspace/ui";
import { useToolState, type ToolResult } from "../workspace/use-tool-state";

interface Caps {
  available: boolean;
  missing: string[];
  ocrLanguages?: string[];
}

const LANG_NAMES: Record<string, string> = {
  eng: "English", fra: "French", deu: "German", spa: "Spanish", ita: "Italian", por: "Portuguese", nld: "Dutch",
  rus: "Russian", ara: "Arabic", chi_sim: "Chinese (Simplified)", chi_tra: "Chinese (Traditional)", jpn: "Japanese",
  kor: "Korean", hin: "Hindi", heb: "Hebrew", ind: "Indonesian", tur: "Turkish", pol: "Polish", swa: "Swahili",
  kin: "Kinyarwanda", ukr: "Ukrainian", vie: "Vietnamese", tha: "Thai", swe: "Swedish",
};

function PasswordInput({ value, onChange, label, autoFocus }: { value: string; onChange: (v: string) => void; label: string; autoFocus?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <span className="label">{label}</span>
      <span className="relative block">
        <input type={show ? "text" : "password"} className="input pr-11" value={value} onChange={(e) => onChange(e.target.value)} autoComplete="new-password" autoFocus={autoFocus} />
        <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </span>
    </label>
  );
}

export default function ServerTool({ tool }: { tool: ToolDef }) {
  const s = useToolState(tool);
  const slug = tool.slug;
  const [caps, setCaps] = useState<Caps | null>(null);

  // options
  const [level, setLevel] = useState<"low" | "recommended" | "high">("recommended");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [ownerPw, setOwnerPw] = useState("");
  const [allowPrint, setAllowPrint] = useState(true);
  const [allowCopy, setAllowCopy] = useState(false);
  const [allowEdit, setAllowEdit] = useState(false);
  const [langs, setLangs] = useState<string[]>(["eng"]);
  const [ocrOutput, setOcrOutput] = useState<"pdf" | "txt">("pdf");
  const [htmlSource, setHtmlSource] = useState("");
  const [pageSize, setPageSize] = useState<"A4" | "Letter">("A4");
  const [landscape, setLandscape] = useState(false);
  const [background, setBackground] = useState(true);
  const [dpi, setDpi] = useState("150");

  useEffect(() => {
    fetch(`/api/process/${slug}`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setCaps)
      .catch(() => setCaps({ available: false, missing: ["server"] }));
  }, [slug]);

  if (s.result) return <ResultView state={s} />;

  const unavailable = caps && !caps.available && (
    <Alert kind="warn">
      This tool needs server software that isn&apos;t installed on this deployment ({caps.missing.join(", ")}). See the README for setup instructions.
    </Alert>
  );

  if (!s.files.length) {
    return (
      <UploadStage
        state={s}
        extra={
          <>
            {unavailable}
            {slug === "html-to-pdf" && (
              <div className="card space-y-3 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink"><FileCode2 className="h-4 w-4 text-brand-ink" /> Or paste HTML</div>
                <textarea className="input min-h-40 font-mono text-xs" value={htmlSource} onChange={(e) => setHtmlSource(e.target.value)} placeholder="<h1>Invoice</h1><p>Paste any HTML here…</p>" />
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!htmlSource.trim()}
                  onClick={() => s.addFiles([new File([htmlSource], "pasted.html", { type: "text/html" })])}
                >
                  Use this HTML
                </button>
              </div>
            )}
          </>
        }
      />
    );
  }

  const file = s.files[0].file;

  function options(): Record<string, unknown> {
    switch (slug) {
      case "compress-pdf": return { level };
      case "protect-pdf": return { password: pw, ownerPassword: ownerPw || undefined, allowPrint, allowCopy, allowEdit };
      case "unlock-pdf": return { password: pw };
      case "ocr-pdf": return { languages: langs, output: ocrOutput };
      case "html-to-pdf": return { pageSize, landscape, background };
      case "pdf-to-powerpoint": return { dpi: Number(dpi) };
      default: return {};
    }
  }

  function validate(): string | null {
    if (slug === "protect-pdf") {
      if (pw.length < 4) return "Use a password with at least 4 characters.";
      if (pw !== pw2) return "The passwords don't match.";
    }
    if (slug === "unlock-pdf" && !pw) return "Enter the document's current password.";
    if (slug === "ocr-pdf" && !langs.length) return "Choose at least one language.";
    return null;
  }

  async function run() {
    const v = validate();
    if (v) return s.setError(v);
    await s.run(async (progress) => {
      const res = await processOnServer(slug, [file], options(), progress);
      const result: ToolResult = { outputs: [{ blob: res.blob, name: res.filename }] };
      if (slug === "compress-pdf" || slug === "optimize-pdf" || slug === "repair-pdf") {
        const before = file.size;
        const after = res.blob.size;
        const saved = Math.round((1 - after / before) * 100);
        result.stats = [
          { label: "Original", value: formatBytes(before) },
          { label: slug === "repair-pdf" ? "Repaired" : "New size", value: formatBytes(after), highlight: true },
          ...(slug !== "repair-pdf" ? [{ label: "Saved", value: saved > 0 ? `${saved}%` : "0%" }] : []),
        ];
        if (slug !== "repair-pdf" && saved <= 0) result.message = "This file was already well optimized, so we kept it as small as possible.";
      }
      if (res.info.note) result.message = String(res.info.note);
      if (res.info.pages) result.stats = [...(result.stats ?? []), { label: "Pages", value: String(res.info.pages) }];
      return result;
    });
  }

  const side = (
    <>
      <PanelTitle sub={`${file.name} · ${formatBytes(file.size)}`}>{tool.name}</PanelTitle>
      {unavailable}

      {slug === "compress-pdf" && (
        <Segmented
          label="Compression level"
          value={level}
          onChange={setLevel}
          options={[
            { value: "low", label: "Low", sub: "Best quality" },
            { value: "recommended", label: "Recommended", sub: "Good balance" },
            { value: "high", label: "High", sub: "Smallest file" },
          ]}
        />
      )}

      {slug === "protect-pdf" && (
        <div className="space-y-3">
          <PasswordInput label="Password" value={pw} onChange={setPw} autoFocus />
          <PasswordInput label="Repeat password" value={pw2} onChange={setPw2} />
          <details className="rounded-xl border border-line p-3">
            <summary className="cursor-pointer text-sm font-medium text-ink">Permissions & owner password</summary>
            <div className="mt-3 space-y-3">
              <Toggle checked={allowPrint} onChange={setAllowPrint} label="Allow printing" />
              <Toggle checked={allowCopy} onChange={setAllowCopy} label="Allow copying text" />
              <Toggle checked={allowEdit} onChange={setAllowEdit} label="Allow editing" />
              <PasswordInput label="Owner password (optional)" value={ownerPw} onChange={setOwnerPw} />
            </div>
          </details>
          <p className="text-xs text-muted">Encrypted with AES-256. We can&apos;t recover a forgotten password.</p>
        </div>
      )}

      {slug === "unlock-pdf" && (
        <div className="space-y-2">
          <PasswordInput label="Current password" value={pw} onChange={setPw} autoFocus />
          <p className="text-xs text-muted">Only unlock documents you own or are authorized to modify.</p>
        </div>
      )}

      {slug === "ocr-pdf" && (
        <div className="space-y-3">
          <div>
            <span className="label">Document language{langs.length > 1 ? "s" : ""}</span>
            <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
              {(caps?.ocrLanguages ?? ["eng"]).map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={langs.includes(l)}
                  onClick={() => setLangs((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : cur.length >= 3 ? cur : [...cur, l]))}
                  className={`chip ${langs.includes(l) ? "chip-active" : ""}`}
                >
                  {LANG_NAMES[l] ?? l}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted">Up to 3 languages.</p>
          </div>
          <Segmented label="Output" value={ocrOutput} onChange={setOcrOutput} options={[{ value: "pdf", label: "Searchable PDF" }, { value: "txt", label: "Text file" }]} />
        </div>
      )}

      {slug === "html-to-pdf" && (
        <div className="space-y-3">
          <Segmented label="Page size" value={pageSize} onChange={setPageSize} options={[{ value: "A4", label: "A4" }, { value: "Letter", label: "Letter" }]} />
          <Toggle checked={landscape} onChange={setLandscape} label="Landscape" />
          <Toggle checked={background} onChange={setBackground} label="Print backgrounds" />
          <p className="text-xs text-muted">External resources (remote images, scripts) are blocked for security. Use inline styles or data: URLs.</p>
        </div>
      )}

      {slug === "pdf-to-powerpoint" && (
        <Segmented label="Slide image quality" value={dpi} onChange={setDpi} options={[{ value: "110", label: "Standard" }, { value: "150", label: "High" }, { value: "200", label: "Maximum" }]} />
      )}

      {slug === "pdf-to-word" && <p className="text-sm text-muted">Paragraphs, tables and images are reconstructed as editable Word content. Scanned PDFs need OCR first.</p>}
      {slug === "pdf-to-excel" && <p className="text-sm text-muted">Each page with data becomes a worksheet. Detected tables keep their rows and columns.</p>}
      {slug === "repair-pdf" && <p className="text-sm text-muted">We rebuild the file structure and recover every readable page.</p>}
      {slug === "optimize-pdf" && <p className="text-sm text-muted">Removes unused objects, compresses internal streams and linearizes for fast web viewing. Visual content is unchanged.</p>}

      <ProcessButton state={s} onClick={() => void run()} disabled={caps?.available === false} />
      <button type="button" className="chip w-full justify-center" onClick={s.reset}>Use a different file</button>
    </>
  );

  return <Workspace state={s} main={<FileGrid state={s} sortable={false} />} side={side} />;
}
