#!/bin/bash
source ~/.hermes/.env
ENC=$(python3 -c 'import urllib.parse; print(urllib.parse.quote("{Status}=\"New — Needs Review\""))')
curl -s "https://api.airtable.com/v0/appUUjLXEUwlyx23M/tblZHw2NCn9gB4dqX?filterByFormula=${ENC}" \
  -H "Authorization: Bearer $AIRTABLE_API_KEY" > airtable_response.json
