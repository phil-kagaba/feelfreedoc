"use client";

import { useEffect, useMemo, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Check, Copy, FilePlus2, LoaderCircle, Plus, RotateCcw, RotateCw, Trash2, ArrowUpDown, Undo2 } from "lucide-react";
import { assemblePages, splitPdf, type PageSpec } from "@/lib/pdf-ops";
import type { ToolDef } from "@/lib/tools";
import { baseName, cn, errorMessage, parseRanges, uid } from "@/lib/utils";
import { Dropzone } from "../dropzone";
import { getDoc, PageThumb, fileKey } from "../workspace/pdf-hooks";
import { SortableGrid } from "../workspace/sortable-grid";
import { Alert, PanelTitle, ProcessButton, ResultView, Segmented, Toggle, UploadStage, Workspace } from "../workspace/ui";
import { useToolState } from "../workspace/use-tool-state";

interface PageItem {
  id: string;
  source: number; // index in sources, -1 = blank
  page: number;
  rotation: number;
  selected: boolean;
}

const GROUP_COLORS = ["#A3E4B0", "#93C5FD", "#FCD34D", "#F9A8D4", "#C4B5FD", "#FDBA74"];

export default function PagesTool({ tool }: { tool: ToolDef }) {
  const s = useToolState(tool);
  const slug = tool.slug;
  const [docs, setDocs] = useState<(PDFDocumentProxy | null)[]>([]);
  const [items, setItems] = useState<PageItem[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // split options
  const [splitMode, setSplitMode] = useState<"ranges" | "every" | "all">("ranges");
  const [ranges, setRanges] = useState("");
  const [every, setEvery] = useState(1);
  // extract/delete options
  const [rangeInput, setRangeInput] = useState("");
  const [separate, setSeparate] = useState(false);

  const sources = useMemo(() => s.files.map((f) => f.file), [s.files]);

  // Load documents and build the page list whenever sources change (keeps edits of existing sources).
  useEffect(() => {
    let alive = true;
    if (!sources.length) {
      setItems([]);
      setDocs([]);
      return;
    }
    setLoading(true);
    setLoadErr(null);
    Promise.all(sources.map((f) => getDoc(f)))
      .then((ds) => {
        if (!alive) return;
        setDocs(ds);
        setItems((prev) => {
          const known = new Set(prev.map((p) => p.source));
          const next = prev.filter((p) => p.source < ds.length);
          ds.forEach((d, si) => {
            if (known.has(si)) return;
            for (let i = 0; i < d.numPages; i++) next.push({ id: uid(), source: si, page: i, rotation: 0, selected: false });
          });
          return next;
        });
        if (slug === "split-pdf" && !ranges) {
          const n = ds[0].numPages;
          setRanges(n > 1 ? `1-${Math.ceil(n / 2)}, ${Math.ceil(n / 2) + 1}-${n}` : "1");
        }
      })
      .catch((e) => alive && setLoadErr(errorMessage(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources]);

  const pageCount = items.length;

  // Split groups preview
  const splitGroups = useMemo(() => {
    if (slug !== "split-pdf" || !pageCount) return { groups: [] as number[][], error: null as string | null };
    try {
      if (splitMode === "all") return { groups: items.map((_, i) => [i]), error: null };
      if (splitMode === "every") {
        const n = Math.max(1, every);
        const g: number[][] = [];
        for (let i = 0; i < pageCount; i += n) g.push(Array.from({ length: Math.min(n, pageCount - i) }, (_, k) => i + k));
        return { groups: g, error: null };
      }
      return { groups: parseRanges(ranges, pageCount), error: null };
    } catch (e) {
      return { groups: [], error: errorMessage(e) };
    }
  }, [slug, splitMode, every, ranges, pageCount, items]);

  const groupOf = useMemo(() => {
    const m = new Map<number, number>();
    splitGroups.groups.forEach((g, gi) => g.forEach((p) => !m.has(p) && m.set(p, gi)));
    return m;
  }, [splitGroups]);

  if (s.result) return <ResultView state={s} />;
  if (!s.files.length) return <UploadStage state={s} />;

  const update = (id: string, patch: Partial<PageItem>) => setItems((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const selectionMode = slug === "extract-pages" || slug === "delete-pages";
  const sortable = slug === "reorder-pages" || slug === "organize-pdf";
  const selectedCount = items.filter((p) => p.selected).length;

  function applyRangeSelection(expr: string) {
    setRangeInput(expr);
    if (!expr.trim()) return;
    try {
      const idx = new Set(parseRanges(expr, pageCount).flat());
      setItems((list) => list.map((p, i) => ({ ...p, selected: idx.has(i) })));
      s.setError(null);
    } catch (e) {
      s.setError(errorMessage(e));
    }
  }

  const name = baseName(sources[0]?.name ?? "document");

  function specs(list: PageItem[]): PageSpec[] {
    return list.map((p) => ({ source: p.source, page: p.page, rotation: p.rotation }));
  }

  async function run() {
    await s.run(async (progress) => {
      switch (slug) {
        case "split-pdf": {
          if (splitGroups.error) throw new Error(splitGroups.error);
          progress(null, "Splitting…");
          const blobs = await splitPdf(sources[0], splitGroups.groups);
          return {
            outputs: blobs.map((b, i) => {
              const g = splitGroups.groups[i];
              const label = g.length === 1 ? `page-${g[0] + 1}` : `pages-${g[0] + 1}-${g[g.length - 1] + 1}`;
              return { blob: b, name: `${name}-${label}.pdf` };
            }),
            zipName: `${name}-split.zip`,
            stats: [{ label: "Files created", value: String(blobs.length), highlight: true }],
          };
        }
        case "extract-pages": {
          const chosen = items.filter((p) => p.selected);
          if (!chosen.length) throw new Error("Select at least one page to extract.");
          if (separate) {
            const outs = [];
            for (const p of chosen) outs.push({ blob: await assemblePages(sources, specs([p])), name: `${name}-page-${p.page + 1}.pdf` });
            return { outputs: outs, zipName: `${name}-pages.zip` };
          }
          const blob = await assemblePages(sources, specs(chosen));
          return { outputs: [{ blob, name: `${name}-extracted.pdf` }], stats: [{ label: "Pages extracted", value: String(chosen.length), highlight: true }] };
        }
        case "delete-pages": {
          const keep = items.filter((p) => !p.selected);
          if (!selectedCount) throw new Error("Click the pages you want to delete.");
          if (!keep.length) throw new Error("You can't delete every page.");
          const blob = await assemblePages(sources, specs(keep));
          return {
            outputs: [{ blob, name: `${name}-edited.pdf` }],
            stats: [
              { label: "Pages removed", value: String(selectedCount) },
              { label: "Pages left", value: String(keep.length), highlight: true },
            ],
          };
        }
        default: {
          const blob = await assemblePages(sources, specs(items));
          const suffix = slug === "rotate-pdf" ? "rotated" : slug === "reorder-pages" ? "reordered" : "organized";
          return { outputs: [{ blob, name: `${name}-${suffix}.pdf` }], stats: [{ label: "Pages", value: String(items.length), highlight: true }] };
        }
      }
    });
  }

  const pageCard = (p: PageItem, i: number, handle?: { attributes: object; listeners: object | undefined }) => {
    const doc = p.source >= 0 ? docs[p.source] : null;
    const gi = groupOf.get(i);
    const marked = p.selected;
    const isDelete = slug === "delete-pages";
    return (
      <div
        className={cn(
          "group card relative p-2 transition",
          selectionMode && "cursor-pointer",
          marked && !isDelete && "border-brand-ink ring-2 ring-brand",
          marked && isDelete && "border-danger ring-2 ring-danger/30",
        )}
        onClick={selectionMode ? () => update(p.id, { selected: !p.selected }) : undefined}
        role={selectionMode ? "checkbox" : undefined}
        aria-checked={selectionMode ? marked : undefined}
        tabIndex={selectionMode ? 0 : undefined}
        onKeyDown={selectionMode ? (e) => (e.key === " " || e.key === "Enter") && (e.preventDefault(), update(p.id, { selected: !p.selected })) : undefined}
      >
        <div {...(handle?.attributes ?? {})} {...(handle?.listeners ?? {})} className={cn(sortable && "cursor-grab active:cursor-grabbing")}>
          {p.source < 0 ? (
            <div className="flex aspect-[3/4] items-center justify-center rounded-lg border border-dashed border-line bg-white text-xs text-muted">Blank page</div>
          ) : (
            <PageThumb doc={doc} docKey={fileKey(sources[p.source])} index={p.page} rotation={p.rotation} className={cn(marked && isDelete && "opacity-40")} />
          )}
        </div>
        {marked && (
          <span className={cn("absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full text-white", isDelete ? "bg-danger" : "bg-brand-ink")}>
            {isDelete ? <Trash2 className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
          </span>
        )}
        {gi !== undefined && (
          <span className="absolute left-3 top-3 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[#171717]" style={{ background: GROUP_COLORS[gi % GROUP_COLORS.length] }}>
            File {gi + 1}
          </span>
        )}
        <div className="mt-1.5 flex items-center justify-between gap-1">
          <span className="text-xs font-medium text-muted">
            {i + 1}
            {sources.length > 1 && p.source >= 0 && <span className="ml-1 text-[10px]">· {String.fromCharCode(65 + p.source)}{p.page + 1}</span>}
          </span>
          {(slug === "rotate-pdf" || slug === "organize-pdf") && (
            <span className="flex gap-0.5" onPointerDown={(e) => e.stopPropagation()}>
              <IconBtn label="Rotate left" onClick={() => update(p.id, { rotation: (p.rotation + 270) % 360 })}><RotateCcw className="h-3.5 w-3.5" /></IconBtn>
              <IconBtn label="Rotate right" onClick={() => update(p.id, { rotation: (p.rotation + 90) % 360 })}><RotateCw className="h-3.5 w-3.5" /></IconBtn>
              {slug === "organize-pdf" && (
                <>
                  <IconBtn label="Duplicate page" onClick={() => setItems((l) => { const k = l.findIndex((x) => x.id === p.id); const c = [...l]; c.splice(k + 1, 0, { ...p, id: uid() }); return c; })}><Copy className="h-3.5 w-3.5" /></IconBtn>
                  <IconBtn label="Insert blank page after" onClick={() => setItems((l) => { const k = l.findIndex((x) => x.id === p.id); const c = [...l]; c.splice(k + 1, 0, { id: uid(), source: -1, page: 0, rotation: 0, selected: false }); return c; })}><Plus className="h-3.5 w-3.5" /></IconBtn>
                  <IconBtn label="Delete page" danger onClick={() => setItems((l) => l.filter((x) => x.id !== p.id))}><Trash2 className="h-3.5 w-3.5" /></IconBtn>
                </>
              )}
            </span>
          )}
        </div>
      </div>
    );
  };

  const grid = "grid grid-cols-2 gap-3 min-[480px]:grid-cols-3 md:grid-cols-4 xl:grid-cols-5";

  const main = (
    <div className="space-y-4">
      {loadErr && <Alert>{loadErr}</Alert>}
      {loading && !items.length && (
        <div className="flex h-48 items-center justify-center text-muted"><LoaderCircle className="h-6 w-6 animate-spin" /></div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          <strong className="text-ink">{sources.map((f) => f.name).join(", ")}</strong> · {pageCount} pages
        </p>
        <button type="button" className="chip" onClick={s.reset}>Change file</button>
      </div>
      {sortable ? (
        <SortableGrid items={items} onChange={setItems} className={grid} render={(p, i, h) => pageCard(p, i, h)} />
      ) : (
        <div className={grid}>{items.map((p, i) => <div key={p.id}>{pageCard(p, i)}</div>)}</div>
      )}
      {slug === "organize-pdf" && (
        <Dropzone compact accept={[".pdf"]} multiple onFiles={s.addFiles} onError={s.setError} />
      )}
    </div>
  );

  const side = (
    <fieldset disabled={loading || !pageCount} className="m-0 min-w-0 space-y-5 border-0 p-0 disabled:opacity-60">
      {loading && <p className="flex items-center gap-2 text-sm text-muted"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading pages…</p>}
      {slug === "split-pdf" && (
        <>
          <PanelTitle sub="Each colored group becomes its own PDF.">Split options</PanelTitle>
          <Segmented
            value={splitMode}
            onChange={setSplitMode}
            options={[
              { value: "ranges", label: "Custom ranges" },
              { value: "every", label: "Every N pages" },
              { value: "all", label: "Every page" },
            ]}
          />
          {splitMode === "ranges" && (
            <label className="block">
              <span className="label">Ranges</span>
              <input className="input" value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder="1-3, 4-6, 7" />
              <span className="mt-1 block text-xs text-muted">Separate files with commas. Example: 1-3, 5, 8-</span>
            </label>
          )}
          {splitMode === "every" && (
            <label className="block">
              <span className="label">Pages per file</span>
              <input type="number" min={1} max={pageCount || 1} className="input" value={every} onChange={(e) => setEvery(Math.max(1, Number(e.target.value)))} />
            </label>
          )}
          {splitGroups.error ? <Alert>{splitGroups.error}</Alert> : <p className="text-sm text-muted">Creates <strong className="text-ink">{splitGroups.groups.length}</strong> file{splitGroups.groups.length === 1 ? "" : "s"}.</p>}
        </>
      )}

      {selectionMode && (
        <>
          <PanelTitle sub={slug === "extract-pages" ? "Click pages to select them." : "Click the pages you want to remove."}>
            {slug === "extract-pages" ? "Pages to extract" : "Pages to delete"}
          </PanelTitle>
          <label className="block">
            <span className="label">Or type pages</span>
            <input className="input" value={rangeInput} onChange={(e) => applyRangeSelection(e.target.value)} placeholder="e.g. 1, 3-5" />
          </label>
          <div className="flex gap-2">
            <button type="button" className="chip" onClick={() => setItems((l) => l.map((p) => ({ ...p, selected: true })))}>Select all</button>
            <button type="button" className="chip" onClick={() => { setItems((l) => l.map((p) => ({ ...p, selected: false }))); setRangeInput(""); }}>Clear</button>
          </div>
          <p className="text-sm text-muted"><strong className="text-ink">{selectedCount}</strong> of {pageCount} selected</p>
          {slug === "extract-pages" && <Toggle checked={separate} onChange={setSeparate} label="Separate files" sub="Save each selected page as its own PDF" />}
        </>
      )}

      {slug === "rotate-pdf" && (
        <>
          <PanelTitle sub="Hover a page to rotate it individually.">Rotate all pages</PanelTitle>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-ghost" onClick={() => setItems((l) => l.map((p) => ({ ...p, rotation: (p.rotation + 270) % 360 })))}><RotateCcw className="h-4 w-4" /> Left</button>
            <button type="button" className="btn-ghost" onClick={() => setItems((l) => l.map((p) => ({ ...p, rotation: (p.rotation + 90) % 360 })))}><RotateCw className="h-4 w-4" /> Right</button>
          </div>
          <button type="button" className="chip" onClick={() => setItems((l) => l.map((p) => ({ ...p, rotation: 0 })))}><Undo2 className="h-4 w-4" /> Reset</button>
        </>
      )}

      {slug === "reorder-pages" && (
        <>
          <PanelTitle sub="Drag thumbnails to move pages. Keyboard: focus a page, press Space, then use arrows.">Page order</PanelTitle>
          <button type="button" className="btn-ghost w-full" onClick={() => setItems((l) => [...l].reverse())}><ArrowUpDown className="h-4 w-4" /> Reverse order</button>
          <button type="button" className="chip" onClick={() => setItems((l) => [...l].sort((a, b) => a.source - b.source || a.page - b.page))}><Undo2 className="h-4 w-4" /> Original order</button>
        </>
      )}

      {slug === "organize-pdf" && (
        <>
          <PanelTitle sub="Drag to reorder. Use the page buttons to rotate, duplicate, insert blank pages or delete.">Organize</PanelTitle>
          <button type="button" className="btn-ghost w-full" onClick={() => setItems((l) => [...l, { id: uid(), source: -1, page: 0, rotation: 0, selected: false }])}><FilePlus2 className="h-4 w-4" /> Add blank page</button>
          <p className="text-sm text-muted">Add more PDFs below the pages to combine them.</p>
        </>
      )}

      <ProcessButton state={s} onClick={() => void run()} disabled={loading || !!loadErr || !pageCount} />
    </fieldset>
  );

  return <Workspace state={s} main={main} side={side} />;
}

function IconBtn({ children, label, onClick, danger }: { children: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn("flex h-7 w-7 items-center justify-center rounded-md text-muted transition hover:bg-brand-soft hover:text-ink", danger && "hover:bg-danger-soft hover:text-danger")}
    >
      {children}
    </button>
  );
}
