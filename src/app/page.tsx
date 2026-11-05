import Link from "next/link";
import { Lock, MousePointerClick, ServerCog, Settings2, ShieldCheck, Trash2, UploadCloud, Download } from "lucide-react";
import { HomeHero } from "@/components/home-hero";
import { UsageStrip } from "@/components/usage-strip";
import { ToolsExplorer } from "@/components/tools-explorer";
import { FaqList } from "@/components/faq-list";
import { TOOLS } from "@/lib/tools";

const STEPS = [
  { icon: MousePointerClick, title: "Choose a tool", text: `Pick from ${TOOLS.length} tools, or drop a file above and we'll suggest what fits.` },
  { icon: UploadCloud, title: "Add your files", text: "Drag and drop or browse. Files are checked for type and size first." },
  { icon: Settings2, title: "Adjust options", text: "Ranges, quality, passwords, signatures — only the settings that matter." },
  { icon: Download, title: "Download", text: "Get your result instantly. Temporary copies are deleted right away." },
];

const SECURITY = [
  { icon: ShieldCheck, title: "Processed in your browser", text: "Organizing, editing, signing and image tools never upload your file." },
  { icon: Trash2, title: "Deleted automatically", text: "Server-side jobs run in an isolated temp folder that is wiped as soon as you get the result." },
  { icon: Lock, title: "Encrypted in transit", text: "Uploads use HTTPS. Results are streamed back only to you — no public links." },
  { icon: ServerCog, title: "Real document engines", text: "LibreOffice, Tesseract OCR, PyMuPDF and qpdf do the heavy lifting." },
];

export default function HomePage() {
  return (
    <>
      <HomeHero />

      <div className="container-page space-y-24 py-16 sm:py-20">
        <UsageStrip />

        <ToolsExplorer />

        <section aria-labelledby="how">
          <div className="mb-10 text-center">
            <h2 id="how" className="text-3xl font-semibold tracking-tight text-ink">How it works</h2>
            <p className="mt-2 text-muted">Four steps. No software, no watermarks on your results.</p>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="card relative p-6">
                <span className="absolute right-5 top-5 text-xs font-semibold text-muted">0{i + 1}</span>
                <s.icon className="h-6 w-6 text-brand-ink" strokeWidth={1.75} />
                <h3 className="mt-4 font-semibold text-ink">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="overflow-hidden rounded-3xl border border-line bg-brand-soft/60 p-6 sm:p-10 lg:p-14" aria-labelledby="sec">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <h2 id="sec" className="text-3xl font-semibold tracking-tight text-ink">Your documents stay yours</h2>
              <p className="mt-3 leading-7 text-muted">
                We built feelfreedoc around a simple rule: process as much as possible on your own device, and when a server
                is needed, keep the file only as long as the job takes.
              </p>
              <Link href="/privacy" className="btn-ghost mt-6">Read our privacy policy</Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {SECURITY.map((s) => (
                <div key={s.title} className="rounded-2xl border border-line bg-surface p-5">
                  <s.icon className="h-5 w-5 text-brand-ink" strokeWidth={1.75} />
                  <h3 className="mt-3 text-sm font-semibold text-ink">{s.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl" aria-labelledby="faq">
          <h2 id="faq" className="mb-8 text-center text-3xl font-semibold tracking-tight text-ink">Frequently asked questions</h2>
          <FaqList />
        </section>

        <section className="rounded-3xl bg-ink px-6 py-12 text-center sm:px-12 sm:py-16">
          <h2 className="text-3xl font-semibold tracking-tight text-bg">Keep your history in one place</h2>
          <p className="mx-auto mt-3 max-w-xl text-bg/70">
            A free account adds a dashboard with your recent jobs and favourite tools. Every tool still works without one.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/signup" className="btn-primary px-6">Create free account</Link>
            <Link href="/tools" className="btn border border-bg/20 text-bg hover:bg-bg/10">Browse all tools</Link>
          </div>
        </section>
      </div>
    </>
  );
}
