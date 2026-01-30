App: scholarship_api | APP_BASE_URL: https://scholarship-api-jamarrlmayes.replit.app

# ⚠️ WRONG WORKSPACE ALERT — scholarship_api planning docs only; no code changes performed

**Workspace Mismatch**: Currently in `auto_page_maker` workspace; cannot execute tests or collect evidence for scholarship_api. This document provides the **test plan and expected evidence** that must be collected once agent is placed in the correct workspace.

---

# Evidence Pack — scholarship_api (Test Plan)

**Report Type**: Test Plan and Expected Evidence Framework  
**Generated**: 2025-11-24 (from auto_page_maker workspace)  
**Status**: PENDING - Requires scholarship_api workspace access  

---

## 1. Health, Version, and Metrics Verification

### Test Plan:

```bash
# Health check
curl -sS -w "\nHTTP:%{http_code} Time:%{time_total}s\n" \
  https://scholarship-api-jamarrlmayes.replit.app/healthz

# Expected output:
# {"status":"ok","db":"connected","uptime_s":12345,"version":"1.0.0"}
# HTTP:200 Time:0.045s

# Version check
curl -sS -w "\nHTTP:%{http_code} Time:%{time_total}s\n" \
  https://scholarship-api-jamarrlmayes.replit.app/version

# Expected output:
# {"version":"1.0.0","git_sha":"abc123","build_time":"2025-11-24T00:00:00Z"}
# HTTP:200 Time:0.042s

# Metrics check (Prometheus format)
curl -sS https://scholarship-api-jamarrlmayes.replit.app/metrics | head -20

# Expected output:
# # HELP http_requests_total Total HTTP requests
# # TYPE http_requests_total counter
# http_requests_total{method="GET",route="/api/v1/scholarships",status="200"} 1234
# ...
```

**Evidence to Collect**:
- ✓ All three endpoints return 200
- ✓ Response times < 100ms
- ✓ Version includes git SHA and build timestamp
- ✓ Metrics include per-route histograms

---

## 2. Public Scholarship Data (No Auth, CORS Enabled)

### Test Plan:

```bash
# Scholarship search with filters
curl -sS -w "\nHTTP:%{http_code} Time:%{time_total}s\n" \
  "https://scholarship-api-jamarrlmayes.replit.app/api/v1/scholarships?search=STEM&state=CA&page=1&per_page=20&sort=deadline&order=asc"

# Expected output:
# {
#   "data": [
#     {"id":"abc","title":"Computer Science Scholarship","amount":5000,"deadline":"2025-12-01",...},
#     ...
#   ],
#   "page":1,
#   "per_page":20,
#   "total":156,
#   "next_page_url":"...page=2",
#   "prev_page_url":null
# }
# HTTP:200 Time:0.095s

# Scholarship detail
curl -sS -w "\nHTTP:%{http_code} Time:%{time_total}s\n" \
  https://scholarship-api-jamarrlmayes.replit.app/api/v1/scholarships/SCHOLARSHIP_ID

# Expected output:
# {
#   "id":"SCHOLARSHIP_ID",
#   "title":"...",
#   "description":"...",
#   "amount":5000,
#   "deadline":"2025-12-01",
#   "eligibility":["GPA >= 3.0","Enrolled in CS program"],
#   ...
# }
# HTTP:200 Time:0.078s
```

### P95 Latency Test (20+ samples):

```bash
# Run 50 requests and measure P95
for i in {1..50}; do
  curl -sS -w "%{time_total}\n" -o /dev/null \
    "https://scholarship-api-jamarrlmayes.replit.app/api/v1/scholarships?search=test&page=1&per_page=20"
done | sort -n | awk '{all[NR] = $0} END{print "P95:", all[int(NR*0.95)]}'

# Expected P95: ≤ 0.120 seconds (120ms target)
```

### CORS Preflight Test:

```bash
# Test allowed origin (auto_page_maker)
curl -sS -X OPTIONS \
  -H "Origin: https://auto-page-maker-jamarrlmayes.replit.app" \
  -H "Access-Control-Request-Method: GET" \
  https://scholarship-api-jamarrlmayes.replit.app/api/v1/scholarships

# Expected headers in response:
# access-control-allow-origin: https://auto-page-maker-jamarrlmayes.replit.app
# access-control-allow-methods: GET, POST, OPTIONS
# HTTP:204 or 200

# Test denied origin
curl -sS -X OPTIONS \
  -H "Origin: https://malicious-site.com" \
  -H "Access-Control-Request-Method: GET" \
  https://scholarship-api-jamarrlmayes.replit.app/api/v1/scholarships

# Expected: No access-control-allow-origin header OR explicit deny
```

