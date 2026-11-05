import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Terms of Service", description: "The terms that apply when you use feelfreedoc." };

export default function TermsPage() {
  return (
    <>
      <PageHeader eyebrow="Legal" title="Terms of Service" sub="Last updated: November 3, 2026" />
      <article className="prose-ffd container-page max-w-3xl py-16">
        <p>By using feelfreedoc you agree to these terms. Please read them carefully.</p>
        <h2>1. The service</h2>
        <p>feelfreedoc provides online tools to process documents. The service is provided free of charge, &ldquo;as is&rdquo;, without warranties of any kind. We work hard to keep it reliable but can&apos;t guarantee that every file will be processed perfectly — always keep your originals.</p>
        <h2>2. Your content</h2>
        <p>You keep all rights to the files you process. You confirm that you have the right to process them, including any document you unlock, convert or modify. Don&apos;t use the service to process content that is illegal or infringes others&apos; rights.</p>
        <h2>3. Acceptable use</h2>
        <ul>
          <li>Don&apos;t attempt to bypass rate limits, upload malware, or disrupt the service.</li>
          <li>Don&apos;t use Unlock PDF or other tools to access documents you&apos;re not authorized to access.</li>
          <li>Don&apos;t use automated scripts to access the service without permission.</li>
        </ul>
        <h2>4. AI features</h2>
        <p>AI-generated summaries, translations and answers can contain errors. Verify important information against the original document. Don&apos;t rely on AI output as legal, medical or financial advice.</p>
        <h2>5. Accounts</h2>
        <p>You&apos;re responsible for keeping your password secure. We may suspend accounts that violate these terms.</p>
        <h2>6. Limitation of liability</h2>
        <p>To the maximum extent permitted by law, feelfreedoc is not liable for any indirect or consequential damages, or for loss of data, arising from your use of the service.</p>
        <h2>7. Changes</h2>
        <p>We may update these terms. Continuing to use the service after changes means you accept the new terms.</p>
        <h2>8. Contact</h2>
        <p>Questions? Reach us through the <Link href="/contact">contact page</Link>.</p>
      </article>
    </>
  );
}
