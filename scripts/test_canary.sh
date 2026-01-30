#!/bin/bash
# A7 Canary Test Script - v3.5.1 Protocol Verification
# Emits test events with deterministic UUIDs for verification

set -e

A8_URL="${A8_URL:-https://auto-com-center-jamarrlmayes.replit.app}"
APP_LABEL="auto_page_maker"
TIMESTAMP=$(date +%s)000

# Fixed UUIDs for verification (deterministic)
UUID1="canary-a7-pageview-$(date +%Y%m%d)-001"
UUID2="canary-a7-ctaclick-$(date +%Y%m%d)-002"
UUID3="canary-a7-traffic-$(date +%Y%m%d)-003"

echo "=== A7 Canary Test - v3.5.1 Protocol ==="
echo "Target: $A8_URL/api/events"
echo "App: $APP_LABEL"
echo ""

# Event 1: page_view
echo ">>> Event 1: page_view (ID: $UUID1)"
RESP1=$(curl -s -X POST "$A8_URL/api/events" \
  -H "Content-Type: application/json" \
  -H "x-scholar-protocol: v3.5.1" \
  -H "x-app-label: $APP_LABEL" \
  -H "x-event-id: $UUID1" \
  -d "{
    \"event_type\": \"page_view\",
    \"source_app_id\": \"$APP_LABEL\",
    \"app_base_url\": \"https://auto-page-maker-jamarrlmayes.replit.app\",
    \"ts\": $TIMESTAMP,
    \"context\": {
      \"page\": \"/scholarships/nursing\",
      \"utm_source\": \"google\",
      \"utm_medium\": \"organic\",
      \"referrer\": \"google.com\"
    }
  }")
echo "$RESP1" | jq .
echo ""

# Event 2: cta_click
echo ">>> Event 2: cta_click (ID: $UUID2)"
RESP2=$(curl -s -X POST "$A8_URL/api/events" \
  -H "Content-Type: application/json" \
  -H "x-scholar-protocol: v3.5.1" \
  -H "x-app-label: $APP_LABEL" \
  -H "x-event-id: $UUID2" \
  -d "{
    \"event_type\": \"cta_click\",
    \"source_app_id\": \"$APP_LABEL\",
    \"app_base_url\": \"https://auto-page-maker-jamarrlmayes.replit.app\",
    \"ts\": $TIMESTAMP,
    \"context\": {
      \"button\": \"get_matches\",
      \"target\": \"https://student-pilot-jamarrlmayes.replit.app\",
      \"utm_source\": \"auto_page_maker\",
      \"utm_medium\": \"cta\"
    }
  }")
echo "$RESP2" | jq .
echo ""

# Event 3: traffic (SEO)
echo ">>> Event 3: traffic (ID: $UUID3)"
RESP3=$(curl -s -X POST "$A8_URL/api/events" \
  -H "Content-Type: application/json" \
  -H "x-scholar-protocol: v3.5.1" \
  -H "x-app-label: $APP_LABEL" \
  -H "x-event-id: $UUID3" \
  -d "{
    \"event_type\": \"traffic\",
    \"source_app_id\": \"$APP_LABEL\",
    \"app_base_url\": \"https://auto-page-maker-jamarrlmayes.replit.app\",
    \"ts\": $TIMESTAMP,
    \"context\": {
      \"page_count\": 1155,
      \"indexed_pages\": 890,
      \"organic_visits\": 45
    }
  }")
echo "$RESP3" | jq .
echo ""

echo "=== Canary Test Complete ==="
echo "Event IDs for verification:"
echo "  1. $UUID1"
echo "  2. $UUID2"
echo "  3. $UUID3"
echo ""
echo "Verify in A8 /api/events/recent or database"
