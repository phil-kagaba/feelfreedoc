import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: ReactNode }) {
  return (
    <section className="bg-hero border-b border-line">
      <div className="container-page py-14 text-center sm:py-20">
        {eyebrow && <p className="text-sm font-semibold text-brand-ink">{eyebrow}</p>}
        <h1 className="mx-auto mt-2 max-w-3xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">{title}</h1>
        {sub && <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-muted">{sub}</p>}
      </div>
    </section>
  );
}
