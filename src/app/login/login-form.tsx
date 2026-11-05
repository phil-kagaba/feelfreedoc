"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { AuthShell, FormError } from "@/components/auth-shell";
import { useAuth } from "@/components/auth-provider";
import { postJson } from "@/lib/api-client";
import { errorMessage } from "@/lib/utils";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const next = params.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/auth/login", { email, password });
      await refresh();
      router.push(safeNext);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      sub="Log in to see your history and favourite tools."
      footer={<>New to feelfreedoc? <Link href="/signup" className="font-semibold text-brand-ink hover:underline">Create an account</Link></>}
    >
      {params.get("reset") === "1" && (
        <p className="mb-4 rounded-xl bg-brand-soft px-3.5 py-2.5 text-sm text-ink">Password updated. Log in with your new password.</p>
      )}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <label className="block">
          <span className="label">Email</span>
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1.5 flex items-center justify-between text-sm font-medium text-ink">
            Password
            <Link href="/forgot-password" className="text-xs font-semibold text-brand-ink hover:underline">Forgot password?</Link>
          </span>
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <FormError msg={error} />
        <button className="btn-primary h-12 w-full" disabled={busy}>
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Log in
        </button>
      </form>
    </AuthShell>
  );
}
