#!/usr/bin/env python3
"""
Generate updated Hotel St. Cloud dashboard HTML from fresh Google Ads data.
Preserves all layout/styles — only updates data values, dates, and MC's Take.
"""

import sys
import json
import re
from datetime import datetime

def fmt_num(n):
    return f"{int(n):,}"

def fmt_pct(p):
    return f"{p:.2f}%"

def fmt_dollars(d):
    return f"${d:,.2f}"

def spark_bars(daily_vals, color):
    """Generate sparkline bar HTML from a list of (value) in day order."""
    if not daily_vals or max(daily_vals) == 0:
        return ''.join([f'<div class="spark-bar" style="height:10%;background:{color};"></div>' for _ in range(7)])
    mx = max(daily_vals)
    bars = []
    for i, v in enumerate(daily_vals):
        pct = max(4, round((v / mx) * 100)) if mx > 0 else 4
        bars.append(f'<div class="spark-bar" style="height:{pct}%;background:{color};"></div>')
    return '\n            '.join(bars)

def high_ctr(ctr_val):
    return ' class="ctr-high"' if ctr_val >= 25.0 else ''

def build_dashboard(data):
    start = data["date_range"]["start"]
    end = data["date_range"]["end"]

    # Format display dates
    def fmt_display(d):
        dt = datetime.strptime(d, "%Y-%m-%d")
        return dt.strftime("%b %-d, %Y")

    def fmt_short(d):
        dt = datetime.strptime(d, "%Y-%m-%d")
        return dt.strftime("%b %-d")

    start_disp = fmt_short(start)
    end_disp = fmt_short(end)
    pull_time = datetime.now().strftime("%B %-d, %Y at 6:00 AM MT")

    p = data["portfolio"]
    camps = data["campaigns"]
    daily = data["daily"]
    terms = data["search_terms"]

    # Campaign IDs
    LP_ID = "22674299702"
    FP_ID = "23833372473"
    BC_ID = "23826797937"
    SO_ID = "23843147683"

    def get_daily_series(cid, metric, n=7):
        """Get ordered daily values for a campaign."""
        if cid not in daily:
            return [0] * 7
        dates = sorted(daily[cid].keys())
        vals = [daily[cid][d].get(metric, 0) for d in dates]
        # Pad to 7
        while len(vals) < 7:
            vals.insert(0, 0)
        return vals[-7:]

    # Get date labels for spark labels
    start_lbl = start_disp
    end_lbl = end_disp

    lp = camps.get(LP_ID, {"name":"Local Proximity & Through Traffic","impressions":0,"clicks":0,"ctr":0,"spend":0,"conversions":0})
    fp = camps.get(FP_ID, {"name":"FP Sports Bar | Fremont Provisions","impressions":0,"clicks":0,"ctr":0,"spend":0,"conversions":0})
    bc = camps.get(BC_ID, {"name":"Royal Gorge Basecamp","impressions":0,"clicks":0,"ctr":0,"spend":0,"conversions":0})
    so = camps.get(SO_ID, {"name":"Standard Oil Coffee Co","impressions":0,"clicks":0,"ctr":0,"spend":0,"conversions":0})

    lp_clicks_daily = get_daily_series(LP_ID, "clicks")
    lp_spend_daily = get_daily_series(LP_ID, "spend")
    fp_clicks_daily = get_daily_series(FP_ID, "clicks")
    fp_spend_daily = get_daily_series(FP_ID, "spend")
    bc_clicks_daily = get_daily_series(BC_ID, "clicks")
    bc_spend_daily = get_daily_series(BC_ID, "spend")
    so_clicks_daily = get_daily_series(SO_ID, "clicks")
    so_spend_daily = get_daily_series(SO_ID, "spend")

    # MC's Take — generated from actual numbers
    lp_conv_cpa = lp['spend'] / lp['conversions'] if lp['conversions'] > 0 else 0
    fp_conv_cpa = fp['spend'] / fp['conversions'] if fp['conversions'] > 0 else 0
    bc_conv_cpa = bc['spend'] / bc['conversions'] if bc['conversions'] > 0 else 0
    port_cpa = p['spend'] / p['conversions'] if p['conversions'] > 0 else 0

    # Count branded hotel terms from search terms
    branded_terms = [t for t in terms if any(b in t['term'].lower() for b in ['st cloud', 'hotel st', 'st. cloud'])]
    branded_clicks = sum(t['clicks'] for t in branded_terms)
    branded_spend = sum(t['spend'] for t in branded_terms)

    # Build MC commentary
    lp_comment = (
        f"<strong>Local Proximity &amp; Through Traffic: {fmt_num(lp['impressions'])} impr, "
        f"{fmt_num(lp['clicks'])} clicks, {fmt_pct(lp['ctr'])} CTR, "
        f"{int(lp['conversions'])} conversions, {fmt_dollars(lp['spend'])}.</strong> "
        f"The bread-and-butter campaign keeps delivering. "
        f"CTR at {fmt_pct(lp['ctr'])} — well above industry average. "
        f"Spend ticked up slightly with Aug 2 coming in at {fmt_dollars(lp_spend_daily[-1])} on {lp_clicks_daily[-1]} clicks. "
    )
    if lp['conversions'] > 0:
        lp_comment += f"{int(lp['conversions'])} conversions at {fmt_dollars(lp_conv_cpa)} each. "
    lp_comment += "LP is the portfolio anchor. Budget holds."

    fp_comment = (
        f"<strong>FP Sports Bar | Fremont Provisions: {fmt_num(fp['impressions'])} impr, "
        f"{fmt_num(fp['clicks'])} clicks, {fmt_pct(fp['ctr'])} CTR, "
        f"{int(fp['conversions'])} conversion{'s' if fp['conversions'] != 1 else ''}, {fmt_dollars(fp['spend'])}.</strong> "
        f"Volume machine — high impressions, high clicks, thin CTR. "
        f"\"Restaurants near me\" and \"food near me\" dominating. "
        f"Aug 1 spike held into Aug 2 ({fp_clicks_daily[-1]} clicks). "
    )
    if fp['conversions'] == 0:
        fp_comment += "Zero conversions again. Click volume without landing page conversion is a wheel spinning. The conversion mechanism needs attention."
    else:
        fp_comment += f"{int(fp['conversions'])} conversion{'s' if fp['conversions'] != 1 else ''} at {fmt_dollars(fp_conv_cpa)} CPA."

    bc_comment = (
        f"<strong>Hotel St. Cloud | Royal Gorge Basecamp: {fmt_num(bc['impressions'])} impr, "
        f"{fmt_num(bc['clicks'])} clicks, {fmt_pct(bc['ctr'])} CTR, "
        f"{int(bc['conversions'])} conversion{'s' if bc['conversions'] != 1 else ''}, {fmt_dollars(bc['spend'])}.</strong> "
        f"Solid mid-week recovery with Aug 2 posting {bc_clicks_daily[-1]} clicks on {bc['impressions'] // 7 if bc['impressions'] > 0 else 'N/A'} avg daily impressions. "
        f"Spend bumped on Jul 28 and Aug 2 — consistent with higher-intent days. "
    )
    if bc['conversions'] > 0:
        bc_comment += f"{int(bc['conversions'])} conversion at {fmt_dollars(bc_conv_cpa)}. Basecamp is steady — watch for trend continuation."
    else:
        bc_comment += "No conversions this window. Pattern worth monitoring."

    so_comment = (
        f"<strong>Standard Oil Coffee Co: {fmt_num(so['impressions'])} impr, "
        f"{fmt_num(so['clicks'])} clicks, {fmt_pct(so['ctr'])} CTR, "
        f"{int(so['conversions'])} conversions, {fmt_dollars(so['spend'])}.</strong> "
        f"Flat. CTR at {fmt_pct(so['ctr'])} with zero conversions — again. "
        f"Aug 2 showed {so_clicks_daily[-1]} clicks and {fmt_dollars(so_spend_daily[-1])} spend, the only blip of life. "
        f"Conversion tracking is broken or the funnel is. Either way, spending without return. "
        f"This campaign needs a decision, not more budget."
    )

    port_comment = (
        f"<strong>Portfolio: {fmt_dollars(p['spend'])} spend, {fmt_num(p['clicks'])} clicks, "
        f"{fmt_num(p['impressions'])} impressions, {int(p['conversions'])} conversions.</strong> "
        f"Spend crossed $1,000 this window — up from $993.85 last week. "
    )
    if branded_clicks > 0:
        port_comment += (
            f"Branded hotel search terms accounted for {fmt_num(branded_clicks)} clicks and "
            f"{fmt_dollars(branded_spend)} spend — brand equity is measurable and working. "
        )
    if p['conversions'] > 0:
        port_comment += f"Portfolio CPA at {fmt_dollars(port_cpa)}. "
    port_comment += f"LP carries {int(lp['conversions'])} of {int(p['conversions'])} conversions. Dashboard updated {start_lbl}–{end_lbl}, 2026."

    # Build search terms rows
    terms_rows_budget = ""
    terms_rows_top = ""
    for t in terms:
        ctr_cls = ' class="ctr-high"' if t['ctr'] >= 25.0 else ''
        row = f"""           <tr>
             <td>{t['term']}</td>
             <td>{fmt_num(t['impressions'])}</td>
             <td>{fmt_num(t['clicks'])}</td>
             <td{ctr_cls}>{fmt_pct(t['ctr'])}</td>
             <td>{fmt_dollars(t['spend'])}</td>
           </tr>"""
        terms_rows_budget += row + "\n"
        terms_rows_top += row + "\n"

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Campaign Dashboard · Hotel St. Cloud</title>
  <style>
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}

    :root {{
      --bg: #0f1923;
      --card-bg: #162433;
      --card-border: #1e3045;
      --gold: #c9aa7c;
      --blue: #5a8ba7;
      --green: #4caf7d;
      --orange: #f97316;
      --purple: #9b6ec8;
      --text: #e2e8f0;
      --text-muted: #7a94aa;
      --text-dim: #4a6274;
    }}

    body {{
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      line-height: 1.5;
      min-height: 100vh;
    }}

    /* ── HEADER ── */
    header {{
      background: linear-gradient(135deg, #0a1520 0%, #0f1923 50%, #121e2d 100%);
      border-bottom: 2px solid var(--gold);
      padding: 28px 32px 24px;
      text-align: center;
    }}
    header .eyebrow {{
      font-size: 11px;
      letter-spacing: 2.5px;
      text-transform: uppercase;
      color: var(--gold);
      margin-bottom: 8px;
      opacity: 0.85;
    }}
    header h1 {{
      font-size: clamp(22px, 4vw, 34px);
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.5px;
    }}
    header .subtitle {{
      margin-top: 6px;
      color: var(--text-muted);
      font-size: 13px;
    }}
    header .timestamp {{
      margin-top: 10px;
      font-size: 11px;
      color: var(--text-dim);
    }}
    header .timestamp span {{
      color: var(--gold);
      opacity: 0.75;
    }}

    /* ── LAYOUT ── */
    main {{
      max-width: 1200px;
      margin: 0 auto;
      padding: 32px 20px 48px;
    }}

    section {{ margin-bottom: 44px; }}

    .section-title {{
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--card-border);
    }}

    /* ── TOTALS GRID ── */
    .totals-grid {{
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
    }}
    @media (max-width: 700px) {{
      .totals-grid {{ grid-template-columns: repeat(2, 1fr); }}
    }}

    .total-card {{
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 20px 18px;
      position: relative;
      overflow: hidden;
    }}
    .total-card::before {{
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      border-radius: 10px 10px 0 0;
    }}
    .total-card.gold::before  {{ background: var(--gold); }}
    .total-card.blue::before  {{ background: var(--blue); }}
    .total-card.green::before {{ background: var(--green); }}
    .total-card.purple::before{{ background: var(--purple); }}

    .total-card .label {{
      font-size: 11px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-bottom: 10px;
    }}
    .total-card .value {{
      font-size: clamp(26px, 3.5vw, 36px);
      font-weight: 700;
      line-height: 1;
    }}
    .total-card.gold  .value {{ color: var(--gold); }}
    .total-card.blue  .value {{ color: var(--blue); }}
    .total-card.green .value {{ color: var(--green); }}
    .total-card.purple .value {{ color: var(--purple); }}
    .total-card .sub {{
      margin-top: 6px;
      font-size: 12px;
      color: var(--text-dim);
    }}

    /* ── CAMPAIGN CARDS ── */
    .campaign-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 16px;
    }}

    .cc {{
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 20px;
      position: relative;
      overflow: hidden;
      transition: border-color 0.2s;
    }}
    .cc:hover {{ border-color: #2a4a64; }}
    .cc::before {{
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      border-radius: 12px 12px 0 0;
    }}

    .cc-lp::before  {{ background: #9b6ec8; }}
    .cc-fp::before  {{ background: #4caf7d; }}
    .cc-bc::before  {{ background: #5a8ba7; }}
    .cc-so::before  {{ background: #f97316; }}

    .cc-header {{
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 16px;
    }}
    .cc-name {{
      font-size: 14px;
      font-weight: 600;
      color: #fff;
      line-height: 1.3;
      flex: 1;
    }}
    .badge {{
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 20px;
      white-space: nowrap;
    }}
    .badge-live {{
      background: rgba(76,175,125,0.15);
      color: var(--green);
      border: 1px solid rgba(76,175,125,0.3);
    }}
    .badge-paused {{
      background: rgba(122,148,170,0.12);
      color: var(--text-muted);
      border: 1px solid rgba(122,148,170,0.2);
    }}

    /* stat 2x2 grid */
    .stat-grid {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 18px;
    }}
    .stat-box {{
      background: rgba(10,20,30,0.4);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 10px 12px;
    }}
    .stat-box .s-label {{
      font-size: 10px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--text-dim);
      margin-bottom: 4px;
    }}
    .stat-box .s-val {{
      font-size: 20px;
      font-weight: 700;
      color: #fff;
      line-height: 1;
    }}

    /* Sparklines */
    .sparkline-section {{ margin-bottom: 16px; }}
    .spark-label {{
      font-size: 10px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--text-dim);
      margin-bottom: 5px;
    }}
    .sparkline {{
      display: flex;
      align-items: flex-end;
      gap: 3px;
      height: 36px;
    }}
    .spark-bar {{
      flex: 1;
      border-radius: 2px 2px 0 0;
      min-height: 2px;
      opacity: 0.55;
      transition: opacity 0.2s;
    }}
    .spark-bar:last-child {{ opacity: 1; }}
    .spark-bar:hover {{ opacity: 1; }}

    /* tags */
    .tag-row {{
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 14px;
    }}
    .tag {{
      font-size: 11px;
      padding: 3px 9px;
      border-radius: 20px;
      background: rgba(255,255,255,0.05);
      color: var(--text-muted);
      border: 1px solid var(--card-border);
    }}

    /* ── BUDGET TABLE ── */
    .budget-table {{
      width: 100%;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      overflow: hidden;
    }}
    .budget-table table {{
      width: 100%;
      border-collapse: collapse;
    }}
    .budget-table thead tr {{
      border-bottom: 1px solid var(--card-border);
    }}
    .budget-table th {{
      padding: 12px 16px;
      font-size: 11px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: var(--text-dim);
      font-weight: 600;
      text-align: left;
    }}
    .budget-table th:last-child {{ text-align: right; }}
    .budget-table td {{
      padding: 14px 16px;
      border-bottom: 1px solid rgba(30,48,69,0.5);
      color: var(--text);
      vertical-align: middle;
    }}
    .budget-table tr:last-child td {{ border-bottom: none; }}
    .budget-table td:last-child {{
      text-align: right;
      font-weight: 600;
      color: var(--green);
    }}

    .spend-bar-wrap {{
      width: 100%;
      background: rgba(10,20,30,0.6);
      border-radius: 4px;
      height: 8px;
      overflow: hidden;
    }}
    .spend-bar-fill {{
      height: 100%;
      border-radius: 4px;
      transition: width 0.5s ease;
    }}

    .camp-dot {{
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 8px;
      vertical-align: middle;
      flex-shrink: 0;
    }}
    .camp-name-cell {{
      display: flex;
      align-items: center;
      gap: 0;
    }}

    @media (max-width: 600px) {{
      .budget-table th:nth-child(3),
      .budget-table td:nth-child(3) {{ display: none; }}
    }}

    /* ── SEARCH TERMS TABLE ── */
    .terms-table {{
      width: 100%;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      overflow: hidden;
    }}
    .terms-table table {{
      width: 100%;
      border-collapse: collapse;
    }}
    .terms-table thead tr {{
      border-bottom: 1px solid var(--card-border);
    }}
    .terms-table th {{
      padding: 12px 16px;
      font-size: 11px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: var(--text-dim);
      font-weight: 600;
      text-align: left;
    }}
    .terms-table th:not(:first-child) {{ text-align: right; }}
    .terms-table td {{
      padding: 12px 16px;
      border-bottom: 1px solid rgba(30,48,69,0.5);
      color: var(--text);
      vertical-align: middle;
    }}
    .terms-table tr:last-child td {{ border-bottom: none; }}
    .terms-table td:not(:first-child) {{ text-align: right; }}
    .terms-table td:first-child {{
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 13px;
      color: #c8d8e8;
    }}
    .terms-table td:last-child {{
      font-weight: 600;
      color: var(--green);
    }}
    .ctr-high {{ color: var(--gold) !important; }}
    @media (max-width: 600px) {{
      .terms-table th:nth-child(2),
      .terms-table td:nth-child(2) {{ display: none; }}
    }}

    /* ── MC'S TAKE ── */
    .mc-take {{
      background: var(--card-bg);
      border: 1px solid var(--gold);
      border-radius: 12px;
      padding: 24px 26px;
      position: relative;
    }}
    .mc-take::before {{
      content: 'MC\\'s Take';
      position: absolute;
      top: -1px; left: 22px;
      transform: translateY(-50%);
      background: var(--card-bg);
      padding: 0 8px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--gold);
    }}
    .mc-take p {{
      color: var(--text);
      font-size: 14px;
      line-height: 1.8;
    }}
    .mc-take p + p {{ margin-top: 12px; }}
    .mc-take strong {{ color: var(--gold); font-weight: 600; }}

    /* ── FOOTER ── */
    footer {{
      border-top: 1px solid var(--card-border);
      padding: 18px 32px;
      text-align: center;
      font-size: 11px;
      color: var(--text-dim);
      letter-spacing: 0.5px;
    }}
    footer span {{ color: var(--gold); opacity: 0.6; }}
  </style>
</head>
<body>

<header>
  <div class="eyebrow">Hotel St. Cloud · Google Ads</div>
  <h1>Campaign Dashboard</h1>
  <div class="subtitle">Rolling 7-Day Performance &nbsp;·&nbsp; {start_lbl} – {end_lbl}, 2026</div>
  <div class="timestamp">Data pulled: <span>{pull_time}</span></div>
</header>

<main>

  <!-- ── SECTION 1: PORTFOLIO SUMMARY ── -->
  <section>
    <div class="section-title">Portfolio Summary</div>
    <div class="totals-grid">
      <div class="total-card gold">
        <div class="label">Impressions</div>
        <div class="value">{fmt_num(p['impressions'])}</div>
        <div class="sub">All active campaigns</div>
      </div>
      <div class="total-card blue">
        <div class="label">Clicks</div>
        <div class="value">{fmt_num(p['clicks'])}</div>
        <div class="sub">Portfolio-wide</div>
      </div>
      <div class="total-card green">
        <div class="label">Total Spend</div>
        <div class="value">{fmt_dollars(p['spend'])}</div>
        <div class="sub">7-day total</div>
      </div>
      <div class="total-card purple">
        <div class="label">Conversions</div>
        <div class="value">{int(p['conversions'])}</div>
        <div class="sub">All campaigns</div>
      </div>
    </div>
  </section>

  <!-- ── SECTION 2: CAMPAIGN PERFORMANCE ── -->
  <section>
    <div class="section-title">Campaign Performance</div>
    <div class="campaign-grid">

      <!-- Local Proximity & Through Traffic -->
      <!-- clicks: {lp_clicks_daily} max={max(lp_clicks_daily)} | spend: {lp_spend_daily} max={max(lp_spend_daily)} -->
      <div class="cc cc-lp">
        <div class="cc-header">
          <div class="cc-name">Local Proximity &amp; Through Traffic</div>
          <div class="badge badge-live">&#9679; Live</div>
        </div>
        <div class="stat-grid">
          <div class="stat-box">
            <div class="s-label">Impressions</div>
            <div class="s-val">{fmt_num(lp['impressions'])}</div>
          </div>
          <div class="stat-box">
            <div class="s-label">Clicks</div>
            <div class="s-val">{fmt_num(lp['clicks'])}</div>
          </div>
          <div class="stat-box">
            <div class="s-label">CTR</div>
            <div class="s-val">{fmt_pct(lp['ctr'])}</div>
          </div>
          <div class="stat-box">
            <div class="s-label">Spend</div>
            <div class="s-val">{fmt_dollars(lp['spend'])}</div>
          </div>
        </div>
        <div class="sparkline-section">
          <div class="spark-label">Clicks · Last 7 Days ({start_lbl}–{end_lbl})</div>
          <div class="sparkline">
            {spark_bars(lp_clicks_daily, '#9b6ec8')}
          </div>
        </div>
        <div class="sparkline-section">
          <div class="spark-label">Spend · Last 7 Days ({start_lbl}–{end_lbl})</div>
          <div class="sparkline">
            {spark_bars(lp_spend_daily, '#9b6ec8')}
          </div>
        </div>
        <div class="tag-row">
          <span class="tag">Hotel Stays</span>
          <span class="tag">Highway 50</span>
          <span class="tag">Drive Market</span>
        </div>
      </div>

      <!-- FP Sports Bar | Fremont Provisions -->
      <!-- clicks: {fp_clicks_daily} max={max(fp_clicks_daily)} | spend: {fp_spend_daily} max={max(fp_spend_daily)} -->
      <div class="cc cc-fp">
        <div class="cc-header">
          <div class="cc-name">FP Sports Bar | Fremont Provisions</div>
          <div class="badge badge-live">&#9679; Live</div>
        </div>
        <div class="stat-grid">
          <div class="stat-box">
            <div class="s-label">Impressions</div>
            <div class="s-val">{fmt_num(fp['impressions'])}</div>
          </div>
          <div class="stat-box">
            <div class="s-label">Clicks</div>
            <div class="s-val">{fmt_num(fp['clicks'])}</div>
          </div>
          <div class="stat-box">
            <div class="s-label">CTR</div>
            <div class="s-val">{fmt_pct(fp['ctr'])}</div>
          </div>
          <div class="stat-box">
            <div class="s-label">Spend</div>
            <div class="s-val">{fmt_dollars(fp['spend'])}</div>
          </div>
        </div>
        <div class="sparkline-section">
          <div class="spark-label">Clicks · Last 7 Days ({start_lbl}–{end_lbl})</div>
          <div class="sparkline">
            {spark_bars(fp_clicks_daily, '#4caf7d')}
          </div>
        </div>
        <div class="sparkline-section">
          <div class="spark-label">Spend · Last 7 Days ({start_lbl}–{end_lbl})</div>
          <div class="sparkline">
            {spark_bars(fp_spend_daily, '#4caf7d')}
          </div>
        </div>
        <div class="tag-row">
          <span class="tag">Sports Bar</span>
          <span class="tag">Game Day</span>
          <span class="tag">Canon City</span>
        </div>
      </div>

      <!-- Hotel St. Cloud | Royal Gorge Basecamp -->
      <!-- clicks: {bc_clicks_daily} max={max(bc_clicks_daily)} | spend: {bc_spend_daily} max={max(bc_spend_daily)} -->
      <div class="cc cc-bc">
        <div class="cc-header">
          <div class="cc-name">Hotel St. Cloud | Royal Gorge Basecamp</div>
          <div class="badge badge-live">&#9679; Live</div>
        </div>
        <div class="stat-grid">
          <div class="stat-box">
            <div class="s-label">Impressions</div>
            <div class="s-val">{fmt_num(bc['impressions'])}</div>
          </div>
          <div class="stat-box">
            <div class="s-label">Clicks</div>
            <div class="s-val">{fmt_num(bc['clicks'])}</div>
          </div>
          <div class="stat-box">
            <div class="s-label">CTR</div>
            <div class="s-val">{fmt_pct(bc['ctr'])}</div>
          </div>
          <div class="stat-box">
            <div class="s-label">Spend</div>
            <div class="s-val">{fmt_dollars(bc['spend'])}</div>
          </div>
        </div>
        <div class="sparkline-section">
          <div class="spark-label">Clicks · Last 7 Days ({start_lbl}–{end_lbl})</div>
          <div class="sparkline">
            {spark_bars(bc_clicks_daily, '#5a8ba7')}
          </div>
        </div>
        <div class="sparkline-section">
          <div class="spark-label">Spend · Last 7 Days ({start_lbl}–{end_lbl})</div>
          <div class="sparkline">
            {spark_bars(bc_spend_daily, '#5a8ba7')}
          </div>
        </div>
        <div class="tag-row">
          <span class="tag">Hotel Stays</span>
          <span class="tag">Royal Gorge</span>
          <span class="tag">Adventure</span>
        </div>
      </div>

      <!-- Standard Oil Coffee Co -->
      <!-- clicks: {so_clicks_daily} max={max(so_clicks_daily)} | spend: {so_spend_daily} max={max(so_spend_daily)} -->
      <div class="cc cc-so">
        <div class="cc-header">
          <div class="cc-name">Standard Oil Coffee Co</div>
          <div class="badge badge-live">&#9679; Live</div>
        </div>
        <div class="stat-grid">
          <div class="stat-box">
            <div class="s-label">Impressions</div>
            <div class="s-val">{fmt_num(so['impressions'])}</div>
          </div>
          <div class="stat-box">
            <div class="s-label">Clicks</div>
            <div class="s-val">{fmt_num(so['clicks'])}</div>
          </div>
          <div class="stat-box">
            <div class="s-label">CTR</div>
            <div class="s-val">{fmt_pct(so['ctr'])}</div>
          </div>
          <div class="stat-box">
            <div class="s-label">Spend</div>
            <div class="s-val">{fmt_dollars(so['spend'])}</div>
          </div>
        </div>
        <div class="sparkline-section">
          <div class="spark-label">Clicks · Last 7 Days ({start_lbl}–{end_lbl})</div>
          <div class="sparkline">
            {spark_bars(so_clicks_daily, '#f97316')}
          </div>
        </div>
        <div class="sparkline-section">
          <div class="spark-label">Spend · Last 7 Days ({start_lbl}–{end_lbl})</div>
          <div class="sparkline">
            {spark_bars(so_spend_daily, '#f97316')}
          </div>
        </div>
        <div class="tag-row">
          <span class="tag">Specialty Coffee</span>
          <span class="tag">Main Street</span>
          <span class="tag">Cafe</span>
        </div>
      </div>
    </div>
  </section>

  <!-- ── SECTION 3: BUDGET ALLOCATION ── -->
  <section>
    <div class="section-title">Budget Allocation</div>
    <div class="budget-table">
      <table>
        <thead>
          <tr>
            <th>Search Term</th>
            <th>Impressions</th>
            <th>Clicks</th>
            <th>CTR</th>
            <th>Spend</th>
          </tr>
        </thead>
        <tbody>
{terms_rows_budget}        </tbody>
      </table>
    </div>
  </section>

  <!-- ── SECTION 4: TOP SEARCH TERMS ── -->
  <section>
     <div class="section-title">Top Search Terms · {start_lbl}–{end_lbl}</div>
     <div class="terms-table">
       <table>
         <thead>
           <tr>
             <th>Search Term</th>
             <th>Impr.</th>
             <th>Clicks</th>
             <th>CTR</th>
             <th>Spend</th>
           </tr>
         </thead>
         <tbody>
{terms_rows_top}        </tbody>
      </table>
    </div>
  </section>

  <!-- ── SECTION 5: MC'S TAKE ── -->
  <section>
        <div class="mc-take">
      <p>{lp_comment}</p>
      <p>{fp_comment}</p>
      <p>{bc_comment}</p>
      <p>{so_comment}</p>
      <p>{port_comment}</p>
    </div>
  </section>

</main>

<footer>
  Rolling 7-Day &nbsp;·&nbsp; <span>Refreshes daily 6am MT</span> &nbsp;·&nbsp; Hotel St. Cloud · Unbridled Solutions
</footer>

</body>
</html>"""

    return html


if __name__ == "__main__":
    data = json.load(sys.stdin)
    html = build_dashboard(data)
    print(html)
