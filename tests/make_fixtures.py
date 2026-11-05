"""Creates test documents in tests/fx for tests/e2e.py. Requires the worker requirements + LibreOffice."""
import shutil, subprocess
from pathlib import Path
import openpyxl, pymupdf
from pptx import Presentation

FX = Path(__file__).parent / "fx"
FX.mkdir(exist_ok=True)
doc = pymupdf.open()
pix = pymupdf.Pixmap(pymupdf.csRGB, 400, 250, bytes(b for y in range(250) for x in range(400) for b in ((x * 255) // 400, (y * 255) // 250, (x * y) % 256)), 0)
for i in range(3):
    p = doc.new_page()
    p.insert_text((72, 90), f"Quarterly Report - Page {i+1}", fontsize=20)
    p.insert_text((72, 130), "Contact: John Smith, john.smith@example.com, phone 555-0142.", fontsize=11)
    p.insert_text((72, 150), "The invoice total is $12,450.00 due on 15 March 2026.", fontsize=11)
    rows = [["Region", "Q1", "Q2", "Q3"], ["North", "120", "135", "150"], ["South", "98", "110", "121"]]
    for r, row in enumerate(rows):
        for c, val in enumerate(row):
            rect = pymupdf.Rect(72 + c * 110, 190 + r * 22, 72 + (c + 1) * 110, 190 + (r + 1) * 22)
            p.draw_rect(rect, color=(0, 0, 0), width=0.7)
            p.insert_textbox(rect + (4, 4, 0, 0), val, fontsize=10)
    p.insert_image(pymupdf.Rect(72, 300, 520, 580), pixmap=pix)
doc.set_metadata({"title": "Quarterly Report", "author": "Jane Doe"})
doc.save(FX / "report.pdf")
d2 = pymupdf.open(FX / "report.pdf"); d2[1].set_rotation(90); d2.save(FX / "rotated.pdf")
sd = pymupdf.open()
for pg in pymupdf.open(FX / "report.pdf"):
    np_ = sd.new_page(width=pg.rect.width, height=pg.rect.height)
    np_.insert_image(np_.rect, pixmap=pg.get_pixmap(dpi=200))
sd.save(FX / "scanned.pdf")
pymupdf.open(FX / "report.pdf")[0].get_pixmap(dpi=200).save(FX / "scan.png")
r = pymupdf.open(FX / "report.pdf")
for pg in r:
    for hit in pg.search_for("john.smith@example.com"):
        pg.add_redact_annot(hit)
    pg.apply_redactions()
r.save(FX / "api_redacted.pdf")
from pikepdf import Pdf, Encryption
Pdf.open(FX / "report.pdf").save(FX / "locked.pdf", encryption=Encryption(user="hunter22", owner="owner22", R=6))
(FX / "fake.pdf").write_text("<html>not a pdf</html>")
wb = openpyxl.Workbook(); wb.active.append(["Item", "Qty"]); wb.save(FX / "sheet.xlsx")
prs = Presentation(); s = prs.slides.add_slide(prs.slide_layouts[1]); s.shapes.title.text = "Hello"; prs.save(FX / "deck.pptx")
(FX / "doc.html").write_text("<h1>Contract</h1><p>Between Acme Ltd and Beta LLC.</p>")
(FX / "page.html").write_text("<h1>Invoice #42</h1><img src='file:///etc/hostname'><script>document.write('JS')</script>")
soffice = shutil.which("soffice") or shutil.which("libreoffice")
if soffice:
    subprocess.run([soffice, "--headless", "--convert-to", "docx:MS Word 2007 XML", "--outdir", str(FX), str(FX / "doc.html")], capture_output=True)
print("fixtures in", FX)
