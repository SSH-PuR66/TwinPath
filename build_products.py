#!/usr/bin/env python3
"""Build styled product PDFs + ZIP deliverables from products/ markdown."""
import zipfile
from pathlib import Path

import markdown
from weasyprint import HTML

ROOT = Path(__file__).parent
PRODUCTS = ROOT / "products"
OUT = ROOT / "product-exports"
OUT.mkdir(exist_ok=True)

VERSION = "Version 1.0 — July 2026"
STORE = "TwinPath Studio"
DISCLAIMER = (
    "Educational materials only. These documents are organizational tools and "
    "do not replace professional legal, financial, medical or cybersecurity "
    "advice. No income, employment, certification or security result is "
    "guaranteed."
)

CSS = """
@page {
  size: letter;
  margin: 2.2cm 2cm;
  @bottom-left { content: "%(store)s — %(title)s"; font-size: 8pt; color: #8a90a3; }
  @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 8pt; color: #8a90a3; }
}
@page cover { @bottom-left { content: none; } @bottom-right { content: none; } }
body { font-family: Helvetica, Arial, sans-serif; font-size: 10.5pt; color: #1c2333; line-height: 1.55; }
.cover { page: cover; page-break-after: always; text-align: center; padding-top: 7cm; }
.cover .store { font-size: 12pt; letter-spacing: 3px; text-transform: uppercase; color: #4a6cf7; font-weight: bold; }
.cover h1 { font-size: 26pt; margin: 0.6cm 0 0.3cm; color: #10131c; }
.cover .version { color: #5a6172; font-size: 10pt; margin-top: 0.4cm; }
.cover .rule { width: 3cm; height: 3px; background: #4a6cf7; margin: 0.8cm auto; }
.cover .disclaimer { font-size: 8.5pt; color: #7a8093; max-width: 12cm; margin: 3.5cm auto 0; line-height: 1.5; }
h1 { font-size: 17pt; color: #10131c; border-bottom: 2px solid #4a6cf7; padding-bottom: 6px; margin-top: 0; page-break-before: always; }
h1:first-of-type { page-break-before: avoid; }
h2 { font-size: 12.5pt; color: #232a3d; margin-top: 22px; }
h3 { font-size: 11pt; color: #38405a; }
table { border-collapse: collapse; width: 100%%; margin: 10px 0; font-size: 9.5pt; }
th, td { border: 1px solid #ccd2e0; padding: 6px 8px; text-align: left; min-height: 18px; }
th { background: #eef1fb; }
ul { padding-left: 1.2em; }
li { margin: 3px 0; }
blockquote { border-left: 3px solid #4a6cf7; margin: 10px 0; padding: 4px 12px; color: #38405a; background: #f4f6fd; }
li:has(input[type=checkbox]) { list-style: none; margin-left: -1.2em; }
input[type=checkbox] { width: 10px; height: 10px; border: 1.2px solid #38405a; }
"""


def md_to_html(path: Path) -> str:
    text = path.read_text()
    # GFM checkboxes → printable boxes
    text = text.replace("- [ ] ", "- ☐ ")
    return markdown.markdown(text, extensions=["tables"])


def build_pdf(title: str, md_files: list, out_pdf: Path):
    body = "".join(f"<section>{md_to_html(f)}</section>" for f in md_files)
    html = f"""
    <html><head><style>{CSS % {'store': STORE, 'title': title}}</style></head><body>
      <div class="cover">
        <div class="store">{STORE}</div>
        <h1>{title}</h1>
        <div class="rule"></div>
        <div class="version">{VERSION}</div>
        <div class="disclaimer">{DISCLAIMER}</div>
      </div>
      {body}
    </body></html>"""
    HTML(string=html).write_pdf(out_pdf)
    print("PDF:", out_pdf.name, out_pdf.stat().st_size, "bytes")


def build_zip(out_zip: Path, entries: list):
    with zipfile.ZipFile(out_zip, "w", zipfile.ZIP_DEFLATED) as z:
        for arcname, src in entries:
            z.write(src, arcname)
    print("ZIP:", out_zip.name, out_zip.stat().st_size, "bytes")


P = {
    "safety": {
        "title": "Personal Digital Safety Checklist",
        "dir": PRODUCTS / "personal-digital-safety",
        "files": ["checklist.md", "recovery-inventory.md", "completion-tracker.md"],
    },
    "lab": {
        "title": "Cybersecurity Lab and Portfolio Tracker",
        "dir": PRODUCTS / "cyber-lab-tracker",
        "files": ["lab-template.md", "evidence-index.md", "portfolio-checklist.md"],
    },
    "incident": {
        "title": "Security Incident Notebook",
        "dir": PRODUCTS / "incident-notebook",
        "files": ["initial-response.md", "incident-timeline.md", "action-plan.md"],
    },
}

zips = {}
for key, spec in P.items():
    slug = spec["dir"].name
    pdf = OUT / f"{slug}.pdf"
    build_pdf(spec["title"], [spec["dir"] / f for f in spec["files"]], pdf)
    zpath = OUT / f"{slug}.zip"
    entries = [(f"{slug}/{spec['title']}.pdf", pdf)]
    entries += [(f"{slug}/editable-templates/{f}", spec["dir"] / f) for f in spec["files"]]
    entries.append((f"{slug}/README.md", spec["dir"] / "README.md"))
    build_zip(zpath, entries)
    zips[key] = entries

bundle_entries = []
for key, entries in zips.items():
    for arc, src in entries:
        bundle_entries.append((f"digital-security-starter-bundle/{arc}", src))
build_zip(OUT / "digital-security-starter-bundle.zip", bundle_entries)
print("All done.")
