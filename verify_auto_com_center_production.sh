#!/bin/bash
# auto_com_center Production Verification Script
# Execute after clicking "Publish" in Replit
# SLA: Complete within 15 minutes of publish

set -e

PROD_URL="https://auto-com-center-jamarrlmayes.replit.app"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EVIDENCE_FILE="auto_com_center_evidence_${TIMESTAMP}.log"

echo "════════════════════════════════════════════════════════════════" | tee -a $EVIDENCE_FILE
echo "auto_com_center Production Verification Evidence Bundle" | tee -a $EVIDENCE_FILE
echo "Timestamp: $TIMESTAMP" | tee -a $EVIDENCE_FILE
echo "Production URL: $PROD_URL" | tee -a $EVIDENCE_FILE
echo "════════════════════════════════════════════════════════════════" | tee -a $EVIDENCE_FILE
echo "" | tee -a $EVIDENCE_FILE

# 1. CANARY v2.7 CHECK
echo "1. CANARY v2.7 VERIFICATION" | tee -a $EVIDENCE_FILE
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a $EVIDENCE_FILE
curl -s $PROD_URL/canary | jq '.' | tee -a $EVIDENCE_FILE

# Validation
echo "" | tee -a $EVIDENCE_FILE
echo "Validation Checks:" | tee -a $EVIDENCE_FILE
CANARY=$(curl -s $PROD_URL/canary)
echo "$CANARY" | jq -e '.version == "v2.7"' && echo "✅ Version v2.7" | tee -a $EVIDENCE_FILE || echo "❌ Wrong version" | tee -a $EVIDENCE_FILE
echo "$CANARY" | jq -e 'keys | length == 8' && echo "✅ 8 fields present" | tee -a $EVIDENCE_FILE || echo "❌ Wrong field count" | tee -a $EVIDENCE_FILE
echo "$CANARY" | jq -e '.dependencies_ok == true' && echo "✅ Dependencies OK" | tee -a $EVIDENCE_FILE || echo "❌ Dependencies degraded" | tee -a $EVIDENCE_FILE
echo "$CANARY" | jq -e '.security_headers.present | length == 6' && echo "✅ 6/6 security headers" | tee -a $EVIDENCE_FILE || echo "❌ Missing headers" | tee -a $EVIDENCE_FILE
echo "" | tee -a $EVIDENCE_FILE

# 2. SECURITY HEADERS CHECK
echo "2. SECURITY HEADERS VERIFICATION" | tee -a $EVIDENCE_FILE
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a $EVIDENCE_FILE
curl -I $PROD_URL/canary 2>&1 | grep -i "strict-transport-security\|content-security-policy\|x-frame-options\|x-content-type\|referrer-policy\|permissions-policy" | tee -a $EVIDENCE_FILE
echo "" | tee -a $EVIDENCE_FILE

# 3. P95 LATENCY (30 samples)
echo "3. P95 LATENCY BASELINE (30 samples)" | tee -a $EVIDENCE_FILE
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a $EVIDENCE_FILE
echo "Collecting 30 latency samples..." | tee -a $EVIDENCE_FILE
for i in {1..30}; do
  curl -s -w '%{time_total}\n' -o /dev/null $PROD_URL/canary
  sleep 0.1
done | sort -n > /tmp/latency_samples.txt

P95=$(awk 'NR==29 {printf "%.0f", $1*1000}' /tmp/latency_samples.txt)
echo "P95 Latency: ${P95}ms" | tee -a $EVIDENCE_FILE
if [ "$P95" -le 120 ]; then
  echo "✅ P95 ≤120ms (target met)" | tee -a $EVIDENCE_FILE
else
  echo "⚠️  P95 >120ms (exceeds target)" | tee -a $EVIDENCE_FILE
fi
echo "" | tee -a $EVIDENCE_FILE

# 4. AUTH/JWKS REACHABILITY (Note: May be degraded if Gate 1 not GREEN)
echo "4. AUTH/JWKS REACHABILITY CHECK" | tee -a $EVIDENCE_FILE
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a $EVIDENCE_FILE
SCHOLAR_AUTH_URL="https://scholar-auth-jamarrlmayes.replit.app"
JWKS_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" $SCHOLAR_AUTH_URL/.well-known/jwks.json)
HTTP_CODE=$(echo "$JWKS_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ scholar_auth JWKS reachable (Gate 1 likely GREEN)" | tee -a $EVIDENCE_FILE
  echo "$JWKS_RESPONSE" | sed '/HTTP_CODE/d' | jq '.' | tee -a $EVIDENCE_FILE
else
  echo "⚠️  scholar_auth JWKS degraded (Gate 1 may not be GREEN yet)" | tee -a $EVIDENCE_FILE
  echo "HTTP Code: $HTTP_CODE" | tee -a $EVIDENCE_FILE
  echo "Status: degraded – pending Gate 1 GREEN" | tee -a $EVIDENCE_FILE
  echo "Action: Rerun this check after Gate 1 flips GREEN" | tee -a $EVIDENCE_FILE
fi
echo "" | tee -a $EVIDENCE_FILE

# 5. M2M TOKEN FLOW (Note: Will fail if Gate 1 not GREEN)
echo "5. M2M TOKEN FLOW VALIDATION" | tee -a $EVIDENCE_FILE
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a $EVIDENCE_FILE
echo "Testing SystemService M2M token acquisition..." | tee -a $EVIDENCE_FILE
M2M_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST $SCHOLAR_AUTH_URL/api/auth/m2m \
  -H "Content-Type: application/json" \
  -d '{"service": "auto_com_center", "role": "SystemService"}')
