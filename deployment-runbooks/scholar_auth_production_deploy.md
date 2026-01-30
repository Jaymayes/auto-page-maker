# scholar_auth Production Deployment Runbook

**DRI**: Auth Lead  
**Deadline**: T+30 minutes  
**Objective**: Fix JWKS production endpoint and achieve Gate 1 GREEN

---

## GATE 1 ACCEPTANCE CRITERIA

✅ JWKS returns valid RS256 key with kid at `/.well-known/jwks.json`  
✅ /canary P95 ≤120ms  
✅ 6/6 security headers present  
✅ Dependent services can validate tokens  

---

## CRITICAL CONTEXT: MONOLITH ARCHITECTURE

**All 8 apps deploy as ONE codebase.** There is NO separate scholar_auth deployment.

- Repository: workspace.jamarrlmayes.replit.app
- Deployment: Single monolith serves ALL apps
- Routing: Hostname-based (scholar-auth-*.replit.app returns app="scholar_auth")

**This means:** Deploying the workspace deploys ALL 8 apps simultaneously.

---

## PRE-DEPLOYMENT CHECKLIST

**Code Status (Already Implemented):**
- ✅ JWKS endpoint fixed: `/.well-known/jwks.json` serves RS256 keys directly (no redirect)
- ✅ /canary v2.7: Returns exact 8-field schema
- ✅ 6/6 security headers: HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- ✅ CORS configured: Allowlist includes all 8 platform origins
- ✅ Rate limiting: Express-rate-limit middleware active

**Files Modified:**
- `server/index.ts` - JWKS endpoint fix (line 198-213)
- `server/index.ts` - Canary v2.7 implementation (line 83-165)
- `server/auth/keys.ts` - RSA key generation and JWK conversion
- `server/replitAuth.ts` - OIDC integration with Replit Auth

---

## DEPLOYMENT STEPS

### Option A: Replit Auto-Deploy (Fastest - 2 minutes)

Replit auto-deploys on file save. Your production may already have the fixes.

**1. Verify Current Production Status:**
```bash
curl -s https://scholar-auth-jamarrlmayes.replit.app/.well-known/jwks.json | jq .
```

**Expected Output (If Already Deployed):**
```json
{
  "keys": [
    {
      "kid": "scholar-auth-2025-01",
      "kty": "RSA",
      "alg": "RS256",
      "use": "sig",
      "n": "...",
      "e": "AQAB"
    }
  ]
}
```

**If output is correct:** ✅ Gate 1 is GREEN, skip to Verification section.

---

### Option B: Force Production Rebuild (5-10 minutes)

**If production shows old code or returns redirect:**

1. Open Replit workspace: https://replit.com/@jamarrlmayes/workspace
2. Click "Deployments" tab in left sidebar
3. Click "Publish" button (or "Redeploy" if already published)
4. Wait for deployment to complete (~3-5 minutes)
5. Verify JWKS endpoint (see Verification section)

---

### Option C: Emergency Fresh Deployment (15 minutes + propagation)

**Only if cache persists >15 minutes after forced rebuild:**

**⚠️ WARNING:** Creates new production URL - requires propagation to all services.

1. **Create New Deployment:**
   - Replit → Deployments → "Create New Deployment"
   - Note new URL: `https://workspace-v2-jamarrlmayes.replit.app`

2. **Update All Service References (7 services):**
   
   Update `ISSUER_URL` in each dependent service:
   - student_pilot
   - provider_register  
   - scholarship_api
   - scholarship_sage
   - scholarship_agent
   - auto_com_center
   - auto_page_maker
   
   Change from:
   ```
   ISSUER_URL=https://scholar-auth-jamarrlmayes.replit.app/oidc
   ```
   
   To:
   ```
   ISSUER_URL=https://workspace-v2-jamarrlmayes.replit.app/oidc
   ```

3. **Redeploy All 7 Services** (monolith deploys all together)

---

## VERIFICATION (Gate 1 Checklist)

### 1. JWKS Endpoint Validation

```bash
# Test JWKS endpoint
curl -s https://scholar-auth-jamarrlmayes.replit.app/.well-known/jwks.json | jq .
```

**Expected Output:**
- ✅ Status 200 OK
- ✅ Content-Type: application/json
- ✅ Contains "keys" array
- ✅ keys[0].alg == "RS256"
- ✅ keys[0].kid == "scholar-auth-2025-01"
- ✅ keys[0].kty == "RSA"
- ✅ keys[0].use == "sig"
- ✅ keys[0].n present (modulus)
- ✅ keys[0].e == "AQAB" (exponent)

