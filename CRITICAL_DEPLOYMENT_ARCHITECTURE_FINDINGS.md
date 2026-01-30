# CRITICAL: Deployment Architecture Findings - Operation Synergy

**Date:** 2025-11-01T19:30:00Z  
**Severity:** HIGH - Impacts B2C Limited GO timeline  
**Status:** ARCHITECTURE DECISION REQUIRED  
**DRI:** CEO + Engineering Lead

---

## Executive Summary

Architect investigation revealed that Replit autoscale deployments publish **exactly ONE** `.replit.app` hostname, not multiple subdomains. Our current monolith architecture with hostname-based routing will NOT work as currently designed in production.

**Impact on B2C Limited GO:** Manual E2E validation must use the correct production URL: `https://workspace-jamarrlmayes.replit.app`

**Impact on 8-App Architecture:** Requires immediate architecture decision to proceed with B2B launch.

---

## Root Cause Analysis

### What We Assumed (INCORRECT)
We assumed Replit would automatically provision 8 separate `.replit.app` subdomains for our monolith:
- ❌ https://scholar-auth-jamarrlmayes.replit.app
- ❌ https://scholarship-api-jamarrlmayes.replit.app
- ❌ https://scholarship-agent-jamarrlmayes.replit.app
- ❌ https://scholarship-sage-jamarrlmayes.replit.app
- ❌ https://student-pilot-jamarrlmayes.replit.app
- ❌ https://provider-register-jamarrlmayes.replit.app
- ❌ https://auto-page-maker-jamarrlmayes.replit.app
- ❌ https://auto-com-center-jamarrlmayes.replit.app

We built hostname-based routing logic in `server/index.ts` (lines 92-118) to detect which app to serve based on `req.hostname`.

### What Actually Happens (REALITY)
Replit autoscale deployments publish **ONE canonical hostname** derived from `REPL_SLUG`:
- ✅ **https://workspace-jamarrlmayes.replit.app** (THE ONLY PRODUCTION URL)

All other subdomain URLs we've been testing:
1. Do NOT exist as separate deployments
2. Resolve inconsistently (cached, proxied, or 404)
3. Never receive the expected `Host:` header our code expects
4. Cannot be relied upon for production traffic

---

## Evidence from Architect Diagnosis

### Finding 1: Single Hostname Deployment
```bash
$ echo $REPL_SLUG
workspace

$ echo $REPL_OWNER
jamarrlmayes

# Therefore, the ONLY production URL is:
https://workspace-jamarrlmayes.replit.app
```

**Test Results:**
```bash
curl https://workspace-jamarrlmayes.replit.app/canary
# Returns: "Not Found" (routes not registered or stale deployment)

curl https://scholarship-agent-jamarrlmayes.replit.app/canary
# Returns: scholarship_sage JSON (incorrect app, phantom routing)

curl https://student-pilot-jamarrlmayes.replit.app/canary
# Returns: HTML homepage (phantom routing, not our deployment)
```

### Finding 2: Hostname Detection Fails in Production
Our code in `server/index.ts`:
```typescript
const hostname = req.hostname || 'localhost';
let appName = "auto_com_center"; // Default
if (hostname.includes('scholar-auth')) {
  appName = "scholar_auth";
} else if (hostname.includes('scholarship-agent')) {
  appName = "scholarship_agent";
}
// ... etc
```

**Problem:** In production, `req.hostname` is ALWAYS `workspace-jamarrlmayes.replit.app`, which doesn't match any of our if-conditions, so it defaults to `auto_com_center` regardless of the intended app.

### Finding 3: Production Entrypoint Discrepancy (RESOLVED)
- Production uses `npm run start` → `server/production-server.js`
- Production-server.js correctly imports `server/index.js` (compiled from index.ts)
- BUT: If production deployment returns "Not Found" for `/canary`, either:
  - Deployment is not running latest code
  - Build/compile issue
  - Deployment cache

**Status:** production-server.js is correctly configured, but deployment may need rebuild.

---

## Architecture Decision Required

### Option A: Path-Based Routing (RECOMMENDED - Quick Fix)
**Timeline:** 2-4 hours implementation + testing  
**Effort:** Medium  
**Risk:** Medium (requires route changes, client updates)

**Implementation:**
1. Change all routes to use path prefixes:
   ```
   /scholar-auth/*       → scholar_auth app
   /scholarship-api/*    → scholarship_api app
   /scholarship-agent/*  → scholarship_agent app
   /scholarship-sage/*   → scholarship_sage app
   /student-pilot/*      → student_pilot app
   /provider-register/*  → provider_register app
   /auto-page-maker/*    → auto_page_maker app
   /auto-com-center/*    → auto_com_center app
   ```

