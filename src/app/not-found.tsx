import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink"><FileQuestion className="h-8 w-8" /></span>
      <h1 className="mt-6 text-3xl font-semibold text-ink">Page not found</h1>
      <p className="mt-2 text-muted">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <div className="mt-6 flex gap-3">
        <Link href="/" className="btn-ghost">Go home</Link>
        <Link href="/tools" className="btn-primary">Browse tools</Link>
      </div>
    </div>
  );
}
