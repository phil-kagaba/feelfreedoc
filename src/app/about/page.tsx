import type { Metadata } from "next";
import Link from "next/link";
import { Accessibility, Heart, ShieldCheck, Sparkles, Zap, Globe } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { TOOLS } from "@/lib/tools";

export const metadata: Metadata = {
  title: "About Us",
  description: "feelfreedoc makes working with documents simple, fast, accessible and private.",
};

const VALUES = [
  { icon: ShieldCheck, title: "Privacy first", text: "Most tools run in your browser. When a server is needed, files live in a temporary folder only for the seconds the job takes." },
  { icon: Zap, title: "Fast by default", text: "No queues for simple tasks, no sign-up walls, no watermarks on your results." },
  { icon: Accessibility, title: "Accessible", text: "Keyboard navigation, readable contrast, touch-friendly controls and support for reduced motion." },
  { icon: Globe, title: "Works everywhere", text: "Desktop, tablet or phone — every tool adapts to the screen in front of you." },
  { icon: Sparkles, title: "Honest AI", text: "AI tools use a real language model and tell you clearly when they're not configured — never fake output." },
  { icon: Heart, title: "Built on open source", text: "PDF.js, pdf-lib, PyMuPDF, qpdf, LibreOffice and Tesseract power the engine under the hood." },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About feelfreedoc"
        title="Document tools that just work"
        sub="We started feelfreedoc because editing a PDF shouldn't require installing software, creating an account, or wondering where your file ends up."
      />
      <div className="container-page py-16">
        <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-2">
          <div className="prose-ffd">
            <h2>Our mission</h2>
            <p>
              Make working with documents simple, fast, accessible and secure for everyone — students submitting assignments,
              freelancers signing contracts, and teams handling hundreds of files a week.
            </p>
            <p>
              Today feelfreedoc offers {TOOLS.length} tools covering organizing, compression, conversion, editing, signing,
              security and AI-assisted reading. Every one of them is free to use, with or without an account.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              [String(TOOLS.length), "document tools"],
              ["0", "files kept after processing"],
              ["50 MB", "per file, free"],
              ["100%", "in-browser for most tools"],
            ].map(([n, l]) => (
              <div key={l} className="card p-6">
                <p className="text-3xl font-semibold text-ink">{n}</p>
                <p className="mt-1 text-sm text-muted">{l}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mx-auto mt-16 max-w-5xl">
          <h2 className="mb-6 text-2xl font-semibold text-ink">What we care about</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {VALUES.map((v) => (
              <div key={v.title} className="card p-6">
                <v.icon className="h-6 w-6 text-brand-ink" strokeWidth={1.75} />
                <h3 className="mt-4 font-semibold text-ink">{v.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted">{v.text}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mx-auto mt-16 flex max-w-5xl flex-col items-center justify-between gap-4 rounded-3xl bg-brand-soft p-8 sm:flex-row">
          <div>
            <h2 className="text-xl font-semibold text-ink">Questions or ideas?</h2>
            <p className="text-muted">We read every message.</p>
          </div>
          <Link href="/contact" className="btn-dark">Contact us</Link>
        </div>
      </div>
    </>
  );
}
