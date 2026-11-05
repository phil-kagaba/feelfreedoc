import type { Metadata } from "next";
import { Clock, Mail, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Contact", description: "Get in touch with the feelfreedoc team." };

export default function ContactPage() {
  return (
    <>
      <PageHeader eyebrow="Contact" title="We'd love to hear from you" sub="Bug reports, feature requests, partnership ideas — send us a message." />
      <div className="container-page grid gap-10 py-16 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          {[
            { icon: MessageSquare, title: "Support", text: "Problems with a tool? Tell us the tool name and what happened — please don't attach confidential files." },
            { icon: Clock, title: "Response time", text: "We usually reply within two business days." },
            { icon: Mail, title: "Privacy requests", text: "Need your account data or want it deleted? You can delete your account any time in Settings, or ask us here." },
          ].map((c) => (
            <div key={c.title} className="card flex gap-4 p-5">
              <c.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-ink" />
              <div>
                <h2 className="font-semibold text-ink">{c.title}</h2>
                <p className="mt-1 text-sm leading-6 text-muted">{c.text}</p>
              </div>
            </div>
          ))}
        </div>
        <ContactForm />
      </div>
    </>
  );
}
