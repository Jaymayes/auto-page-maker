# scholarship_api v2.7 Production Deployment Runbook

**DRI**: API Lead  
**Deadline**: T+30 minutes  
**Objective**: Deploy /canary v2.7 and achieve Gate 2 GREEN

---

## GATE 2 ACCEPTANCE CRITERIA

✅ /canary returns exact 8-field v2.7 schema  
✅ version == "v2.7"  
✅ dependencies_ok == true  
✅ 6/6 security headers present  
✅ Protected routes return 401/403 with invalid/missing JWT  

---

## CRITICAL CONTEXT: MONOLITH ARCHITECTURE

**scholarship_api is part of the MONOLITH.** Same deployment as scholar_auth.

- Repository: workspace.jamarrlmayes.replit.app
- Deployment: Single codebase serves ALL 8 apps
- Routing: `scholarship-api-*.replit.app` returns `app="scholarship_api"`

**This means:** Deploying workspace deploys scholarship_api automatically.

---

## PRE-DEPLOYMENT CHECKLIST

**Code Status (Already Implemented):**
- ✅ /canary v2.7: Exact 8-field schema implemented
- ✅ Security headers: All 6 configured via Helmet middleware
- ✅ JWT validation: isAuthenticated middleware active
- ✅ RBAC: Protected routes require valid JWT
- ✅ Input validation: Zod schemas on all POST/PUT/PATCH
- ✅ Error handling: Standardized JSON error responses

**Files Modified:**
- `server/index.ts` - /canary v2.7 handler (lines 83-168)
- `server/routes.ts` - API routes with auth middleware
- `server/replitAuth.ts` - JWT validation against scholar_auth JWKS

---

## DEPLOYMENT STEPS

### Option A: Auto-Deploy Verification (Fastest - 2 minutes)

**1. Check Current Production:**
```bash
curl -s https://scholarship-api-jamarrlmayes.replit.app/canary | jq .
```