**Failure Indicators:**
- ❌ 308 redirect (old code - redeploy needed)
- ❌ HTML response (wrong endpoint)
- ❌ 404 or 500 error (deployment issue)

---

### 2. Canary Endpoint Validation

```bash
# Test canary
curl -s https://scholar-auth-jamarrlmayes.replit.app/canary | jq .
```

**Expected Output:**
```json
{
  "app": "scholar_auth",
  "app_base_url": "https://scholar-auth-jamarrlmayes.replit.app",
  "version": "v2.7",
  "status": "ok",
  "p95_ms": <number ≤120>,
  "security_headers": {
    "present": [
      "strict-transport-security",
      "content-security-policy",
      "x-frame-options",
      "x-content-type-options",
      "referrer-policy",
      "permissions-policy"
    ],
    "missing": []
  },
  "dependencies_ok": true,
  "timestamp": "2025-11-01T..."
}
```

**Checklist:**
- ✅ Exactly 8 fields (no more, no less)
- ✅ version == "v2.7"
- ✅ status == "ok"
- ✅ p95_ms ≤ 120
- ✅ security_headers.present.length == 6
- ✅ security_headers.missing.length == 0
- ✅ dependencies_ok == true

---

### 3. Security Headers Validation

```bash
# Check response headers
curl -I https://scholar-auth-jamarrlmayes.replit.app/canary
```

**Required Headers (6/6):**
- ✅ Strict-Transport-Security: max-age=31536000; includeSubDomains
- ✅ Content-Security-Policy: default-src 'self'; frame-ancestors 'none'
- ✅ X-Frame-Options: DENY
- ✅ X-Content-Type-Options: nosniff
- ✅ Referrer-Policy: strict-origin-when-cross-origin
- ✅ Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()

---

### 4. Latency Validation (30 samples)

```bash
# Collect 30 latency samples
for i in {1..30}; do 
  curl -s -w '%{time_total}\n' -o /dev/null https://scholar-auth-jamarrlmayes.replit.app/canary
  sleep 0.1
done | sort -n | awk 'NR==29 {print "P95: " $1*1000 "ms"}'
```

**Acceptance:** P95 ≤ 120ms

---

### 5. Token Validation Test (Dependent Services)

```bash
# From student_pilot or any dependent service
# Verify JWT validation works against JWKS
curl -H "Authorization: Bearer <valid-jwt>" \
  https://student-pilot-jamarrlmayes.replit.app/api/auth/user
```

**Expected:** 200 OK with user data (if valid JWT)  
**Expected:** 401 Unauthorized (if invalid/expired JWT)

---

## TROUBLESHOOTING

### Problem: JWKS returns 308 redirect

**Cause:** Old code deployed  
**Fix:** Force production rebuild (Option B)

### Problem: JWKS returns HTML

**Cause:** Wrong endpoint or routing issue  
**Fix:** Verify URL is `/.well-known/jwks.json` (with leading dot)

### Problem: /canary missing fields

**Cause:** Old v2.6 or earlier deployed  
**Fix:** Force production rebuild, verify version=="v2.7"

### Problem: P95 > 120ms

**Cause:** Cold start or database latency  
**Fix:** Warm up endpoint with 10 requests, re-measure. Check dependency health.

### Problem: Security headers missing

**Cause:** Helmet middleware not applied  
**Fix:** Verify server/index.ts lines 234-260, redeploy

---

## SUCCESS CRITERIA (Report to CEO)

```
GATE 1 STATUS: GREEN

JWKS Verification:
✅ curl https://scholar-auth-jamarrlmayes.replit.app/.well-known/jwks.json
   Output: Valid RS256 JWK with kid="scholar-auth-2025-01"

Canary Verification:  
✅ curl https://scholar-auth-jamarrlmayes.replit.app/canary
   Output: v2.7, 8 fields, 6/6 headers, dependencies_ok=true, p95_ms=<X>ms

Security Headers:
✅ All 6 required headers present

Latency:
✅ P95 = <X>ms (≤120ms threshold)

Token Validation:
✅ Dependent services can validate JWTs against JWKS

Gate 1 Status: GREEN - Ready for soft launch
```

---

## EMERGENCY CONTACTS

**If deployment fails:** Escalate to CEO immediately  
**Timeline:** T+30 minutes deadline (strict)  
**Fallback:** Option C (new deployment URL) must complete by T+45 minutes max

---

**END OF RUNBOOK**
