#!/bin/bash
# Evidence collection commands used during audit

# Fleet health baseline
for app in scholar-auth scholarship-api scholarship-agent scholarship-sage student-pilot provider-register auto-page-maker auto-com-center; do
  curl -s "https://${app}-jamarrlmayes.replit.app/health"
done

# A2 /ready probes
for i in 1 2 3 4 5; do
  curl -s -w "\n%{http_code}" "https://scholarship-api-jamarrlmayes.replit.app/ready"
done

# A7 latency profile
for i in $(seq 1 20); do
  time curl -s -o /dev/null "https://auto-page-maker-jamarrlmayes.replit.app/health"
done

# A8 event ingestion test
curl -s -X POST "https://auto-com-center-jamarrlmayes.replit.app/api/events" \
  -H "content-type: application/json" \
  -H "x-scholar-protocol: v3.5.1" \
  -H "x-app-label: auto_page_maker" \
  -H "x-event-id: test-$(date +%s)" \
  -d '{"event_type":"PageView","occurred_at":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","actor_id":"audit","source":"test","payload":{"namespace":"simulated_audit"}}'
