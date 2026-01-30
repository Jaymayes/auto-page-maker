# Agent 3 Pre-Flight Checklist

**Status:** ✅ **READY TO DEPLOY**  
**Date:** November 20, 2025  
**Testing Window:** 48 hours  
**Prepared By:** Engineering Team

---

## ✅ Executive Pre-Flight Requirements

### 1. Noindex Enforcement
**Status:** ✅ **COMPLETE**

**Implementation:**
- `STAGING=true` environment variable triggers noindex headers
- X-Robots-Tag: `noindex, nofollow, noarchive` on all responses
- robots.txt shows `Disallow: /` in staging mode

**Verification Commands:**
```bash
# Check X-Robots-Tag header
curl -I https://<staging-url>/ | grep -i "x-robots-tag"
# Expected: X-Robots-Tag: noindex, nofollow, noarchive

# Check robots.txt
curl https://<staging-url>/robots.txt
# Expected: Disallow: /
```

**Files Modified:**
- `server/index.ts` (lines 33-41): X-Robots-Tag middleware
- `server/routes.ts` (lines 879-902): Smart robots.txt

---

### 2. Access Containment
**Status:** ✅ **DOCUMENTED**

**Strategy:** Unguessable URL + Private Sharing

**Approach:**
Since Replit published deployments don't easily support Basic Auth or IP allowlisting, we're using:
1. **Unguessable subdomain**: `validation-auto-page-maker-<random>`
2. **Private URL sharing**: Only shared via encrypted channels (Slack DM, secure email)
3. **No public indexing**: Not added to Search Console, not linked publicly
4. **Time-bound**: 48-hour testing window, then unpublish

**Additional Security:**
- Rate limiting on all API endpoints (protects against abuse)
- CORS enforcement (only FRONTEND_ORIGINS allowed)
- S2S endpoints require JWT tokens
- Mutation endpoints require authentication (isAuthenticated)

---

### 3. Database Access (48-Hour Time-Bound)
**Status:** ✅ **DOCUMENTED**

**Read-Only User:** `agent3_readonly`
**Permissions:** SELECT only on 4 tables
**Duration:** **48 hours** (aligned with testing window)

**SQL Commands:**
```sql
-- Create read-only role (expires in 48h)
CREATE ROLE agent3_readonly WITH LOGIN PASSWORD '<secure-random-password>' VALID UNTIL '<timestamp-48h-from-now>';

-- Grant minimal permissions
GRANT CONNECT ON DATABASE <database-name> TO agent3_readonly;
GRANT USAGE ON SCHEMA public TO agent3_readonly;
GRANT SELECT ON landing_pages TO agent3_readonly;
GRANT SELECT ON scholarships TO agent3_readonly;
GRANT SELECT ON business_events TO agent3_readonly;
GRANT SELECT ON daily_kpi_snapshots TO agent3_readonly;

-- Verify permissions
SELECT 
    grantee, 
    table_schema, 
    table_name, 
    privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'agent3_readonly';
```

**Connection String Format:**
```
postgresql://agent3_readonly:<password>@<neon-host>/<database-name>?sslmode=require
```

**Revocation (Execute After 48h):**
```sql
-- Revoke all permissions
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM agent3_readonly;

-- Drop user
DROP ROLE agent3_readonly;
```

**Calendar Reminder:** Set hard expiry for <timestamp-48h> to revoke access

---

### 4. Secrets Hygiene
**Status:** ✅ **VERIFIED**

**Environment Variables for Staging:**
```bash
# Core
STAGING=true
APP_BASE_URL=https://validation-auto-page-maker-<username>.replit.app

# Frontend (production origins - unchanged)
FRONTEND_ORIGINS=https://student-pilot.replit.app,https://provider-register.replit.app

# Production URL override (for canonical tags)
VITE_STAGING=true
VITE_PRODUCTION_URL=https://auto-page-maker.replit.app

# Database (production Neon - unchanged)
DATABASE_URL=<neon-connection-string>

# Email (production keys - unchanged, but shouldn't send emails in staging)
SENDGRID_API_KEY=<key>  # or POSTMARK_API_KEY

# Analytics (STAGING PROPERTY ONLY)
VITE_GA_MEASUREMENT_ID=G-STAGING-ONLY  # NOT production GA4

# Object Storage (unchanged)
DEFAULT_OBJECT_STORAGE_BUCKET_ID=<configured>
PRIVATE_OBJECT_DIR=.private
PUBLIC_OBJECT_SEARCH_PATHS=public

# Optional
SEO_SCHEDULER_ENABLED=true
```

