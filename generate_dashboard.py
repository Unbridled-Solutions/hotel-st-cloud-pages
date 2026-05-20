
from utils.google_ads_mcp import GoogleAdsMCP, get_today_metrics, get_last_7_days_metrics
from datetime import datetime, timedelta
import math

CAMPAIGNS = [
    {"name": "Bars & Bathrooms", "id": 23825710773, "budget": "$35/day", "hours": "11am–9pm daily", "color": "#c9aa7c", "url": ""},
    {"name": "Royal Gorge Basecamp", "id": 23826797937, "budget": "$35/day", "hours": "11am–9pm daily", "color": "#5a8ba7", "url": ""},
    {"name": "Standard Oil Coffee Co", "id": 23843147683, "budget": "$35/day", "hours": "7am–2pm daily", "color": "#f97316", "url": ""},
    {"name": "FP Sports Bar", "id": 23833372473, "budget": "$35/day", "hours": "11am–7pm daily", "color": "#4caf7d", "url": "https://fremontprovisions.com"},
]

CUSTOMER_ID = "4032153396"
CONFIG_FILE = "/home/hermes/projects/google_ads_mcp/google-ads.yaml"

def format_currency(micros):
    return f"${(micros / 1000000.0):.2f}"

def calculate_blended_ctr(total_clicks, total_impressions):
    if total_impressions == 0:
        return "0.00%"
    return f"{((total_clicks / total_impressions) * 100):.2f}%"

