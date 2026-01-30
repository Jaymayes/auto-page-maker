# Gate 1: scholar_auth Republish Instructions - CORRECTED

**CEO Deadline:** 15 minutes  
**DRI:** Human Ops (Auth DRI)  
**Status:** CRITICAL PATH - Code corrections deployed, ready for republish

---

## CRITICAL CORRECTION APPLIED

**Previous Error (FIXED):** Agent3 incorrectly configured CORS for single hostname. This has been corrected.

**Current Status (VERIFIED in logs):**
```
CORS allowlist: https://scholar-auth-jamarrlmayes.replit.app, 
https://scholarship-api-jamarrlmayes.replit.app, 
https://scholarship-agent-jamarrlmayes.replit.app, 
https://scholarship-sage-jamarrlmayes.replit.app, 
https://student-pilot-jamarrlmayes.replit.app, 
https://provider-register-jamarrlmayes.replit.app, 
https://auto-page-maker-jamarrlmayes.replit.app, 
https://auto-com-center-jamarrlmayes.replit.app
```

✅ **All 8 subdomain URLs are now in CORS allowlist**

---

## Immediate Republish Actions (NOW)

### 1. scholar-auth Republish

**Production URL:** `https://scholar-auth-jamarrlmayes.replit.app`

**Actions:**
1. Navigate to the scholar-auth Replit project
2. Click "Publish" button
3. Wait 2-3 minutes for deployment
4. Run acceptance tests below

### 2. auto-com-center Republish

**Production URL:** `https://auto-com-center-jamarrlmayes.replit.app`

**Actions:**
1. Navigate to the auto-com-center Replit project
2. Click "Publish" button
3. Wait 2-3 minutes for deployment
4. Run compliance endpoint tests below

---

## Gate 1 Acceptance Tests - scholar_auth

**All tests must use PUBLIC URL:** `https://scholar-auth-jamarrlmayes.replit.app`

### Test 1: Canary Endpoint
```bash
curl -s https://scholar-auth-jamarrlmayes.replit.app/canary | jq '.'
```

**Expected Output:**
```json
{
  "app": "scholar_auth",
  "app_base_url": "https://scholar-auth-jamarrlmayes.replit.app",
  "version": "v2.7",
  "status": "ok",
  "p95_ms": <number>,
  "security_headers": {
    "present": ["strict-transport-security", "content-security-policy", "x-frame-options", "x-content-type-options", "referrer-policy", "permissions-policy"],
    "missing": []
  },
  "dependencies_ok": true,
  "timestamp": "2025-11-01T..."
}
```

**Critical Checks:**
- ✅ `security_headers.present` has 6 items
- ✅ `security_headers.missing` is empty
- ✅ `dependencies_ok` is `true`
- ✅ `app_base_url` matches public URL

### Test 2: JWKS Endpoint
```bash
curl -s https://scholar-auth-jamarrlmayes.replit.app/.well-known/jwks.json | jq '.keys[0]'
```

**Expected:** Valid JWK with `kid`, `kty`, `use`, `alg`, `n`, `e` fields

**Alternative JWKS path:**
```bash
curl -s https://scholar-auth-jamarrlmayes.replit.app/jwks.json | jq '.keys[0]'
```

### Test 3: Health Endpoint
```bash
curl -s https://scholar-auth-jamarrlmayes.replit.app/healthz | jq '.'
```

**Expected:**
```json
{
  "healthy": true,
  "timestamp": "2025-11-01T...",
  "uptime": <number>
}
```

### Test 4: Auth Endpoints Reachable

```bash
# Login
curl -I https://scholar-auth-jamarrlmayes.replit.app/login

# Register  
curl -I https://scholar-auth-jamarrlmayes.replit.app/register

# Logout
curl -I https://scholar-auth-jamarrlmayes.replit.app/logout

# Token Refresh
curl -I https://scholar-auth-jamarrlmayes.replit.app/token/refresh
```

**Expected:** All return HTTP 200, 302, or 401 (not 404)

### Test 5: RBAC Roles in JWT

**Manual test (requires browser):**
1. Navigate to https://scholar-auth-jamarrlmayes.replit.app/login
2. Complete login flow
3. Open Browser DevTools → Application → Cookies or Local Storage
4. Find JWT token
5. Decode at jwt.io
6. Verify `roles` claim contains one of: `Student`, `Provider`, `Admin`, `SystemService`

### Test 6: CORS Allowlist

```bash
# Test unauthorized origin (should block)
curl -v -H "Origin: https://malicious-site.com" \
  https://scholar-auth-jamarrlmayes.replit.app/api/health 2>&1 | grep "403"
```

**Expected:** 403 Forbidden

```bash
# Test authorized origin (should allow)
curl -v -H "Origin: https://student-pilot-jamarrlmayes.replit.app" \
  https://scholar-auth-jamarrlmayes.replit.app/healthz 2>&1 | grep "Access-Control-Allow-Origin"
```

**Expected:** `Access-Control-Allow-Origin: https://student-pilot-jamarrlmayes.replit.app`

### Test 7: Rate Limiting Active

```bash
# Burst 20 requests rapidly
for i in {1..20}; do 
  curl -s https://scholar-auth-jamarrlmayes.replit.app/healthz > /dev/null
done
```

**Expected:** Some requests return 429 Too Many Requests

### Test 8: Performance Baseline

```bash
# Warm P95 target: ≤ 200ms (will trend to ≤ 120ms over 72h)
curl -w "\nTime: %{time_total}s\n" -s https://scholar-auth-jamarrlmayes.replit.app/canary -o /dev/null
```

**Run 30 times and calculate P95**

### Test 9: Security Headers Present

