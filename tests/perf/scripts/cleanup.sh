#!/bin/bash
set -e

NAMESPACE="perf_test"

echo "=== A7 Performance Test Cleanup ==="
echo "Namespace: $NAMESPACE"
echo ""

echo "Cleaning up perf_test namespace records..."

echo "No database records to clean (A7 is read-only content generator)"

REPORTS_DIR="$(dirname "$0")/../reports"
if [ -d "$REPORTS_DIR" ]; then
    echo "Archiving old reports..."
    ARCHIVE_DIR="$REPORTS_DIR/archive"
    mkdir -p "$ARCHIVE_DIR"
    
    find "$REPORTS_DIR" -maxdepth 1 -name "*.json" -mtime +7 -exec mv {} "$ARCHIVE_DIR/" \; 2>/dev/null || true
    find "$REPORTS_DIR" -maxdepth 1 -name "*.csv" -mtime +7 -exec mv {} "$ARCHIVE_DIR/" \; 2>/dev/null || true
    
    echo "Archived reports older than 7 days"
fi

echo ""
echo "Cleanup complete (idempotent)"
