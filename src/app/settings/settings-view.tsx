"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { useAuth, type SessionUser } from "@/components/auth-provider";
import { FormError } from "@/components/auth-shell";
import { StrengthMeter } from "@/app/signup/signup-form";
import { postJson } from "@/lib/api-client";
import { errorMessage } from "@/lib/utils";

function Section({ title, sub, children, danger }: { title: string; sub: string; children: ReactNode; danger?: boolean }) {
  return (
    <section className={`card grid gap-6 p-6 md:grid-cols-[240px_1fr] ${danger ? "border-danger/40" : ""}`}>
      <div>
        <h2 className={`font-semibold ${danger ? "text-danger" : "text-ink"}`}>{title}</h2>
        <p className="mt-1 text-sm text-muted">{sub}</p>
      </div>
      <div className="max-w-lg">{children}</div>
    </section>
  );
}

function useForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  async function run(fn: () => Promise<string | void>) {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const msg = await fn();
      if (msg) setOk(msg);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, ok, run };
}

function Saved({ msg }: { msg: string | null }) {
  return msg ? <p className="flex items-center gap-2 text-sm text-brand-ink"><CheckCircle2 className="h-4 w-4" /> {msg}</p> : null;
}

export function SettingsView() {
  return <RequireAuth>{(u) => <Inner user={u} />}</RequireAuth>;
}

function Inner({ user }: { user: SessionUser }) {
  const { refresh } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [emailPw, setEmailPw] = useState("");
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [delPw, setDelPw] = useState("");
  const profile = useForm();
  const pw = useForm();
  const del = useForm();

  return (
    <div className="container-page py-10 sm:py-14">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Account settings</h1>
      <p className="mt-1 text-muted">Manage your profile, password and data.</p>
      <div className="mt-8 space-y-6">
        <Section title="Profile" sub="Your name and the email you log in with.">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void profile.run(async () => {
                await postJson("/api/auth/profile", { name, email, currentPassword: emailPw }, "PATCH");
                await refresh();
                setEmailPw("");
                return "Profile saved.";
              });
            }}
          >
            <label className="block"><span className="label">Name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></label>
            <label className="block"><span className="label">Email</span><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            {email.trim().toLowerCase() !== user.email && (
              <label className="block"><span className="label">Current password (required to change email)</span><input className="input" type="password" value={emailPw} onChange={(e) => setEmailPw(e.target.value)} autoComplete="current-password" /></label>
            )}
            <FormError msg={profile.error} />
            <Saved msg={profile.ok} />
            <button className="btn-primary" disabled={profile.busy}>{profile.busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Save profile</button>
          </form>
        </Section>

        <Section title="Password" sub="Changing your password signs you out on other devices.">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void pw.run(async () => {
                await postJson("/api/auth/password", { currentPassword: cur, newPassword: next });
                setCur("");
                setNext("");
                return "Password updated.";
              });
            }}
          >
            <label className="block"><span className="label">Current password</span><input className="input" type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" /></label>
            <label className="block"><span className="label">New password</span><input className="input" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" /><StrengthMeter pw={next} /></label>
            <FormError msg={pw.error} />
            <Saved msg={pw.ok} />
            <button className="btn-primary" disabled={pw.busy || !cur || !next}>{pw.busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Change password</button>
          </form>
        </Section>

        <Section title="Delete account" sub="Permanently deletes your account and history. This cannot be undone." danger>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!confirm("Delete your account permanently?")) return;
              void del.run(async () => {
                await postJson("/api/auth/account", { password: delPw }, "DELETE");
                await refresh();
                router.push("/");
              });
            }}
          >
            <label className="block"><span className="label">Confirm with your password</span><input className="input" type="password" value={delPw} onChange={(e) => setDelPw(e.target.value)} autoComplete="current-password" /></label>
            <FormError msg={del.error} />
            <button className="btn-danger" disabled={del.busy || !delPw}>{del.busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Delete my account</button>
          </form>
        </Section>
      </div>
    </div>
  );
}
