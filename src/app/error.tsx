"use client";

import { AlertTriangle } from "lucide-react";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-soft text-danger"><AlertTriangle className="h-8 w-8" /></span>
      <h1 className="mt-6 text-3xl font-semibold text-ink">Something went wrong</h1>
      <p className="mt-2 text-muted">An unexpected error occurred. Your files were not uploaded anywhere.</p>
      <button type="button" onClick={reset} className="btn-primary mt-6">Try again</button>
    </div>
  );
}
