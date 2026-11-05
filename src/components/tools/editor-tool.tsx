"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  ArrowUpRight, Calendar, ChevronLeft, ChevronRight, Circle, Eraser, Highlighter, ImagePlus, LoaderCircle,
  Minus, MessageSquare, MousePointer2, Pencil, Signature, Square, StickyNote, Trash2, Type, Underline, Undo2, ZoomIn, ZoomOut, EyeOff,
} from "lucide-react";
import { applyEditorObjects, loadPdf, savePdf, type EditorObject } from "@/lib/pdf-ops";
import { renderThumb } from "@/lib/pdfjs";
import { processOnServer } from "@/lib/server-client";
import type { ToolDef } from "@/lib/tools";
import { baseName, cn, uid } from "@/lib/utils";
import { getDoc } from "../workspace/pdf-hooks";
import { Alert, PanelTitle, ProcessButton, ResultView, Toggle, UploadStage, Workspace } from "../workspace/ui";
import { useToolState } from "../workspace/use-tool-state";
import { SignaturePad } from "./signature-pad";

type ToolId =
  | "select" | "text" | "image" | "signature" | "rect" | "ellipse" | "line" | "arrow"
  | "ink" | "highlight" | "underline" | "note" | "whiteout" | "redact";

const TOOL_META: Record<ToolId, { label: string; icon: React.ComponentType<{ className?: string }>; hint: string }> = {
  select: { label: "Select", icon: MousePointer2, hint: "Click an item to select, drag to move, use the corner handle to resize." },
  text: { label: "Text", icon: Type, hint: "Click on the page to add a text box." },
  image: { label: "Image", icon: ImagePlus, hint: "Choose an image; it is placed in the middle of the page." },
  signature: { label: "Signature", icon: Signature, hint: "Create a signature, then drag it into place." },
  rect: { label: "Rectangle", icon: Square, hint: "Drag on the page to draw a rectangle." },
  ellipse: { label: "Ellipse", icon: Circle, hint: "Drag on the page to draw an ellipse or circle." },
  line: { label: "Line", icon: Minus, hint: "Drag to draw a straight line." },
  arrow: { label: "Arrow", icon: ArrowUpRight, hint: "Drag to draw an arrow." },
  ink: { label: "Draw", icon: Pencil, hint: "Draw freehand with your mouse, finger or stylus." },
  highlight: { label: "Highlight", icon: Highlighter, hint: "Drag over text to highlight it." },
  underline: { label: "Underline", icon: Underline, hint: "Drag under text to underline it." },
  note: { label: "Comment", icon: StickyNote, hint: "Click to place a sticky-note comment." },
  whiteout: { label: "Whiteout", icon: Eraser, hint: "Drag to cover content with a white box." },
  redact: { label: "Redact area", icon: EyeOff, hint: "Drag boxes over content that must be permanently removed." },
};

const MODE_TOOLS: Record<string, ToolId[]> = {
  "edit-pdf": ["select", "text", "image", "rect", "ellipse", "line", "arrow", "ink", "whiteout"],
  "add-images": ["select", "image"],
  "add-shapes": ["select", "rect", "ellipse", "line", "arrow"],
  "sign-pdf": ["select", "signature", "text"],
  "annotate-pdf": ["select", "highlight", "underline", "ink", "note", "text"],
  "redact-pdf": ["select", "redact"],
};

const DEFAULT_TOOL: Record<string, ToolId> = {
  "edit-pdf": "text", "add-images": "image", "add-shapes": "rect", "sign-pdf": "signature", "annotate-pdf": "highlight", "redact-pdf": "redact",
};

const SWATCHES = ["#171717", "#dc2626", "#2563eb", "#16a34a", "#f59e0b", "#ffffff"];

interface Style {
  stroke: string;
  fill: string | null;
  width: number;
  opacity: number;
  textSize: number;
  textColor: string;
  bold: boolean;
}

function measureText(text: string, size: number, bold: boolean) {
  const c = document.createElement("canvas").getContext("2d")!;
  c.font = `${bold ? "700" : "400"} ${size}px Helvetica, Arial, sans-serif`;
  const lines = text.split("\n");
  const w = Math.max(...lines.map((l) => c.measureText(l || " ").width));
  return { w: Math.max(w, size), h: lines.length * size * 1.25 };
}

function lineBox(x1: number, y1: number, x2: number, y2: number, width: number) {
  const pad = width / 2 + 4;
  return { x: Math.min(x1, x2) - pad, y: Math.min(y1, y2) - pad, w: Math.abs(x2 - x1) + pad * 2, h: Math.abs(y2 - y1) + pad * 2 };
}

