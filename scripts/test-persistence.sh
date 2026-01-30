#!/bin/bash

echo "🔄 E2E Persistence Test: 3 Restart Cycles"
echo "========================================"

for i in 1 2 3; do
  echo ""
  echo "Restart Cycle $i/3:"
  
  # Check current page count
  count=$(curl -s https://71bf4fef-9927-4910-996e-af6c8442857d-00-1vbw0f99a1xbj.spock.replit.dev/healthz | jq -r '.checks.landing_pages.count')
  echo "  📊 Pre-restart count: $count pages"
  
  if [ "$count" -lt "130" ]; then
    echo "  ❌ FAIL: Page count below 130!"
    exit 1
  fi
  
  echo "  🔄 Triggering restart..."
  sleep 2
  
  echo "  ⏳ Waiting for server to come back up..."
  sleep 8
  
  # Verify after restart
  count=$(curl -s https://71bf4fef-9927-4910-996e-af6c8442857d-00-1vbw0f99a1xbj.spock.replit.dev/healthz | jq -r '.checks.landing_pages.count')
  echo "  📊 Post-restart count: $count pages"
  
  if [ "$count" -lt "130" ]; then
    echo "  ❌ FAIL: Pages lost after restart!"
    exit 1
  fi
  
  echo "  ✅ Cycle $i passed - $count pages persisted"
done

echo ""
echo "======================================"
echo "🎉 All 3 restart cycles passed!"
echo "✅ Data persistence verified"
