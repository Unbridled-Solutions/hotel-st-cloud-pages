
import datetime
import urllib.parse
import os
import json
import subprocess

# Calculate 15 minutes ago in UTC and format it for Airtable
fifteen_minutes_ago_utc = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=15)
fifteen_minutes_ago_str = fifteen_minutes_ago_utc.isoformat(timespec="milliseconds").replace("+00:00", "Z")

# Construct the Airtable filter formula
# The formula needs single quotes around string values
# f-string: {{}} for literal braces, then single quotes for string values inside Airtable formula
formula = f"AND({{Status}}='New — Needs Review', {{Submitted At}} >= '{fifteen_minutes_ago_str}')"
encoded_formula = urllib.parse.quote(formula, safe="")

# Retrieve Airtable API key
api_key = os.environ.get("AIRTABLE_API_KEY")
if not api_key:
    try:
        with open(os.path.expanduser("~/.hermes/.env"), "r") as f:
            for line in f:
                if line.startswith("AIRTABLE_API_KEY="):
                    api_key = line.strip().split("=", 1)[1]
                    break
    except FileNotFoundError:
        print("Error: ~/.hermes/.env not found and AIRTABLE_API_KEY not in environment.")
        exit(1)

if not api_key:
    print("Error: AIRTABLE_API_KEY not found.")
    exit(1)

# Construct and execute the curl command
curl_command_parts = [
    "curl",
    "-s",
    f"https://api.airtable.com/v0/appUUjLXEUwlyx23M/tblZHw2NCn9gB4dqX?filterByFormula={encoded_formula}",
    "-H",
    f"Authorization: Bearer {api_key}"
]

try:
    result = subprocess.run(curl_command_parts, capture_output=True, text=True, check=True)
    
    # Parse the JSON response
    response_data = json.loads(result.stdout)
    
    new_submissions = []
    if "records" in response_data:
        for record in response_data["records"]:
            fields = record.get("fields", {})
            name = fields.get("Name")
            business = fields.get("Business Name")
            vertical = fields.get("Vertical/Industry")
            server_tier = fields.get("Server Tier Chosen")
            telegram_username = fields.get("Telegram Username")
            submitted_at_str = fields.get("Submitted At") # Already filtered by Airtable API, but good for local check if needed

            if name and business and vertical and server_tier and telegram_username:
                # All required fields are present, add to list
                new_submissions.append({
                    "name": name,
                    "business": business,
                    "vertical": vertical,
                    "server_tier": server_tier,
                    "telegram_username": telegram_username
                })
    
    if new_submissions:
        alert_message = ""
        for sub in new_submissions:
            alert_message += (
                f"New Client Submission:\n"
                f"Name: {sub["name"]}\n"
                f"Business: {sub["business"]}\n"
                f"Vertical/Industry: {sub["vertical"]}\n"
                f"Server Tier: {sub["server_tier"]}\n"
                f"Telegram: @{sub["telegram_username"]}\n\n"
            )
        alert_message += "Ready for your review. Reply 'go' and I'll draft their Business DNA."
        
        print(alert_message)
    else:
        print("[SILENT]")

except subprocess.CalledProcessError as e:
    print(f"Error executing curl command: {e}")
    print(f"Stderr: {e.stderr}")
    exit(1)
except FileNotFoundError:
    print("Error: curl command not found. Is curl installed?")
    exit(1)
except json.JSONDecodeError:
    print(f"Error: Failed to decode JSON from curl response: {result.stdout}")
    exit(1)
except Exception as e:
    print(f"An unexpected error occurred: {e}")
    exit(1)