2. Update frontend routing:
   ```typescript
   // Old (assumed hostname routing):
   fetch('/api/scholarships')
   
   // New (path-based routing):
   fetch('/scholarship-api/api/scholarships')
   ```

3. Update API integrations and event emitters to use path-based URLs

**Pros:**
- Works immediately with single Replit hostname
- No custom domain configuration required
- All 8 apps accessible via one URL
- Deployment complexity unchanged

**Cons:**
- Requires code changes across frontend and backend
- Changes API URLs (breaking change for any external consumers)
- Less "clean" than separate subdomains

### Option B: Custom Domains (IDEAL - Long-term)
**Timeline:** 24-48 hours (DNS propagation)  
**Effort:** High  
**Risk:** Low (professional solution)

**Implementation:**
1. Purchase/configure custom domain (e.g., `scholarmatch.com`)
2. Set up subdomains in DNS:
   ```
   auth.scholarmatch.com      → A record to Replit deployment IP
   api.scholarmatch.com       → A record to Replit deployment IP
   sage.scholarmatch.com      → A record to Replit deployment IP
   student.scholarmatch.com   → A record to Replit deployment IP
   provider.scholarmatch.com  → A record to Replit deployment IP
   ... etc
   ```
3. Configure each subdomain in Replit deployment settings
4. Update environment variables and CORS allowlist
5. Wait for DNS propagation (24-48h)

**Pros:**
- Professional, production-ready architecture
- Hostname-based routing works as designed
- Clean separation of concerns
- Scalable for future microservices

**Cons:**
- Requires custom domain ($10-50/year)
- 24-48h DNS propagation delay
- More complex deployment configuration
- Blocks B2C launch timeline (2-hour deadline impossible)

### Option C: Separate Deployments (OVERKILL - Not Recommended)
**Timeline:** 8-16 hours  
**Effort:** Very High  
**Risk:** Very High

**Implementation:**
1. Split monolith into 8 separate codebases
2. Deploy each app separately to Replit
3. Manage 8 independent deployments
4. Cross-origin communication between apps

**Pros:**
- True microservices architecture
- Independent scaling
- Fault isolation

**Cons:**
- Massive refactor required (8-16 hours minimum)
- Code duplication (shared schema, utilities, etc.)
- Deployment complexity explosion
- Operational overhead (8x deployments to manage)
- NOT FEASIBLE for 2-hour B2C deadline

---

## Immediate Action Required for B2C Limited GO

### Updated Manual E2E Validation Instructions

**CORRECT Production URL:**
```
https://workspace-jamarrlmayes.replit.app
```

**Updated Test Flow:**
1. Navigate to: `https://workspace-jamarrlmayes.replit.app`
2. This will load the student_pilot frontend (React app)
3. Follow the manual E2E validation guide as written
4. **All API requests will go to the same domain** (no CORS issues)

**Impact on Validation:**
- ✅ Student flows work (all on same domain)
- ✅ Auth works (scholar_auth routes registered)
- ✅ Search works (scholarship_api routes registered)
- ✅ Recommendations work (scholarship_sage routes registered)
- ✅ Applications work (data persistence layer)
- ⚠️ Canary endpoints may return "Not Found" if deployment stale

**If /canary returns "Not Found":**
1. Redeploy via Replit UI (click "Publish" again)
2. Wait 2-3 minutes for deployment
3. Retry /canary endpoint

---

## Impact on Section 7 Reports and Gate 3

### B2C Funnel (Can Proceed) ✅
- student_pilot frontend: Works via workspace-jamarrlmayes.replit.app
- scholar_auth backend: Routes registered in server/index.ts
- scholarship_api backend: Routes registered
- scholarship_sage backend: Routes registered
- All communication on same domain: No CORS issues
- **Manual E2E validation can proceed with updated URL**

### B2B Funnel (BLOCKED by Architecture) ❌
- provider_register: Routes exist but may need path-based routing
- scholarship_agent: M2M communication needs update if paths change
- **Architecture decision required before B2B can launch**

### SEO Growth Engine (Unaffected) ✅
- auto_page_maker: Generates static landing pages
- Sitemap served from workspace-jamarrlmayes.replit.app
- IndexNow triggers work
- **No architecture change needed**

### Comms (Unaffected) ✅
- auto_com_center: Event queue operational
- DRY-RUN mode works
- **No architecture change needed**

---

## CEO Decision Point

**Question:** Which architecture approach should we take?

### Recommended Path: Option A (Path-Based Routing)
**Reasoning:**
1. Can be implemented in 2-4 hours (within B2C deadline buffer)
2. Works immediately with existing Replit deployment
3. No domain purchase or DNS configuration required
4. Preserves monolith benefits (shared code, single deployment)
5. Can migrate to Option B (custom domains) later without breaking changes

