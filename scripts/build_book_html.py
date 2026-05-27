#!/usr/bin/env python3
"""
Build a single-page HTML version of The Unbridled Way — full book, cover to cover.
All chapters merged, nav stripped, chapter dividers added, page numbers via scroll indicator.
"""

import re
from pathlib import Path

ASSETS = Path("/home/hermes/projects/hotel-st-cloud-pages/assets")
OUTPUT = ASSETS / "unbridled-way-full.html"

CHAPTERS = [
    ("Introduction", "The Journey Is the Point", "unbridled-way-intro.html"),
    ("Chapter 1", "Doing Good by Doing Well", "unbridled-way-ch1.html"),
    ("Part I Opener", "A Collaboration of Destiny", "unbridled-way-destiny.html"),
    ("Chapter 2", "Adjacent Opportunities", "unbridled-way-ch3.html"),
    ("Chapter 3", "Ecosystems Over Egosystems", "unbridled-way-ch2.html"),
    ("Part II Opener", "A Culture of Authenticity", "unbridled-way-authenticity-intro.html"),
    ("Chapter 5", "Our Mission: Unbridling Human Purpose and Potential", "unbridled-way-ch5-purpose.html"),
    ("Chapter 6", "Values in Action", "unbridled-way-ch6-values.html"),
    ("Chapter 7", "The Unbridled Journey", "unbridled-way-ch7-journey.html"),
    ("Chapter 8", "Deliver Exceptional. Build World Class.", "unbridled-way-ch8-client-experience.html"),
    ("Part III", "A Business of Generosity", "unbridled-way-part3-generosity.html"),
    ("Closing", "At Least We're in the Arena", "unbridled-way-closing.html"),
    ("Appendix", "The Ancient Roots", "unbridled-way-appendix-scripture.html"),
]

def extract_chapter_content(html: str) -> tuple[str, str]:
    """Extract CSS and body content from a chapter HTML file."""
    # Get all style blocks
    css_blocks = re.findall(r'<style>(.*?)</style>', html, re.DOTALL)
    css = "\n".join(css_blocks)

    # Get body content
    body_match = re.search(r'<body[^>]*>(.*?)</body>', html, re.DOTALL)
    body = body_match.group(1) if body_match else ""

    # Strip elements we don't want
    body = re.sub(r'<a\s+href="javascript:history\.back\(\)".*?</a>', '', body, flags=re.DOTALL)
    body = re.sub(r'<nav\s+class="topbar".*?</nav>', '', body, flags=re.DOTALL)
    body = re.sub(r'<div\s+class="topbar".*?</div>\s*\n', '', body, flags=re.DOTALL)
    body = re.sub(r'<div\s+class="chapter-nav".*?</div>', '', body, flags=re.DOTALL)
    body = re.sub(r'<footer>.*?</footer>', '', body, flags=re.DOTALL)

    return css, body.strip()

# Read all chapters
all_css_parts = []
chapter_sections = []

for i, (num, title, filename) in enumerate(CHAPTERS):
    path = ASSETS / filename
    if not path.exists():
        print(f"  ✗ MISSING: {filename}")
        continue
    html = path.read_text(encoding='utf-8')
    css, body = extract_chapter_content(html)
    all_css_parts.append(css)
    chapter_sections.append((i+1, num, title, body))
    print(f"  ✓ {num}: {title}")

# Deduplicate CSS rules (keep unique blocks)
seen_rules = set()
unique_css_lines = []
for css in all_css_parts:
    for line in css.split('\n'):
        stripped = line.strip()
        if stripped and stripped not in seen_rules:
            seen_rules.add(stripped)
            unique_css_lines.append(line)
merged_css = "\n".join(unique_css_lines)

# Build TOC entries
toc_items = []
for i, (num, title, filename) in enumerate(CHAPTERS):
    anchor = f"section-{i+1}"
    toc_items.append(f'<a href="#{anchor}" class="toc-link"><span class="toc-num">{num}</span><span class="toc-title">{title}</span><span class="toc-dots"></span></a>')
toc_html = "\n".join(toc_items)

# Build chapter sections
sections_html = []
for (idx, num, title, body) in chapter_sections:
    anchor = f"section-{idx}"
    section = f'''
<div class="chapter-divider" id="{anchor}">
  <div class="chapter-divider-inner">
    <div class="chapter-divider-num">{num}</div>
    <div class="chapter-divider-title">{title}</div>
    <div class="chapter-divider-rule"></div>
  </div>
</div>
<div class="chapter-content">
{body}
</div>'''
    sections_html.append(section)

all_sections = "\n".join(sections_html)

