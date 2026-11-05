import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Logo } from "./logo";
import { CATEGORIES, toolsByCategory } from "@/lib/tools";

export function Footer() {
  const cols = CATEGORIES.filter((c) => ["organize", "convert", "edit", "security"].includes(c.id));
  return (
    <footer className="mt-24 border-t border-line bg-surface-2">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(5,1fr)]">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm leading-6 text-muted">
            Free online tools to merge, split, compress, convert, edit, sign and secure your documents.
          </p>
          <p className="flex items-center gap-2 text-xs text-muted">
            <ShieldCheck className="h-4 w-4 text-brand-ink" />
            Files are deleted automatically after processing.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.id}>
            <h3 className="mb-3 text-sm font-semibold text-ink">{c.name.split(" &")[0]}</h3>
            <ul className="space-y-2">
              {toolsByCategory(c.id).slice(0, 6).map((t) => (
                <li key={t.slug}>
                  <Link href={`/${t.slug}`} className="text-sm text-muted transition hover:text-ink">
                    {t.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink">Company</h3>
          <ul className="space-y-2 text-sm">
            {[
              ["/about", "About Us"],
              ["/contact", "Contact"],
              ["/faq", "FAQ"],
              ["/privacy", "Privacy Policy"],
              ["/terms", "Terms of Service"],
              ["/tools", "All tools"],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="text-muted transition hover:text-ink">{label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-6 text-xs text-muted sm:flex-row">
          <p>© {new Date().getFullYear()} feelfreedoc. All rights reserved.</p>
          <p>Made for people who just want their documents to work.</p>
        </div>
      </div>
    </footer>
  );
}