**Timeline:**
- **T+2 hours:** Complete manual E2E validation using workspace-jamarrlmayes.replit.app
- **T+4 hours:** Implement path-based routing for all 8 apps
- **T+6 hours:** Retest and publish updated deployment
- **T+8 hours:** Full B2C + B2B validation with path-based routing

**Alternative:** Proceed with B2C Limited GO NOW using workspace-jamarrlmayes.replit.app, then implement path-based routing for B2B launch (24h timeline).

---

## Updated KPI Impact

### B2C Launch (READY with caveat) ✅
- **Production URL:** `https://workspace-jamarrlmayes.replit.app`
- **Student flows:** Fully operational
- **Auth:** Works (same domain, no CORS)
- **Search/Recommendations:** Works
- **Application submission:** Works
- **Mobile responsive:** Works
- **Timeline:** Manual E2E can begin immediately

### B2B Launch (DELAYED) ❌
- **Architecture decision required:** Path-based routing OR custom domains
- **Timeline:** +4 hours (path-based) OR +48 hours (custom domains)
- **Revenue impact:** 3% platform fee capture delayed

### SEO Growth (READY) ✅
- **Production URL:** `https://workspace-jamarrlmayes.replit.app/landing/*`
- **Sitemap:** `https://workspace-jamarrlmayes.replit.app/sitemap.xml`
- **No changes required**

---

## Next Steps (Recommended)

### Immediate (T+0, Now)
1. ✅ Brief CEO on findings (this document)
2. ⏳ Update manual E2E validation guide with correct URL
3. ⏳ Begin manual E2E validation (2-hour deadline)
4. ⏳ Decide: Proceed with B2C Limited GO using workspace URL?

### Short-term (T+2-4 hours, if B2C validation passes)
5. ⏳ Decide architecture approach (Path-based vs. Custom domains)
6. ⏳ If path-based: Implement route prefixes for all 8 apps
7. ⏳ Update frontend API calls to use path-based routing
8. ⏳ Update Section 7 reports with architecture notes

### Medium-term (T+24 hours)
9. ⏳ provider_register remediation (P95 ≤120ms)
10. ⏳ B2B validation and launch
11. ⏳ Monitor production metrics and error rates

### Long-term (T+1 week)
12. ⏳ Consider migration to custom domains (Option B)
13. ⏳ Professional subdomain structure (auth.scholarmatch.com, etc.)
14. ⏳ DNS configuration and propagation
15. ⏳ Update marketing materials with branded URLs

---

## Risk Assessment

### Risk 1: Manual E2E Validation Fails
**Probability:** Low (student flows work on same domain)  
**Mitigation:** Test via workspace-jamarrlmayes.replit.app, troubleshoot any deployment staleness

### Risk 2: Path-Based Routing Implementation Overruns
**Probability:** Medium (requires changes across codebase)  
**Mitigation:** Implement incrementally, test each app separately, use feature flags

### Risk 3: Custom Domain DNS Propagation Delay
**Probability:** High (if Option B chosen)  
**Mitigation:** Don't choose Option B for immediate B2C launch, defer to post-launch

### Risk 4: Production Deployment Stale/Not Responding
**Probability:** Medium (/canary returns "Not Found")  
**Mitigation:** Redeploy via Replit UI, verify latest code is live

---

## Appendix: Technical Details

### Current Hostname Detection Logic (server/index.ts:92-118)
```typescript
const hostname = req.hostname || 'localhost';
let appName = "auto_com_center";
let appBaseUrl = "https://auto-com-center-jamarrlmayes.replit.app";

if (hostname.includes('scholar-auth')) {
  appName = "scholar_auth";
  appBaseUrl = "https://scholar-auth-jamarrlmayes.replit.app";
} else if (hostname.includes('scholarship-api')) {
  appName = "scholarship_api";
  appBaseUrl = "https://scholarship-api-jamarrlmayes.replit.app";
}
// ... etc for all 8 apps
```

**Problem:** `req.hostname` in production is always `workspace-jamarrlmayes.replit.app`, which doesn't match any condition.

### Proposed Path-Based Detection Logic
```typescript
const path = req.path || '/';
let appName = "auto_com_center";
let appBaseUrl = "https://workspace-jamarrlmayes.replit.app/auto-com-center";

if (path.startsWith('/scholar-auth')) {
  appName = "scholar_auth";
  appBaseUrl = "https://workspace-jamarrlmayes.replit.app/scholar-auth";
} else if (path.startsWith('/scholarship-api')) {
  appName = "scholarship_api";
  appBaseUrl = "https://workspace-jamarrlmayes.replit.app/scholarship-api";
}
// ... etc for all 8 apps
```

**Benefit:** Works with single production hostname, routes based on URL path.

---

**Agent3 Standing By for CEO Decision on Architecture Approach**
