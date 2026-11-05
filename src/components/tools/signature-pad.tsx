"use client";

import "@fontsource/dancing-script/600.css";
import "@fontsource/caveat/500.css";
import "@fontsource/great-vibes/400.css";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Segmented, Toggle } from "../workspace/ui";
import { cn } from "@/lib/utils";

const FONTS = [
  { family: "Dancing Script", weight: 600 },
  { family: "Great Vibes", weight: 400 },
  { family: "Caveat", weight: 500 },
];
const COLORS = ["#171717", "#1d4ed8", "#0f766e"];

function trimCanvas(src: HTMLCanvasElement): HTMLCanvasElement | null {
  const ctx = src.getContext("2d")!;
  const { width, height } = src;
  const data = ctx.getImageData(0, 0, width, height).data;
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return null;
  const pad = 6;
  const out = document.createElement("canvas");
  out.width = x1 - x0 + pad * 2;
  out.height = y1 - y0 + pad * 2;
  out.getContext("2d")!.drawImage(src, x0 - pad, y0 - pad, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

const toBlob = (c: HTMLCanvasElement) => new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/png"));

export function SignaturePad({ onDone, onClose }: { onDone: (png: Blob, w: number, h: number) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"draw" | "type" | "upload">("draw");
  const [color, setColor] = useState(COLORS[0]);
  const [name, setName] = useState("");
  const [font, setFont] = useState(0);
  const [upload, setUpload] = useState<File | null>(null);
  const [removeBg, setRemoveBg] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || tab !== "draw") return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    setHasInk(false);
  }, [tab]);

  function pos(e: React.PointerEvent) {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  async function finish() {
    setErr(null);
    if (tab === "draw") {
      const t = canvasRef.current && hasInk ? trimCanvas(canvasRef.current) : null;
      if (!t) return setErr("Draw your signature first.");
      onDone(await toBlob(t), t.width, t.height);
    } else if (tab === "type") {
      if (!name.trim()) return setErr("Type your name first.");
      const f = FONTS[font];
      await document.fonts.load(`${f.weight} 96px "${f.family}"`);
      const c = document.createElement("canvas");
      const ctx = c.getContext("2d")!;
      ctx.font = `${f.weight} 96px "${f.family}"`;
      c.width = Math.ceil(ctx.measureText(name).width) + 40;
      c.height = 160;
      ctx.font = `${f.weight} 96px "${f.family}"`;
      ctx.fillStyle = color;
      ctx.textBaseline = "middle";
      ctx.fillText(name, 20, 80);
      const t = trimCanvas(c)!;
      onDone(await toBlob(t), t.width, t.height);
    } else {
      if (!upload) return setErr("Choose an image of your signature.");
      const bmp = await createImageBitmap(upload).catch(() => null);
      if (!bmp) return setErr("That image could not be read.");
      const c = document.createElement("canvas");
      const scale = Math.min(1, 1200 / bmp.width);
      c.width = Math.round(bmp.width * scale);
      c.height = Math.round(bmp.height * scale);
      const ctx = c.getContext("2d")!;
      ctx.drawImage(bmp, 0, 0, c.width, c.height);
      if (removeBg) {
        const img = ctx.getImageData(0, 0, c.width, c.height);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
          const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          if (lum > 200) d[i + 3] = 0;
          else if (lum > 150) d[i + 3] = Math.round(((200 - lum) / 50) * d[i + 3]);
        }
        ctx.putImageData(img, 0, 0);
      }
      const t = trimCanvas(c) ?? c;
      onDone(await toBlob(t), t.width, t.height);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Create signature">
      <div className="card w-full max-w-lg rounded-b-none p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Create your signature</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted hover:bg-brand-soft" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <Segmented value={tab} onChange={setTab} options={[{ value: "draw", label: "Draw" }, { value: "type", label: "Type" }, { value: "upload", label: "Upload" }]} />

        <div className="mt-4">
          {tab === "draw" && (
            <div>
              <canvas
                ref={canvasRef}
                className="h-48 w-full touch-none rounded-xl border border-line bg-white"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  drawing.current = true;
                  last.current = pos(e);
                }}
                onPointerMove={(e) => {
                  if (!drawing.current || !last.current) return;
                  const ctx = canvasRef.current!.getContext("2d")!;
                  const p = pos(e);
                  ctx.strokeStyle = color;
                  ctx.lineWidth = 2.6;
                  ctx.lineCap = "round";
                  ctx.lineJoin = "round";
                  ctx.beginPath();
                  ctx.moveTo(last.current.x, last.current.y);
                  ctx.lineTo(p.x, p.y);
                  ctx.stroke();
                  last.current = p;
                  setHasInk(true);
                }}
                onPointerUp={() => {
                  drawing.current = false;
                  last.current = null;
                }}
              />
              <div className="mt-2 flex justify-between text-xs text-muted">
                <span>Sign with your mouse, finger or stylus</span>
                <button
                  type="button"
                  className="font-semibold text-brand-ink hover:underline"
                  onClick={() => {
                    const c = canvasRef.current!;
                    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
                    setHasInk(false);
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          )}
          {tab === "type" && (
            <div className="space-y-3">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" autoFocus maxLength={60} />
              <div className="grid gap-2">
                {FONTS.map((f, i) => (
                  <button
                    key={f.family}
                    type="button"
                    onClick={() => setFont(i)}
                    className={cn("truncate rounded-xl border px-4 py-2 text-left text-3xl", font === i ? "border-brand-ink bg-brand-soft" : "border-line")}
                    style={{ fontFamily: `"${f.family}"`, fontWeight: f.weight, color }}
                  >
                    {name || "Your Name"}
                  </button>
                ))}
              </div>
            </div>
          )}
          {tab === "upload" && (
            <div className="space-y-3">
              <input type="file" accept="image/png,image/jpeg,image/webp" className="input file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-1 file:text-sm" onChange={(e) => setUpload(e.target.files?.[0] ?? null)} />
              <Toggle checked={removeBg} onChange={setRemoveBg} label="Remove white background" sub="Makes a photo of a paper signature transparent" />
            </div>
          )}
        </div>

        {tab !== "upload" && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm text-muted">Ink</span>
            {COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Ink color ${c}`} className={cn("h-7 w-7 rounded-full border-2", color === c ? "border-brand-ink" : "border-transparent")} style={{ background: c }} />
            ))}
          </div>
        )}
        {err && <p className="mt-3 text-sm text-danger" role="alert">{err}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={() => void finish()}>Use signature</button>
        </div>
      </div>
    </div>
  );
}
