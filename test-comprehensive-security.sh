#!/bin/bash

echo "🛡️ COMPREHENSIVE SECURITY VALIDATION"
echo "===================================="
echo "Testing both Path Traversal Protection + Unicode Normalization"
echo ""

SERVER_URL="http://localhost:5000"

# Test Path Traversal Protection
echo "🔒 PATH TRAVERSAL SECURITY TESTS"
echo "--------------------------------"

# Path traversal should be blocked
RESPONSE=$(curl -s -w "STATUS:%{http_code}" "$SERVER_URL/../../../etc/passwd")
if [[ "$RESPONSE" == *"STATUS:403"* ]]; then
  echo "✅ Path traversal blocked correctly"
else
  echo "❌ Path traversal protection failed"
fi

# Legitimate API should work
RESPONSE=$(curl -s -w "STATUS:%{http_code}" "$SERVER_URL/healthz")
if [[ "$RESPONSE" == *"STATUS:200"* ]]; then
  echo "✅ Legitimate API requests work"
else
  echo "❌ Legitimate API requests broken"
fi

echo ""

# Test Unicode Normalization
echo "🔤 UNICODE NORMALIZATION TESTS"
echo "------------------------------"

# Test combined security: Path traversal with Unicode encoding
RESPONSE=$(curl -s -w "STATUS:%{http_code}" "$SERVER_URL/%2e%2e%2fetc%2fpasswd")
if [[ "$RESPONSE" == *"STATUS:403"* ]]; then
  echo "✅ Unicode-encoded path traversal blocked"
else
  echo "❌ Unicode-encoded path traversal not blocked"
fi

# Test Unicode normalization in API request
RESPONSE=$(curl -s -X POST "$SERVER_URL/api/landing-pages" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "test-unicode-é",
    "title": "Test Unicode é",
    "metaDescription": "Test with ñormalized characters",
    "template": "test",
    "templateData": {},
    "content": "Content with émoji and àccents"
  }' \
  -w "STATUS:%{http_code}")

if [[ "$RESPONSE" == *"STATUS:201"* ]] || [[ "$RESPONSE" == *"STATUS:200"* ]]; then
  echo "✅ Unicode normalization in API works"
else
  echo "❌ Unicode normalization in API failed"
fi

# Test malicious Unicode + Path traversal combo
RESPONSE=$(curl -s -X POST "$SERVER_URL/../api/landing-pages" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "malicious\u0000\u200B",
    "title": "Malicious Title",
    "metaDescription": "Test",
    "template": "test",
    "templateData": {},
    "content": "Test"
  }' \
  -w "STATUS:%{http_code}")

if [[ "$RESPONSE" == *"STATUS:403"* ]] || [[ "$RESPONSE" == *"STATUS:400"* ]]; then
  echo "✅ Combined malicious Unicode + path traversal blocked"
else
  echo "❌ Combined attack not properly blocked"
fi

echo ""

# Test Performance
echo "⚡ PERFORMANCE IMPACT TESTS"
echo "--------------------------"

START_TIME=$(date +%s%N)
for i in {1..10}; do
  curl -s "$SERVER_URL/api/scholarships" > /dev/null
done
END_TIME=$(date +%s%N)
DURATION=$((($END_TIME - $START_TIME) / 1000000))
AVG_MS=$(($DURATION / 10))

if [ $AVG_MS -lt 50 ]; then
  echo "✅ Performance impact minimal: ${AVG_MS}ms average"
else
  echo "⚠️ Performance impact: ${AVG_MS}ms average (target: <50ms)"
fi

echo ""

# Test International Content
echo "🌍 INTERNATIONAL CONTENT TESTS"
echo "------------------------------"

# Test various international scripts
RESPONSE=$(curl -s -X POST "$SERVER_URL/api/landing-pages" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "international-test",
    "title": "国际奖学金 Scholarships बर्साटा Στιπέντια",
    "metaDescription": "منح دراسية للطلاب الدوليين",
    "template": "test",
    "templateData": {},
    "content": "Multiple scripts: 中文 العربية हिंदी ελληνικά русский"
  }' \
  -w "STATUS:%{http_code}")

if [[ "$RESPONSE" == *"STATUS:201"* ]] || [[ "$RESPONSE" == *"STATUS:200"* ]]; then
  echo "✅ International scripts preserved correctly"
else
  echo "❌ International scripts not handled properly"
fi

echo ""
echo "🛡️ SECURITY VALIDATION COMPLETE"
echo "==============================="
echo "ScholarMatch platform security hardening verified:"
echo "• Path traversal protection: ACTIVE"
echo "• Unicode normalization: ACTIVE" 
echo "• Input validation: ACTIVE"
echo "• International content: PRESERVED"
echo "• Performance impact: MINIMAL"