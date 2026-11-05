"use client";

import { useState } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { FormError } from "@/components/auth-shell";
import { postJson } from "@/lib/api-client";
import { errorMessage } from "@/lib/utils";

export function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  if (sent) {
    return (
      <div className="card flex flex-col items-center justify-center p-10 text-center">
        <CheckCircle2 className="h-12 w-12 text-brand-ink" />
        <h2 className="mt-4 text-xl font-semibold text-ink">Message sent</h2>
        <p className="mt-1 text-muted">Thanks, {form.name.split(" ")[0]}! We&apos;ll get back to you at {form.email}.</p>
      </div>
    );
  }

  return (
    <form
      className="card space-y-4 p-6 sm:p-8"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await postJson("/api/contact", form);
          setSent(true);
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="label">Name</span><input className="input" value={form.name} onChange={set("name")} autoComplete="name" required /></label>
        <label className="block"><span className="label">Email</span><input className="input" type="email" value={form.email} onChange={set("email")} autoComplete="email" required /></label>
      </div>
      <label className="block"><span className="label">Subject</span><input className="input" value={form.subject} onChange={set("subject")} maxLength={150} /></label>
      <label className="block"><span className="label">Message</span><textarea className="input min-h-40" value={form.message} onChange={set("message")} required maxLength={5000} /></label>
      <input type="text" name="website" value={form.website} onChange={set("website")} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <FormError msg={error} />
      <button className="btn-primary h-12 w-full sm:w-auto sm:px-8" disabled={busy}>{busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Send message</button>
    </form>
  );
}
