#!/bin/bash
set -e

echo "=== A7 Performance Test Environment Setup ==="

if ! command -v k6 &> /dev/null; then
    echo "k6 not installed. Tests will use curl-based fallback."
    echo "To install k6: https://k6.io/docs/getting-started/installation/"
fi

BASE_URL="${BASE_URL:-http://localhost:5000}"
echo "Testing connectivity to $BASE_URL..."

if curl -s --max-time 5 "$BASE_URL/health" > /dev/null 2>&1; then
    echo "Server is reachable at $BASE_URL"
else
    echo "WARNING: Server not reachable at $BASE_URL"
    echo "Make sure the application is running before testing."
fi

echo ""
echo "Environment ready. Run tests with:"
echo "  ./tests/perf/scripts/run_suite.sh"
