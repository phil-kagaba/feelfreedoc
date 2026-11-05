// Single source of truth for every tool on the platform.
// Kept free of React/icon imports so server routes can import it too.

export type CategoryId = "organize" | "optimize" | "convert" | "edit" | "security" | "ai";

/** Where the document is processed. */
export type Engine = "browser" | "server" | "ai";

export interface ToolDef {
  slug: string;
  name: string;
  short: string;
  description: string;
  category: CategoryId;
  engine: Engine;
  /** Accepted file extensions (lowercase, with dot). */
  accept: string[];
  multiple: boolean;
  /** Minimum number of files before processing is allowed. */
  minFiles?: number;
  keywords: string[];
  popular?: boolean;
  /** Label of the main action button. */
  action: string;
}

export const CATEGORIES: { id: CategoryId; name: string; blurb: string }[] = [
  { id: "organize", name: "Organize & Modify", blurb: "Merge, split, rotate and rearrange pages." },
  { id: "optimize", name: "Compress & Optimize", blurb: "Shrink, streamline and repair PDFs." },
  { id: "convert", name: "Convert Files", blurb: "Move between PDF, Office, images, HTML and text." },
  { id: "edit", name: "Edit & Sign", blurb: "Add text, images, shapes, signatures and notes." },
  { id: "security", name: "Security & Advanced", blurb: "Protect, unlock, redact, OCR and compare." },
  { id: "ai", name: "AI-Powered", blurb: "Summarize, translate and question your documents." },
];

const PDF = [".pdf"];
const WORD = [".docx", ".doc", ".odt", ".rtf"];
const EXCEL = [".xlsx", ".xls", ".ods", ".csv"];
const PPT = [".pptx", ".ppt", ".odp"];
const IMAGES = [".jpg", ".jpeg", ".png", ".webp"];
const AI_DOCS = [".pdf", ".txt", ".md"];

