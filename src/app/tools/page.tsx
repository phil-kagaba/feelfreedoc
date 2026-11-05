import type { Metadata } from "next";
import { ToolsExplorer } from "@/components/tools-explorer";
import { CATEGORIES, TOOLS, type CategoryId } from "@/lib/tools";

export const metadata: Metadata = {
  title: "All PDF Tools",
  description: `Browse all ${TOOLS.length} feelfreedoc tools to organize, compress, convert, edit, sign, protect and analyze documents.`,
};

export default async function ToolsPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const valid = CATEGORIES.some((c) => c.id === category) ? (category as CategoryId) : "all";
  return (
    <div className="bg-hero border-b border-line">
      <div className="container-page py-14 sm:py-20">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">All PDF tools</h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-muted">
            Search or filter by category. Every tool is free and works without an account.
          </p>
        </div>
        <ToolsExplorer initialCategory={valid} showHeading={false} />
      </div>
    </div>
  );
}
