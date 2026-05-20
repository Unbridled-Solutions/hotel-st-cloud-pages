
import json
import datetime
import subprocess
import urllib.parse

def main():
    airtable_api_key = "REDACTED_SET_VIA_ENV"  # Load from ~/.hermes/.env — never hardcode

    base_id = "appUUjLXEUwlyx23M"
    table_id = "tblZHw2NCn9gB4dqX"
    formula = "{Status}='New — Needs Review'"
    encoded_formula = urllib.parse.quote(formula)
    
    url = f"https://api.airtable.com/v0/{base_id}/{table_id}?filterByFormula={encoded_formula}"
    
    try:
        command = [
            "curl", "-s", url,
            "-H", f"Authorization: Bearer {airtable_api_key}"
        ]
        
        result = subprocess.run(command, capture_output=True, text=True, check=True)
        response_data = json.loads(result.stdout)
    except subprocess.CalledProcessError as e:
        print(f"Error: Curl command failed: {e}")
        print(f"Stderr: {e.stderr}")
        return
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON from Airtable response: {e}")
        print(f"Raw response: {result.stdout}")
        return

    new_submissions_alerts = []
    current_utc = datetime.datetime.utcnow().replace(tzinfo=datetime.timezone.utc)
    
    for record in response_data.get("records", []):
        fields = record.get("fields", {})
        submitted_at_str = fields.get("Submitted At")

        if submitted_at_str:
            try:
                submitted_at = datetime.datetime.strptime(submitted_at_str, "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=datetime.timezone.utc)
                
                time_difference = current_utc - submitted_at
                
                # Check if submitted within the last 15 minutes and is not a future submission
                if datetime.timedelta(minutes=0) <= time_difference < datetime.timedelta(minutes=15):
                    name = fields.get("Full Name", "N/A")
                    business = fields.get("Business Name", "N/A")
                    server_tier = fields.get("Server Tier", "N/A")
                    telegram_username = fields.get("Telegram Username", "N/A")

                    alert = (
                        f"""New client submission requires review!
Name: {name}
Business: {business}
Server Tier: {server_tier}
Telegram: {telegram_username}

Ready for your review. Reply 'go' and I'll draft their Business DNA."""
                    )
                    new_submissions_alerts.append(alert)
            except ValueError:
                # Handle cases where 'Submitted At' format might vary or be invalid
                # In a cron job, suppress verbose warnings unless critical.
                pass 

    if new_submissions_alerts:
        print("""\n\n---\n\n""".join(new_submissions_alerts))
    else:
        print("[SILENT]")

if __name__ == "__main__":
    main()
