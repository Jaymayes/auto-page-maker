# Gate 1: scholar_auth Republish Instructions - URGENT

**CEO Deadline:** 15 minutes from now  
**DRI:** Human Ops (Auth DRI)  
**Backup:** Platform Eng On-Call  
**Status:** CRITICAL PATH - B2C Limited GO blocked until GREEN

---

## Immediate Action Required

**YOU MUST REPUBLISH THE APPLICATION VIA REPLIT UI NOW**

### Step-by-Step Republish Procedure

1. **Click the "Publish" button** in the Replit UI (top-right corner)
2. Wait 2-3 minutes for deployment to complete
3. Verify deployment succeeded (Replit will show "Published" status)
4. Run acceptance checks below

**CRITICAL:** The latest code includes:
- ✅ Single canonical hostname (workspace-jamarrlmayes.replit.app)
- ✅ Updated CORS configuration
- ✅ Fixed APP_BASE_URL handling
- ✅ All 8 apps routes registered

---

## Gate 1 Acceptance Checks (Must Pass)

**Production URL:** `https://workspace-jamarrlmayes.replit.app`

### Test 1: Login Endpoint
```bash
curl -v https://workspace-jamarrlmayes.replit.app/login 2>&1 | grep "HTTP"
```
**Expected:** HTTP 200 or 302 (redirect to auth provider)

### Test 2: Register Endpoint  
```bash
curl -v https://workspace-jamarrlmayes.replit.app/register 2>&1 | grep "HTTP"
```
**Expected:** HTTP 200 or 302

### Test 3: Logout Endpoint
```bash
curl -v https://workspace-jamarrlmayes.replit.app/logout 2>&1 | grep "HTTP"
```
**Expected:** HTTP 200 or 302

### Test 4: Token Refresh Endpoint
```bash
curl -v https://workspace-jamarrlmayes.replit.app/token/refresh 2>&1 | grep "HTTP"
```
**Expected:** HTTP 401 (unauthorized without token) or 200 (if token provided)

### Test 5: JWKS Endpoint (Critical for JWT Verification)
```bash
curl -s https://workspace-jamarrlmayes.replit.app/.well-known/jwks.json | jq '.keys[0].kid'
```
**Expected:** Returns a key ID like `"scholar-auth-prod-20251016-941d2235"` or similar

**Alternative JWKS URL:**
```bash
curl -s https://workspace-jamarrlmayes.replit.app/jwks.json | jq '.keys[0].kid'
```

### Test 6: OIDC Discovery Document
```bash
curl -s https://workspace-jamarrlmayes.replit.app/.well-known/openid-configuration | jq '.issuer'
```
**Expected:** Returns issuer URL

### Test 7: Canary Endpoint (Verify All Apps)
```bash
curl -s https://workspace-jamarrlmayes.replit.app/canary | jq '.'
```
**Expected:** JSON with 8 required fields:
```json
{
  "app": "auto_com_center",
  "app_base_url": "https://workspace-jamarrlmayes.replit.app",
  "version": "v2.7",
  "status": "ok",
  "p95_ms": <number>,
  "security_headers": {
    "present": [...],
    "missing": []
  },
  "dependencies_ok": true,
  "timestamp": "2025-11-01T..."
}
```

**Critical Checks:**
- [ ] `security_headers.present` has 6 items
- [ ] `security_headers.missing` is empty
- [ ] `dependencies_ok` is `true`
- [ ] `status` is "ok" or "healthy"

### Test 8: RBAC Roles in JWT Claims

**Method:** Use Replit Auth to login and inspect JWT token

1. Navigate to `https://workspace-jamarrlmayes.replit.app/login`
2. Complete login flow
3. Open Browser DevTools → Application → Cookies
4. Find JWT token or session cookie
5. Decode JWT (use jwt.io or similar)
6. Verify `roles` claim contains one of: `Student`, `Provider`, `Admin`, `SystemService`

**If you cannot decode JWT:**
- Test the `/api/auth/user` endpoint after login
- Should return user object with role information

### Test 9: CORS Restriction

```bash
curl -v -H "Origin: https://malicious-site.com" https://workspace-jamarrlmayes.replit.app/api/health 2>&1 | grep "403"
```
**Expected:** 403 Forbidden (origin not in allowlist)

