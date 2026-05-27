#!/usr/bin/env python3
"""
Build a single merged PDF of The Unbridled Way with page numbers.
Reads local HTML files, merges them, and generates a print-ready PDF.
"""

import asyncio
from playwright.async_api import async_playwright
from pathlib import Path

ASSETS = Path("/home/hermes/projects/hotel-st-cloud-pages/assets")
OUTPUT = Path("/home/hermes/projects/hotel-st-cloud-pages/assets/unbridled-way-complete.pdf")

CHAPTERS = [
    ("Introduction", "unbridled-way-intro.html"),
    ("Chapter 1 · Doing Good by Doing Well", "unbridled-way-ch1.html"),
    ("Part I · A Collaboration of Destiny", "unbridled-way-destiny.html"),
    ("Chapter 2 · Adjacent Opportunities", "unbridled-way-ch3.html"),
    ("Chapter 3 · Ecosystems Over Egosystems", "unbridled-way-ch2.html"),
    ("Part II · A Culture of Authenticity (Section Opener)", "unbridled-way-authenticity-intro.html"),
    ("Chapter 5 · Our Mission", "unbridled-way-ch5-purpose.html"),
    ("Chapter 6 · Values in Action", "unbridled-way-ch6-values.html"),
    ("Chapter 7 · The Unbridled Journey", "unbridled-way-ch7-journey.html"),
    ("Chapter 8 · Deliver Exceptional. Build World Class.", "unbridled-way-ch8-client-experience.html"),
    ("Part III · A Business of Generosity", "unbridled-way-part3-generosity.html"),
    ("Closing · At Least We're in the Arena", "unbridled-way-closing.html"),
    ("Appendix · The Ancient Roots", "unbridled-way-appendix-scripture.html"),
]

def extract_body_content(html: str, chapter_title: str) -> str:
    """Extract the body-wrap content from each chapter HTML."""
    import re
    # Remove topbar, opener, nav, footer, back button
    html = re.sub(r'<a href="javascript:history\.back\(\)"[^>]*>.*?</a>', '', html, flags=re.DOTALL)
    html = re.sub(r'<nav class="topbar">.*?</nav>', '', html, flags=re.DOTALL)
    html = re.sub(r'<div class="chapter-nav">.*?</div>', '', html, flags=re.DOTALL)
    html = re.sub(r'<footer>.*?</footer>', '', html, flags=re.DOTALL)
    # Extract just body content
    body_match = re.search(r'<body[^>]*>(.*?)</body>', html, re.DOTALL)
    if body_match:
        return body_match.group(1).strip()
    return html

async def build_pdf():
    # Read all chapter HTML files
    chapters_content = []
    for title, filename in CHAPTERS:
        path = ASSETS / filename
        if path.exists():
            content = path.read_text(encoding='utf-8')
            chapters_content.append((title, filename, content))
            print(f"  ✓ {filename}")
        else:
            print(f"  ✗ MISSING: {filename}")

    # Extract CSS from first chapter for shared styles
    import re
    first_html = chapters_content[0][2]
    css_match = re.search(r'<style>(.*?)</style>', first_html, re.DOTALL)
    base_css = css_match.group(1) if css_match else ""

    # Collect all unique CSS from all chapters
    all_css = set()
    for _, _, html in chapters_content:
        matches = re.findall(r'<style>(.*?)</style>', html, re.DOTALL)
        for m in matches:
            all_css.add(m.strip())

    # Build merged HTML
    merged_sections = []
    for i, (title, filename, html) in enumerate(chapters_content):
        body = extract_body_content(html, title)
        # Add chapter divider page break
        divider = f'''
<div class="chapter-break" style="page-break-before: always;">
  <div class="chapter-break-inner">
    <div class="chapter-break-num" style="font-family:'Josefin Sans',sans-serif;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#5a8ba7;margin-bottom:1rem">{title}</div>
  </div>
</div>
'''
        if i > 0:
            merged_sections.append(divider)
        merged_sections.append(body)

    merged_body = "\n".join(merged_sections)

    # Get Google Fonts link from any chapter
    fonts_link = '<link href="https://fonts.googleapis.com/css2?family=Josefin+Sans:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400&family=Lora:ital,wght@0,400;0,600;1,400;1,600&display=swap" rel="stylesheet">'

    merged_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>The Unbridled Way · Stan Bullis · Complete Manuscript</title>
{fonts_link}
<style>
/* ── PRINT / PAGE SETUP ── */
@page {{
  size: letter;
  margin: 1in 1.1in 1in 1.1in;
  @bottom-center {{
    content: counter(page);
    font-family: 'Josefin Sans', sans-serif;
    font-size: 10px;
    letter-spacing: 2px;
    color: #7a8490;
  }}
  @top-center {{
    content: "The Unbridled Way · Stan Bullis";
    font-family: 'Josefin Sans', sans-serif;
    font-size: 9px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #b0b8c0;
  }}
}}