**Evidence to Collect**:
- ✓ Search endpoint returns paginated results with filters
- ✓ Detail endpoint returns full scholarship object
- ✓ P95 latency ≤ 120ms (50-sample test)
- ✓ CORS allows all 8 app origins
- ✓ CORS denies non-allowlisted origins

---

## 3. Credits Ledger - Authentication Tests

### Test Plan:

```bash
# Get a valid JWT from scholar_auth (assume M2M flow)
export VALID_JWT="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." # (masked)
export INVALID_JWT="invalid.token.here"

# Test 401 - No token
curl -sS -w "\nHTTP:%{http_code}\n" \
  https://scholarship-api-jamarrlmayes.replit.app/api/v1/credits/balance?user_id=test-user

# Expected: HTTP:401 Unauthorized

# Test 401 - Invalid token
curl -sS -w "\nHTTP:%{http_code}\n" \
  -H "Authorization: Bearer $INVALID_JWT" \
  https://scholarship-api-jamarrlmayes.replit.app/api/v1/credits/balance?user_id=test-user

# Expected: HTTP:401 Unauthorized

# Test 200 - Valid token
curl -sS -w "\nHTTP:%{http_code} Time:%{time_total}s\n" \
  -H "Authorization: Bearer $VALID_JWT" \
  https://scholarship-api-jamarrlmayes.replit.app/api/v1/credits/balance?user_id=test-user

# Expected:
# {"user_id":"test-user","balance":0,"updated_at":"2025-11-24T..."}
# HTTP:200 Time:0.085s
```

**Evidence to Collect**:
- ✓ 401 without token
- ✓ 401 with invalid/expired token
- ✓ 200 with valid RS256 JWT from scholar_auth

---

## 4. Credits Ledger - Credit/Debit Operations

### Test Plan:

```bash
# Test POST /credits/credit (grant credits)
curl -sS -w "\nHTTP:%{http_code} Time:%{time_total}s\n" \
  -X POST \
  -H "Authorization: Bearer $VALID_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test-user",
    "amount":100,
    "reason":"test_grant",
    "source":"test_suite",
    "reference_id":"ref-001",
    "idempotency_key":"idem-001"
  }' \
  https://scholarship-api-jamarrlmayes.replit.app/api/v1/credits/credit

# Expected:
# {"user_id":"test-user","new_balance":100,"ledger_entry_id":"led-001"}
# HTTP:201 Time:0.145s

# Test idempotency (same request again)
curl -sS -w "\nHTTP:%{http_code}\n" \
  -X POST \
  -H "Authorization: Bearer $VALID_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test-user",
    "amount":100,
    "reason":"test_grant",
    "source":"test_suite",
    "reference_id":"ref-001",
    "idempotency_key":"idem-001"
  }' \
  https://scholarship-api-jamarrlmayes.replit.app/api/v1/credits/credit

# Expected:
# {"user_id":"test-user","new_balance":100,"ledger_entry_id":"led-001"}
# HTTP:201 (same response, no double-credit)

# Test POST /credits/debit (spend credits)
curl -sS -w "\nHTTP:%{http_code} Time:%{time_total}s\n" \
  -X POST \
  -H "Authorization: Bearer $VALID_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test-user",
    "amount":25,
    "reason":"ai_match",
    "source":"scholarship_sage",
    "reference_id":"match-001",
    "idempotency_key":"idem-002"
  }' \
  https://scholarship-api-jamarrlmayes.replit.app/api/v1/credits/debit

# Expected:
# {"user_id":"test-user","new_balance":75,"ledger_entry_id":"led-002"}
# HTTP:201 Time:0.152s

# Test insufficient funds (debit 100 when balance is 75)
curl -sS -w "\nHTTP:%{http_code}\n" \
  -X POST \
  -H "Authorization: Bearer $VALID_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test-user",
    "amount":100,
    "reason":"ai_match",
    "source":"test",
    "reference_id":"fail-001",
    "idempotency_key":"idem-003"
  }' \
  https://scholarship-api-jamarrlmayes.replit.app/api/v1/credits/debit

# Expected:
# {"error":"INSUFFICIENT_FUNDS","balance":75,"required":100}
# HTTP:409 Conflict

# Verify final balance
curl -sS -w "\nHTTP:%{http_code}\n" \
  -H "Authorization: Bearer $VALID_JWT" \
  https://scholarship-api-jamarrlmayes.replit.app/api/v1/credits/balance?user_id=test-user

# Expected:
# {"user_id":"test-user","balance":75,"updated_at":"..."}
# HTTP:200
```