export const TOOLS: ToolDef[] = [
  // ── Organize & Modify ──────────────────────────────────────────────
  {
    slug: "merge-pdf", name: "Merge PDF", category: "organize", engine: "browser",
    short: "Combine multiple PDFs into one document in the order you choose.",
    description: "Combine several PDF files into a single document. Drag files to set their order, then merge in seconds — right in your browser.",
    accept: PDF, multiple: true, minFiles: 2, popular: true, action: "Merge PDFs",
    keywords: ["combine", "join", "append", "unite"],
  },
  {
    slug: "split-pdf", name: "Split PDF", category: "organize", engine: "browser",
    short: "Separate a PDF into several files by ranges or page count.",
    description: "Split one PDF into multiple documents using custom page ranges, fixed chunks, or one file per page. Multiple outputs are packed into a ZIP.",
    accept: PDF, multiple: false, popular: true, action: "Split PDF",
    keywords: ["separate", "divide", "ranges", "cut"],
  },
  {
    slug: "extract-pages", name: "Extract Pages", category: "organize", engine: "browser",
    short: "Pick specific pages and save them as a new PDF.",
    description: "Select the pages you need by clicking thumbnails or typing ranges, and get them as a brand new PDF.",
    accept: PDF, multiple: false, action: "Extract pages",
    keywords: ["select", "pick", "save pages"],
  },
  {
    slug: "rotate-pdf", name: "Rotate PDF", category: "organize", engine: "browser",
    short: "Rotate single pages or the whole document.",
    description: "Rotate individual pages or every page at once by 90°, 180° or 270°. Previews update instantly.",
    accept: PDF, multiple: false, action: "Apply rotation",
    keywords: ["turn", "orientation", "landscape", "portrait"],
  },
  {
    slug: "reorder-pages", name: "Reorder Pages", category: "organize", engine: "browser",
    short: "Drag and drop pages into a new order.",
    description: "Rearrange the pages of your PDF by dragging thumbnails into place, or reverse the whole document with one click.",
    accept: PDF, multiple: false, action: "Save new order",
    keywords: ["sort", "arrange", "move pages", "drag"],
  },
  {
    slug: "delete-pages", name: "Delete Pages", category: "organize", engine: "browser",
    short: "Remove unwanted pages from a PDF.",
    description: "Click the pages you want to remove — or type ranges — and download a clean copy without them.",
    accept: PDF, multiple: false, action: "Delete pages",
    keywords: ["remove", "drop pages", "trim"],
  },
  {
    slug: "organize-pdf", name: "Organize PDF", category: "organize", engine: "browser",
    short: "Visually sort, rotate, duplicate, delete and insert pages.",
    description: "A visual page manager: reorder by drag and drop, rotate, duplicate, delete, insert blank pages and add pages from other PDFs.",
    accept: PDF, multiple: true, action: "Save document",
    keywords: ["manage", "pages", "insert blank", "duplicate"],
  },

  // ── Compress & Optimize ────────────────────────────────────────────
  {
    slug: "compress-pdf", name: "Compress PDF", category: "optimize", engine: "server",
    short: "Reduce file size while keeping good visual quality.",
    description: "Shrink PDFs by recompressing images, subsetting fonts and removing redundant data. Choose low, recommended or high compression and compare sizes.",
    accept: PDF, multiple: false, popular: true, action: "Compress PDF",
    keywords: ["reduce", "shrink", "smaller", "size"],
  },
  {
    slug: "optimize-pdf", name: "Optimize PDF", category: "optimize", engine: "server",
    short: "Clean structure and linearize for fast web viewing.",
    description: "Rebuild the PDF's internal structure: compress object streams, drop unused objects and linearize the file for fast web view.",
    accept: PDF, multiple: false, action: "Optimize PDF",
    keywords: ["linearize", "fast web view", "clean"],
  },
  {
    slug: "repair-pdf", name: "Repair PDF", category: "optimize", engine: "server",
    short: "Attempt to recover a damaged or corrupted PDF.",
    description: "Rebuild broken cross-reference tables and recover readable pages from damaged PDF files.",
    accept: PDF, multiple: false, action: "Repair PDF",
    keywords: ["fix", "recover", "corrupted", "broken"],
  },

  // ── Convert ────────────────────────────────────────────────────────
  {
    slug: "pdf-to-word", name: "PDF to Word", category: "convert", engine: "server",
    short: "Turn PDFs into editable DOCX documents.",
    description: "Convert PDF documents into editable Word files, keeping paragraphs, tables, images and layout as closely as possible.",
    accept: PDF, multiple: false, popular: true, action: "Convert to Word",
    keywords: ["docx", "doc", "editable", "microsoft word"],
  },
  {
    slug: "word-to-pdf", name: "Word to PDF", category: "convert", engine: "server",
    short: "Convert DOCX, DOC, ODT and RTF files to PDF.",
    description: "Make PDFs from Word documents with LibreOffice-grade rendering of fonts, tables and images.",
    accept: WORD, multiple: false, popular: true, action: "Convert to PDF",
    keywords: ["docx", "doc", "odt", "rtf"],
  },
  {
    slug: "pdf-to-excel", name: "PDF to Excel", category: "convert", engine: "server",
    short: "Pull tables out of PDFs into XLSX spreadsheets.",
    description: "Detect tables in your PDF and export them to an Excel workbook, one sheet per page. Pages without tables keep their text lines.",
    accept: PDF, multiple: false, action: "Convert to Excel",
    keywords: ["xlsx", "spreadsheet", "tables", "csv"],
  },
  {
    slug: "excel-to-pdf", name: "Excel to PDF", category: "convert", engine: "server",
    short: "Convert XLSX, XLS, ODS and CSV spreadsheets to PDF.",
    description: "Turn spreadsheets into clean, printable PDF documents.",
    accept: EXCEL, multiple: false, action: "Convert to PDF",
    keywords: ["xlsx", "xls", "spreadsheet", "csv"],
  },
  {
    slug: "pdf-to-powerpoint", name: "PDF to PowerPoint", category: "convert", engine: "server",
    short: "Turn each PDF page into a PPTX slide.",
    description: "Create a PowerPoint deck where every page becomes a high-resolution slide, with the page text copied into the speaker notes.",
    accept: PDF, multiple: false, action: "Convert to PowerPoint",
    keywords: ["pptx", "slides", "presentation"],
  },
  {
    slug: "powerpoint-to-pdf", name: "PowerPoint to PDF", category: "convert", engine: "server",
    short: "Convert PPTX, PPT and ODP presentations to PDF.",
    description: "Turn presentations into PDFs that look the same on every device.",
    accept: PPT, multiple: false, action: "Convert to PDF",
    keywords: ["pptx", "ppt", "slides", "presentation"],
  },
  {
    slug: "pdf-to-jpg", name: "PDF to JPG", category: "convert", engine: "browser",
    short: "Render every page as a JPG image.",
    description: "Convert PDF pages to JPG images at the resolution and quality you choose. Several pages are delivered as a ZIP.",
    accept: PDF, multiple: false, popular: true, action: "Convert to JPG",
    keywords: ["image", "jpeg", "picture", "export"],
  },
  {
    slug: "jpg-to-pdf", name: "Image to PDF", category: "convert", engine: "browser",
    short: "Combine JPG, PNG and WebP images into a PDF.",
    description: "Turn photos and scans into a PDF. Reorder images, choose page size, orientation and margins.",
    accept: IMAGES, multiple: true, popular: true, action: "Create PDF",
    keywords: ["jpg", "png", "photo", "scan", "image"],
  },
  {
    slug: "pdf-to-png", name: "PDF to PNG", category: "convert", engine: "browser",
    short: "Render pages as lossless PNG images.",
    description: "Export PDF pages as crisp, lossless PNG images. Several pages are delivered as a ZIP.",
    accept: PDF, multiple: false, action: "Convert to PNG",
    keywords: ["image", "png", "lossless", "export"],
  },
  {
    slug: "html-to-pdf", name: "HTML to PDF", category: "convert", engine: "server",
    short: "Render an HTML file or pasted markup as a PDF.",
    description: "Upload an .html file or paste HTML and get a print-quality PDF. Rendering is sandboxed with network access disabled.",
    accept: [".html", ".htm"], multiple: false, action: "Convert to PDF",
    keywords: ["web page", "html", "markup"],
  },
  {
    slug: "pdf-to-text", name: "PDF to Text", category: "convert", engine: "browser",
    short: "Extract plain text from a PDF.",
    description: "Pull the text layer out of a PDF as a .txt file, page by page. For scanned documents use OCR PDF first.",
    accept: PDF, multiple: false, action: "Extract text",
    keywords: ["txt", "plain text", "copy text"],
  },

  // ── Edit & Sign ────────────────────────────────────────────────────
  {
    slug: "edit-pdf", name: "Edit PDF", category: "edit", engine: "browser",
    short: "Add text boxes, images, shapes and drawings to a PDF.",
    description: "Place text, images, shapes and freehand drawings anywhere on your pages, then download a flattened PDF.",
    accept: PDF, multiple: false, popular: true, action: "Save PDF",
    keywords: ["add text", "write", "typewriter", "modify"],
  },
  {
    slug: "add-images", name: "Add Images", category: "edit", engine: "browser",
    short: "Insert pictures and logos onto PDF pages.",
    description: "Place JPG or PNG images on any page, then move and resize them before saving.",
    accept: PDF, multiple: false, action: "Save PDF",
    keywords: ["insert image", "logo", "picture", "stamp"],
  },
  {
    slug: "add-shapes", name: "Add Shapes", category: "edit", engine: "browser",
    short: "Draw rectangles, circles, lines and arrows.",
    description: "Insert rectangles, ellipses, lines and arrows with custom colors and stroke widths.",
    accept: PDF, multiple: false, action: "Save PDF",
    keywords: ["rectangle", "circle", "line", "arrow"],
  },
  {
    slug: "watermark-pdf", name: "Watermark PDF", category: "edit", engine: "browser",
    short: "Stamp text or an image across your pages.",
    description: "Add a text or image watermark with custom position, size, rotation, color and transparency.",
    accept: PDF, multiple: false, action: "Add watermark",
    keywords: ["stamp", "confidential", "draft", "logo"],
  },
  {
    slug: "page-numbers", name: "Page Numbers", category: "edit", engine: "browser",
    short: "Number pages with your own format and position.",
    description: "Add page numbers in any corner or center, with formats like “Page 1 of 10”, a custom start number and margins.",
    accept: PDF, multiple: false, action: "Add page numbers",
    keywords: ["numbering", "pagination", "footer"],
  },
  {
    slug: "sign-pdf", name: "Sign PDF", category: "edit", engine: "browser",
    short: "Draw, type or upload a signature and place it.",
    description: "Create your signature by drawing, typing or uploading an image, then place it anywhere in the document.",
    accept: PDF, multiple: false, popular: true, action: "Save signed PDF",
    keywords: ["signature", "e-sign", "initials"],
  },
  {
    slug: "annotate-pdf", name: "Annotate PDF", category: "edit", engine: "browser",
    short: "Highlight, underline, draw and add comments.",
    description: "Mark up documents with highlights, underlines, freehand ink and sticky-note comments that open in any PDF reader.",
    accept: PDF, multiple: false, action: "Save annotations",
    keywords: ["highlight", "comment", "markup", "notes"],
  },

  // ── Security & Advanced ────────────────────────────────────────────
  {
    slug: "protect-pdf", name: "Protect PDF", category: "security", engine: "server",
    short: "Encrypt a PDF with a password (AES-256).",
    description: "Lock your PDF with AES-256 encryption and optionally restrict printing, copying and editing.",
    accept: PDF, multiple: false, popular: true, action: "Protect PDF",
    keywords: ["password", "encrypt", "lock", "secure"],
  },
  {
    slug: "unlock-pdf", name: "Unlock PDF", category: "security", engine: "server",
    short: "Remove a password you know from a PDF.",
    description: "Remove password protection and restrictions from a PDF. You must enter the document's password — this tool does not crack passwords.",
    accept: PDF, multiple: false, action: "Unlock PDF",
    keywords: ["remove password", "decrypt", "unlock"],
  },
  {
    slug: "redact-pdf", name: "Redact PDF", category: "security", engine: "server",
    short: "Permanently remove sensitive text and areas.",
    description: "Black out text by search term or by drawing boxes. Content underneath is deleted from the file, not just covered.",
    accept: PDF, multiple: false, action: "Apply redactions",
    keywords: ["black out", "censor", "hide", "privacy"],
  },
  {
    slug: "ocr-pdf", name: "OCR PDF", category: "security", engine: "server",
    short: "Make scanned PDFs searchable with Tesseract OCR.",
    description: "Recognize text in scanned pages and add an invisible, searchable text layer. Supports multiple languages.",
    accept: [".pdf", ".jpg", ".jpeg", ".png"], multiple: false, action: "Run OCR",
    keywords: ["scan", "recognize", "searchable", "tesseract"],
  },
  {
    slug: "pdf-metadata", name: "PDF Metadata", category: "security", engine: "browser",
    short: "View and edit title, author, keywords and more.",
    description: "Inspect document properties and edit the title, author, subject, keywords, creator and producer — or wipe them for privacy.",
    accept: PDF, multiple: false, action: "Save metadata",
    keywords: ["properties", "author", "title", "info"],
  },
  {
    slug: "compare-pdf", name: "Compare PDF", category: "security", engine: "browser",
    short: "Highlight text differences between two PDFs.",
    description: "Upload two versions of a document to see added and removed text highlighted page by page.",
    accept: PDF, multiple: true, minFiles: 2, action: "Compare documents",
    keywords: ["diff", "difference", "versions", "changes"],
  },

  // ── AI ─────────────────────────────────────────────────────────────
  {
    slug: "ai-summarizer", name: "AI PDF Summarizer", category: "ai", engine: "ai",
    short: "Get a clear summary of long documents.",
    description: "Generate a concise summary with key points from long PDFs, choosing the length and style you need.",
    accept: AI_DOCS, multiple: false, popular: true, action: "Summarize",
    keywords: ["summary", "tl;dr", "key points"],
  },
  {
    slug: "ai-translator", name: "AI Document Translator", category: "ai", engine: "ai",
    short: "Translate document text into another language.",
    description: "Translate the text of your document into dozens of languages while keeping headings and paragraphs.",
    accept: AI_DOCS, multiple: false, action: "Translate",
    keywords: ["translate", "language", "localize"],
  },
  {
    slug: "ai-extractor", name: "AI Text Extractor", category: "ai", engine: "ai",
    short: "Pull out dates, amounts, names and key facts.",
    description: "Extract structured information — key facts, dates, parties, amounts, action items or your own fields.",
    accept: AI_DOCS, multiple: false, action: "Extract information",
    keywords: ["extract", "fields", "entities", "data"],
  },
  {
    slug: "ai-assistant", name: "AI Document Assistant", category: "ai", engine: "ai",
    short: "Ask questions and chat with your document.",
    description: "Ask anything about your document and get answers grounded in its content.",
    accept: AI_DOCS, multiple: false, action: "Start chat",
    keywords: ["chat", "ask", "question", "q&a"],
  },
];

export const TOOL_MAP: Record<string, ToolDef> = Object.fromEntries(TOOLS.map((t) => [t.slug, t]));

export function getTool(slug: string): ToolDef | undefined {
  return TOOL_MAP[slug];
}

export function toolsByCategory(id: CategoryId): ToolDef[] {
  return TOOLS.filter((t) => t.category === id);
}

export function searchTools(q: string): ToolDef[] {
  const s = q.trim().toLowerCase();
  if (!s) return TOOLS;
  return TOOLS.filter((t) =>
    [t.name, t.short, t.slug, ...t.keywords].some((v) => v.toLowerCase().includes(s)),
  );
}

/** Tools that make sense for an uploaded file, given its extension. */
export function suggestToolsForExt(ext: string): ToolDef[] {
  return TOOLS.filter((t) => t.accept.includes(ext.toLowerCase()));
}