# Build final HTML
# Build sections JS list first (needed inside f-string)
sections_js_list = [f'"{num}: {title}"' for _, num, title, _ in chapter_sections]
sections_js_str = "[" + ", ".join(sections_js_list) + "]"

output_html = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Unbridled Way · Complete Manuscript · Stan Bullis</title>
  <link href="https://fonts.googleapis.com/css2?family=Josefin+Sans:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400&family=Lora:ital,wght@0,400;0,600;1,400;1,600&display=swap" rel="stylesheet">

<style>
/* ── RESET & BASE ── */
*{{box-sizing:border-box;margin:0;padding:0}}
html{{scroll-behavior:smooth}}
body{{background:#f7f5f0;color:#2e3338;font-family:'Lora',serif;font-size:18px;line-height:1.85}}

/* ── STICKY TOP BAR ── */
.site-bar{{position:sticky;top:0;z-index:200;background:#1f2b3f;padding:.65rem clamp(1rem,4vw,2.5rem);display:flex;align-items:center;justify-content:space-between;box-shadow:0 2px 12px rgba(0,0,0,.3)}}
.site-title{{font-family:'Josefin Sans',sans-serif;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#fff}}
.site-title span{{color:#5a8ba7}}
.site-page{{font-family:'Josefin Sans',sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#4a6a85}}

/* ── PROGRESS BAR ── */
.progress-bar{{position:fixed;top:0;left:0;height:3px;background:linear-gradient(90deg,#ba8032,#5a8ba7);z-index:300;transition:width .1s linear;width:0%}}

/* ── COVER PAGE ── */
.cover{{background:#1f2b3f;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:4rem 2rem;position:relative;overflow:hidden}}
.cover::before{{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%,rgba(186,128,50,.12) 0%,transparent 65%)}}
.cover::after{{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#ba8032,transparent)}}
.cover-eyebrow{{font-family:'Josefin Sans',sans-serif;font-size:10px;letter-spacing:5px;text-transform:uppercase;color:#5a8ba7;margin-bottom:1.5rem;position:relative}}
.cover-title{{font-family:'Josefin Sans',sans-serif;font-size:clamp(36px,7vw,80px);font-weight:700;color:#fff;line-height:1.05;letter-spacing:-2px;margin-bottom:.75rem;position:relative}}
.cover-subtitle{{font-family:'Lora',serif;font-size:clamp(16px,2.5vw,24px);color:#ba8032;font-style:italic;margin-bottom:2rem;position:relative}}
.cover-rule{{width:60px;height:2px;background:#ba8032;margin:0 auto 2rem;position:relative}}
.cover-author{{font-family:'Josefin Sans',sans-serif;font-size:13px;letter-spacing:4px;text-transform:uppercase;color:#8aaabb;margin-bottom:.5rem;position:relative}}
.cover-year{{font-family:'Josefin Sans',sans-serif;font-size:10px;letter-spacing:2px;color:#4a6a85;position:relative}}
.cover-scroll{{position:absolute;bottom:2rem;left:50%;transform:translateX(-50%);font-family:'Josefin Sans',sans-serif;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#4a6a85;display:flex;flex-direction:column;align-items:center;gap:.5rem}}
.cover-scroll::after{{content:'↓';font-size:16px;animation:bob 1.5s ease-in-out infinite}}
@keyframes bob{{0%,100%{{transform:translateY(0)}}50%{{transform:translateY(5px)}}}}

/* ── TABLE OF CONTENTS ── */
.toc-section{{max-width:680px;margin:0 auto;padding:clamp(4rem,8vw,7rem) clamp(1.5rem,5vw,2.5rem)}}
.toc-heading{{font-family:'Josefin Sans',sans-serif;font-size:10px;letter-spacing:5px;text-transform:uppercase;color:#5a8ba7;margin-bottom:2.5rem;padding-bottom:1rem;border-bottom:1px solid #ddd8cf}}
.toc-link{{display:flex;align-items:baseline;gap:.5rem;padding:.55rem 0;border-bottom:1px dotted #ddd8cf;text-decoration:none;color:#2e3338;font-family:'Josefin Sans',sans-serif}}
.toc-link:hover{{color:#5a8ba7}}
.toc-num{{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#ba8032;min-width:90px;flex-shrink:0}}
.toc-title{{font-size:13px;font-weight:600;flex:1}}
.toc-dots{{flex:1;border-bottom:1px dotted #ddd8cf;margin:0 .5rem .25rem}}

/* ── CHAPTER DIVIDER ── */
.chapter-divider{{background:#1f2b3f;padding:clamp(3rem,6vw,5rem) clamp(1.5rem,5vw,3rem);text-align:center;border-top:3px solid #ba8032;margin-top:4rem}}
.chapter-divider-num{{font-family:'Josefin Sans',sans-serif;font-size:10px;letter-spacing:5px;text-transform:uppercase;color:#5a8ba7;margin-bottom:1rem}}
.chapter-divider-title{{font-family:'Josefin Sans',sans-serif;font-size:clamp(20px,4vw,42px);font-weight:700;color:#fff;line-height:1.15;letter-spacing:-.5px;margin-bottom:1.25rem}}
.chapter-divider-rule{{width:50px;height:2px;background:#ba8032;margin:0 auto}}

/* ── CHAPTER CONTENT ── */
.chapter-content{{max-width:100%}}
.chapter-content .body-wrap{{max-width:740px;margin:0 auto;padding:clamp(3rem,6vw,5rem) clamp(1.5rem,5vw,2.5rem)}}

/* ── SUPPRESS DUPLICATE OPENERS ── */
.chapter-content .opener .opener-eyebrow{{display:none}}
.chapter-content .opener{{margin-bottom:0;border-radius:0}}

/* ── SUPPRESS NAV ELEMENTS ── */
.chapter-content .chapter-nav,
.chapter-content footer,
.chapter-content .topbar{{display:none!important}}

/* ── MERGED CHAPTER CSS ── */
{merged_css}

/* ── OVERRIDE: full-width layout ── */
.body-wrap{{max-width:740px;margin:0 auto}}

/* ── BACK TO TOP ── */
.back-top{{position:fixed;bottom:1.25rem;right:1.25rem;z-index:199;background:#1f2b3f;color:#ba8032;border:1px solid #ba8032;border-radius:50%;width:44px;height:44px;display:flex;align-items:center;justify-content:center;text-decoration:none;font-size:18px;box-shadow:0 2px 12px rgba(0,0,0,.35);opacity:0;transition:opacity .3s;font-family:sans-serif}}
.back-top.visible{{opacity:.9}}
.back-top:hover{{opacity:1}}
</style>
</head>
<body>

<!-- PROGRESS BAR -->
<div class="progress-bar" id="progress"></div>

<!-- STICKY BAR -->
<div class="site-bar">
  <span class="site-title">The Unbridled Way <span>·</span> Stan Bullis</span>
  <span class="site-page" id="current-section">Cover</span>
</div>

<!-- COVER PAGE -->
<div class="cover" id="cover">
  <div class="cover-eyebrow">Complete Manuscript · 2026</div>
  <h1 class="cover-title">The Unbridled Way</h1>
  <p class="cover-subtitle">Doing Good by Doing Well</p>
  <div class="cover-rule"></div>
  <div class="cover-author">Stan Bullis</div>
  <div class="cover-year">First Draft · For Editorial Review</div>
  <div class="cover-scroll">Begin Reading</div>
</div>

<!-- TABLE OF CONTENTS -->
<div style="background:#f7f5f0;border-top:3px solid #ba8032">
  <div class="toc-section">
    <div class="toc-heading">Table of Contents</div>
    {toc_html}
  </div>
</div>

<!-- ALL CHAPTERS -->
{all_sections}

<!-- BACK TO TOP -->
<a href="#cover" class="back-top" id="backTop" title="Back to top">↑</a>

<script>
// Progress bar + section tracker + back-to-top
const progress = document.getElementById('progress');
const currentSection = document.getElementById('current-section');
const backTop = document.getElementById('backTop');
const sections = document.querySelectorAll('.chapter-divider');
  const sectionNames = {sections_js_str};

function onScroll() {{
  // Progress bar
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const pct = docHeight > 0 ? (scrollTop / docHeight * 100).toFixed(1) : 0;
  progress.style.width = pct + '%';

  // Back to top
  backTop.classList.toggle('visible', scrollTop > 800);

  // Current section label
  let current = 'Cover';
  sections.forEach((s, i) => {{
    if (window.scrollY >= s.offsetTop - 120) {{
      current = sectionNames[i] || current;
    }}
  }});
  currentSection.textContent = current;
}}

window.addEventListener('scroll', onScroll, {{passive: true}});
</script>

</body>
</html>'''

# Build sections_js for the sticky bar labels
sections_js_list = [f'"{num}: {title}"' for _, num, title, _ in chapter_sections]
sections_js_str = "[" + ", ".join(sections_js_list) + "]"
output_html = output_html.replace('{sections_js_str}', sections_js_str)

OUTPUT.write_text(output_html, encoding='utf-8')
size = OUTPUT.stat().st_size
print(f"\nDone! {OUTPUT.name}")
print(f"Size: {size:,} bytes ({size/1024:.0f} KB)")
print(f"Chapters: {len(chapter_sections)}")