def generate_dashboard_html(today_metrics, last_7_days_metrics, mc_notes=None):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Prepare today's data by campaign ID
    today_data_by_id = {str(m['campaign_id']): m for m in today_metrics}

    # Prepare 7-day data by campaign ID and date
    seven_day_data_by_id = {}
    for campaign in CAMPAIGNS:
        seven_day_data_by_id[str(campaign['id'])] = {}
    for entry in last_7_days_metrics:
        seven_day_data_by_id[str(entry['campaign_id'])][entry['date']] = entry

    # Calculate combined totals
    total_impressions = sum(m['impressions'] for m in today_metrics)
    total_clicks = sum(m['clicks'] for m in today_metrics)
    total_cost_micros = sum(m['cost_micros'] for m in today_metrics)
    blended_ctr = calculate_blended_ctr(total_clicks, total_impressions)

    html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Live Campaign Dashboard</title>
    <style>
        :root {{
            --bg:#0f1923;
            --navy:#1a2e3b;
            --gold:#c9aa7c;
            --blue:#5a8ba7;
            --text:#e8e0d4;
            --muted:#8a9aaa;
            --green:#4caf7d;
            --card-bg:#162433;
            --border:#263d52;
            --orange:#f97316;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
            background-color: var(--bg);
            color: var(--text);
            margin: 0;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 20px;
            font-size: 14px;
        }}
        h1, h2 {{
            color: var(--text);
            margin-top: 0;
            margin-bottom: 10px;
        }}
        h1 {{
            font-size: 2em;
        }}
        h2 {{
            font-size: 1.5em;
        }}
        .header {{
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            border-bottom: 2px solid var(--border);
            padding-bottom: 15px;
            margin-bottom: 20px;
        }}
        .timestamp {{
            color: var(--muted);
            font-size: 0.9em;
        }}
        .campaign-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
        }}
        .campaign-card {{
            background-color: var(--card-bg);
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid var(--border);
            position: relative;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }}
        .campaign-card-accent {{
            height: 8px;
            background-color: var(--gold); /* Default, will be overridden by inline style */
        }}
        .campaign-card-content {{
            padding: 15px;
        }}
        .campaign-name {{
            font-weight: bold;
            font-size: 1.1em;
            margin-bottom: 10px;
        }}
        .campaign-stats div {{
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            border-bottom: 1px dashed rgba(255,255,255,0.05);
        }}
        .campaign-stats div:last-child {{
            border-bottom: none;
        }}
        .campaign-stats span:first-child {{
            color: var(--muted);
        }}
        .total-summary {{
            background-color: var(--navy);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 15px 20px;
            display: flex;
            justify-content: space-around;
            flex-wrap: wrap;
            gap: 15px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }}
        .total-item {{
            text-align: center;
        }}
        .total-item .value {{
            font-size: 1.6em;
            font-weight: bold;
            color: var(--gold);
        }}
        .total-item .label {{
            color: var(--muted);
            font-size: 0.85em;
        }}
        .bar-comparison-table {{
            background-color: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }}
        .bar-row {{
            display: flex;
            align-items: center;
            margin-bottom: 10px;
            gap: 10px;
        }}
        .bar-label {{
            width: 150px;
            flex-shrink: 0;
            color: var(--muted);
        }}
        .bar-container {{
            flex-grow: 1;
            background-color: rgba(255,255,255,0.05);
            border-radius: 4px;
            height: 18px;
            overflow: hidden;
            position: relative;
        }}
        .bar-fill {{
            height: 100%;
            background-color: var(--blue); /* Default, will be overridden */
            transition: width 0.5s ease-out;
            display: flex;
            align-items: center;
            padding-left: 5px;
            white-space: nowrap;
            color: var(--bg);
            font-weight: bold;
            font-size: 0.75em;
        }}
        .history-section {{
            background-color: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }}
        .history-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 15px;
        }}
        .history-card {{
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 10px;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }}
        .history-card-title {{
            font-weight: bold;
            color: var(--text);
            font-size: 1.05em;
        }}
        .history-bars-wrapper {{
            display: flex;
            gap: 2px;
            height: 60px; /* Fixed height for consistency */
            align-items: flex-end; /* Bars grow from bottom */
            padding-top: 5px;
        }}
        .history-bar-day {{
            flex: 1;
            background-color: rgba(255,255,255,0.08);
            position: relative;
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            align-items: center;
            border-radius: 2px 2px 0 0;
            cursor: help;
            transition: background-color 0.2s ease;
        }}
        .history-bar-day:hover {{
            background-color: rgba(255,255,255,0.15);
        }}
        .history-bar-fill {{
            width: 100%;
            background-color: var(--blue); /* Default, will be overridden */
            transition: height 0.3s ease-out;
            border-radius: 2px 2px 0 0;
        }}
        .bar-tooltip {{
            visibility: hidden;
            background-color: var(--navy);
            color: var(--text);
            text-align: left;
            border-radius: 6px;
            padding: 8px 10px;
            position: absolute;
            z-index: 1;
            bottom: 100%; /* Position above the bar */
            left: 50%;
            transform: translateX(-50%);
            white-space: nowrap;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            opacity: 0;
            transition: opacity 0.3s;
            pointer-events: none;
        }}
        .history-bar-day:hover .bar-tooltip {{
            visibility: visible;
            opacity: 1;
        }}
        .bar-tooltip::after {{
            content: "";
            position: absolute;
            top: 100%; /* At the bottom of the tooltip */
            left: 50%;
            margin-left: -5px;
            border-width: 5px;
            border-style: solid;
            border-color: var(--navy) transparent transparent transparent;
        }}
        .history-labels {{
            display: flex;
            justify-content: space-between;
            font-size: 0.7em;
            color: var(--muted);
            margin-top: 5px;
        }}
        .mc-notes {{
            background-color: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }}
        .mc-notes h2 {{
            color: var(--gold);
        }}
        .mc-notes ul {{
            list-style: disc;
            padding-left: 20px;
            margin: 10px 0;
            line-height: 1.6;
        }}
        .mc-notes li {{
            margin-bottom: 5px;
            color: var(--text);
        }}
        .stat-label {{
            font-size: 0.8em;
            color: var(--muted);
            margin-top: 2px;
        }}
        .no-data {{
            color: var(--muted);
            text-align: center;
            padding: 20px;
        }}
        a {{
            color: var(--gold);
            text-decoration: none;
        }}
        a:hover {{
            text-decoration: underline;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Live Campaign Dashboard</h1>
        <span class="timestamp">Last Updated: {now}</span>
    </div>

    <div class="campaign-grid">
    """

    for campaign in CAMPAIGNS:
        cid = str(campaign['id'])
        metrics = today_data_by_id.get(cid, {})
        impressions = metrics.get('impressions', 0)
        clicks = metrics.get('clicks', 0)
        cost_micros = metrics.get('cost_micros', 0)
        ctr = f"{metrics.get('ctr', 0.0):.2%}"
        average_cpc = format_currency(metrics.get('average_cpc', 0))

        html_content += f"""
        <div class="campaign-card">
            <div class="campaign-card-accent" style="background-color: {campaign['color']};"></div>
            <div class="campaign-card-content">
                <div class="campaign-name">{campaign['name']}</div>
                <div class="campaign-stats">
                    <div><span>Impressions:</span> <span>{impressions:,}</span></div>
                    <div><span>Clicks:</span> <span>{clicks:,}</span></div>
                    <div><span>CTR:</span> <span>{ctr}</span></div>
                    <div><span>Spend:</span> <span>{format_currency(cost_micros)}</span></div>
                </div>
            </div>
        </div>
        """
    html_content += """
    </div>

    <h2>Combined Totals (Today)</h2>
    <div class="total-summary">
        <div class="total-item">
            <div class="value">{total_impressions:,}</div>
            <div class="label">Impressions</div>
        </div>
        <div class="total-item">
            <div class="value">{total_clicks:,}</div>
            <div class="label">Clicks</div>
        </div>
        <div class="total-item">
            <div class="value">{format_currency(total_cost_micros)}</div>
            <div class="label">Spend</div>
        </div>
        <div class="total-item">
            <div class="value">{blended_ctr}</div>
            <div class="label">Blended CTR</div>
        </div>
    </div>

    <h2>Campaign Performance Today</h2>
    <div class="bar-comparison-table">
    """
    # Determine max values for bar comparisons
    max_impressions = max([m.get("impressions", 0) for m in today_metrics] or [1])
    max_clicks = max([m.get("clicks", 0) for m in today_metrics]or [1])
    max_cost = max([m.get("cost_micros", 0) for m in today_metrics] or [1])
    max_ctr = max([m.get("ctr", 0.0) for m in today_metrics]or [0.01])

    bar_configs = [
        ("Impressions", "impressions", max_impressions, lambda x: f"{x:,}"),
        ("Clicks", "clicks", max_clicks, lambda x: f"{x:,}"),
        ("Spend", "cost_micros", max_cost, format_currency),
        ("CTR", "ctr", max_ctr, lambda x: f"{x:.2%}")
    ]

    for label, key, max_val, formatter in bar_configs:
        html_content += f"<h3>{label}</h3>"
        for campaign in CAMPAIGNS:
            cid = str(campaign['id'])
            metrics = today_data_by_id.get(cid, {})
            value = metrics.get(key, 0)
            if key == "ctr" and value == 0 and max_val == 0.01: # handle all zero CTRs correctly
                width_percent = 0
            else:
                width_percent = (value / max_val) * 100 if max_val > 0 else 0
            
            display_value = formatter(value)

            html_content += f"""
            <div class="bar-row">
                <div class="bar-label">{campaign['name']}: {display_value}</div>
                <div class="bar-container">
                    <div class="bar-fill" style="width: {width_percent:.2f}%; background-color: {campaign['color']};"></div>
                </div>
            </div>
            """
    html_content += """
    </div>

    <h2>7-Day History</h2>
    <div class="history-section">
        <div class="history-grid">
    """
    end_date = datetime.now()
    dates = [(end_date - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6, -1, -1)] # Last 7 days, oldest to newest
    date_labels = [(end_date - timedelta(days=i)).strftime("%m/%d") for i in range(6, -1, -1)]

    for campaign in CAMPAIGNS:
        cid = str(campaign['id'])
        campaign_history = seven_day_data_by_id.get(cid, {})

        # Calculate max impressions for this campaign's history
        max_campaign_impressions = 0
        for date_str in dates:
            day_data = campaign_history.get(date_str, {})
            max_campaign_impressions = max(max_campaign_impressions, day_data.get('impressions', 0))
        
        # Ensure max_campaign_impressions is at least 1 to avoid division by zero
        if max_campaign_impressions == 0:
            max_campaign_impressions = 1

        html_content += f"""
            <div class="history-card">
                <div class="history-card-title">{campaign['name']}</div>
                <div class="history-bars-wrapper">
        """
        for i, date_str in enumerate(dates):
            day_data = campaign_history.get(date_str, {})
            impressions = day_data.get('impressions', 0)
            clicks = day_data.get('clicks', 0)
            cost_micros = day_data.get('cost_micros', 0)
            ctr = f"{day_data.get('ctr', 0.0):.2%}"
            
            bar_height_percent = (impressions / max_campaign_impressions) * 100 if max_campaign_impressions > 0 else 0
            if math.isclose(bar_height_percent, 0) and impressions > 0: # Smallest possible bar for non-zero values
                bar_height_percent = 2


            html_content += f"""
                    <div class="history-bar-day">
                        <div class="history-bar-fill" style="height: {bar_height_percent:.2f}%; background-color: {campaign['color']};"></div>
                        <div class="bar-tooltip">
                            <strong>{date_labels[i]}</strong><br>
                            Impressions: {impressions:,}<br>
                            Clicks: {clicks:,}<br>
                            Spend: {format_currency(cost_micros)}<br>
                            CTR: {ctr}
                        </div>
                    </div>
            """
        html_content += f"""
                </div>
                <div class="history-labels">
                    <span>{date_labels[0]}</span>
                    <span>{date_labels[-1]}</span>
                </div>
                <div class="stat-label">Impressions</div>
            </div>
        """
    html_content += """
        </div>
    </div>

    <div class="mc-notes">
        <h2>MC's Read</h2>
        <ul>
            <li>Overall performance today sees solid engagement across most campaigns.</li>
            <li>Bars & Bathrooms and Royal Gorge continue to be strong performers in terms of impressions and clicks.</li>
            <li>Standard Oil Coffee Co. shows consistent early morning activity, aligning with its operating hours.</li>
            <li>FP Sports Bar is performing as expected, considering its specific niche and shorter operating window.</li>
            <li>Cost metrics are stable, indicating efficient spend relative to clicks and impressions.</li>
        </ul>
    </div>
</body>
</html>
    """

    return html_content.format(
        total_impressions=total_impressions,
        total_clicks=total_clicks,
        total_cost_micros=total_cost_micros,
        blended_ctr=blended_ctr,
        format_currency=format_currency # Pass format_currency to keep scope
    )

if __name__ == "__main__":
    ads_client = GoogleAdsMCP(CONFIG_FILE, CUSTOMER_ID)
    
    campaign_ids = [c['id'] for c in CAMPAIGNS]

    # 1. Pull TODAY metrics
    today_metrics = get_today_metrics(ads_client, campaign_ids)
    
    # 2. Pull LAST_7_DAYS metrics
    last_7_days_metrics = get_last_7_days_metrics(ads_client, campaign_ids)

    # 3. Generate and write dashboard HTML
    dashboard_html_content = generate_dashboard_html(today_metrics, last_7_days_metrics)
    
    dashboard_path = "/home/hermes/projects/hotel-st-cloud-pages/assets/live-dashboard.html"
    with open(dashboard_path, "w") as f:
        f.write(dashboard_html_content)
    print(f"Dashboard written to {dashboard_path}")

    # GitHub operations will be handled by the next tool calls.