**Evidence to Collect**:
- ✓ Credit operation increases balance
- ✓ Idempotency prevents double-credit
- ✓ Debit operation decreases balance
- ✓ Insufficient funds returns 409 with clear error
- ✓ Balance query reflects accurate state

---

## 5. Performance Snapshot

### Test Plan:

```bash
# Collect P95 latency for each endpoint type
# (Run 50 samples per endpoint, calculate P95)

# Read endpoints: /scholarships, /scholarships/:id, /credits/balance
# Target: P95 ≤ 120ms

# Write endpoints: /credits/credit, /credits/debit
# Target: P95 ≤ 200ms

# Generate histogram data and export to metrics
```

**Evidence to Collect**:
- ✓ P95 latency table per endpoint
- ✓ Histogram showing distribution
- ✓ Compliance statement (PASS/FAIL vs. targets)

---

## 6. JWKS Integration

### Test Plan:

```bash
# Verify JWKS fetch from scholar_auth
curl -sS https://scholar-auth-jamarrlmayes.replit.app/.well-known/jwks.json

# Expected:
# {"keys":[{"kty":"RSA","kid":"key-001","use":"sig","alg":"RS256","n":"...","e":"AQAB"}]}

# Log evidence of:
# - JWKS cached on startup
# - Token validation using fetched public key
# - Key rotation support (cache TTL < 24h)
```

**Evidence to Collect**:
- ✓ JWKS fetch succeeds
- ✓ RS256 signature validation works
- ✓ Cache refresh logic documented

---

## 7. Rate Limiting

### Test Plan:

```bash
# Test public endpoint rate limit (60 rpm per IP)
for i in {1..65}; do
  curl -sS -w "HTTP:%{http_code}\n" -o /dev/null \
    https://scholarship-api-jamarrlmayes.replit.app/api/v1/scholarships?page=1
  sleep 0.5
done | grep -c "429"

# Expected: At least 5 requests return HTTP:429

# Verify Retry-After header present on 429
curl -sS -I https://scholarship-api-jamarrlmayes.replit.app/api/v1/scholarships?page=1
# (after triggering rate limit)

# Expected header:
# retry-after: 30
```

**Evidence to Collect**:
- ✓ Rate limit triggers at expected threshold
- ✓ 429 response includes Retry-After header
- ✓ Rate limit resets after window

---

## 8. Integration Verification Matrix

### Test Plan:

| App | Test Scenario | Expected Result | Status |
|-----|---------------|----------------|--------|
| **auto_page_maker** | Fetch 20 scholarships for SEO page | 200 OK, <120ms, CORS allowed | PENDING |
| **student_pilot** | Check balance, debit 10 credits | 200 OK, balance decreases by 10 | PENDING |
| **scholarship_sage** | Debit 25 credits for AI match | 201 Created, balance reflects debit | PENDING |
| **provider_register** | Credit 50 credits after payment | 201 Created, balance increases by 50 | PENDING |
| **auto_com_center** | Receive webhook on credit event | Event delivered with user_id, amount | PENDING |

**Evidence to Collect**:
- ✓ Screenshots or logs from each integration test
- ✓ End-to-end flow: payment → credit → debit → notification
- ✓ All 5 apps confirm successful integration

---

## Summary of Required Evidence

Once agent is placed in scholarship_api workspace, collect:

1. ✓ Health/version/metrics outputs
2. ✓ Public scholarship search + detail (50-sample P95)
3. ✓ CORS preflight PASS/FAIL tests
4. ✓ JWT validation (401/200 tests)
5. ✓ Credit/debit operations with idempotency
6. ✓ Insufficient funds error handling
7. ✓ Rate limit behavior (429 + Retry-After)
8. ✓ JWKS fetch and caching
9. ✓ Integration verification with 5 apps
10. ✓ Performance histogram (P95/P99 per endpoint)

**Estimated Evidence Collection Time**: 1-2 hours after implementation complete

---

**Document Generated From**: auto_page_maker workspace (test plan only)  
**Tests Executed**: NONE (workspace mismatch)  
**Next Action**: Transfer to scholarship_api workspace and execute test suite