/* Title page has no header/footer */
@page :first {{
  @top-center {{ content: none; }}
  @bottom-center {{ content: none; }}
}}

body {{
  font-family: 'Lora', Georgia, serif;
  font-size: 11.5pt;
  line-height: 1.8;
  color: #2e3338;
  background: white;
  counter-reset: page 1;
}}

/* ── TITLE PAGE ── */
.title-page {{
  page-break-after: always;
  text-align: center;
  padding-top: 2.5in;
  min-height: 9in;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}}
.title-page-eyebrow {{
  font-family: 'Josefin Sans', sans-serif;
  font-size: 9pt;
  letter-spacing: 4px;
  text-transform: uppercase;
  color: #5a8ba7;
  margin-bottom: 1rem;
}}
.title-page-title {{
  font-family: 'Josefin Sans', sans-serif;
  font-size: 32pt;
  font-weight: 700;
  color: #1f2b3f;
  line-height: 1.1;
  margin-bottom: 0.5rem;
}}
.title-page-subtitle {{
  font-family: 'Lora', serif;
  font-size: 14pt;
  color: #4b4f54;
  font-style: italic;
  margin-bottom: 2rem;
}}
.title-page-author {{
  font-family: 'Josefin Sans', sans-serif;
  font-size: 11pt;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: #1f2b3f;
  margin-bottom: 0.5rem;
}}
.title-page-year {{
  font-family: 'Josefin Sans', sans-serif;
  font-size: 9pt;
  letter-spacing: 2px;
  color: #7a8490;
}}
.title-page-rule {{
  width: 60px;
  height: 2px;
  background: #ba8032;
  margin: 1.5rem auto;
}}