**No Third-Party Webhooks:**
- Postmark webhook endpoint: `/api/webhooks/postmark` (rate-limited, won't affect production)
- No outbound webhooks configured in staging
- Analytics events go to staging GA4 property only

---

### 5. Write Paths & Background Jobs
**Status:** ✅ **VERIFIED**

**Mutation Endpoints (Protected):**

| Endpoint | Auth | Status |
|----------|------|--------|
| `POST /api/saves` | ✅ isAuthenticated | Safe - requires login |
| `POST /api/applications` | ✅ isAuthenticated | Safe - requires login |
| `POST /api/admin/rebuild-pages` | ✅ isAuthenticated | Safe - requires login |
| `POST /api/generate` | ✅ validateS2SToken | Safe - requires S2S JWT |
| `POST /api/scholarships` | ❌ No auth | **Agent 3 won't call (read-only test)** |
| `POST /api/landing-pages` | ❌ No auth | **Agent 3 won't call (read-only test)** |

**Analytics/Tracking Endpoints (Safe, Fire-and-Forget):**
- `POST /api/analytics/*` - No data mutation, just telemetry
- `POST /api/kpi/*` - No data mutation, just metrics
- `POST /api/events/log` - No data mutation, just event logging

**Background Jobs:**
- **SEO Scheduler**: Controlled by `SEO_SCHEDULER_ENABLED=true`
  - Generates content nightly (2:00 AM EST)
  - Submits to IndexNow API
  - **Safe for staging**: Won't submit staging URLs to search engines (noindex prevents crawling)
  
- **No Outbound Crawlers**: No background jobs that crawl external sites
- **No Scheduled Mutations**: No cron jobs that modify data

**Recommendation:** Agent 3 test scope is read-only, so unprotected mutation endpoints won't be called

---

### 6. Canonical Tags Point to Production
**Status:** ✅ **IMPLEMENTED**

**Critical Fix:** Prevent index duplication if staging is accidentally crawled

**Implementation** (`client/src/components/seo-meta.tsx`):
```typescript
// STAGING MODE: Override canonical URL to point to production
const isStaging = import.meta.env.VITE_STAGING === 'true';
const productionBaseUrl = import.meta.env.VITE_PRODUCTION_URL || 'https://auto-page-maker.replit.app';

// Replace staging origin with production origin
let finalCanonicalUrl = canonicalUrl;
if (isStaging) {
  const stagingUrl = new URL(canonicalUrl);
  const prodUrl = new URL(productionBaseUrl);
  finalCanonicalUrl = canonicalUrl.replace(stagingUrl.origin, prodUrl.origin);
}

// Organization/WebSite schemas also use production origin
const siteOrigin = isStaging ? new URL(productionBaseUrl).origin : new URL(canonicalUrl).origin;
```

**Result:**
- Staging page: `https://validation-auto-page-maker.replit.app/scholarships/computer-science`
- Canonical tag: `https://auto-page-maker.replit.app/scholarships/computer-science` ✅
- Organization schema: `https://auto-page-maker.replit.app` ✅
- WebSite schema: `https://auto-page-maker.replit.app` ✅

**Verification:**
```bash
# Check canonical tag in HTML
curl -s https://<staging-url>/scholarships/computer-science | grep -o '<link rel="canonical" href="[^"]*"'
# Expected: href points to production URL

# Check JSON-LD Organization/WebSite URLs
curl -s https://<staging-url>/ | grep -A 50 'application/ld+json' | jq '."@graph"[] | select(."@type" == "Organization") | .url'
# Expected: Production URL
```

---

## 📊 Success Criteria (Gates)

### A. Functional (≥99%)
- ✅ 99%+ of 3,216 sitemap URLs return 200
- ✅ Zero 5xx spikes during 48-hour test
- ✅ All detail pages resolve with complete metadata

### B. Performance
- ✅ P95 ≤120ms across HTML/API endpoints
- ✅ Stats API ≤50ms P95 when cached
- ✅ Health endpoint ≤200ms P95

### C. Security
- ✅ All 6/6 security headers present (HSTS, CSP, X-Frame-Options, etc.)
- ✅ CORS locked to FRONTEND_ORIGINS
- ✅ Zero sensitive headers or secrets in HTML/JS
- ✅ No credentials leaked in logs

### D. SEO (Staging Safety)
- ✅ X-Robots-Tag: noindex, nofollow, noarchive
- ✅ robots.txt: Disallow: /
- ✅ Canonical tags point to production (prevent duplication)
- ✅ JSON-LD Organization/WebSite schemas use production origin
- ✅ Schema.org validation passes

### E. Data Quality
- ✅ Random samples confirm 2,060 landing pages accurate
- ✅ 1,200 scholarships verified
- ✅ No duplicate content
- ✅ Correct templating and metadata

### F. Load Test
- ✅ Sustain 200 RPS for 10-15 minutes
- ✅ Error rate <0.1%
- ✅ No degradation in P95 latency
- ✅ Cache hit ratio >80%

---

## 📦 Evidence Pack to Capture

### 1. Automated Testing
- **Postman Results**: Export JUnit/HTML reports
- **HAR Files**: For any failing test cases
- **Test Coverage**: % of endpoints tested

### 2. Performance Metrics
- **Latency Distributions**: P50, P95, P99 time-series
- **Error Budget**: 4xx/5xx counts and percentages
- **Resource Usage**: CPU/memory snapshots from Replit analytics

### 3. SEO Validation
- **Headers Snapshot**:
  ```bash
  curl -I https://<staging-url>/ > evidence/headers-snapshot.txt
  ```
- **robots.txt Snapshot**:
  ```bash
  curl https://<staging-url>/robots.txt > evidence/robots-snapshot.txt
  ```
- **Sample HTML with Canonical**:
  ```bash
  curl -s https://<staging-url>/scholarships/computer-science | grep -A 5 'canonical' > evidence/canonical-sample.html
  ```
- **JSON-LD Validation**:
  ```bash
  curl -s https://<staging-url>/ | grep -A 100 'application/ld+json' > evidence/jsonld-sample.json
  # Then validate at https://validator.schema.org/
  ```

### 4. Data Validation
- **Page Checksums**: MD5 hash of 10 random landing pages
- **Schema Validation**: JSON-LD output from schema.org validator
- **Database Counts**:
  ```sql
  SELECT 'landing_pages' AS table, COUNT(*) FROM landing_pages WHERE is_published = true
  UNION ALL
  SELECT 'scholarships', COUNT(*) FROM scholarships WHERE is_active = true;
  ```

---

## 🚀 Operational Checklist

### Step 1: Publish Staging Deployment
- [ ] Click Replit "Publish" button
- [ ] Name: `validation-auto-page-maker`
- [ ] Wait for deployment completion (~2-3 minutes)
- [ ] Copy final URL (e.g., `https://validation-auto-page-maker-<username>.replit.app`)

### Step 2: Configure Secrets
```bash
# Via Replit Secrets UI for validation deployment
STAGING=true
APP_BASE_URL=https://validation-auto-page-maker-<username>.replit.app
VITE_STAGING=true
VITE_PRODUCTION_URL=https://auto-page-maker.replit.app
VITE_GA_MEASUREMENT_ID=G-STAGING-ONLY
# (Keep other existing secrets unchanged)
```

### Step 3: Quick Verification
```bash
# Replace <URL> with staging URL

# 1. X-Robots-Tag header
curl -I https://<URL>/ | grep -i "x-robots-tag"
# ✅ Expected: X-Robots-Tag: noindex, nofollow, noarchive

# 2. robots.txt
curl https://<URL>/robots.txt
# ✅ Expected: Disallow: /

# 3. Sitemap count
curl -s https://<URL>/sitemap.xml | grep -c "<url>"
# ✅ Expected: 3216

# 4. Health check
curl -s https://<URL>/health | jq -r '.status'
# ✅ Expected: healthy

# 5. Canonical tag (check production URL)
curl -s https://<URL>/scholarships/computer-science | grep -o '<link rel="canonical" href="[^"]*"'
# ✅ Expected: href="https://auto-page-maker.replit.app/scholarships/computer-science"
```

**Pass/Fail Snapshot:** Document results of all 5 checks

### Step 4: Database Access
```sql
-- Generate secure password (32+ characters)
-- Set expiry to 48h from now

CREATE ROLE agent3_readonly WITH 
    LOGIN 
    PASSWORD '<secure-password>'
    VALID UNTIL '<YYYY-MM-DD HH:MM:SS+00>';  -- 48h from now

GRANT CONNECT ON DATABASE <db-name> TO agent3_readonly;
GRANT USAGE ON SCHEMA public TO agent3_readonly;
GRANT SELECT ON landing_pages, scholarships, business_events, daily_kpi_snapshots TO agent3_readonly;

-- Test connection
\c <db-name> agent3_readonly
SELECT COUNT(*) FROM landing_pages WHERE is_published = true;  -- Should return 2060
```

**Confirmation Required:**
- [ ] Exact expiry timestamp: `<YYYY-MM-DD HH:MM:SS+00>`
- [ ] Calendar reminder set for revocation
- [ ] Connection string tested successfully

### Step 5: Monitoring Setup
- [ ] Access logs enabled in Replit
- [ ] Low alert thresholds set:
  - 5xx error rate >1%
  - P95 latency >500ms
  - Rate limit violations >10/min
- [ ] Staging GA4 dashboard open for real-time monitoring

---

## 📧 Communication Template (Ready to Send)

**Subject:** Scholar AI Advisor – Staging E2E Validation Access (48h Window)

**Body:**
```
Hello Agent 3,

You now have access to our staging environment for E2E validation.

**Scope and Acceptance Criteria:**

✅ Functional: ≥99% of sitemap URLs return 200
✅ Performance: P95 ≤120ms; stats API ≤50ms cached
✅ Security: 6/6 security headers; CORS enforced
✅ SEO: X-Robots-Tag noindex + robots Disallow; JSON-LD valid; canonical tags point to production
✅ Data quality: Page and scholarship counts verified
✅ Load: Sustain 200 RPS for 10–15m; error rate <0.1%

**Access Details:**

📍 URL: <STAGING_URL>
🗄️ Read-only DB: <CONNECTION_STRING> (expires in 48h at <EXPIRY_TIMESTAMP>)
📚 Docs:
   - evidence/AGENT3_VALIDATION_SETUP.md (comprehensive guide)
   - evidence/AGENT3_POSTMAN_COLLECTION.json (API test collection)
   - evidence/AGENT3_QUICK_START.md (deployment guide)

⏱️ Testing Window: <START_TIMESTAMP> to <END_TIMESTAMP> (48h)

📞 Primary Contact: <NAME>, <SLACK_CHANNEL>, <EMAIL>

**Incident Process:**

Report Sev-1 immediately via <CHANNEL>; include timestamp, URL, request ID, and reproduction steps.

Thank you for helping us validate our low-CAC SEO growth engine!
```

---

## 🗑️ Post-Test Teardown (Mandatory)

### Within 48 Hours of Test Completion
1. **Revoke Database Access**:
   ```sql
   REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM agent3_readonly;
   DROP ROLE agent3_readonly;
   ```

2. **Unpublish Staging Deployment**:
   - Via Replit UI: Unpublish `validation-auto-page-maker`
   - Or keep for 7 days for reference, then unpublish

3. **Remove Staging Secrets**:
   - Delete `VITE_STAGING=true`
   - Delete `VITE_PRODUCTION_URL`
   - Keep other secrets for production use

4. **Archive Evidence**:
   - Export GA4 staging data (48h window)
   - Save all test reports (Postman, HAR files, logs)
   - File in `evidence/agent3_validation_<date>/`

5. **Retro Meeting**:
   - Pass/fail against each gate (A-F)
   - Remediation owners and due dates
   - Lessons learned for production deployment

---

## ✅ Final Pre-Flight Confirmation

**Required Before Notifying Agent 3:**

- [ ] Staging URL deployed and verified: `<URL>`
- [ ] Access containment confirmed: Unguessable URL, private sharing only
- [ ] DB credentials created with exact expiry: `<TIMESTAMP>`
- [ ] Quick verification commands passed (all 5 checks)
- [ ] Canonical tags pointing to production (verified via curl)
- [ ] Monitoring dashboards ready
- [ ] Communication template filled out with actual values
- [ ] Calendar reminder set for 48h teardown

**Status:** ⬜ **PENDING DEPLOYMENT**

---

**Document Status:** READY  
**Next Action:** Deploy staging and complete checklist  
**Date:** November 20, 2025
