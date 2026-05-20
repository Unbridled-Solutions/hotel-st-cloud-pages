from datetime import datetime, timezone, timedelta
import json
import os

TELEGRAM_JUSTIN_ID = "8221308132" # Assuming this is Justin's Telegram ID

def main():
    try:
        with open("airtable_response.json", "r") as f:
            records_data = json.load(f)
    except FileNotFoundError:
        print("[SILENT]")
        return
    except json.JSONDecodeError:
        print("[SILENT]") # Handle cases where the JSON might be malformed or empty
        return

    new_submissions_for_alert = []
    now_utc = datetime.now(timezone.utc)
    fifteen_minutes_ago = now_utc - timedelta(minutes=15)

    for record in records_data.get('records', []):
        fields = record.get('fields', {})
        submitted_at_str = fields.get('Submitted At')

        if submitted_at_str:
            # Ensure the datetime parsing handles the 'Z' for UTC
            # Handles 'Z' by replacing it with '+00:00' for fromisoformat
            submitted_at = datetime.fromisoformat(submitted_at_str.replace('Z', '+00:00'))
            
            if submitted_at > fifteen_minutes_ago:
                new_submissions_for_alert.append(fields)

    if new_submissions_for_alert:
        for submission in new_submissions_for_alert:
            name = submission.get('Full Name', 'N/A')
            business = submission.get('Business Name', 'N/A')
            vertical = 'N/A' # Vertical/Industry is not directly in the provided AirTable fields
            server_tier = submission.get('Server Tier', 'N/A')
            telegram_username = submission.get('Telegram Username', 'N/A')
            
            alert_message = f"New BeUnbridled Client Submission:\n"
            alert_message += f"Name: {name}\n"
            alert_message += f"Business: {business}\n"
            alert_message += f"Vertical/Industry: {vertical}\n"
            alert_message += f"Server Tier: {server_tier}\n"
            alert_message += f"Telegram Username: {telegram_username}\n"
            alert_message += f"Ready for your review. Reply 'go' and I'll draft their Business DNA."
            
            # This simulates sending a message to Justin
            print(alert_message)
    else:
        print('[SILENT]')

if __name__ == "__main__":
    main()
