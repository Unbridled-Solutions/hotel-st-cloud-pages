#!/usr/bin/env python3
"""
Pull rolling 7-day Google Ads data for Hotel St. Cloud dashboard.
Active campaigns only (Bars & Bathrooms RETIRED as of June 9, 2026 — excluded).
"""

import sys
import json
from datetime import datetime, timedelta
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

YAML_PATH = "/home/hermes/projects/google_ads_mcp/google-ads.yaml"
CUSTOMER_ID = "4032153396"

ACTIVE_CAMPAIGNS = {
    "22674299702": "Local Proximity & Through Traffic",
    "23826797937": "Royal Gorge Basecamp",
    "23843147683": "Standard Oil Coffee Co",
    "23833372473": "FP Sports Bar | Fremont Provisions",
}
RETIRED_CAMPAIGN_ID = "23825710773"  # Bars & Bathrooms — DO NOT INCLUDE

def get_date_range():
    today = datetime.now()
    end_date = today - timedelta(days=1)   # yesterday
    start_date = end_date - timedelta(days=6)  # 7 days total
    return start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d")

def main():
    client = GoogleAdsClient.load_from_storage(YAML_PATH)
    service = client.get_service("GoogleAdsService")

    start_date, end_date = get_date_range()
    print(f"Date range: {start_date} to {end_date}", file=sys.stderr)

    results = {
        "date_range": {"start": start_date, "end": end_date},
        "campaigns": {},
        "daily": {},
        "search_terms": [],
        "portfolio": {
            "impressions": 0,
            "clicks": 0,
            "spend": 0.0,
            "conversions": 0.0,
        }
    }

    # ── 1. Campaign 7-day totals ──────────────────────────────────────────────
    query_totals = f"""
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
          AND campaign.id IN ({','.join(ACTIVE_CAMPAIGNS.keys())})
        ORDER BY metrics.cost_micros DESC
    """

    response = service.search(customer_id=CUSTOMER_ID, query=query_totals)
    for row in response:
        cid = str(row.campaign.id)
        if cid == RETIRED_CAMPAIGN_ID:
            continue
        name = ACTIVE_CAMPAIGNS.get(cid, row.campaign.name)
        impr = row.metrics.impressions
        clicks = row.metrics.clicks
        ctr = row.metrics.ctr * 100
        avg_cpc = row.metrics.average_cpc / 1_000_000 if row.metrics.average_cpc else 0
        spend = row.metrics.cost_micros / 1_000_000
        convs = row.metrics.conversions

        results["campaigns"][cid] = {
            "name": name,
            "impressions": impr,
            "clicks": clicks,
            "ctr": round(ctr, 2),
            "avg_cpc": round(avg_cpc, 2),
            "spend": round(spend, 2),
            "conversions": round(convs, 1),
        }

        results["portfolio"]["impressions"] += impr
        results["portfolio"]["clicks"] += clicks
        results["portfolio"]["spend"] += spend
        results["portfolio"]["conversions"] += convs

    results["portfolio"]["spend"] = round(results["portfolio"]["spend"], 2)
    results["portfolio"]["conversions"] = round(results["portfolio"]["conversions"], 1)

    # ── 2. Daily breakdown ────────────────────────────────────────────────────
    query_daily = f"""
        SELECT
          campaign.id,
          segments.date,
          metrics.clicks,
          metrics.cost_micros,
          metrics.impressions
        FROM campaign
        WHERE segments.date BETWEEN '{start_date}' AND '{end_date}'
          AND campaign.id IN ({','.join(ACTIVE_CAMPAIGNS.keys())})
        ORDER BY campaign.id, segments.date
    """

    response_daily = service.search(customer_id=CUSTOMER_ID, query=query_daily)
    for row in response_daily:
        cid = str(row.campaign.id)
        if cid == RETIRED_CAMPAIGN_ID:
            continue
        date = row.segments.date
        if cid not in results["daily"]:
            results["daily"][cid] = {}
        results["daily"][cid][date] = {
            "clicks": row.metrics.clicks,
            "spend": round(row.metrics.cost_micros / 1_000_000, 2),
            "impressions": row.metrics.impressions,
        }

    # ── 3. Top 10 search terms ────────────────────────────────────────────────
    query_terms = f"""
        SELECT
          search_term_view.search_term,
          metrics.impressions,
          metrics.clicks,
          metrics.ctr,
          metrics.cost_micros,
          campaign.id
        FROM search_term_view
        WHERE segments.date BETWEEN '{start_date}' AND '{end_date}'
          AND campaign.id IN ({','.join(ACTIVE_CAMPAIGNS.keys())})
        ORDER BY metrics.clicks DESC
        LIMIT 50
    """

    try:
        response_terms = service.search(customer_id=CUSTOMER_ID, query=query_terms)
        term_agg = {}
        for row in response_terms:
            cid = str(row.campaign.id)
            if cid == RETIRED_CAMPAIGN_ID:
                continue
            term = row.search_term_view.search_term
            if term not in term_agg:
                term_agg[term] = {"impressions": 0, "clicks": 0, "spend": 0.0}
            term_agg[term]["impressions"] += row.metrics.impressions
            term_agg[term]["clicks"] += row.metrics.clicks
            term_agg[term]["spend"] += row.metrics.cost_micros / 1_000_000

        # Sort by clicks, take top 10
        sorted_terms = sorted(term_agg.items(), key=lambda x: x[1]["clicks"], reverse=True)[:10]
        for term, m in sorted_terms:
            ctr = (m["clicks"] / m["impressions"] * 100) if m["impressions"] > 0 else 0
            results["search_terms"].append({
                "term": term,
                "impressions": m["impressions"],
                "clicks": m["clicks"],
                "ctr": round(ctr, 2),
                "spend": round(m["spend"], 2),
            })
    except GoogleAdsException as e:
        print(f"Search terms query failed: {e}", file=sys.stderr)

    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    main()
