"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { AuthShell, FormError } from "@/components/auth-shell";
import { useAuth } from "@/components/auth-provider";
import { postJson } from "@/lib/api-client";
import { cn, errorMessage } from "@/lib/utils";

export function passwordScore(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}

export function StrengthMeter({ pw }: { pw: string }) {
  const score = passwordScore(pw);
  const label = ["Too weak", "Weak", "Okay", "Good", "Strong"][score];
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-1 flex-1 rounded-full", i < score ? (score < 2 ? "bg-danger" : score < 3 ? "bg-amber-400" : "bg-brand-strong") : "bg-line")} />
        ))}
      </div>
      {pw && <p className="mt-1 text-xs text-muted">{label} · at least 8 characters with a letter and a number</p>}
    </div>
  );
}

export function SignupForm() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!agree) return setError("Please accept the Terms of Service and Privacy Policy.");
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/auth/signup", { name, email, password });
      await refresh();
      router.push("/dashboard");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create your free account"
      sub="Takes 20 seconds. No credit card."
      footer={<>Already have an account? <Link href="/login" className="font-semibold text-brand-ink hover:underline">Log in</Link></>}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <label className="block">
          <span className="label">Full name</span>
          <input className="input" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </label>
        <label className="block">
          <span className="label">Email</span>
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Password</span>
          <input className="input" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <StrengthMeter pw={password} />
        </label>
        <label className="flex items-start gap-2.5 text-sm text-muted">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-[#7fd492]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>I agree to the <Link href="/terms" className="font-medium text-brand-ink underline">Terms</Link> and <Link href="/privacy" className="font-medium text-brand-ink underline">Privacy Policy</Link>.</span>
        </label>
        <FormError msg={error} />
        <button className="btn-primary h-12 w-full" disabled={busy}>
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Create account
        </button>
      </form>
    </AuthShell>
  );
}
