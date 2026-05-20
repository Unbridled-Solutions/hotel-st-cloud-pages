
import os
import requests
import json
import datetime
from urllib.parse import quote

# Load environment variable
airtable_api_key = os.getenv('AIRTABLE_API_KEY')
if not airtable_api_key:
    # Fallback for when script isn't run directly in current shell but through subprocess where env might not be fully sourced.
    # Assumes .hermes/.env is readable relative to the home directory.
    home_dir = os.path.expanduser("~")
    env_path = os.path.join(home_dir, ".hermes", ".env")
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if line.strip() and not line.strip().startswith('#'):
                    key, value = line.strip().split('=', 1)
                    if key == "AIRTABLE_API_KEY":
                        airtable_api_key = value
                        break
    if not airtable_api_key:
        print("AIRTABLE_API_KEY not found.")
        exit(1)

base_id = "appUUjLXEUwlyx23M"
table_id = "tblZHw2NCn9gB4dqX"
formula = "{Status}='New — Needs Review'"
encoded_formula = quote(formula, safe="")

url = f"https://api.airtable.com/v0/{base_id}/{table_id}?filterByFormula={encoded_formula}"
headers = {
    "Authorization": f"Bearer {airtable_api_key}"
}

response = requests.get(url, headers=headers)
response.raise_for_status()  # Raise an exception for HTTP errors

data = response.json()

new_submissions = []
time_threshold = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=15)

for record in data.get('records', []):
    fields = record.get('fields', {})
    submitted_at_str = fields.get('Submitted At')
    
    if submitted_at_str:
        # Airtable often returns 'Submitted At' in ISO format, e.g., '2023-10-27T10:00:00.000Z'
        # Parse it as UTC
        submitted_at = datetime.datetime.fromisoformat(submitted_at_str.replace('Z', '+00:00'))
        
        if submitted_at >= time_threshold:
            new_submissions.append(fields)

if new_submissions:
    alert_messages = []
    for sub in new_submissions:
        name = sub.get('Name', 'N/A')
        business = sub.get('Business Name', 'N/A')
        vertical = sub.get('Vertical/Industry', 'N/A')
        server_tier = sub.get('Server Tier', 'N/A')
        telegram_username = sub.get('Telegram (username)', 'N/A')
        
        alert_messages.append(f"Name: {name}, Business: {business}, Vertical: {vertical}, Server Tier: {server_tier}, Telegram: {telegram_username}")
    
    final_alert = "New BeUnbridled Client Submissions:\n" + "\n".join(alert_messages) + "\n\nReady for your review. Reply 'go' and I'll draft their Business DNA."
    
    # Simulate sending message to Justin (Telegram ID: 8221308132)
    # In a real scenario, you'd use a tool like default_api.send_message() if available
    # For this task, we will print the message to stdout if new submissions are found.
    # If no new submissions, print nothing, as per instructions.
    print(final_alert)
else:
    print("[SILENT]")