**Expected Output (If Already Deployed):**
```json
{
  "app": "scholarship_api",
  "app_base_url": "https://scholarship-api-jamarrlmayes.replit.app",
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

**If correct:** ✅ Gate 2 GREEN, proceed to RBAC verification.

---

### Option B: Force Production Rebuild (5-10 minutes)

**If production shows old schema or wrong version:**

1. Navigate to Replit workspace
2. Deployments → "Publish" (or "Redeploy")
3. Wait for deployment (~3-5 min)
4. Verify canary endpoint

---

## VERIFICATION (Gate 2 Checklist)

### 1. Canary Schema Validation

```bash
# Fetch canary response
curl -s https://scholarship-api-jamarrlmayes.replit.app/canary | jq .
```

**Checklist (Exact 8 fields):**
- ✅ `app` == "scholarship_api"
- ✅ `app_base_url` == "https://scholarship-api-jamarrlmayes.replit.app"
- ✅ `version` == "v2.7"
- ✅ `status` == "ok" or "degraded"
- ✅ `p95_ms` (number, preferably ≤120)
- ✅ `security_headers` (object with "present" and "missing" arrays)
- ✅ `dependencies_ok` (boolean)
- ✅ `timestamp` (ISO 8601 string)

**Validation Script:**
```bash
canary=$(curl -s https://scholarship-api-jamarrlmayes.replit.app/canary)
echo "$canary" | jq -e '.version == "v2.7"' && echo "✅ Version correct" || echo "❌ Wrong version"
echo "$canary" | jq -e '.dependencies_ok == true' && echo "✅ Dependencies OK" || echo "❌ Dependencies degraded"
echo "$canary" | jq -e '.security_headers.present | length == 6' && echo "✅ 6/6 headers" || echo "❌ Missing headers"
```

---

### 2. Security Headers Validation

```bash
# Check HTTP response headers
curl -I https://scholarship-api-jamarrlmayes.replit.app/canary
```

**Required Headers (6/6):**
- ✅ Strict-Transport-Security
- ✅ Content-Security-Policy
- ✅ X-Frame-Options
- ✅ X-Content-Type-Options
- ✅ Referrer-Policy
- ✅ Permissions-Policy

---

### 3. RBAC Validation (Protected Routes)

**Test 1: Unauthenticated Access**
```bash
# Should return 401 Unauthorized
curl -s https://scholarship-api-jamarrlmayes.replit.app/api/auth/user
```

**Expected Response:**
```json
{
  "message": "Unauthorized"
}
```
**Status:** 401

---

**Test 2: Invalid JWT**
```bash
# Should return 401 Unauthorized
curl -H "Authorization: Bearer invalid.jwt.token" \
  https://scholarship-api-jamarrlmayes.replit.app/api/auth/user
```

**Expected:** 401 or 403 (depending on validation stage)

---

**Test 3: Public Endpoints (No Auth Required)**
```bash
# Should return 200 OK
curl -s https://scholarship-api-jamarrlmayes.replit.app/api/scholarships?limit=5
```

**Expected:** 200 with array of 5 scholarships

---

### 4. Input Validation Test

**Test: Invalid POST data**
```bash
# Missing required fields - should return 400
curl -X POST https://scholarship-api-jamarrlmayes.replit.app/api/scholarships \
  -H "Content-Type: application/json" \
  -d '{"invalid": "data"}'
```

**Expected Response:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Required",
    "request_id": "..."
  },
  "status": 400
}
```

---

### 5. Performance Validation (30-sample P95)

```bash
# Collect 30 samples
for i in {1..30}; do
  curl -s -w '%{time_total}\n' -o /dev/null \
    https://scholarship-api-jamarrlmayes.replit.app/canary
  sleep 0.1
done | sort -n | awk 'NR==29 {printf "P95: %.0f ms\n", $1*1000}'
```

**Acceptance:** P95 ≤ 120ms  
**Warning Threshold:** P95 > 120ms but ≤ 250ms (monitor closely)  
**Critical:** P95 > 250ms (requires immediate optimization)

---

### 6. Dependencies Health Check

```bash
# Check dependencies_ok field
curl -s https://scholarship-api-jamarrlmayes.replit.app/canary | jq '.dependencies_ok'
```

**Expected:** `true`

**If false:** Check database connectivity and health
```bash
# Test database endpoint
curl -s https://scholarship-api-jamarrlmayes.replit.app/api/scholarships?limit=1
```

Should return scholarship data, not error.

---

## TROUBLESHOOTING

### Problem: Wrong version (not v2.7)

**Cause:** Old code deployed  
**Fix:** Force rebuild (Option B)

### Problem: Missing security_headers field

**Cause:** Old v2.6 schema  
**Fix:** Redeploy, verify server/index.ts lines 148-157

### Problem: dependencies_ok == false

**Cause:** Database connection issue  
**Fix:**
1. Check DATABASE_URL environment variable
2. Verify PostgreSQL connection
3. Check logs for connection errors
4. Restart database if needed

### Problem: 401/403 not working (unprotected routes)

**Cause:** Missing isAuthenticated middleware  
**Fix:** Verify server/routes.ts protected routes use isAuthenticated

### Problem: CORS errors in browser console

**Cause:** Missing origins in allowlist  
**Fix:** Verify server/index.ts CORS config includes all 8 platform origins

---

## GATE 2 SUCCESS CRITERIA (Report to CEO)

```
GATE 2 STATUS: GREEN

Canary Schema Verification:
✅ curl https://scholarship-api-jamarrlmayes.replit.app/canary | jq .
   Output: v2.7, 8 fields exactly, app="scholarship_api"

Security Headers:
✅ curl -I https://scholarship-api-jamarrlmayes.replit.app/canary
   Output: All 6 security headers present

RBAC Validation:
✅ Unauthenticated GET /api/auth/user → 401 Unauthorized
✅ Invalid JWT → 401/403
✅ Public endpoints accessible without auth

Input Validation:
✅ Invalid POST data → 400 with standardized error JSON

Performance:
✅ P95 = <X>ms (target ≤120ms)

Dependencies:
✅ dependencies_ok = true
✅ Database queries successful

Gate 2 Status: GREEN - Ready for E2E testing
```

---

## DEPENDENCIES FOR GATE 3 (student_pilot)

**After Gate 2 is GREEN:**
- student_pilot can fetch scholarships via /api/scholarships
- Authentication flow validated via /api/auth/user
- RBAC protects sensitive operations

**Next Step:** Frontend Lead proceeds with student_pilot E2E smoke test

---

## EMERGENCY CONTACTS

**If deployment fails:** Escalate to CEO immediately  
**Timeline:** T+30 minutes deadline (strict)  
**Blocker Impact:** Gates 1 & 2 are required for Gate 3 (student_pilot)

---

**END OF RUNBOOK**