```bash
curl -I https://scholar-auth-jamarrlmayes.replit.app/healthz | grep -i "strict-transport-security\|content-security-policy\|x-frame-options\|x-content-type-options\|referrer-policy\|permissions-policy"
```

**Expected:** All 6 headers present in response

---

## auto_com_center Compliance Tests

**Production URL:** `https://auto-com-center-jamarrlmayes.replit.app`

### Test 1: Unsubscribe Endpoint (POST)
```bash
curl -X POST https://auto-com-center-jamarrlmayes.replit.app/api/unsubscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}' | jq '.'
```

**Expected:** 200 OK with confirmation payload

### Test 2: Unsubscribe Confirmation Page (GET)
```bash
curl https://auto-com-center-jamarrlmayes.replit.app/api/unsubscribe?email=test@example.com
```

**Expected:** HTML confirmation page (200 OK)

### Test 3: Suppression List (RBAC Protected)
```bash
# Without auth (should fail)
curl -I https://auto-com-center-jamarrlmayes.replit.app/api/suppression-list
```

**Expected:** 401 Unauthorized or 403 Forbidden

**With Admin JWT:**
```bash
curl -H "Authorization: Bearer <ADMIN_JWT>" \
  https://auto-com-center-jamarrlmayes.replit.app/api/suppression-list | jq '.'
```

**Expected:** 200 OK with suppression list schema

### Test 4: DRY-RUN Mode Verified
```bash
curl https://auto-com-center-jamarrlmayes.replit.app/canary | jq '.dry_run_mode'
```

**Expected:** `true` or environment variable `DISABLE_SEND=true` confirmed

### Test 5: Queue Health
```bash
curl https://auto-com-center-jamarrlmayes.replit.app/api/queue/stats | jq '.'
```

**Expected:** No dead-letter growth, P95 < 10ms

---

## Success Criteria (All Must Pass)

**scholar_auth:**
- [ ] Canary returns 8 fields, 6/6 security headers, dependencies_ok=true
- [ ] JWKS endpoint returns valid key
- [ ] Health endpoint returns healthy=true
- [ ] Login/register/logout/token-refresh reachable (not 404)
- [ ] JWT contains RBAC roles (Student/Provider/Admin/SystemService)
- [ ] CORS blocks unauthorized origins, allows student_pilot
- [ ] Rate limiting active
- [ ] P95 ≤ 200ms (warm, trending to ≤ 120ms)
- [ ] 6/6 security headers present

**auto_com_center:**
- [ ] POST /api/unsubscribe returns 200
- [ ] GET /api/unsubscribe serves HTML
- [ ] GET /api/suppression-list requires RBAC (401/403 without auth)
- [ ] DRY-RUN mode confirmed (DISABLE_SEND=true)
- [ ] Queue healthy, no dead letters
- [ ] 6/6 security headers present

---

## If Tests Fail

**Escalation Path:**

1. **First 5 minutes:** Retry failed tests (may be warmup delay)
2. **5-10 minutes:** Check Replit deployment logs for errors
3. **10-15 minutes:** Escalate to Platform Lead
4. **15+ minutes:** CEO decision on fallback/rollback

**Possible Issues:**
- **404 on /canary:** Deployment incomplete, wait 1-2 minutes
- **JWKS empty:** Key generation failed, check logs
- **CORS errors:** Allowlist not applied, verify code deployed
- **High latency:** Cold start, run warmup requests

---

## Post-GREEN Actions

**IMMEDIATELY after Gate 1 GREEN:**

1. **Post evidence to war room:**
   - All 9 acceptance test outputs
   - Canary JSON response
   - JWKS key data (KID only, not private key)
   - Performance baseline (30 samples)

2. **Notify DRIs:**
   - student_pilot DRI: Begin E2E validation (T+0 to T+120)
   - scholarship_sage DRI: Prepare recommendation capture
   - scholarship_api DRI: Begin performance monitoring

3. **Update Section 7 reports:**
   - scholar_auth: Production verified
   - auto_com_center: Compliance endpoints verified, DRY-RUN confirmed

---

## Timeline

- **T+0 (NOW):** Click "Publish" for scholar-auth and auto-com-center
- **T+3 min:** Deployments live
- **T+5 min:** Run acceptance tests
- **T+10 min:** Post GREEN evidence
- **T+15 min:** Gate 1 GREEN declared, E2E begins

**If not GREEN by T+15:** Escalate immediately

---

## Evidence Bundle Template

```
GATE 1 GREEN - scholar_auth + auto_com_center

Timestamp: 2025-11-01T[TIME]
URLs:
  - scholar-auth: https://scholar-auth-jamarrlmayes.replit.app
  - auto-com-center: https://auto-com-center-jamarrlmayes.replit.app

scholar_auth Acceptance:
✅ Canary: 8/8 fields, 6/6 security headers
✅ JWKS: KID [paste KID here]
✅ Health: healthy=true
✅ Auth endpoints: all reachable
✅ RBAC: roles in JWT
✅ CORS: restricted to allowlist
✅ Rate limit: active
✅ P95: [value]ms (≤200ms target met)
✅ Security headers: 6/6

auto_com_center Compliance:
✅ POST /api/unsubscribe: 200 OK
✅ GET /api/unsubscribe: HTML served
✅ GET /api/suppression-list: RBAC enforced
✅ DRY-RUN: confirmed
✅ Queue: healthy, P95=[value]ms
✅ Security headers: 6/6

Artifacts:
- [Link to canary responses]
- [Link to performance data]
- [Link to JWKS output]
```

---

**REPUBLISH NOW - 15-MINUTE CEO DEADLINE ACTIVE**