/* ── TOC ── */
.toc-page {{
  page-break-after: always;
  padding-top: 0.5in;
}}
.toc-title {{
  font-family: 'Josefin Sans', sans-serif;
  font-size: 10pt;
  letter-spacing: 4px;
  text-transform: uppercase;
  color: #5a8ba7;
  margin-bottom: 2rem;
  border-bottom: 1px solid #ddd8cf;
  padding-bottom: 0.5rem;
}}
.toc-entry {{
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-family: 'Josefin Sans', sans-serif;
  font-size: 10pt;
  padding: 0.35rem 0;
  border-bottom: 1px dotted #ddd8cf;
  color: #2e3338;
}}
.toc-entry-title {{ font-weight: 600; letter-spacing: 0.3px; }}
.toc-entry-page {{ color: #7a8490; font-size: 9pt; }}
.toc-part-header {{
  font-family: 'Josefin Sans', sans-serif;
  font-size: 9pt;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: #ba8032;
  margin-top: 1.5rem;
  margin-bottom: 0.25rem;
}}

/* ── CHAPTER BREAKS ── */
.chapter-break {{
  page-break-before: always;
}}

/* ── SUPPRESS WEB UI ELEMENTS ── */
.topbar, .chapter-nav, footer,
a[href="javascript:history.back()"],
.topbar-brand, .nav-link, .opener-eyebrow {{
  display: none !important;
}}

/* ── OPENER BECOMES CHAPTER HEADER ── */
.opener {{
  background: #1f2b3f !important;
  padding: 2.5rem 0 2rem !important;
  text-align: center;
  page-break-after: avoid;
  color: white;
  border-radius: 0 !important;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}}
.opener-title {{
  font-family: 'Josefin Sans', sans-serif !important;
  font-size: 22pt !important;
  font-weight: 700 !important;
  color: white !important;
  line-height: 1.15 !important;
  margin-bottom: 0.75rem !important;
}}
.opener-title em {{ color: #ba8032 !important; font-style: normal !important; }}
.opener-sub {{
  font-family: 'Lora', serif !important;
  font-size: 11pt !important;
  color: #8aaabb !important;
  font-style: italic !important;
  max-width: 100% !important;
}}

/* ── BODY TEXT ── */
.body-wrap {{
  max-width: 100% !important;
  padding: 0 !important;
  margin: 0 !important;
}}
p {{ margin-bottom: 0.85rem; orphans: 3; widows: 3; }}
p.lead {{ font-size: 12.5pt; color: #1f2b3f; }}
h2 {{
  font-family: 'Josefin Sans', sans-serif;
  font-size: 13pt;
  font-weight: 700;
  color: #1f2b3f;
  margin: 1.75rem 0 0.5rem;
  letter-spacing: -0.3px;
  page-break-after: avoid;
}}

/* ── PULL QUOTES ── */
.pull-quote {{
  border-left: 3px solid #ba8032;
  padding: 0.75rem 1rem;
  margin: 1.5rem 0;
  background: #f7f5f0;
  page-break-inside: avoid;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}}
.pull-quote p {{
  font-family: 'Lora', serif;
  font-size: 12pt;
  color: #1f2b3f;
  font-style: italic;
  margin: 0;
}}

/* ── CALLOUT BOXES ── */
.callout, .brene-card, .imposter-box, .recognition-box {{
  background: #1f2b3f !important;
  border-radius: 8px !important;
  padding: 1.25rem 1.5rem !important;
  margin: 1.5rem 0 !important;
  page-break-inside: avoid;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}}

/* ── GRIDS → STACK FOR PRINT ── */
.cornerstones, .pillars, .pillars-grid,
.programs, .promises, .arc,
.five-moments, .stages-grid, .mission-grid {{
  display: block !important;
}}
.cornerstone-card, .pillar-card, .program-card,
.promise-card, .arc-card, .moment-card, .stage-card {{
  display: block !important;
  margin-bottom: 0.75rem !important;
  page-break-inside: avoid;
}}

/* ── FUNNELS ── */
.funnel-cols {{
  display: grid !important;
  grid-template-columns: 1fr auto 1fr !important;
  font-size: 9pt !important;
}}

/* ── SECTION DIVIDERS ── */
.section-divider {{
  margin: 1.5rem 0 !important;
  page-break-after: avoid;
}}

/* ── DROP CAP ── */
.dropcap::first-letter {{
  font-size: 3.5em !important;
}}

/* ── REFLECTION BOXES ── */
.reflection {{
  background: #1f2b3f !important;
  border-radius: 8px !important;
  padding: 1.25rem 1.5rem !important;
  margin-top: 2rem !important;
  page-break-inside: avoid;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}}

/* ── CLOSING CARDS ── */
.closing, .final-card, .cindy-block, .arena-block {{
  page-break-inside: avoid;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}}

/* ── CHAIN / OUTPUT ── */
.chain {{ page-break-inside: avoid; }}
.chain-item {{ margin-bottom: 0.4rem !important; }}

/* ── SCRIPTURE ── */
.scripture {{
  background: #f0f4f7 !important;
  border-radius: 6px;
  padding: 0.75rem 1rem;
  margin: 1rem 0;
  page-break-inside: avoid;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}}

/* All color backgrounds need print permission */
* {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
</style>
</head>
<body>

<!-- TITLE PAGE -->
<div class="title-page">
  <div class="title-page-eyebrow">Stan Bullis</div>
  <div class="title-page-rule"></div>
  <div class="title-page-title">The Unbridled Way</div>
  <div class="title-page-subtitle">Doing Good by Doing Well</div>
  <div class="title-page-rule"></div>
  <div class="title-page-author">Stan Bullis</div>
  <div class="title-page-year">2026 · Complete Manuscript Draft</div>
</div>

<!-- TABLE OF CONTENTS -->
<div class="toc-page">
  <div class="toc-title">Table of Contents</div>

  <div class="toc-entry">
    <span class="toc-entry-title">Introduction · The Journey Is the Point</span>
  </div>

  <div class="toc-part-header">Part I · A Collaboration of Destiny</div>
  <div class="toc-entry"><span class="toc-entry-title">Chapter 1 · Doing Good by Doing Well</span></div>
  <div class="toc-entry"><span class="toc-entry-title">Section Opener · A Collaboration of Destiny</span></div>
  <div class="toc-entry"><span class="toc-entry-title">Chapter 2 · Adjacent Opportunities</span></div>
  <div class="toc-entry"><span class="toc-entry-title">Chapter 3 · Ecosystems Over Egosystems</span></div>

  <div class="toc-part-header">Part II · A Culture of Authenticity</div>
  <div class="toc-entry"><span class="toc-entry-title">Section Opener · A Culture of Authenticity</span></div>
  <div class="toc-entry"><span class="toc-entry-title">Chapter 5 · Our Mission: Unbridling Human Purpose and Potential</span></div>
  <div class="toc-entry"><span class="toc-entry-title">Chapter 6 · Values in Action</span></div>
  <div class="toc-entry"><span class="toc-entry-title">Chapter 7 · The Unbridled Journey</span></div>
  <div class="toc-entry"><span class="toc-entry-title">Chapter 8 · Deliver Exceptional. Build World Class.</span></div>

  <div class="toc-part-header">Part III · A Business of Generosity</div>
  <div class="toc-entry"><span class="toc-entry-title">Part III · A Business of Generosity</span></div>

  <div class="toc-part-header">Back Matter</div>
  <div class="toc-entry"><span class="toc-entry-title">Closing · At Least We're in the Arena</span></div>
  <div class="toc-entry"><span class="toc-entry-title">Appendix · The Ancient Roots</span></div>
</div>

<!-- CHAPTERS -->
{merged_body}

</body>
</html>"""

    # Write merged HTML
    merged_path = Path("/tmp/unbridled-way-merged.html")
    merged_path.write_text(merged_html, encoding='utf-8')
    print(f"Merged HTML written: {len(merged_html):,} chars")

    # Generate PDF with Playwright
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto(f"file://{merged_path}", wait_until="networkidle", timeout=60000)
        await page.wait_for_timeout(3000)  # Let fonts load

        await page.pdf(
            path=str(OUTPUT),
            format="Letter",
            print_background=True,
            margin={"top": "1in", "right": "1.1in", "bottom": "1in", "left": "1.1in"},
            display_header_footer=True,
            header_template='''<div style="font-family:'Arial',sans-serif;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:#b0b8c0;width:100%;text-align:center;padding-top:0.3in">The Unbridled Way · Stan Bullis</div>''',
            footer_template='''<div style="font-family:'Arial',sans-serif;font-size:9px;color:#7a8490;width:100%;text-align:center;padding-bottom:0.3in"><span class="pageNumber"></span></div>''',
        )
        await browser.close()

    size = OUTPUT.stat().st_size
    print(f"PDF generated: {OUTPUT}")
    print(f"Size: {size:,} bytes ({size/1024/1024:.1f} MB)")

asyncio.run(build_pdf())
