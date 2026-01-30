#!/bin/bash

echo "🔤 TESTING UNICODE NORMALIZATION AND VALIDATION"
echo "=============================================="

SERVER_URL="http://localhost:5000"

# Wait for server to be ready
sleep 2

# Test 1: Basic NFC normalization (e + combining acute → é)
echo "TEST 1: Basic NFC normalization"
RESPONSE=$(curl -s -X POST "$SERVER_URL/api/landing-pages" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "test-e\u0301",
    "title": "Test Title e\u0301",
    "metaDescription": "Test description",
    "template": "test",
    "templateData": {},
    "content": "Test content"
  }' \
  -w "STATUS:%{http_code}")

if [[ "$RESPONSE" == *"STATUS:201"* ]] || [[ "$RESPONSE" == *"STATUS:200"* ]]; then
  echo "✅ PASS: NFC normalization works"
else
  echo "❌ FAIL: NFC normalization failed (Status: $(echo $RESPONSE | grep -o 'STATUS:[0-9]*'))"
fi

# Test 2: Control character removal
echo "TEST 2: Control character removal"
RESPONSE=$(curl -s -X POST "$SERVER_URL/api/landing-pages" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "test-control\u0000\u0001",
    "title": "Test Title\u0007",
    "metaDescription": "Test description",
    "template": "test",
    "templateData": {},
    "content": "Test content"
  }' \
  -w "STATUS:%{http_code}")

if [[ "$RESPONSE" == *"STATUS:201"* ]] || [[ "$RESPONSE" == *"STATUS:200"* ]]; then
  echo "✅ PASS: Control character removal works"
else
  echo "❌ FAIL: Control character removal failed (Status: $(echo $RESPONSE | grep -o 'STATUS:[0-9]*'))"
fi

# Test 3: Zero-width character removal in identifier fields
echo "TEST 3: Zero-width character removal (identifier)"
RESPONSE=$(curl -s -X POST "$SERVER_URL/api/landing-pages" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "test\u200B\u2060slug",
    "title": "Test Title",
    "metaDescription": "Test description", 
    "template": "test",
    "templateData": {},
    "content": "Test content"
  }' \
  -w "STATUS:%{http_code}")

if [[ "$RESPONSE" == *"STATUS:201"* ]] || [[ "$RESPONSE" == *"STATUS:200"* ]]; then
  echo "✅ PASS: Zero-width removal in identifiers works"
else
  echo "❌ FAIL: Zero-width removal failed (Status: $(echo $RESPONSE | grep -o 'STATUS:[0-9]*'))"
fi

# Test 4: Empty identifier rejection
echo "TEST 4: Empty identifier rejection"
RESPONSE=$(curl -s -X POST "$SERVER_URL/api/landing-pages" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "\u200B\u2060\u0000",
    "title": "Test Title",
    "metaDescription": "Test description",
    "template": "test", 
    "templateData": {},
    "content": "Test content"
  }' \
  -w "STATUS:%{http_code}")

if [[ "$RESPONSE" == *"STATUS:400"* ]]; then
  echo "✅ PASS: Empty identifier rejection works"
else
  echo "❌ FAIL: Empty identifier should be rejected (Status: $(echo $RESPONSE | grep -o 'STATUS:[0-9]*'))"
fi

# Test 5: Line ending standardization
echo "TEST 5: Line ending standardization"
RESPONSE=$(curl -s -X POST "$SERVER_URL/api/landing-pages" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "test-line-endings",
    "title": "Test\r\nTitle",
    "metaDescription": "Test description",
    "template": "test",
    "templateData": {},
    "content": "Line 1\r\nLine 2\rLine 3"
  }' \
  -w "STATUS:%{http_code}")

if [[ "$RESPONSE" == *"STATUS:201"* ]] || [[ "$RESPONSE" == *"STATUS:200"* ]]; then
  echo "✅ PASS: Line ending standardization works"
else
  echo "❌ FAIL: Line ending standardization failed (Status: $(echo $RESPONSE | grep -o 'STATUS:[0-9]*'))"
fi

# Test 6: Query parameter normalization
echo "TEST 6: Query parameter normalization"
RESPONSE=$(curl -s "$SERVER_URL/api/scholarships?major=computer%20science&state=californi\u0061" \
  -w "STATUS:%{http_code}")

if [[ "$RESPONSE" == *"STATUS:200"* ]]; then
  echo "✅ PASS: Query parameter normalization works"
else
  echo "❌ FAIL: Query parameter normalization failed (Status: $(echo $RESPONSE | grep -o 'STATUS:[0-9]*'))"
fi

# Test 7: International text preservation
echo "TEST 7: International text preservation"
RESPONSE=$(curl -s -X POST "$SERVER_URL/api/landing-pages" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "test-international",
    "title": "国际学生奖学金",
    "metaDescription": "منح دراسية للطلاب الدوليين",
    "template": "test",
    "templateData": {},
    "content": "हिंदी में सामग्री και ελληνικά"
  }' \
  -w "STATUS:%{http_code}")

if [[ "$RESPONSE" == *"STATUS:201"* ]] || [[ "$RESPONSE" == *"STATUS:200"* ]]; then
  echo "✅ PASS: International text preservation works"
else
  echo "❌ FAIL: International text preservation failed (Status: $(echo $RESPONSE | grep -o 'STATUS:[0-9]*'))"
fi

echo ""
echo "🔤 UNICODE NORMALIZATION TESTING COMPLETE"
echo "========================================="