#!/bin/bash
# Cleanup script for simulated_audit namespace data
# TTL: 14 days
# Usage: ./cleanup_simulated_audit.sh [--dry-run]

set -e

DRY_RUN=false
if [[ "$1" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "=== DRY RUN MODE - No deletions will be performed ==="
fi

A8_URL="https://auto-com-center-jamarrlmayes.replit.app"

echo "Checking for simulated_audit events..."

# Count events with simulated_audit namespace
COUNT_QUERY='SELECT COUNT(*) FROM events WHERE payload->>'\''namespace'\'' = '\''simulated_audit'\'''

if [ "$DRY_RUN" = true ]; then
  echo "[DRY RUN] Would execute: DELETE FROM events WHERE payload->>'namespace' = 'simulated_audit' AND created_at < NOW() - INTERVAL '14 days'"
  echo "[DRY RUN] Estimated affected rows: (requires DB access)"
else
  echo "Executing cleanup..."
  # This would require direct DB access or an admin endpoint
  # For now, log the intent
  echo "CLEANUP: DELETE FROM events WHERE payload->>'namespace' = 'simulated_audit' AND created_at < NOW() - INTERVAL '14 days'"
fi

echo ""
echo "Cleanup script completed."
echo "Note: Actual deletion requires A8 admin endpoint or direct DB access."
