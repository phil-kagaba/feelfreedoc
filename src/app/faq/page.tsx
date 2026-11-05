import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { FaqList } from "@/components/faq-list";
import { FAQ } from "@/lib/faq";

export const metadata: Metadata = { title: "Frequently Asked Questions", description: "Answers about security, file limits, formats and AI tools on feelfreedoc." };

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <>
      <PageHeader eyebrow="Help center" title="Frequently asked questions" />
      <div className="container-page max-w-3xl py-16">
        <FaqList />
        <p className="mt-8 text-center text-sm text-muted">
          Still stuck? <Link href="/contact" className="font-semibold text-brand-ink underline">Contact us</Link>.
        </p>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
