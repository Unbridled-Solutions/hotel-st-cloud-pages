
import json
from datetime import datetime, timedelta

def process_records(json_data):
    records = json.loads(json_data).get("records", [])
    new_submissions = []

    # Assuming current time is UTC
    # The prompt states "Tuesday, May 19, 2026 05:45 PM"
    # let's use a dynamic current time for robustness.
    # We should subtract 15 minutes from the current UTC time.
    # Note: The problem might imply a fixed time, but for real cron jobs,
    # it needs to be dynamic. Let's use the actual current time.
    current_utc_time = datetime.utcnow().replace(tzinfo=None)
    fifteen_minutes_ago = current_utc_time - timedelta(minutes=15)

    for record in records:
        fields = record.get("fields", {})
        status = fields.get("Status")
        submitted_at_str = fields.get("Submitted At")

        if status == "New — Needs Review" and submitted_at_str:
            try:
                # Parse 'Submitted At' string to datetime object
                # Example: "2026-05-15T01:57:11.805Z"
                submitted_at = datetime.strptime(submitted_at_str, "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=None)

                if submitted_at > fifteen_minutes_ago:
                    # This is a new submission
                    name = fields.get("Full Name", "N/A")
                    business = fields.get("Business Name", "N/A")
                    # Vertical/Industry is not in the example, so check if it exists
                    vertical_industry = fields.get("Vertical/Industry", "N/A")
                    server_tier = fields.get("Server Tier", "N/A")
                    telegram_username = fields.get("Telegram Username", "N/A")

                    new_submissions.append({
                        "name": name,
                        "business": business,
                        "vertical_industry": vertical_industry,
                        "server_tier": server_tier,
                        "telegram_username": telegram_username
                    })
            except ValueError:
                # Handle cases where 'Submitted At' format might be different or invalid
                print(f"Warning: Could not parse date for record {record.get('id')}: {submitted_at_str}", file=sys.stderr)
                continue
    return new_submissions

if __name__ == "__main__":
    import sys
    with open("airtable_response.json", "r") as f:
        json_data_from_file = f.read()

    new_subs = process_records(json_data_from_file)

    if new_subs:
        print("NEW_SUBMISSIONS_FOUND")
        for sub in new_subs:
            print(f"Name: {sub['name']}")
            print(f"Business: {sub['business']}")
            print(f"Vertical/Industry: {sub['vertical_industry']}")
            print(f"Server Tier: {sub['server_tier']}")
            print(f"Telegram Username: {sub['telegram_username']}")
    else:
        print("NO_NEW_SUBMISSIONS")
