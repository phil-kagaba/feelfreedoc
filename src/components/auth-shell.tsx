import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

export function AuthShell({ title, sub, children, footer }: { title: string; sub?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="bg-hero border-b border-line">
      <div className="container-page grid min-h-[calc(100dvh-4rem)] items-center gap-10 py-12 lg:grid-cols-2">
        <div className="hidden lg:block">
          <h2 className="max-w-md text-4xl font-semibold leading-tight tracking-tight text-ink">
            Your documents, <span className="text-brand-ink">organized</span>.
          </h2>
          <ul className="mt-8 space-y-4">
            {[
              "Processing history across all tools",
              "Quick access to your most-used tools",
              "Free forever — every tool still works without an account",
              "We store job details, never your documents",
            ].map((t) => (
              <li key={t} className="flex items-center gap-3 text-muted">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-ink" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="mx-auto w-full max-w-md">
          <div className="card p-6 shadow-lift sm:p-8">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
            {sub && <p className="mt-1.5 text-sm text-muted">{sub}</p>}
            <div className="mt-6">{children}</div>
          </div>
          {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

export function FormError({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <p role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
      {msg}
    </p>
  );
}
