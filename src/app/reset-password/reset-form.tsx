"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { AuthShell, FormError } from "@/components/auth-shell";
import { StrengthMeter } from "@/app/signup/signup-form";
import { postJson } from "@/lib/api-client";
import { errorMessage } from "@/lib/utils";

export function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setError("The passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/auth/reset", { token, password });
      router.push("/login?reset=1");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <AuthShell title="Invalid link" sub="This password reset link is missing its token.">
        <Link href="/forgot-password" className="btn-primary w-full">Request a new link</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" sub="You'll be signed out of all other devices.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <label className="block">
          <span className="label">New password</span>
          <input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <StrengthMeter pw={password} />
        </label>
        <label className="block">
          <span className="label">Repeat new password</span>
          <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        <FormError msg={error} />
        <button className="btn-primary h-12 w-full" disabled={busy}>
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Update password
        </button>
      </form>
    </AuthShell>
  );
}