function inkBox(points: [number, number][], width: number) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const pad = width / 2 + 2;
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) - x + pad, h: Math.max(...ys) - y + pad };
}

type Drag =
  | { kind: "draw"; id: string; sx: number; sy: number }
  | { kind: "move"; id: string; sx: number; sy: number; orig: EditorObject }
  | { kind: "resize"; id: string; sx: number; sy: number; orig: EditorObject }
  | { kind: "end"; id: string; which: 1 | 2; orig: EditorObject };

export default function EditorTool({ tool }: { tool: ToolDef }) {
  const s = useToolState(tool);
  const file = s.files[0]?.file;
  const mode = tool.slug;
  const tools = MODE_TOOLS[mode];
  const isRedact = mode === "redact-pdf";

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<{ w: number; h: number }[]>([]);
  const [page, setPage] = useState(0);
  const [bg, setBg] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [objects, setObjects] = useState<EditorObject[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [active, setActive] = useState<ToolId>(DEFAULT_TOOL[mode]);
  const [zoom, setZoom] = useState(1);
  const [containerW, setContainerW] = useState(800);
  const [showSig, setShowSig] = useState(false);
  const [signature, setSignature] = useState<{ blob: Blob; url: string; ratio: number } | null>(null);
  const [style, setStyle] = useState<Style>({
    stroke: isRedact ? "#000000" : "#dc2626", fill: null, width: 2, opacity: 1, textSize: 16, textColor: "#171717", bold: false,
  });
  const [terms, setTerms] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [scrubMeta, setScrubMeta] = useState(true);

  const history = useRef<EditorObject[][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const drag = useRef<Drag | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const imgInput = useRef<HTMLInputElement>(null);

  // Load document
  useEffect(() => {
    if (!file) return;
    let alive = true;
    setLoadErr(null);
    getDoc(file).then(
      async (d) => {
        const sz: { w: number; h: number }[] = [];
        for (let i = 1; i <= d.numPages; i++) {
          const p = await d.getPage(i);
          const v = p.getViewport({ scale: 1 });
          sz.push({ w: v.width, h: v.height });
        }
        if (!alive) return;
        setDoc(d);
        setSizes(sz);
        setPage(0);
      },
      (e) => alive && setLoadErr(String(e.message || e)),
    );
    return () => {
      alive = false;
    };
  }, [file]);

  // Track container width for responsive page size
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerW(el.clientWidth));
    ro.observe(el);
    setContainerW(el.clientWidth);
    return () => ro.disconnect();
  }, [doc]);

  const size = sizes[page];
  const scale = size ? (Math.min(containerW, 980) / size.w) * zoom : 1;

  // Render page background
  useEffect(() => {
    if (!doc || !size) return;
    let alive = true;
    setBg(null);
    renderThumb(doc, page, Math.round(size.w * scale)).then((u) => alive && setBg(u));
    return () => {
      alive = false;
    };
  }, [doc, page, size, scale]);

  const commit = useCallback(() => {
    history.current.push(objects);
    if (history.current.length > 100) history.current.shift();
    setCanUndo(true);
  }, [objects]);

  const undo = useCallback(() => {
    const prev = history.current.pop();
    setCanUndo(history.current.length > 0);
    if (prev) {
      setObjects(prev);
      setSelected(null);
    }
  }, []);

  const removeSelected = useCallback(() => {
    if (!selected) return;
    commit();
    setObjects((o) => o.filter((x) => x.id !== selected));
    setSelected(null);
  }, [selected, commit]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        e.preventDefault();
        removeSelected();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      } else if (e.key === "Escape") {
        setSelected(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, removeSelected, undo]);

  const sel = objects.find((o) => o.id === selected) ?? null;
  const patch = (id: string, p: Partial<EditorObject>) =>
    setObjects((list) => list.map((o) => (o.id === id ? ({ ...o, ...p } as EditorObject) : o)));

  function toPt(e: React.PointerEvent) {
    const r = overlayRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  }

  function addImage(blob: Blob, ratio: number, label: string) {
    if (!size) return;
    const url = URL.createObjectURL(blob);
    const w = Math.min(size.w * (label === "signature" ? 0.3 : 0.4), 260);
    const h = w * ratio;
    const o: EditorObject = { id: uid(), type: "image", page, x: (size.w - w) / 2, y: (size.h - h) / 2, w, h, src: blob, url, ratio, label };
    commit();
    setObjects((l) => [...l, o]);
    setSelected(o.id);
    setActive("select");
  }

  function addText(x: number, y: number, text = "Type here") {
    const m = measureText(text, style.textSize, style.bold);
    const o: EditorObject = { id: uid(), type: "text", page, x, y, w: m.w, h: m.h, text, size: style.textSize, color: style.textColor, bold: style.bold };
    commit();
    setObjects((l) => [...l, o]);
    setSelected(o.id);
    setActive("select");
    return o;
  }

  // ── Pointer handling on the page ──────────────────────────────────
  function onPagePointerDown(e: React.PointerEvent) {
    if (e.button !== 0 || !size) return;
    const p = toPt(e);
    if (active === "select") {
      setSelected(null);
      return;
    }
    if (active === "text") {
      addText(p.x, p.y - style.textSize * 0.6);
      return;
    }
    if (active === "note") {
      const o: EditorObject = { id: uid(), type: "note", page, x: p.x - 11, y: p.y - 11, w: 22, h: 22, text: "", author: "" };
      commit();
      setObjects((l) => [...l, o]);
      setSelected(o.id);
      setActive("select");
      return;
    }
    if (active === "image" || active === "signature") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const id = uid();
    let o: EditorObject;
    switch (active) {
      case "line":
      case "arrow":
      case "underline":
        o = { id, type: active, page, x1: p.x, y1: p.y, x2: p.x, y2: p.y, ...lineBox(p.x, p.y, p.x, p.y, style.width), stroke: style.stroke, width: active === "underline" ? 1.5 : style.width };
        break;
      case "ink":
        o = { id, type: "ink", page, points: [[p.x, p.y]], ...inkBox([[p.x, p.y]], style.width), stroke: style.stroke, width: style.width };
        break;
      default: {
        const t = active as "rect" | "ellipse" | "highlight" | "whiteout" | "redact";
        const preset = {
          rect: { type: "rect" as const, stroke: style.stroke, fill: style.fill, width: style.width, opacity: style.opacity },
          ellipse: { type: "ellipse" as const, stroke: style.stroke, fill: style.fill, width: style.width, opacity: style.opacity },
          highlight: { type: "highlight" as const, stroke: "#facc15", fill: "#fde047", width: 0, opacity: 0.45 },
          whiteout: { type: "rect" as const, stroke: "#ffffff", fill: "#ffffff", width: 0, opacity: 1 },
          redact: { type: "redact" as const, stroke: "#000000", fill: "#000000", width: 0, opacity: 1 },
        }[t];
        o = { id, page, x: p.x, y: p.y, w: 0, h: 0, ...preset } as EditorObject;
      }
    }
    commit();
    setObjects((l) => [...l, o]);
    drag.current = { kind: "draw", id, sx: p.x, sy: p.y };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || !size) return;
    const p = toPt(e);
    const clampX = (v: number) => Math.max(0, Math.min(size.w, v));
    const clampY = (v: number) => Math.max(0, Math.min(size.h, v));
    if (d.kind === "draw") {
      setObjects((list) =>
        list.map((o) => {
          if (o.id !== d.id) return o;
          if (o.type === "line" || o.type === "arrow" || o.type === "underline") {
            let x2 = clampX(p.x), y2 = clampY(p.y);
            if (o.type === "underline" || e.shiftKey) {
              if (o.type === "underline" || Math.abs(x2 - o.x1) > Math.abs(y2 - o.y1)) y2 = o.y1;
              else x2 = o.x1;
            }
            return { ...o, x2, y2, ...lineBox(o.x1, o.y1, x2, y2, o.width) };
          }
          if (o.type === "ink") {
            const points = [...o.points, [clampX(p.x), clampY(p.y)] as [number, number]];
            return { ...o, points, ...inkBox(points, o.width) };
          }
          let w = clampX(p.x) - d.sx;
          let h = clampY(p.y) - d.sy;
          if (e.shiftKey && o.type === "ellipse") {
            const m = Math.max(Math.abs(w), Math.abs(h));
            w = Math.sign(w || 1) * m;
            h = Math.sign(h || 1) * m;
          }
          return { ...o, x: Math.min(d.sx, d.sx + w), y: Math.min(d.sy, d.sy + h), w: Math.abs(w), h: Math.abs(h) };
        }),
      );
    } else if (d.kind === "move") {
      const dx = p.x - d.sx;
      const dy = p.y - d.sy;
      const o = d.orig;
      const extra: Partial<EditorObject> = {};
      if (o.type === "line" || o.type === "arrow" || o.type === "underline") Object.assign(extra, { x1: o.x1 + dx, y1: o.y1 + dy, x2: o.x2 + dx, y2: o.y2 + dy });
      if (o.type === "ink") Object.assign(extra, { points: o.points.map(([x, y]) => [x + dx, y + dy]) });
      patch(d.id, { x: o.x + dx, y: o.y + dy, ...extra });
    } else if (d.kind === "resize") {
      const o = d.orig;
      const w = Math.max(8, o.w + (p.x - d.sx));
      let h = Math.max(8, o.h + (p.y - d.sy));
      if (o.type === "image") h = w * o.ratio;
      if (o.type === "text") {
        const sizeNew = Math.max(4, Math.round(o.size * (w / o.w) * 2) / 2);
        const m = measureText(o.text, sizeNew, o.bold);
        patch(d.id, { size: sizeNew, w: m.w, h: m.h } as Partial<EditorObject>);
        return;
      }
      if (o.type === "ink") {
        const sx = w / o.w, sy = h / o.h;
        patch(d.id, { w, h, points: o.points.map(([x, y]) => [o.x + (x - o.x) * sx, o.y + (y - o.y) * sy]) } as Partial<EditorObject>);
        return;
      }
      patch(d.id, { w, h });
    } else if (d.kind === "end") {
      const o = d.orig as Extract<EditorObject, { x1: number }>;
      const x = clampX(p.x), y = clampY(p.y);
      const np = d.which === 1 ? { x1: x, y1: y, x2: o.x2, y2: o.y2 } : { x1: o.x1, y1: o.y1, x2: x, y2: y };
      patch(d.id, { ...np, ...lineBox(np.x1, np.y1, np.x2, np.y2, o.width) } as Partial<EditorObject>);
    }
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (d?.kind === "draw") {
      setObjects((list) =>
        list.filter((o) => {
          if (o.id !== d.id) return true;
          if (o.type === "ink") return o.points.length > 1;
          if (o.type === "line" || o.type === "arrow" || o.type === "underline") return Math.hypot(o.x2 - o.x1, o.y2 - o.y1) > 3;
          return o.w > 3 && o.h > 3;
        }),
      );
    }
  }

  function startObjDrag(e: React.PointerEvent, o: EditorObject, kind: "move" | "resize" | 1 | 2) {
    if (active !== "select") return;
    e.stopPropagation();
    e.preventDefault();
    overlayRef.current?.setPointerCapture(e.pointerId);
    setSelected(o.id);
    commit();
    const p = toPt(e);
    drag.current = kind === 1 || kind === 2 ? { kind: "end", id: o.id, which: kind, orig: o } : { kind, id: o.id, sx: p.x, sy: p.y, orig: o };
  }

  // ── Export ────────────────────────────────────────────────────────
  async function run() {
    if (!file) return;
    await s.run(async (progress) => {
      if (isRedact) {
        const boxes = objects.filter((o) => o.type === "redact").map((o) => ({ page: o.page, x: o.x, y: o.y, w: o.w, h: o.h }));
        const termList = terms.split(/[\n,]/).map((t) => t.trim()).filter(Boolean);
        if (!boxes.length && !termList.length) throw new Error("Draw at least one redaction box or enter text to search for.");
        const res = await processOnServer("redact-pdf", [file], { boxes, terms: termList, caseSensitive, scrubMetadata: scrubMeta }, progress);
        const count = Number(res.info.redactions ?? 0);
        return {
          outputs: [{ blob: res.blob, name: res.filename }],
          stats: [
            { label: "Areas redacted", value: String(count), highlight: true },
            { label: "Text matches", value: String(res.info.matches ?? 0) },
          ],
          message: "Content under each box was permanently removed from the file.",
        };
      }
      if (!objects.length) throw new Error("Add something to the page first.");
      progress(null, "Saving your changes…");
      const pdf = await loadPdf(file);
      await applyEditorObjects(pdf, objects);
      const blob = await savePdf(pdf);
      const suffix = { "sign-pdf": "signed", "annotate-pdf": "annotated" }[mode] ?? "edited";
      return { outputs: [{ blob, name: `${baseName(file.name)}-${suffix}.pdf` }], stats: [{ label: "Items added", value: String(objects.length), highlight: true }] };
    });
  }

  const pageObjects = useMemo(() => objects.filter((o) => o.page === page), [objects, page]);

  if (s.result) return <ResultView state={s} />;
  if (!file) return <UploadStage state={s} />;

  const toolButton = (t: ToolId) => {
    const M = TOOL_META[t];
    const isActive = active === t;
    return (
      <button
        key={t}
        type="button"
        title={M.label}
        aria-pressed={isActive}
        onClick={() => {
          if (t === "image") imgInput.current?.click();
          else if (t === "signature") {
            if (signature) addImage(signature.blob, signature.ratio, "signature");
            else setShowSig(true);
            return;
          }
          setActive(t);
        }}
        className={cn(
          "flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition",
          isActive && t !== "image" ? "bg-brand text-[#171717]" : "text-muted hover:bg-brand-soft hover:text-ink",
        )}
      >
        <M.icon className="h-4 w-4" />
        <span className="hidden sm:inline">{M.label}</span>
      </button>
    );
  };

  const cursor = active === "select" ? "default" : active === "text" || active === "note" ? "text" : "crosshair";

  const main = (
    <div className="space-y-3">
      {loadErr && <Alert>{loadErr}</Alert>}
      {/* Toolbar */}
      <div className="card flex items-center gap-1 overflow-x-auto p-1.5" role="toolbar" aria-label="Editing tools">
        {tools.map(toolButton)}
        {mode === "sign-pdf" && (
          <>
            {signature && (
              <button type="button" className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-muted hover:bg-brand-soft hover:text-ink" onClick={() => setShowSig(true)}>
                New signature
              </button>
            )}
            <button type="button" title="Add today's date" className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-muted hover:bg-brand-soft hover:text-ink" onClick={() => size && addText(size.w / 2 - 40, size.h * 0.8, new Date().toLocaleDateString())}>
              <Calendar className="h-4 w-4" /> <span className="hidden sm:inline">Date</span>
            </button>
          </>
        )}
        <span className="mx-1 h-6 w-px shrink-0 bg-line" />
        <button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-brand-soft disabled:opacity-40" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo"><Undo2 className="h-4 w-4" /></button>
        <button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-danger-soft hover:text-danger disabled:opacity-40" onClick={removeSelected} disabled={!selected} title="Delete selected" aria-label="Delete selected"><Trash2 className="h-4 w-4" /></button>
        <span className="ml-auto flex shrink-0 items-center">
          <button type="button" className="flex h-11 w-10 items-center justify-center rounded-xl text-muted hover:bg-brand-soft" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} aria-label="Zoom out"><ZoomOut className="h-4 w-4" /></button>
          <span className="w-12 text-center text-xs tabular-nums text-muted">{Math.round(zoom * 100)}%</span>
          <button type="button" className="flex h-11 w-10 items-center justify-center rounded-xl text-muted hover:bg-brand-soft" onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} aria-label="Zoom in"><ZoomIn className="h-4 w-4" /></button>
        </span>
      </div>
      <p className="text-xs text-muted">{TOOL_META[active].hint}</p>

      <input
        ref={imgInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const bmp = await createImageBitmap(f).catch(() => null);
          if (!bmp) return s.setError("That image could not be read.");
          addImage(f, bmp.height / bmp.width, f.name);
        }}
      />

      {/* Page */}
      <div ref={wrapRef} className="checker overflow-auto rounded-2xl border border-line p-3 sm:p-5">
        {!size ? (
          <div className="flex h-96 items-center justify-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>
        ) : (
          <div
            ref={overlayRef}
            className="relative mx-auto select-none bg-white shadow-lift"
            style={{ width: size.w * scale, height: size.h * scale, cursor, touchAction: active === "select" ? "pan-x pan-y" : "none" }}
            onPointerDown={onPagePointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {bg ? <img src={bg} alt={`Page ${page + 1}`} className="pointer-events-none absolute inset-0 h-full w-full" draggable={false} /> : <LoaderCircle className="absolute left-1/2 top-1/2 h-6 w-6 animate-spin text-muted" />}
            {pageObjects.map((o) => (
              <ObjectView
                key={o.id}
                o={o}
                scale={scale}
                selected={o.id === selected}
                interactive={active === "select"}
                onStart={(e, k) => startObjDrag(e, o, k)}
                onText={(text) => {
                  if (o.type !== "text") return;
                  const m = measureText(text, o.size, o.bold);
                  patch(o.id, { text, w: m.w, h: m.h } as Partial<EditorObject>);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {sizes.length > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button type="button" className="btn-ghost h-10 min-h-10 px-3" onClick={() => { setPage((p) => p - 1); setSelected(null); }} disabled={page === 0} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-sm text-muted">Page <strong className="text-ink">{page + 1}</strong> of {sizes.length}</span>
          <button type="button" className="btn-ghost h-10 min-h-10 px-3" onClick={() => { setPage((p) => p + 1); setSelected(null); }} disabled={page >= sizes.length - 1} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
        </div>
      )}

      {showSig && (
        <SignaturePad
          onClose={() => setShowSig(false)}
          onDone={(blob, w, h) => {
            setShowSig(false);
            setSignature({ blob, url: URL.createObjectURL(blob), ratio: h / w });
            addImage(blob, h / w, "signature");
          }}
        />
      )}
    </div>
  );

  // ── Side panel ────────────────────────────────────────────────────
  const shapeLike = sel && (sel.type === "rect" || sel.type === "ellipse");
  const strokeLike = sel && (sel.type === "line" || sel.type === "arrow" || sel.type === "ink" || sel.type === "underline");
  const showDefaults = !sel && ["rect", "ellipse", "line", "arrow", "ink", "underline", "text"].includes(active);

  const colorRow = (value: string, onChange: (c: string) => void, label: string) => (
    <div>
      <span className="label">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        {SWATCHES.map((c) => (
          <button key={c} type="button" onClick={() => onChange(c)} aria-label={`${label} ${c}`} className={cn("h-8 w-8 rounded-full border-2 border-line", value === c && "ring-2 ring-brand-ink ring-offset-2 ring-offset-surface")} style={{ background: c }} />
        ))}
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded-lg border border-line bg-surface p-0.5" aria-label={`Custom ${label}`} />
      </div>
    </div>
  );

  const side = (
    <>
      <PanelTitle sub={`${objects.length} item${objects.length === 1 ? "" : "s"} added`}>{tool.name}</PanelTitle>

      {sel?.type === "text" && (
        <div className="space-y-3">
          <label className="block">
            <span className="label">Text</span>
            <textarea className="input min-h-24" value={sel.text} onChange={(e) => { const m = measureText(e.target.value, sel.size, sel.bold); patch(sel.id, { text: e.target.value, w: m.w, h: m.h } as Partial<EditorObject>); }} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">Size</span>
              <input type="number" min={4} max={200} className="input" value={sel.size} onChange={(e) => { const size = Math.max(4, Number(e.target.value)); const m = measureText(sel.text, size, sel.bold); patch(sel.id, { size, w: m.w, h: m.h } as Partial<EditorObject>); }} />
            </label>
            <div className="pt-7"><Toggle checked={sel.bold} onChange={(b) => { const m = measureText(sel.text, sel.size, b); patch(sel.id, { bold: b, w: m.w, h: m.h } as Partial<EditorObject>); }} label="Bold" /></div>
          </div>
          {colorRow(sel.color, (c) => patch(sel.id, { color: c } as Partial<EditorObject>), "Color")}
        </div>
      )}

      {sel?.type === "note" && (
        <label className="block">
          <span className="label">Comment</span>
          <textarea className="input min-h-28" autoFocus value={sel.text} placeholder="Write your comment…" onChange={(e) => patch(sel.id, { text: e.target.value } as Partial<EditorObject>)} />
          <span className="mt-1 block text-xs text-muted">Saved as a real PDF comment that opens in any PDF reader.</span>
        </label>
      )}

      {shapeLike && sel && (sel.type === "rect" || sel.type === "ellipse") && (
        <div className="space-y-3">
          {colorRow(sel.stroke, (c) => patch(sel.id, { stroke: c } as Partial<EditorObject>), "Border")}
          <div>
            <span className="label">Fill</span>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => patch(sel.id, { fill: null } as Partial<EditorObject>)} className={cn("h-8 rounded-full border border-line px-3 text-xs", sel.fill === null && "ring-2 ring-brand-ink")}>None</button>
              {SWATCHES.map((c) => (
                <button key={c} type="button" onClick={() => patch(sel.id, { fill: c } as Partial<EditorObject>)} className={cn("h-8 w-8 rounded-full border-2 border-line", sel.fill === c && "ring-2 ring-brand-ink ring-offset-2")} style={{ background: c }} aria-label={`Fill ${c}`} />
              ))}
            </div>
          </div>
          <label className="block"><span className="label">Border width: {sel.width}pt</span><input type="range" min={0} max={12} value={sel.width} onChange={(e) => patch(sel.id, { width: Number(e.target.value) } as Partial<EditorObject>)} className="w-full accent-[#7fd492]" /></label>
          {sel.fill && <label className="block"><span className="label">Fill opacity: {Math.round(sel.opacity * 100)}%</span><input type="range" min={10} max={100} value={sel.opacity * 100} onChange={(e) => patch(sel.id, { opacity: Number(e.target.value) / 100 } as Partial<EditorObject>)} className="w-full accent-[#7fd492]" /></label>}
        </div>
      )}

      {strokeLike && sel && (sel.type === "line" || sel.type === "arrow" || sel.type === "ink" || sel.type === "underline") && (
        <div className="space-y-3">
          {colorRow(sel.stroke, (c) => patch(sel.id, { stroke: c } as Partial<EditorObject>), "Color")}
          <label className="block"><span className="label">Width: {sel.width}pt</span><input type="range" min={1} max={16} step={0.5} value={sel.width} onChange={(e) => patch(sel.id, { width: Number(e.target.value) } as Partial<EditorObject>)} className="w-full accent-[#7fd492]" /></label>
        </div>
      )}

      {sel?.type === "image" && <p className="text-sm text-muted">Drag to move. Use the corner handle to resize — proportions are kept.</p>}

      {showDefaults && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">New item style</p>
          {active === "text" ? (
            <>
              <label className="block"><span className="label">Font size: {style.textSize}pt</span><input type="range" min={6} max={72} value={style.textSize} onChange={(e) => setStyle({ ...style, textSize: Number(e.target.value) })} className="w-full accent-[#7fd492]" /></label>
              {colorRow(style.textColor, (c) => setStyle({ ...style, textColor: c }), "Color")}
              <Toggle checked={style.bold} onChange={(b) => setStyle({ ...style, bold: b })} label="Bold" />
            </>
          ) : (
            <>
              {colorRow(style.stroke, (c) => setStyle({ ...style, stroke: c }), "Color")}
              {(active === "rect" || active === "ellipse") && (
                <div>
                  <span className="label">Fill</span>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setStyle({ ...style, fill: null })} className={cn("h-8 rounded-full border border-line px-3 text-xs", style.fill === null && "ring-2 ring-brand-ink")}>None</button>
                    {SWATCHES.map((c) => <button key={c} type="button" onClick={() => setStyle({ ...style, fill: c })} className={cn("h-8 w-8 rounded-full border-2 border-line", style.fill === c && "ring-2 ring-brand-ink ring-offset-2")} style={{ background: c }} aria-label={`Fill ${c}`} />)}
                  </div>
                </div>
              )}
              <label className="block"><span className="label">Width: {style.width}pt</span><input type="range" min={1} max={12} step={0.5} value={style.width} onChange={(e) => setStyle({ ...style, width: Number(e.target.value) })} className="w-full accent-[#7fd492]" /></label>
            </>
          )}
        </div>
      )}

      {isRedact && (
        <div className="space-y-3">
          <label className="block">
            <span className="label">Find and redact text</span>
            <textarea className="input min-h-20" value={terms} onChange={(e) => setTerms(e.target.value)} placeholder={"One term per line, e.g.\nJohn Smith\n555-0142"} />
          </label>
          <Toggle checked={caseSensitive} onChange={setCaseSensitive} label="Match case" />
          <Toggle checked={scrubMeta} onChange={setScrubMeta} label="Remove metadata" sub="Also wipe author, title and other properties" />
          <Alert kind="warn">Redaction is permanent. Text, images and drawings under each box are deleted — keep your original if you may need it.</Alert>
        </div>
      )}

      {mode === "sign-pdf" && signature && (
        <div>
          <p className="label">Your signature</p>
          <button type="button" onClick={() => addImage(signature.blob, signature.ratio, "signature")} className="w-full rounded-xl border border-line bg-white p-3 hover:border-brand-strong" title="Place another copy">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={signature.url} alt="Your signature" className="mx-auto max-h-16" />
          </button>
          <p className="mt-1 text-xs text-muted">Click to place another copy.</p>
        </div>
      )}

      <ProcessButton state={s} onClick={() => void run()} disabled={!doc || (!objects.length && !(isRedact && terms.trim()))} />
      <button type="button" className="chip w-full justify-center" onClick={s.reset}>Use a different file</button>
    </>
  );

  return <Workspace state={s} main={main} side={side} />;
}

// ── Object renderer ───────────────────────────────────────────────────

function ObjectView({
  o, scale, selected, interactive, onStart, onText,
}: {
  o: EditorObject;
  scale: number;
  selected: boolean;
  interactive: boolean;
  onStart: (e: React.PointerEvent, kind: "move" | "resize" | 1 | 2) => void;
  onText: (t: string) => void;
}) {
  const style: React.CSSProperties = {
    left: o.x * scale,
    top: o.y * scale,
    width: Math.max(o.w * scale, 2),
    height: Math.max(o.h * scale, 2),
    pointerEvents: interactive ? "auto" : "none",
    touchAction: "none",
  };
  const isLine = o.type === "line" || o.type === "arrow" || o.type === "underline";
  let body: React.ReactNode = null;

  switch (o.type) {
    case "text":
      body = selected ? (
        <textarea
          value={o.text}
          onChange={(e) => onText(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute inset-0 resize-none overflow-hidden bg-transparent p-0 outline-none"
          style={{ fontSize: o.size * scale, lineHeight: 1.25, color: o.color, fontWeight: o.bold ? 700 : 400, fontFamily: "Helvetica, Arial, sans-serif", whiteSpace: "pre", width: o.w * scale + o.size * scale }}
          spellCheck={false}
          aria-label="Text content"
        />
      ) : (
        <div style={{ fontSize: o.size * scale, lineHeight: 1.25, color: o.color, fontWeight: o.bold ? 700 : 400, fontFamily: "Helvetica, Arial, sans-serif", whiteSpace: "pre" }}>{o.text}</div>
      );
      break;
    case "image":
      // eslint-disable-next-line @next/next/no-img-element
      body = <img src={o.url} alt="" className="h-full w-full" draggable={false} />;
      break;
    case "note":
      body = (
        <div className="flex h-full w-full items-center justify-center rounded-md bg-amber-300 text-amber-900 shadow">
          <MessageSquare className="h-3/5 w-3/5" />
        </div>
      );
      break;
    case "rect":
    case "highlight":
    case "redact":
      body = (
        <div
          className="h-full w-full"
          style={{
            background: o.fill ?? "transparent",
            opacity: o.type === "highlight" ? 0.45 : o.type === "redact" ? 0.85 : undefined,
            mixBlendMode: o.type === "highlight" ? "multiply" : undefined,
            border: o.type === "rect" && o.width > 0 ? `${o.width * scale}px solid ${o.stroke}` : o.type === "rect" && o.fill === "#ffffff" ? "1px dashed #d4d4d4" : undefined,
            boxSizing: "border-box",
          }}
        >
          {o.type === "rect" && o.fill && o.opacity < 1 && <div className="h-full w-full" style={{ background: o.fill, opacity: o.opacity }} />}
        </div>
      );
      if (o.type === "rect" && o.fill && o.opacity < 1) {
        body = (
          <div className="relative h-full w-full" style={{ border: o.width > 0 ? `${o.width * scale}px solid ${o.stroke}` : undefined, boxSizing: "border-box" }}>
            <div className="absolute inset-0" style={{ background: o.fill, opacity: o.opacity }} />
          </div>
        );
      }
      break;
    case "ellipse":
      body = (
        <svg viewBox={`0 0 ${o.w} ${o.h}`} className="h-full w-full overflow-visible">
          <ellipse cx={o.w / 2} cy={o.h / 2} rx={Math.max(o.w / 2 - o.width / 2, 0)} ry={Math.max(o.h / 2 - o.width / 2, 0)} fill={o.fill ?? "none"} fillOpacity={o.opacity} stroke={o.width > 0 ? o.stroke : "none"} strokeWidth={o.width} />
        </svg>
      );
      break;
    case "line":
    case "arrow":
    case "underline": {
      const x1 = o.x1 - o.x, y1 = o.y1 - o.y, x2 = o.x2 - o.x, y2 = o.y2 - o.y;
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const len = Math.max(8, o.width * 4);
      body = (
        <svg viewBox={`0 0 ${o.w} ${o.h}`} className="h-full w-full overflow-visible">
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={o.stroke} strokeWidth={o.width} strokeLinecap="round" />
          {o.type === "arrow" && [Math.PI * 0.85, -Math.PI * 0.85].map((d) => (
            <line key={d} x1={x2} y1={y2} x2={x2 + len * Math.cos(ang + d)} y2={y2 + len * Math.sin(ang + d)} stroke={o.stroke} strokeWidth={o.width} strokeLinecap="round" />
          ))}
        </svg>
      );
      break;
    }
    case "ink":
      body = (
        <svg viewBox={`0 0 ${o.w} ${o.h}`} className="h-full w-full overflow-visible">
          <polyline points={o.points.map(([x, y]) => `${x - o.x},${y - o.y}`).join(" ")} fill="none" stroke={o.stroke} strokeWidth={o.width} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
      break;
  }

  return (
    <div
      className={cn("absolute", interactive && "cursor-move", selected && !isLine && "outline outline-2 outline-offset-2 outline-[#1f7a3d]")}
      style={style}
      onPointerDown={(e) => onStart(e, "move")}
    >
      {body}
      {selected && interactive && o.type === "text" && (
        <span
          className="absolute -left-3 -top-7 flex h-6 cursor-move items-center rounded-md bg-brand-ink px-1.5 text-[10px] font-semibold text-white"
          onPointerDown={(e) => onStart(e, "move")}
        >
          Move
        </span>
      )}
      {selected && interactive && !isLine && o.type !== "note" && (
        <span
          className="absolute -bottom-2.5 -right-2.5 h-5 w-5 cursor-nwse-resize rounded-full border-2 border-white bg-brand-ink shadow"
          onPointerDown={(e) => onStart(e, "resize")}
          aria-label="Resize"
        />
      )}
      {selected && interactive && isLine && (
        <>
          {[1, 2].map((w) => {
            const ox = (w === 1 ? o.x1 : o.x2) - o.x;
            const oy = (w === 1 ? o.y1 : o.y2) - o.y;
            return (
              <span
                key={w}
                className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border-2 border-white bg-brand-ink shadow"
                style={{ left: ox * scale, top: oy * scale }}
                onPointerDown={(e) => onStart(e, w as 1 | 2)}
              />
            );
          })}
        </>
      )}
    </div>
  );
}
