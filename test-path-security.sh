#!/bin/bash

echo "🔒 TESTING PATH TRAVERSAL SECURITY FIXES"
echo "========================================"

BASE_URL="http://localhost:5000"

# Test 1: Basic directory traversal
echo "TEST 1: Basic directory traversal (../)"
RESPONSE=$(curl -s -w "STATUS:%{http_code}" "$BASE_URL/../../../etc/passwd")
STATUS=$(echo "$RESPONSE" | grep -o "STATUS:[0-9]*" | cut -d: -f2)
if [ "$STATUS" = "403" ]; then
    echo "✅ PASS: Basic traversal blocked (403)"
else
    echo "❌ FAIL: Basic traversal not blocked (Status: $STATUS)"
fi

# Test 2: URL encoded traversal
echo ""
echo "TEST 2: URL encoded traversal (%2e%2e%2f)"
RESPONSE=$(curl -s -w "STATUS:%{http_code}" "$BASE_URL/%2e%2e%2fetc%2fpasswd")
STATUS=$(echo "$RESPONSE" | grep -o "STATUS:[0-9]*" | cut -d: -f2)
if [ "$STATUS" = "403" ]; then
    echo "✅ PASS: URL encoded traversal blocked (403)"
else
    echo "❌ FAIL: URL encoded traversal not blocked (Status: $STATUS)"
fi

# Test 3: Double encoded traversal
echo ""
echo "TEST 3: Double encoded traversal (%252e%252e%252f)"
RESPONSE=$(curl -s -w "STATUS:%{http_code}" "$BASE_URL/%252e%252e%252fpasswd")
STATUS=$(echo "$RESPONSE" | grep -o "STATUS:[0-9]*" | cut -d: -f2)
if [ "$STATUS" = "403" ]; then
    echo "✅ PASS: Double encoded traversal blocked (403)"
else
    echo "❌ FAIL: Double encoded traversal not blocked (Status: $STATUS)"
fi

# Test 4: Windows-style traversal
echo ""
echo "TEST 4: Windows-style traversal (..\\)"
RESPONSE=$(curl -s -w "STATUS:%{http_code}" "$BASE_URL/..\\..\\windows\\system32")
STATUS=$(echo "$RESPONSE" | grep -o "STATUS:[0-9]*" | cut -d: -f2)
if [ "$STATUS" = "403" ]; then
    echo "✅ PASS: Windows traversal blocked (403)"
else
    echo "❌ FAIL: Windows traversal not blocked (Status: $STATUS)"
fi

# Test 5: Null byte injection
echo ""
echo "TEST 5: Null byte injection (..%00)"
RESPONSE=$(curl -s -w "STATUS:%{http_code}" "$BASE_URL/../%00.txt")
STATUS=$(echo "$RESPONSE" | grep -o "STATUS:[0-9]*" | cut -d: -f2)
if [ "$STATUS" = "403" ]; then
    echo "✅ PASS: Null byte injection blocked (403)"
else
    echo "❌ FAIL: Null byte injection not blocked (Status: $STATUS)"
fi

# Test 6: Legitimate requests still work
echo ""
echo "TEST 6: Legitimate API requests still work"
RESPONSE=$(curl -s -w "STATUS:%{http_code}" "$BASE_URL/healthz")
STATUS=$(echo "$RESPONSE" | grep -o "STATUS:[0-9]*" | cut -d: -f2)
if [ "$STATUS" = "200" ]; then
    echo "✅ PASS: Legitimate requests work (200)"
else
    echo "❌ FAIL: Legitimate requests broken (Status: $STATUS)"
fi

# Test 7: System path access
echo ""
echo "TEST 7: System path access (/etc/)"
RESPONSE=$(curl -s -w "STATUS:%{http_code}" "$BASE_URL/etc/passwd")
STATUS=$(echo "$RESPONSE" | grep -o "STATUS:[0-9]*" | cut -d: -f2)
if [ "$STATUS" = "403" ]; then
    echo "✅ PASS: System path access blocked (403)"
else
    echo "❌ FAIL: System path access not blocked (Status: $STATUS)"
fi

# Test 8: Environment file access
echo ""
echo "TEST 8: Environment file access (.env)"
RESPONSE=$(curl -s -w "STATUS:%{http_code}" "$BASE_URL/.env")
STATUS=$(echo "$RESPONSE" | grep -o "STATUS:[0-9]*" | cut -d: -f2)
if [ "$STATUS" = "403" ]; then
    echo "✅ PASS: Environment file access blocked (403)"
else
    echo "❌ FAIL: Environment file access not blocked (Status: $STATUS)"
fi

echo ""
echo "🔒 PATH SECURITY TESTING COMPLETE"
echo "================================="