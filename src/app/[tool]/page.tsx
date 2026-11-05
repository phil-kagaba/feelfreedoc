import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Lock, Server, Sparkles, Zap } from "lucide-react";
import { ToolIcon } from "@/components/tool-icon";
import { ToolCard } from "@/components/tool-card";
import { ToolLoader } from "@/components/tools/tool-loader";
import { CATEGORIES, TOOLS, getTool } from "@/lib/tools";

export const dynamicParams = false;

export function generateStaticParams() {
  return TOOLS.map((t) => ({ tool: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ tool: string }> }): Promise<Metadata> {
  const { tool: slug } = await params;
  const tool = getTool(slug);
  if (!tool) return {};
  return {
    title: `${tool.name} Online — Free`,
    description: tool.description,
    alternates: { canonical: `/${tool.slug}` },
    openGraph: { title: `${tool.name} | feelfreedoc`, description: tool.short },
  };
}

const ENGINE_NOTE = {
  browser: { icon: Zap, text: "Runs entirely in your browser — your file is never uploaded." },
  server: { icon: Server, text: "Processed on our secure server in an isolated temporary folder, deleted right after." },
  ai: { icon: Sparkles, text: "Text is extracted in your browser and sent to the AI provider to generate results." },
};

export default async function ToolPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool: slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();
  const category = CATEGORIES.find((c) => c.id === tool.category)!;
  const related = TOOLS.filter((t) => t.category === tool.category && t.slug !== tool.slug).slice(0, 4);
  const note = ENGINE_NOTE[tool.engine];

  return (
    <>
      <section className="bg-hero border-b border-line">
        <div className="container-page pt-8 pb-10 sm:pt-10 sm:pb-12">
          <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1 text-xs text-muted">
            <Link href="/" className="hover:text-ink">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href={`/tools?category=${category.id}`} className="hover:text-ink">{category.name}</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-ink">{tool.name}</span>
          </nav>
          <div className="mx-auto max-w-3xl text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-[#171717] shadow-soft">
              <ToolIcon slug={tool.slug} className="h-7 w-7" />
            </span>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{tool.name}</h1>
            <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-muted sm:text-lg">{tool.description}</p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-muted">
              <note.icon className="h-3.5 w-3.5 text-brand-ink" /> {note.text}
            </p>
          </div>
        </div>
      </section>

      <section className="container-page py-10 sm:py-12">
        <ToolLoader slug={tool.slug} />
      </section>

      <section className="container-page mt-10 border-t border-line pt-14">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="text-xl font-semibold text-ink">How to use {tool.name}</h2>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-muted">
              <li><strong className="text-ink">1.</strong> Upload {tool.multiple ? "your files" : "your file"} ({tool.accept.join(", ")}).</li>
              <li><strong className="text-ink">2.</strong> Adjust the options in the side panel.</li>
              <li><strong className="text-ink">3.</strong> Click <em>{tool.action}</em> and download the result.</li>
            </ol>
            <p className="mt-6 flex items-start gap-2 text-sm text-muted">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-brand-ink" />
              Files are validated before processing and never shared. <Link href="/privacy" className="font-medium text-brand-ink underline">Privacy</Link>
            </p>
          </div>
          {related.length > 0 && (
            <div>
              <h2 className="mb-4 text-xl font-semibold text-ink">Related tools</h2>
              <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
                {related.map((t) => (
                  <ToolCard key={t.slug} tool={t} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
