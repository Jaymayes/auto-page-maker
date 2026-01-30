#!/bin/bash

echo "🌐 TESTING STRICT CORS ENFORCEMENT"
echo "=================================="

SERVER_URL="http://localhost:5000"

# Test 1: Server-to-server request (no Origin header) should work
echo "TEST 1: Server-to-server request (no Origin)"
RESPONSE=$(curl -s -w "STATUS:%{http_code}" "$SERVER_URL/healthz")
if [[ "$RESPONSE" == *"STATUS:200"* ]]; then
  echo "✅ PASS: Server-to-server requests work"
else
  echo "❌ FAIL: Server-to-server requests broken (Status: $(echo $RESPONSE | grep -o 'STATUS:[0-9]*'))"
fi

# Test 2: Allowed origin should work (using localhost:5000 from default config)
echo "TEST 2: Allowed origin request"
RESPONSE=$(curl -s -H "Origin: http://localhost:5000" -w "STATUS:%{http_code}" "$SERVER_URL/healthz")
if [[ "$RESPONSE" == *"STATUS:200"* ]]; then
  echo "✅ PASS: Allowed origin works"
else
  echo "❌ FAIL: Allowed origin blocked (Status: $(echo $RESPONSE | grep -o 'STATUS:[0-9]*'))"
fi

# Test 3: Disallowed origin should be blocked
echo "TEST 3: Disallowed origin blocked"
RESPONSE=$(curl -s -H "Origin: https://malicious-site.com" -w "STATUS:%{http_code}" "$SERVER_URL/healthz")
if [[ "$RESPONSE" == *"STATUS:403"* ]]; then
  echo "✅ PASS: Disallowed origin blocked"
else
  echo "❌ FAIL: Disallowed origin not blocked (Status: $(echo $RESPONSE | grep -o 'STATUS:[0-9]*'))"
fi

# Test 4: OPTIONS preflight from allowed origin
echo "TEST 4: OPTIONS preflight from allowed origin"
RESPONSE=$(curl -s -X OPTIONS -H "Origin: http://localhost:5000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -w "STATUS:%{http_code}" "$SERVER_URL/api/scholarships")
if [[ "$RESPONSE" == *"STATUS:204"* ]]; then
  echo "✅ PASS: OPTIONS preflight from allowed origin works"
else
  echo "❌ FAIL: OPTIONS preflight failed (Status: $(echo $RESPONSE | grep -o 'STATUS:[0-9]*'))"
fi

# Test 5: OPTIONS preflight from disallowed origin
echo "TEST 5: OPTIONS preflight from disallowed origin"
RESPONSE=$(curl -s -X OPTIONS -H "Origin: https://malicious-site.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -w "STATUS:%{http_code}" "$SERVER_URL/api/scholarships")
if [[ "$RESPONSE" == *"STATUS:403"* ]]; then
  echo "✅ PASS: OPTIONS preflight from disallowed origin blocked"
else
  echo "❌ FAIL: OPTIONS preflight not blocked (Status: $(echo $RESPONSE | grep -o 'STATUS:[0-9]*'))"
fi

# Test 6: Check CORS headers are set correctly for allowed origin
echo "TEST 6: CORS headers for allowed origin"
RESPONSE=$(curl -s -I -H "Origin: http://localhost:5000" "$SERVER_URL/healthz")
if [[ "$RESPONSE" == *"Access-Control-Allow-Origin: http://localhost:5000"* ]]; then
  echo "✅ PASS: Correct ACAO header for allowed origin"
else
  echo "❌ FAIL: Missing or incorrect ACAO header"
fi

# Test 7: Verify no CORS headers for disallowed origin
echo "TEST 7: No CORS headers for disallowed origin"
RESPONSE=$(curl -s -I -H "Origin: https://malicious-site.com" "$SERVER_URL/healthz")
if [[ "$RESPONSE" != *"Access-Control-Allow-Origin"* ]]; then
  echo "✅ PASS: No ACAO header for disallowed origin"
else
  echo "❌ FAIL: ACAO header present for disallowed origin"
fi

# Test 8: Verify Vary header is present
echo "TEST 8: Vary header presence"
RESPONSE=$(curl -s -I -H "Origin: http://localhost:5000" "$SERVER_URL/healthz")
if [[ "$RESPONSE" == *"Vary: Origin"* ]]; then
  echo "✅ PASS: Vary header present"
else
  echo "❌ FAIL: Vary header missing"
fi

# Test 9: API endpoint with allowed origin
echo "TEST 9: API endpoint with allowed origin"
RESPONSE=$(curl -s -H "Origin: http://localhost:5000" -w "STATUS:%{http_code}" "$SERVER_URL/api/scholarships")
if [[ "$RESPONSE" == *"STATUS:200"* ]]; then
  echo "✅ PASS: API endpoints work with allowed origin"
else
  echo "❌ FAIL: API endpoints broken with allowed origin (Status: $(echo $RESPONSE | grep -o 'STATUS:[0-9]*'))"
fi

# Test 10: API endpoint with disallowed origin
echo "TEST 10: API endpoint with disallowed origin"
RESPONSE=$(curl -s -H "Origin: https://malicious-site.com" -w "STATUS:%{http_code}" "$SERVER_URL/api/scholarships")
if [[ "$RESPONSE" == *"STATUS:403"* ]]; then
  echo "✅ PASS: API endpoints block disallowed origin"
else
  echo "❌ FAIL: API endpoints allow disallowed origin (Status: $(echo $RESPONSE | grep -o 'STATUS:[0-9]*'))"
fi

echo ""
echo "🌐 CORS SECURITY TESTING COMPLETE"
echo "================================="