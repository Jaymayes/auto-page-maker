#!/bin/bash
# Fleet Event Simulator - v3.5.1 Protocol Compliant

A8_URL="${A8_URL:-https://auto-com-center-jamarrlmayes.replit.app/api/events}"
A8_KEY="${A8_KEY:-${S2S_API_KEY:-}}"
TS=$(date +%s)
TIMESTAMP="${TS}000"

echo "============================================================"
echo "Fleet Event Simulator - v3.5.1 Protocol"
echo "============================================================"
echo "Target: $A8_URL"
echo "Time: $(date -u +%Y-%m-%dT%H:%M:%S)Z"
echo ""

# Event 1: NewUser
UUID1="NewUser-$TS-canary001"
echo ">>> Event 1: NewUser (ID: $UUID1) Source: scholar_auth"
RESP1=$(curl -s -X POST "$A8_URL" \
  -H "Content-Type: application/json" \
  -H "x-scholar-protocol: v3.5.1" \
  -H "x-app-label: scholar_auth" \
  -H "x-event-id: $UUID1" \
  -d "{\"event_type\":\"NewUser\",\"source_app_id\":\"scholar_auth\",\"app_base_url\":\"https://scholar-auth-jamarrlmayes.replit.app\",\"ts\":$TIMESTAMP,\"context\":{\"user_id_hash\":\"sha256_canary\",\"utm_source\":\"auto_page_maker\"}}")
echo "$RESP1" | jq -c . 2>/dev/null || echo "$RESP1"

# Event 2: NewLead
UUID2="NewLead-$TS-canary002"
echo ""
echo ">>> Event 2: NewLead (ID: $UUID2) Source: auto_page_maker"
RESP2=$(curl -s -X POST "$A8_URL" \
  -H "Content-Type: application/json" \
  -H "x-scholar-protocol: v3.5.1" \
  -H "x-app-label: auto_page_maker" \
  -H "x-event-id: $UUID2" \
  -d "{\"event_type\":\"NewLead\",\"source_app_id\":\"auto_page_maker\",\"app_base_url\":\"https://auto-page-maker-jamarrlmayes.replit.app\",\"ts\":$TIMESTAMP,\"context\":{\"lead_id\":\"lead_$TS\",\"utm_source\":\"google\"}}")
echo "$RESP2" | jq -c . 2>/dev/null || echo "$RESP2"

# Event 3: PaymentSuccess
UUID3="PaymentSuccess-$TS-canary003"
echo ""
echo ">>> Event 3: PaymentSuccess (ID: $UUID3) Source: student_pilot"
RESP3=$(curl -s -X POST "$A8_URL" \
  -H "Content-Type: application/json" \
  -H "x-scholar-protocol: v3.5.1" \
  -H "x-app-label: student_pilot" \
  -H "x-event-id: $UUID3" \
  -d "{\"event_type\":\"PaymentSuccess\",\"source_app_id\":\"student_pilot\",\"app_base_url\":\"https://student-pilot-jamarrlmayes.replit.app\",\"ts\":$TIMESTAMP,\"context\":{\"payment_id\":\"pay_$TS\",\"amount_cents\":100,\"currency\":\"usd\",\"mode\":\"test\"}}")
echo "$RESP3" | jq -c . 2>/dev/null || echo "$RESP3"

# Summary
echo ""
echo "============================================================"
echo "SUMMARY"
echo "============================================================"
P1=$(echo "$RESP1" | jq -r '.persisted // false' 2>/dev/null)
P2=$(echo "$RESP2" | jq -r '.persisted // false' 2>/dev/null)
P3=$(echo "$RESP3" | jq -r '.persisted // false' 2>/dev/null)
E1=$(echo "$RESP1" | jq -r '.event_id // "?"' 2>/dev/null)
E2=$(echo "$RESP2" | jq -r '.event_id // "?"' 2>/dev/null)
E3=$(echo "$RESP3" | jq -r '.event_id // "?"' 2>/dev/null)

[ "$P1" = "true" ] && echo "✅ NewUser ($E1): persisted" || echo "❌ NewUser: failed"
[ "$P2" = "true" ] && echo "✅ NewLead ($E2): persisted" || echo "❌ NewLead: failed"
[ "$P3" = "true" ] && echo "✅ PaymentSuccess ($E3): persisted" || echo "❌ PaymentSuccess: failed"

echo "============================================================"
[ "$P1" = "true" ] && [ "$P2" = "true" ] && [ "$P3" = "true" ] && echo "RESULT: ALL PERSISTED - DEMO MODE READY" || echo "RESULT: CHECK FAILURES"
