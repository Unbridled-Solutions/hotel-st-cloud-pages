#!/usr/bin/env python3
"""Pull Google Ads data for Hotel St. Cloud dashboard."""

import json
from datetime import datetime, timedelta
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

YAML_PATH = "/home/hermes/projects/google_ads_mcp/google-ads.yaml"
CUSTOMER_ID = "4032153396"

# Active campaigns only — Bars & Bathrooms (23825710773) RETIRED June 9, 2026
ACTIVE_CAMPAIGNS = {
    "22674299702": "Local Proximity & Through Traffic",
    "23826797937": "Royal Gorge Basecamp",
    "23843147683": "Standard Oil Coffee Co",
    "23833372473": "FP Sports Bar | Fremont Provisions",
}

def get_date_range():
    today = datetime.today()
    end = today - timedelta(days=1)
    start = end - timedelta(days=6)
    return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")

def run():
    client = GoogleAdsClient.load_from_storage(YAML_PATH)
    service = client.get_service("GoogleAdsService")
    start_date, end_date = get_date_range()
    
    results = {
        "generated_at": datetime.now().isoformat(),
        "date_range": {"start": start_date, "end": end_date},
        "campaigns": {},
        "daily": {},
        "search_terms": []
    }

    # ── 1. Campaign 7-day totals ──
    totals_query = f"""
        SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.average_cpc,
            metrics.cost_micros,
            metrics.conversions
        FROM campaign
        WHERE segments.date BETWEEN '{start_date}' AND '{end_date}'
          AND campaign.id IN ({', '.join(ACTIVE_CAMPAIGNS.keys())})
        ORDER BY metrics.cost_micros DESC
    """
    
    try:
        response = service.search(customer_id=CUSTOMER_ID, query=totals_query)
        for row in response:
            cid = str(row.campaign.id)
            if cid not in ACTIVE_CAMPAIGNS:
                continue
            results["campaigns"][cid] = {
                "id": cid,
                "name": ACTIVE_CAMPAIGNS.get(cid, row.campaign.name),
                "status": str(row.campaign.status),
                "impressions": row.metrics.impressions,
                "clicks": row.metrics.clicks,
                "ctr": round(row.metrics.ctr * 100, 2),
                "avg_cpc": round(row.metrics.average_cpc / 1_000_000, 2),
                "spend": round(row.metrics.cost_micros / 1_000_000, 2),
                "conversions": round(row.metrics.conversions, 1),
            }
    except GoogleAdsException as e:
        print(f"ERROR - Campaign totals: {e}")
    
    # Ensure all active campaigns appear even if zero data
    for cid, name in ACTIVE_CAMPAIGNS.items():
        if cid not in results["campaigns"]:
            results["campaigns"][cid] = {
                "id": cid,
                "name": name,
                "status": "ENABLED",
                "impressions": 0,
                "clicks": 0,
                "ctr": 0.0,
                "avg_cpc": 0.0,
                "spend": 0.0,
                "conversions": 0.0,
            }

    # ── 2. Daily breakdown per campaign ──
    daily_query = f"""
        SELECT
            campaign.id,
            segments.date,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions
        FROM campaign
        WHERE segments.date BETWEEN '{start_date}' AND '{end_date}'
          AND campaign.id IN ({', '.join(ACTIVE_CAMPAIGNS.keys())})
        ORDER BY segments.date ASC, campaign.id ASC
    """
    
    try:
        response = service.search(customer_id=CUSTOMER_ID, query=daily_query)
        for row in response:
            cid = str(row.campaign.id)
            if cid not in ACTIVE_CAMPAIGNS:
                continue
            date = row.segments.date
            if date not in results["daily"]:
                results["daily"][date] = {}
            results["daily"][date][cid] = {
                "impressions": row.metrics.impressions,
                "clicks": row.metrics.clicks,
                "spend": round(row.metrics.cost_micros / 1_000_000, 2),
                "conversions": round(row.metrics.conversions, 1),
            }
    except GoogleAdsException as e:
        print(f"ERROR - Daily breakdown: {e}")

    # ── 3. Top 10 search terms ──
    terms_query = f"""
        SELECT
            search_term_view.search_term,
            campaign.id,
            campaign.name,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.cost_micros,
            metrics.conversions
        FROM search_term_view
        WHERE segments.date BETWEEN '{start_date}' AND '{end_date}'
          AND campaign.id IN ({', '.join(ACTIVE_CAMPAIGNS.keys())})
        ORDER BY metrics.impressions DESC
        LIMIT 10
    """
    
    try:
        response = service.search(customer_id=CUSTOMER_ID, query=terms_query)
        for row in response:
            cid = str(row.campaign.id)
            if cid not in ACTIVE_CAMPAIGNS:
                continue
            results["search_terms"].append({
                "term": row.search_term_view.search_term,
                "campaign_id": cid,
                "campaign": ACTIVE_CAMPAIGNS.get(cid, row.campaign.name),
                "impressions": row.metrics.impressions,
                "clicks": row.metrics.clicks,
                "ctr": round(row.metrics.ctr * 100, 2),
                "spend": round(row.metrics.cost_micros / 1_000_000, 2),
                "conversions": round(row.metrics.conversions, 1),
            })
    except GoogleAdsException as e:
        print(f"ERROR - Search terms: {e}")

    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    run()