M2M_CODE=$(echo "$M2M_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)

if [ "$M2M_CODE" = "200" ]; then
  echo "✅ M2M token acquisition successful" | tee -a $EVIDENCE_FILE
  echo "$M2M_RESPONSE" | sed '/HTTP_CODE/d' | jq '.token' | tee -a $EVIDENCE_FILE
else
  echo "⚠️  M2M token acquisition blocked (expected if Gate 1 not GREEN)" | tee -a $EVIDENCE_FILE
  echo "HTTP Code: $M2M_CODE" | tee -a $EVIDENCE_FILE
  echo "Status: blocked – pending Gate 1 GREEN" | tee -a $EVIDENCE_FILE
fi
echo "" | tee -a $EVIDENCE_FILE

# 6. EVENT INGESTION (Synthetic Events)
echo "6. EVENT INGESTION VALIDATION (Dry-Run)" | tee -a $EVIDENCE_FILE
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a $EVIDENCE_FILE

# Event 1: deadline_soon
echo "Posting synthetic event: deadline_soon" | tee -a $EVIDENCE_FILE
EVENT1=$(curl -s -X POST $PROD_URL/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "type": "deadline_approaching",
    "student_id": "test_student_001",
    "scholarship_id": "test_scholarship_001",
    "deadline": "2025-11-15T23:59:59Z",
    "hours_remaining": 72,
    "idempotency_key": "test_deadline_'$(date +%s)'"
  }')
echo "$EVENT1" | jq '.' | tee -a $EVIDENCE_FILE

# Event 2: new_match
echo "" | tee -a $EVIDENCE_FILE
echo "Posting synthetic event: new_match_found" | tee -a $EVIDENCE_FILE
EVENT2=$(curl -s -X POST $PROD_URL/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "type": "new_match_found",
    "student_id": "test_student_001",
    "scholarship_id": "test_scholarship_002",
    "match_score": 85,
    "idempotency_key": "test_match_'$(date +%s)'"
  }')
echo "$EVENT2" | jq '.' | tee -a $EVIDENCE_FILE

# Check event queue
echo "" | tee -a $EVIDENCE_FILE
echo "Checking event queue status..." | tee -a $EVIDENCE_FILE
QUEUE_STATUS=$(curl -s $PROD_URL/api/queue/status)
echo "$QUEUE_STATUS" | jq '.' | tee -a $EVIDENCE_FILE
echo "" | tee -a $EVIDENCE_FILE

# 7. DELIVERY PROVIDER HEALTH CHECKS
echo "7. DELIVERY PROVIDER HEALTH CHECKS (Dry-Run)" | tee -a $EVIDENCE_FILE
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a $EVIDENCE_FILE
PROVIDER_HEALTH=$(curl -s $PROD_URL/api/providers/health)
echo "$PROVIDER_HEALTH" | jq '.' | tee -a $EVIDENCE_FILE
echo "" | tee -a $EVIDENCE_FILE

# 8. KILL-SWITCH VALIDATION
echo "8. KILL-SWITCH VALIDATION (DISABLE_SEND)" | tee -a $EVIDENCE_FILE
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a $EVIDENCE_FILE
echo "Checking DISABLE_SEND status..." | tee -a $EVIDENCE_FILE
SEND_STATUS=$(curl -s $PROD_URL/api/send/status)
echo "$SEND_STATUS" | jq '.' | tee -a $EVIDENCE_FILE

DISABLE_SEND=$(echo "$SEND_STATUS" | jq -r '.dry_run')
if [ "$DISABLE_SEND" = "true" ]; then
  echo "✅ Dry-run mode ENABLED (DISABLE_SEND=true)" | tee -a $EVIDENCE_FILE
  echo "✅ No external sends will occur" | tee -a $EVIDENCE_FILE
else
  echo "❌ WARNING: Dry-run mode DISABLED!" | tee -a $EVIDENCE_FILE
  echo "❌ External sends may occur - immediate rollback required!" | tee -a $EVIDENCE_FILE
fi
echo "" | tee -a $EVIDENCE_FILE

# SUMMARY
echo "════════════════════════════════════════════════════════════════" | tee -a $EVIDENCE_FILE
echo "VERIFICATION SUMMARY" | tee -a $EVIDENCE_FILE
echo "════════════════════════════════════════════════════════════════" | tee -a $EVIDENCE_FILE
echo "Timestamp: $TIMESTAMP" | tee -a $EVIDENCE_FILE
echo "Evidence File: $EVIDENCE_FILE" | tee -a $EVIDENCE_FILE
echo "" | tee -a $EVIDENCE_FILE
echo "Next Steps:" | tee -a $EVIDENCE_FILE
echo "1. Review this evidence bundle" | tee -a $EVIDENCE_FILE
echo "2. Post to CEO war-room within T+15 minutes" | tee -a $EVIDENCE_FILE
echo "3. If Gate 1 not GREEN yet, rerun sections 4 & 5 after Gate 1 flips" | tee -a $EVIDENCE_FILE
echo "4. Update status: 'auto_com_center: GREEN (dry-run)'" | tee -a $EVIDENCE_FILE
echo "════════════════════════════════════════════════════════════════" | tee -a $EVIDENCE_FILE

echo ""
echo "Evidence bundle saved to: $EVIDENCE_FILE"
echo "Upload this file to war-room within T+15 minutes of publish"
