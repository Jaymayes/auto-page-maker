#!/bin/bash
# ENDPOINT_TESTS.sh - AGENT3 Unified Execution Prompt Acceptance Tests
# System Identity: auto_page_maker | Base URL: https://auto-page-maker-jamarrlmayes.replit.app
# Generated: 2025-11-25

# Don't exit on errors - we want to count all test results

BASE_URL="${BASE_URL:-http://localhost:5000}"
PROD_URL="https://auto-page-maker-jamarrlmayes.replit.app"

echo "=============================================================="
echo "AGENT3 ENDPOINT TESTS - auto_page_maker"
echo "System Identity: auto_page_maker"
echo "Base URL: $PROD_URL"
echo "Testing against: $BASE_URL"
echo "=============================================================="
echo ""

PASSED=0
FAILED=0

pass() {
    echo "[PASS] $1"
    ((PASSED++))
}

fail() {
    echo "[FAIL] $1"
    ((FAILED++))
}

# Global Compliance Tests
echo "=== GLOBAL COMPLIANCE ENDPOINTS ==="
echo ""

echo "--- Test 1: GET /healthz ---"
RESPONSE=$(curl -s -i "$BASE_URL/healthz" 2>&1)
if echo "$RESPONSE" | grep -q "X-System-Identity: auto_page_maker"; then
    pass "X-System-Identity header present"
else
    fail "X-System-Identity header missing"
fi
if echo "$RESPONSE" | grep -q "X-App-Base-URL:"; then
    pass "X-App-Base-URL header present"
else
    fail "X-App-Base-URL header missing"
fi
if echo "$RESPONSE" | grep -q '"system_identity"'; then
    pass "system_identity JSON field present"
else
    fail "system_identity JSON field missing"
fi
if echo "$RESPONSE" | grep -q '"base_url"'; then
    pass "base_url JSON field present"
else
    fail "base_url JSON field missing"
fi
echo ""

echo "--- Test 2: GET /version ---"
RESPONSE=$(curl -s -i "$BASE_URL/version" 2>&1)
if echo "$RESPONSE" | grep -q "X-System-Identity: auto_page_maker"; then
    pass "/version X-System-Identity header"
else
    fail "/version X-System-Identity header missing"
fi
if echo "$RESPONSE" | grep -q '"system_identity"'; then
    pass "/version system_identity JSON field"
else
    fail "/version system_identity JSON field missing"
fi
echo ""

echo "--- Test 3: GET /api/metrics/prometheus ---"
RESPONSE=$(curl -s "$BASE_URL/api/metrics/prometheus" 2>&1)
if echo "$RESPONSE" | grep -q 'app_info{app_id="auto_page_maker"'; then
    pass "Prometheus app_info metric present"
else
    fail "Prometheus app_info metric missing"
fi
if echo "$RESPONSE" | grep -q 'pages_rendered_total{status='; then
    pass "pages_rendered_total metric present (SECTION G required)"
else
    fail "pages_rendered_total metric missing"
fi
echo ""

# auto_page_maker Specific Tests
echo "=== SECTION G: auto_page_maker ENDPOINTS ==="
echo ""

echo "--- Test 4: GET /sitemap.xml ---"
SITEMAP_COUNT=$(curl -s "$BASE_URL/sitemap.xml" | grep -c '<url>' || echo "0")
if [ "$SITEMAP_COUNT" -gt 0 ]; then
    pass "Sitemap contains $SITEMAP_COUNT URLs"
else
    fail "Sitemap is empty or invalid"
fi
echo ""

echo "--- Test 5: POST /api/v1/pages/generate (without auth) ---"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/v1/pages/generate" \
    -H "Content-Type: application/json" \
    -d '{"query":"test"}')
if [ "$HTTP_CODE" = "401" ]; then
    pass "Returns 401 without auth"
else
    fail "Expected 401, got $HTTP_CODE"
fi
echo ""

echo "--- Test 6: POST /api/v1/rebuild (without auth) ---"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/v1/rebuild" \
    -H "Content-Type: application/json")
if [ "$HTTP_CODE" = "401" ]; then
    pass "Returns 401 without auth"
else
    fail "Expected 401, got $HTTP_CODE"
fi
echo ""

echo "--- Test 7: Scholarship page canonical + schema.org ---"
CANONICAL=$(curl -s "$BASE_URL/scholarship/1" | grep -c 'canonical' || echo "0")
SCHEMA=$(curl -s "$BASE_URL/scholarship/1" | grep -c 'schema.org' || echo "0")
if [ "$CANONICAL" -gt 0 ]; then
    pass "Canonical tag present"
else
    fail "Canonical tag missing"
fi
if [ "$SCHEMA" -gt 0 ]; then
    pass "schema.org markup present"
else
    fail "schema.org markup missing"
fi
echo ""

echo "--- Test 8: Category page OG/Twitter tags ---"
OG_COUNT=$(curl -s "$BASE_URL/scholarships?category=STEM" | grep -c 'og:' || echo "0")
TWITTER_COUNT=$(curl -s "$BASE_URL/scholarships?category=STEM" | grep -c 'twitter:' || echo "0")
if [ "$OG_COUNT" -gt 0 ]; then
    pass "OpenGraph tags present ($OG_COUNT)"
else
    fail "OpenGraph tags missing"
fi
if [ "$TWITTER_COUNT" -gt 0 ]; then
    pass "Twitter card tags present ($TWITTER_COUNT)"
else
    fail "Twitter card tags missing"
fi
echo ""

# Summary
echo "=============================================================="
echo "TEST RESULTS SUMMARY"
echo "=============================================================="
echo ""
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo "Total:  $((PASSED + FAILED))"
echo ""

if [ "$FAILED" -eq 0 ]; then
    echo "STATUS: ALL TESTS PASSED"
else
    echo "STATUS: SOME TESTS FAILED"
fi

echo ""
echo "=============================================================="
echo "FINAL STATUS LINE"
echo "=============================================================="
echo ""
echo "auto_page_maker | $PROD_URL | Readiness: CONDITIONAL GO | Revenue-ready: 168h"
echo ""
echo "=============================================================="