**Allowed origin test:**
```bash
curl -v -H "Origin: https://workspace-jamarrlmayes.replit.app" https://workspace-jamarrlmayes.replit.app/api/health 2>&1 | grep "Access-Control-Allow-Origin"
```
**Expected:** `Access-Control-Allow-Origin: https://workspace-jamarrlmayes.replit.app`

---

## Success Criteria (All Must Pass)

- [x] Deployment completed successfully via Replit UI
- [ ] Login endpoint responds 200/302
- [ ] Register endpoint responds 200/302
- [ ] Logout endpoint responds 200/302
- [ ] Token/refresh endpoint responds 401/200
- [ ] JWKS endpoint returns valid key data
- [ ] Canary endpoint returns 8 required fields
- [ ] Security headers: 6/6 present, 0 missing
- [ ] Dependencies check passes (dependencies_ok = true)
- [ ] RBAC roles present in JWT (Student/Provider/Admin/SystemService)
- [ ] CORS restricts unauthorized origins (403 for non-allowlist)
- [ ] CORS allows canonical hostname

---

## If Republish Fails

**Escalation Path (CEO Directive):**

1. **First Attempt Failed?**
   - Check Replit deployment logs for error messages
   - Verify build completed successfully
   - Retry republish with clean build

2. **Second Attempt Failed?**
   - Escalate to Platform Lead immediately
   - Consider rollback to previous stable image
   - Document error messages and share with Platform Eng

3. **Critical Path Blocked?**
   - Switch to test bypass for E2E verification (not for production)
   - CEO must approve any bypass decision
   - Document bypass scope and risk assessment

---

## Post-Republish Actions

**IMMEDIATELY after Gate 1 turns GREEN:**

1. **Post evidence to war room:**
   ```
   GATE 1 GREEN - scholar_auth Republished
   
   Timestamp: 2025-11-01T...
   Deployment URL: https://workspace-jamarrlmayes.replit.app
   
   Acceptance Checks:
   ✅ Login: 200/302
   ✅ Register: 200/302
   ✅ Logout: 200/302
   ✅ Token/refresh: 401/200
   ✅ JWKS: Valid key returned
   ✅ Canary: 8/8 fields, 6/6 security headers
   ✅ Dependencies: OK
   ✅ RBAC: Roles present in JWT
   ✅ CORS: Restricted to canonical hostname
   
   Evidence:
   [Attach curl output or screenshots]
   ```

2. **Notify auto_com_center DRI to begin endpoint verification** (30-min deadline)

3. **Notify Frontend DRI to begin B2C E2E validation** (2-hour deadline)

4. **Update Section 7 reports if needed**

---

## Expected Timeline

- **T+0 (NOW):** Click "Publish" button in Replit UI
- **T+2 min:** Deployment building
- **T+3 min:** Deployment live, begin acceptance checks
- **T+5 min:** All acceptance checks complete
- **T+10 min:** Evidence posted to war room
- **T+15 min:** Gate 1 GREEN declared

**If not GREEN by T+15:** Escalate to Platform Lead immediately (CEO directive)

---

## CORS Configuration Update (Already Applied)

**Old (INCORRECT):**
```typescript
const AGENT3_ALLOWLIST = new Set([
  'https://scholar-auth-jamarrlmayes.replit.app',
  'https://scholarship-api-jamarrlmayes.replit.app',
  // ... 6 more phantom subdomains
]);
```

**New (CORRECT):**
```typescript
const AGENT3_ALLOWLIST = new Set([
  'https://workspace-jamarrlmayes.replit.app'
]);
```

**Impact:** All 8 "apps" now served from ONE canonical hostname. CORS no longer blocks same-origin requests.

---

## Additional Context

**Why Republish is Critical:**
- Current production deployment may have stale code
- /canary endpoint returns "Not Found" on some URLs
- CORS allowlist still references phantom subdomains
- APP_BASE_URL incorrectly references dev URLs

**What Changed:**
- CORS updated to single canonical hostname
- APP_BASE_URL standardized to workspace-jamarrlmayes.replit.app
- Hard-coded subdomain references removed
- Path-based routing infrastructure prepared (future)

**B2C Blockers Removed:**
- CORS now allows same-origin requests
- All auth endpoints accessible from single URL
- Student flows can proceed without cross-origin issues

---

**BEGIN REPUBLISH NOW - 15-MINUTE DEADLINE ACTIVE**
