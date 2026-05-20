
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException
import yaml
from datetime import datetime, timedelta

class GoogleAdsMCP:
    def __init__(self, config_file: str, customer_id: str):
        self.client = GoogleAdsClient.load_from_storage(config_file)
        self.customer_id = customer_id

    def run_query(self, query: str) -> list[dict]:
        ga_service = self.client.get_service("GoogleAdsService")
        try:
            stream = ga_service.search_stream(customer_id=self.customer_id, query=query)
            results = []
            for batch in stream:
                for row in batch.results:
                    metrics = row.metrics
                    campaign = row.campaign
                    segments = row.segments
                    
                    data = {
                        "campaign_id": campaign.id,
                        "campaign_name": campaign.name,
                        "impressions": metrics.impressions,
                        "clicks": metrics.clicks,
                        "cost_micros": metrics.cost_micros,
                        "ctr": metrics.ctr,
                        "average_cpc": metrics.average_cpc,
                        "date": segments.date if hasattr(segments, 'date') else None
                    }
                    results.append(data)
            return results
        except GoogleAdsException as ex:
            print(f"Request with ID '{ex.request_id}' failed with status '{ex.error.code().name}' and includes the following errors:")
            for error in ex.errors:
                print(f"	Error with message '{error.message}'.")
                if error.location:
                    for field_path_element in error.location.field_path_elements:
                        print(f"		On field: '{field_path_element.field_name}'")
            return []

def get_today_metrics(client: GoogleAdsMCP, campaign_ids: list[int]) -> list[dict]:
    today = datetime.now().strftime("%Y-%m-%d")
    query = f"""
        SELECT
            campaign.id,
            campaign.name,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.ctr,
            metrics.average_cpc
        FROM
            campaign
        WHERE
            campaign.id IN ({",".join(map(str, campaign_ids))})
            AND segments.date = '{today}'
    """
    return client.run_query(query)

def get_last_7_days_metrics(client: GoogleAdsMCP, campaign_ids: list[int]) -> list[dict]:
    end_date = datetime.now()
    start_date = end_date - timedelta(days=6) # 7 days including today
    
    start_date_str = start_date.strftime("%Y-%m-%d")
    end_date_str = end_date.strftime("%Y-%m-%d")

    query = f"""
        SELECT
            campaign.id,
            campaign.name,
            segments.date,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.ctr,
            metrics.average_cpc
        FROM
            campaign
        WHERE
            campaign.id IN ({",".join(map(str, campaign_ids))})
            AND segments.date BETWEEN '{start_date_str}' AND '{end_date_str}'
        ORDER BY
            segments.date
    """
    return client.run_query(query)
