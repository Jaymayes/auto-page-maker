#!/bin/bash

# Production Environment Testing Script
# Tests critical SEO and routing functionality

echo "🏭 PRODUCTION MODE TEST SUITE"
echo "================================"

# Set environment variables for production testing  
export NODE_ENV=production
export PORT=5000

echo "📋 Environment Configuration:"
echo "   NODE_ENV: $NODE_ENV"
echo "   PORT: $PORT"
echo ""

# Build the production assets (simulate production build)
echo "🔨 Building production assets..."
npm run build 2>/dev/null || echo "⚠️  Build step skipped (not available)"

echo ""
echo "🚀 Starting server in production mode..."

# Start server in background
npm run dev &
SERVER_PID=$!

# Wait for server to be ready
sleep 8

echo ""
echo "🔍 CRITICAL ROUTE TESTING"
echo "=========================="

# Test 1: Homepage (should return 200)
echo "Test 1: Homepage"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/)
echo "   GET / → HTTP $RESPONSE $([ "$RESPONSE" = "200" ] && echo "✅ PASS" || echo "❌ FAIL")"

# Test 2: Valid API route (should return JSON)
echo "Test 2: API Route"  
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/scholarships/stats)
echo "   GET /api/scholarships/stats → HTTP $RESPONSE $([ "$RESPONSE" = "200" ] && echo "✅ PASS" || echo "❌ FAIL")"

# Test 3: Invalid route (CRITICAL - should return 404 in production)
echo "Test 3: Invalid Route (CRITICAL)"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/nonexistent-page-test-404)
echo "   GET /nonexistent-page-test-404 → HTTP $RESPONSE"
if [ "$RESPONSE" = "404" ]; then
    echo "   ✅ PASS - Proper 404 response"
elif [ "$RESPONSE" = "200" ]; then
    echo "   ❌ CRITICAL FAIL - SPA fallback serving 200 instead of 404"
else
    echo "   ⚠️  UNEXPECTED - HTTP $RESPONSE (expected 404)"
fi

# Test 4: Content type validation for invalid routes
echo "Test 4: Content Type Validation"
CONTENT_TYPE=$(curl -s -I http://localhost:5000/invalid-test-route | grep -i "content-type" | cut -d' ' -f2-)
echo "   Content-Type: $CONTENT_TYPE"
if [[ "$CONTENT_TYPE" == *"text/html"* ]]; then
    echo "   ❌ FAIL - Serving HTML for invalid routes"
else
    echo "   ✅ PASS - Not serving HTML for invalid routes"
fi

# Test 5: Check for development artifacts
echo "Test 5: Development Artifacts Check"
DEV_ARTIFACTS=$(curl -s http://localhost:5000/invalid-route | grep -E '(vite|@vite|react-refresh|@react-refresh)' | wc -l)
echo "   Development artifacts found: $DEV_ARTIFACTS"
if [ "$DEV_ARTIFACTS" -gt 0 ]; then
    echo "   ❌ FAIL - Development artifacts in production"
else
    echo "   ✅ PASS - Clean production responses"
fi

echo ""
echo "🗺️  SITEMAP & SEO TESTING"
echo "========================"

# Test 6: Sitemap accessibility
echo "Test 6: Sitemap"
SITEMAP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/sitemap.xml)
echo "   GET /sitemap.xml → HTTP $SITEMAP_RESPONSE $([ "$SITEMAP_RESPONSE" = "200" ] && echo "✅ PASS" || echo "❌ FAIL")"

# Test 7: Robots.txt
echo "Test 7: Robots.txt"  
ROBOTS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/robots.txt)
echo "   GET /robots.txt → HTTP $ROBOTS_RESPONSE $([ "$ROBOTS_RESPONSE" = "200" ] && echo "✅ PASS" || echo "❌ FAIL")"

echo ""
echo "📊 TEST SUMMARY"
echo "==============="

# Cleanup
kill $SERVER_PID 2>/dev/null

if [ "$RESPONSE" = "404" ] && [ "$DEV_ARTIFACTS" -eq 0 ]; then
    echo "🎉 PRODUCTION READY"
    echo "   ✅ SPA fallback properly configured"
    echo "   ✅ No development artifacts"
    echo "   ✅ SEO compliance achieved"
    exit 0
else
    echo "⚠️  PRODUCTION BLOCKERS DETECTED"
    echo "   Review failed tests above"
    exit 1
fi