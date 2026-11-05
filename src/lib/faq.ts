export const FAQ: { q: string; a: string }[] = [
  {
    q: "Is feelfreedoc free to use?",
    a: "Yes. Every tool can be used without an account. Creating a free account adds a dashboard with your processing history and frequently used tools.",
  },
  {
    q: "Are my files safe?",
    a: "Most tools — merge, split, rotate, edit, sign, watermark, image conversion and more — run entirely in your browser, so the file never leaves your device. Tools that need server software (Office conversion, compression, OCR, encryption, redaction) upload over HTTPS into an isolated temporary folder that is deleted as soon as the result is returned. Files are never shared or made public.",
  },
  {
    q: "Which file formats are supported?",
    a: "PDF, Word (DOCX, DOC, ODT, RTF), Excel (XLSX, XLS, ODS, CSV), PowerPoint (PPTX, PPT, ODP), images (JPG, PNG, WebP), HTML and plain text, depending on the tool.",
  },
  {
    q: "What is the maximum file size?",
    a: "The default limit is 50 MB per file. Self-hosted installations can change it with the MAX_UPLOAD_MB setting.",
  },
  {
    q: "Does Redact PDF really remove the information?",
    a: "Yes. Redaction deletes the text, vector graphics and image pixels under each redaction box from the file itself, then blacks out the area. It is not a cosmetic overlay that can be removed later.",
  },
  {
    q: "Can you unlock a PDF if I forgot the password?",
    a: "No. Unlock PDF removes protection only when you provide the correct password — it is meant for owners who want an unrestricted copy, not for bypassing someone else's security.",
  },
  {
    q: "How do the AI tools work?",
    a: "The document's text is extracted in your browser and sent to Anthropic's Claude API to summarize, translate, extract information or answer your questions. The AI tools require the site operator to configure an API key; if they are not configured the tools say so clearly instead of returning fake results.",
  },
  {
    q: "Do I need to install anything?",
    a: "No. Everything works in a modern browser on desktop, tablet and phone.",
  },
];
