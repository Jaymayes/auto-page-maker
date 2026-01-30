#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PERF_DIR="$(dirname "$SCRIPT_DIR")"
REPORTS_DIR="$PERF_DIR/reports"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
VERSION=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

echo "=== A7 Performance Test Suite ==="
echo "Timestamp: $TIMESTAMP"
echo "Version: $VERSION"
echo "Reports: $REPORTS_DIR"
echo ""

mkdir -p "$REPORTS_DIR"

export BASE_URL="${BASE_URL:-http://localhost:5000}"
export VERSION="$VERSION"

if ! command -v k6 &> /dev/null; then
    echo "WARNING: k6 not installed. Using curl-based fallback tests."
    
    echo "Running smoke test with curl..."
    ROUTES=("/sitemap.xml" "/" "/browse" "/browse/states" "/browse/majors" "/health")
    
    results_file="$REPORTS_DIR/a7_results_$TIMESTAMP.json"
    echo "{" > "$results_file"
    echo "  \"timestamp\": \"$(date -Iseconds)\"," >> "$results_file"
    echo "  \"version\": \"$VERSION\"," >> "$results_file"
    echo "  \"base_url\": \"$BASE_URL\"," >> "$results_file"
    echo "  \"tests\": [" >> "$results_file"
    
    first=true
    for route in "${ROUTES[@]}"; do
        if [ "$first" = true ]; then
            first=false
        else
            echo "," >> "$results_file"
        fi
        
        start_time=$(date +%s%3N)
        status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$route" --max-time 10 || echo "000")
        end_time=$(date +%s%3N)
        latency=$((end_time - start_time))
        
        echo "  $route: ${latency}ms (HTTP $status)"
        
        echo -n "    {\"route\": \"$route\", \"status\": $status, \"latency_ms\": $latency}" >> "$results_file"
    done
    
    echo "" >> "$results_file"
    echo "  ]" >> "$results_file"
    echo "}" >> "$results_file"
    
    echo ""
    echo "Results saved to: $results_file"
    exit 0
fi

echo "Running k6 tests..."

k6 run \
    --env BASE_URL="$BASE_URL" \
    --env VERSION="$VERSION" \
    --out json="$REPORTS_DIR/a7_raw_$TIMESTAMP.json" \
    "$PERF_DIR/k6/a7_pages.js"

echo ""
echo "=== Test Complete ==="
echo "Results: $REPORTS_DIR/a7_results.json"
