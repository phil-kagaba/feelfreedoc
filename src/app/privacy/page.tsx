import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Privacy Policy", description: "How feelfreedoc handles your files and personal data." };

export default function PrivacyPage() {
  return (
    <>
      <PageHeader eyebrow="Legal" title="Privacy Policy" sub="Last updated: November 3, 2026" />
      <article className="prose-ffd container-page max-w-3xl py-16">
        <p>This policy explains what happens to your documents and personal data when you use feelfreedoc. The short version: we process files only to give you the result, delete them immediately afterwards, and never sell your data.</p>
        <h2>1. Your documents</h2>
        <h3>Tools that run in your browser</h3>
        <p>Merge, split, extract, rotate, reorder, delete and organize pages; watermarking, page numbers, editing, signing and annotating; image conversion; PDF to text; metadata editing and comparison run entirely on your device. These files are never uploaded to our servers.</p>
        <h3>Tools that run on our server</h3>
        <p>Compression, optimization, repair, Office and HTML conversion, OCR, password protection, unlocking and redaction require server software. For these tools:</p>
        <ul>
          <li>Your file is sent over an encrypted HTTPS connection.</li>
          <li>It is stored in an isolated temporary folder with a random name, processed, and the folder is deleted as soon as the result is sent back — usually within seconds. A background sweep removes anything left behind after 15 minutes.</li>
          <li>Results are streamed directly to your browser. We do not create download links that others could access.</li>
          <li>We do not read, analyze, copy or keep your documents.</li>
        </ul>
        <h3>AI tools</h3>
        <p>For AI tools, the text of your document is extracted in your browser and sent to our AI provider (Anthropic) to generate the result. The provider processes it under its API data-handling terms; check them if your organization has specific requirements. Don&apos;t use AI tools for documents you are not allowed to share with a third-party processor.</p>
        <h2>2. Account data</h2>
        <p>If you create an account we store your name, email address, a securely hashed password (bcrypt) and session records. When you complete a job while logged in, we store a history entry with the tool used, file names, file sizes and the time — never file contents. You can clear your history or delete your account at any time from your dashboard and settings.</p>
        <h2>3. Cookies and local storage</h2>
        <p>We use a single essential, HTTP-only cookie to keep you logged in. Your browser&apos;s local storage remembers your theme and recently used tools; this information stays on your device. We don&apos;t use advertising or tracking cookies.</p>
        <h2>4. Security</h2>
        <p>We validate file types and sizes, rate-limit requests, protect forms against cross-site request forgery, run document engines with network access disabled where possible, and never expose uploaded files publicly.</p>
        <h2>5. Your rights</h2>
        <p>You can access, correct or delete your personal data at any time. To exercise these rights or ask a question, use the <Link href="/contact">contact form</Link>.</p>
        <h2>6. Changes</h2>
        <p>If we change this policy we&apos;ll update the date above and, for significant changes, notify registered users.</p>
      </article>
    </>
  );
}
