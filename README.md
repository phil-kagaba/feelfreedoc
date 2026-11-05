# feelfreedoc

An all-in-one online document platform: 38 tools to organize, compress, convert, edit, sign, secure and analyze PDFs and Office documents — with a white / light-green / black SaaS design, light & dark mode, accounts and processing history.

## Architecture

| Layer | What runs there |
|---|---|
| **Browser** (pdf-lib, PDF.js) | Merge, split, extract, rotate, reorder, delete, organize, watermark, page numbers, edit / images / shapes / sign / annotate, PDF ↔ JPG/PNG, PDF → text, metadata, compare. Files never leave the device. |
| **Next.js API → Python worker** (`worker/docworker.py`) | Compress, optimize, repair, PDF ↔ Word/Excel/PowerPoint, HTML → PDF, OCR, protect, unlock, redact. Uses PyMuPDF, pikepdf (qpdf), pdf2docx, pdfplumber, python-pptx, openpyxl, LibreOffice, Tesseract and Chromium. |
| **AI API** (`/api/ai/*`) | Summarizer, translator, extractor, document chat — text is extracted in the browser and sent to Anthropic Claude (streaming). |
| **Database** | PostgreSQL / Supabase via `DATABASE_URL`, or embedded PGlite (zero config) for local dev. Users, sessions, password resets, history, contact messages. |

```
src/
  app/            pages, /[tool] tool pages, API routes (auth, process, ai, history, contact)
  components/     navbar, footer, tool cards, workspace (dropzone, file grid, results), tool UIs
  lib/            tools registry, pdf-ops (pdf-lib), pdfjs helpers, server/ (db, auth, jobs, ai, security)
worker/           docworker.py + requirements.txt
tests/e2e.py      Playwright end-to-end tests for every tool
```

## Run locally

Requirements: Node 20+, Python 3.10+. For the server-side tools also install LibreOffice, Tesseract (with language packs) and Chromium/Chrome.

```bash
npm install
pip install -r worker/requirements.txt          # add --break-system-packages on Debian/Ubuntu system Python
cp .env.example .env.local                       # edit as needed
npm run dev                                      # http://localhost:3000
```

Production: `npm run build && npm start`.

macOS: `brew install --cask libreoffice && brew install tesseract tesseract-lang`.
Debian/Ubuntu: `apt install libreoffice-writer libreoffice-calc libreoffice-impress tesseract-ocr tesseract-ocr-eng chromium`.

Each server tool checks what is installed (`GET /api/process/<tool>`) and tells the user plainly if something is missing — nothing is faked.

### Docker

```bash
cp .env.example .env     # set ANTHROPIC_API_KEY, SMTP etc.
docker compose up --build
```
The image bundles LibreOffice, Tesseract (en/fr/es/de/pt/it), Chromium and Python deps, runs as a non-root user, and uses the bundled Postgres.

## Configuration

See `.env.example`. Key settings:

- `ANTHROPIC_API_KEY` — enables the AI tools (get one at console.anthropic.com). Without it, AI pages show a "not configured" notice and the action is disabled. Model defaults to `claude-sonnet-5-5` (`ANTHROPIC_MODEL`).
- `DATABASE_URL` — Postgres/Supabase connection string. Tables are created automatically on first use. Empty → PGlite in `./.data`.
- `SMTP_*` — sends password-reset and contact emails. Without SMTP, reset links are printed to the server console in dev (or with `MAIL_LOG=1`).
- `MAX_UPLOAD_MB`, `MAX_CONCURRENT_JOBS`, `JOB_TIMEOUT_SEC`, `OCR_TIMEOUT_SEC` — limits.
- `CHROME_PATH`, `SOFFICE_PATH`, `TESSDATA_PREFIX`, `PYTHON_BIN` — engine paths if not on PATH.
- `TRUST_PROXY=1` — use `X-Forwarded-For` for rate limiting behind a reverse proxy.

## Security & privacy

- Extension allowlist **and** magic-byte sniffing on client and server; size limits; one job per request.
- Uploads are written under a fixed name (`input.ext`) in a random `mkdtemp` folder (mode 0700), processed, and deleted in a `finally` block; a sweeper removes anything older than 15 min. Results are streamed back — there are no public file URLs.
- Worker runs with a timeout, in its own process group (timeouts kill LibreOffice/Chromium children), with a concurrency limit.
- LibreOffice runs with a per-job profile that disables macros and routes network access to a dead proxy.
- HTML → PDF: markup is sanitized (scripts, iframes, event handlers, non-`data:` URLs, CSS `@import`/`url()` removed) and Chromium runs with DNS disabled and all traffic sent to a dead proxy, preventing SSRF/local-file reads.
- Redaction uses PyMuPDF `apply_redactions` — text, vector graphics and image pixels under boxes are deleted, and metadata can be wiped.
- Auth: bcrypt (cost 12), random session tokens stored as SHA-256 hashes, HttpOnly SameSite=Lax cookies, Origin checks on every state-changing request, per-IP and per-account rate limits, generic login/reset responses, sessions revoked on password change/reset.
- History stores only tool name, file names and sizes — never contents.
- Security headers (nosniff, frame-deny, referrer policy, permissions policy).
- AI prompts wrap document text in `<document>` tags and instruct the model to treat it as data.

For high-traffic production, run the worker in a separate sandboxed container and put a shared rate limiter (e.g. Redis or your proxy) in front — the built-in limiter is per process.

## Tests

With the server running on :3000 and fixtures in `tests/fx/` (see the top of `tests/e2e.py`):

```bash
pip install playwright && playwright install chromium
python tests/e2e.py            # all tools
python tests/e2e.py merge sign # selected tests
```

Verified in development: all 26 browser scenarios pass (every in-browser tool, server tools through the UI, home → tool hand-off, error handling), every server operation via the API, and the full auth flow (signup, login, logout, reset, profile, password change, delete, rate limiting, CSRF blocking).

## Known limits

- PDF → Word/Excel quality depends on the source; scanned PDFs need OCR first.
- PDF → PowerPoint places each page as a high-resolution image (text in speaker notes), not editable slide objects.
- Edit PDF adds new content (text, images, shapes, whiteout); it does not reflow existing text.
- Compare PDF compares text, not visual layout.
- The Docker image was written to match the tested toolchain but has not been built in this environment.
