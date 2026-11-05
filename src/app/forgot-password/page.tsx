"use client";

import Link from "next/link";
import { useState } from "react";
import { LoaderCircle, MailCheck } from "lucide-react";
import { AuthShell, FormError } from "@/components/auth-shell";
import { postJson } from "@/lib/api-client";
import { errorMessage } from "@/lib/utils";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/auth/forgot", { email });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      sub="Enter your account email and we'll send you a reset link."
      footer={<Link href="/login" className="font-semibold text-brand-ink hover:underline">Back to log in</Link>}
    >
      {sent ? (
        <div className="flex flex-col items-center py-4 text-center">
          <MailCheck className="h-10 w-10 text-brand-ink" />
          <p className="mt-3 font-medium text-ink">Check your inbox</p>
          <p className="mt-1 text-sm text-muted">If an account exists for {email}, a reset link is on its way. It expires in 1 hour.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <label className="block">
            <span className="label">Email</span>
            <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <FormError msg={error} />
          <button className="btn-primary h-12 w-full" disabled={busy}>
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Send reset link
          </button>
        </form>
      )}
    </AuthShell>
  );
}
