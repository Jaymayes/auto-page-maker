#!/bin/bash
# auto_page_maker Daily SEO Health Check
# DRI: SEO Lead
# Schedule: 9:00 AM MST daily
# Execution: ./scripts/daily_seo_health_check.sh

set -e

APP_URL="https://auto-page-maker-jamarrlmayes.replit.app"
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S %Z")
LOG_FILE="evidence/seo_health_$(date +%Y%m%d).log"

echo "=== auto_page_maker SEO Health Check ===" | tee -a "$LOG_FILE"
echo "Timestamp: $TIMESTAMP" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# 1. Health endpoint
echo "1. Application Health Check:" | tee -a "$LOG_FILE"
HEALTH_STATUS=$(curl -s "$APP_URL/health" | jq -r '.status')
HEALTH_DEPS=$(curl -s "$APP_URL/health" | jq -r '.summary | "\(.healthy)/\(.total) healthy"')
echo "Status: $HEALTH_STATUS" | tee -a "$LOG_FILE"
echo "Dependencies: $HEALTH_DEPS" | tee -a "$LOG_FILE"

if [ "$HEALTH_STATUS" != "healthy" ]; then
  echo "⚠️  ALERT: Application is not healthy!" | tee -a "$LOG_FILE"
  # Trigger alert (add alerting integration here)
fi
echo "" | tee -a "$LOG_FILE"

# 2. Sitemap count
echo "2. Sitemap URL Count:" | tee -a "$LOG_FILE"
SITEMAP_COUNT=$(curl -s "$APP_URL/sitemap.xml" | grep -c "<url>" || echo "0")
echo "Total URLs: $SITEMAP_COUNT" | tee -a "$LOG_FILE"

if [ "$SITEMAP_COUNT" -lt 2000 ]; then
  echo "⚠️  WARNING: Sitemap has fewer than 2000 URLs (found: $SITEMAP_COUNT)" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# 3. Sample landing pages (test 3 high-value pages)
echo "3. Sample Landing Page Status Checks:" | tee -a "$LOG_FILE"

PAGES=(
  "nursing-california"
  "computer-science-texas"
  "engineering-florida"
)

for PAGE in "${PAGES[@]}"; do
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/scholarships/$PAGE")
  echo "  /scholarships/$PAGE: HTTP $HTTP_STATUS" | tee -a "$LOG_FILE"
  
  if [ "$HTTP_STATUS" != "200" ]; then
    echo "  ⚠️  WARNING: Non-200 status for $PAGE" | tee -a "$LOG_FILE"
  fi
done
echo "" | tee -a "$LOG_FILE"

# 4. Robots.txt verification
echo "4. Robots.txt Check:" | tee -a "$LOG_FILE"
SITEMAP_REF=$(curl -s "$APP_URL/robots.txt" | grep "Sitemap:" || echo "NOT FOUND")
echo "$SITEMAP_REF" | tee -a "$LOG_FILE"

if [ "$SITEMAP_REF" == "NOT FOUND" ]; then
  echo "⚠️  ERROR: Sitemap reference missing in robots.txt" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# 5. Summary
echo "=== Summary ===" | tee -a "$LOG_FILE"
echo "Health: $HEALTH_STATUS" | tee -a "$LOG_FILE"
echo "Sitemap URLs: $SITEMAP_COUNT" | tee -a "$LOG_FILE"
echo "Log saved to: $LOG_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Exit with error if critical checks fail
if [ "$HEALTH_STATUS" != "healthy" ] || [ "$SITEMAP_COUNT" -lt 2000 ]; then
  echo "❌ Health check FAILED - Manual review required" | tee -a "$LOG_FILE"
  exit 1
else
  echo "✅ Health check PASSED" | tee -a "$LOG_FILE"
  exit 0
fi
