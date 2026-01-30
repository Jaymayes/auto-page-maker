# TRACK 1: Staging Deployment & 48h Validation

**Status:** ✅ Ready to Deploy  
**Date:** November 20, 2025  
**Architecture:** Current local DB (no API integration yet)

---

## 🚀 Deployment Instructions (10 Minutes)

### Step 1: Publish Staging Deployment

1. Click **"Deploy"** button in Replit UI (top-right corner)
2. Select **"Create a new deployment"**
3. Configuration:
   - **Name:** `validation-auto-page-maker`
   - **Type:** Web Service
   - **Region:** US East
4. Click **"Deploy"**
5. Wait 2-3 minutes for deployment completion
6. **Copy the staging URL** (format: `https://validation-auto-page-maker-<username>.replit.app`)

### Step 2: Configure Environment Variables (Replit Secrets)

**CRITICAL - Set these in deployment's Secrets tab:**

```bash
# STAGING MODE (Activates noindex + canonical override)
STAGING=true
VITE_STAGING=true

# URL Configuration
APP_BASE_URL=https://validation-auto-page-maker-<your-username>.replit.app
VITE_PRODUCTION_URL=https://auto-page-maker.replit.app

# Frontend Origins (Production - Unchanged)
FRONTEND_ORIGINS=https://student-pilot.replit.app,https://provider-register.replit.app

# Database (Production - Unchanged, Synthetic Data Only)
DATABASE_URL=<your-neon-connection-string>

# Analytics (STAGING PROPERTY ONLY - Not Production)
VITE_GA_MEASUREMENT_ID=G-STAGING-ONLY

# Email (Staging/Test Credentials - NOT PRODUCTION)
SENDGRID_API_KEY=<staging-test-key>
# OR
POSTMARK_API_KEY=<staging-test-key>

# Object Storage (Unchanged)
DEFAULT_OBJECT_STORAGE_BUCKET_ID=<your-bucket-id>
PRIVATE_OBJECT_DIR=.private
PUBLIC_OBJECT_SEARCH_PATHS=public

# Optional
SEO_SCHEDULER_ENABLED=true
```

---

## ✅ Step 3: Run 5 CEO Verification Checks

**Replace `<STAGING_URL>` with your actual staging URL**

### Check 1: X-Robots-Tag Header (Noindex Enforcement)
```bash
curl -I https://<STAGING_URL>/ | grep -i "x-robots-tag"
```
**Expected Output:**
```
X-Robots-Tag: noindex, nofollow, noarchive
```

### Check 2: robots.txt (Disallow All)
```bash
curl https://<STAGING_URL>/robots.txt
```
**Expected Output:**
```
User-agent: *
Disallow: /

# STAGING ENVIRONMENT - DO NOT INDEX
# This is a validation deployment for testing purposes only
```

### Check 3: Sitemap Coverage & Production URLs Only
```bash
# Check total URLs in sitemap
curl -s https://<STAGING_URL>/sitemap.xml | grep -c "<url>"
# Expected: ~3216

# Verify NO staging URLs leak
curl -s https://<STAGING_URL>/sitemap.xml | grep -c "validation-auto-page-maker"
# Expected: 0 (zero staging URLs)

# Sample first 20 URLs
curl -s https://<STAGING_URL>/sitemap.xml | grep "<loc>" | head -20
# Expected: All URLs point to production domain (auto-page-maker.replit.app)
```

### Check 4: Health Endpoint (Performance Baseline)
```bash
curl -s https://<STAGING_URL>/health | jq '.'
```
**Expected Output:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-20T...",
  "uptime": 123.45,
  "memory": {...},
  "database": "connected"
}
```
**Note:** `"status": "degraded"` is acceptable if non-critical services unavailable

### Check 5: Canonical Tags Point to Production
```bash
# Homepage canonical
curl -s https://<STAGING_URL>/ | grep -o '<link rel="canonical" href="[^"]*"'
# Expected: href="https://auto-page-maker.replit.app/"

# Scholarship detail canonical
curl -s https://<STAGING_URL>/scholarships/computer-science | grep -o '<link rel="canonical" href="[^"]*"'
# Expected: href="https://auto-page-maker.replit.app/scholarships/computer-science"

# JSON-LD Organization schema
curl -s https://<STAGING_URL>/ | grep -A 100 'application/ld+json' | jq '."@graph"[] | select(."@type" == "Organization") | .url'
# Expected: "https://auto-page-maker.replit.app"
```

---

## 📊 Step 4: CEO 5-Check Validation Report

### Sample Verification Report (Fill with actual outputs)

**Staging URL:** `https://validation-auto-page-maker-<your-username>.replit.app`  
**Date:** November 20, 2025  
**Time:** HH:MM UTC

#### 1. Sitemap Coverage: ✅ PASS
- **Total URLs:** 3,216
- **Malformed Entries:** 0
- **Sample Fetch (20 URLs):**
  - 200 status: 20/20
  - 4xx errors: 0
  - 5xx errors: 0
- **Staging URL Leakage:** 0 (verified via grep)

#### 2. Canonical/Metadata: ✅ PASS
**20-Page Sample:**
- rel=canonical present: 20/20
- Canonical points to production: 20/20
- Meta title from SEO metadata: 20/20
- Meta description from SEO metadata: 20/20
- Unique H1s: 20/20

**Sample Pages Tested:**
1. `/` - Canonical: `https://auto-page-maker.replit.app/`
2. `/scholarships/computer-science` - Canonical: `https://auto-page-maker.replit.app/scholarships/computer-science`
3. `/category/engineering` - Canonical: `https://auto-page-maker.replit.app/category/engineering`
4. ... (list 17 more)

#### 3. Robots/Staging Mode: ✅ PASS
- **robots.txt:** Disallow: / ✅
- **X-Robots-Tag header:** noindex, nofollow, noarchive ✅
- **No public indexing:** Verified (not in Search Console, not linked publicly)

#### 4. Performance: ✅ PASS / ⚠️ DEGRADED
- **P95 TTFB (cached):** XXms (Target: ≤200ms)
- **LCP (template pages):** X.Xs (Target: ≤2.5s)
- **Health endpoint:** `healthy` or `degraded`

**Performance Sample (10 requests):**
```
URL                          | TTFB  | Status
----------------------------|-------|-------
/                            | XXms  | 200
/scholarships/stem-women     | XXms  | 200
/category/engineering        | XXms  | 200
... (list 7 more)
```

#### 5. Integrity: ✅ PASS
**200-Page Crawl Sample:**
- Broken internal links: 0
- Missing assets (images, CSS, JS): 0
- Structured data errors: 0
- Console errors (critical): 0

---

## 🗄️ Step 5: Create Read-Only Database User (48h Time-Boxed)

### Calculate Expiry Timestamp
```bash
date -u -d '+48 hours' '+%Y-%m-%d %H:%M:%S+00'
```
**Example Output:** `2025-11-22 16:35:00+00`

### Execute in Neon Console (SQL Editor)
```sql
-- Generate secure password (32+ characters, store securely)

-- Create time-boxed user (48h auto-expiry)
CREATE ROLE agent3_readonly WITH 
    LOGIN 
    PASSWORD '<SECURE_RANDOM_PASSWORD_HERE>'
    VALID UNTIL '2025-11-22 16:35:00+00';  -- Replace with your +48h timestamp

-- Grant minimal permissions (SELECT only, 4 tables)
GRANT CONNECT ON DATABASE neondb TO agent3_readonly;
GRANT USAGE ON SCHEMA public TO agent3_readonly;
GRANT SELECT ON landing_pages TO agent3_readonly;
GRANT SELECT ON scholarships TO agent3_readonly;
GRANT SELECT ON business_events TO agent3_readonly;
GRANT SELECT ON daily_kpi_snapshots TO agent3_readonly;

-- Verify permissions (should show SELECT only)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'agent3_readonly'
ORDER BY table_name;
```

**Expected Output:**
```
grantee          | table_name           | privilege_type
-----------------+---------------------+---------------
agent3_readonly  | business_events      | SELECT
agent3_readonly  | daily_kpi_snapshots  | SELECT
agent3_readonly  | landing_pages        | SELECT
agent3_readonly  | scholarships         | SELECT
```

### Test Connection
```bash
psql "postgresql://agent3_readonly:<password>@<neon-host>/<database>?sslmode=require" -c "SELECT COUNT(*) FROM landing_pages WHERE is_published = true;"
```
**Expected:** Returns count of published pages (~2,060)

---

## 📅 Step 6: Set Calendar Reminders

### T+48h Teardown (MANDATORY)

**Set alarm for:** `<EXPIRY_TIMESTAMP>`

**Teardown Actions:**
1. **Revoke Database Access:**
   ```sql
   REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM agent3_readonly;
   DROP ROLE agent3_readonly;
   ```

2. **Unpublish Staging Deployment:**
   - Via Replit Deployments UI: Delete `validation-auto-page-maker`
   - Or keep for 7 days reference, then delete

3. **Remove Staging-Only Secrets:**
   - Delete `VITE_STAGING=true`
   - Delete `VITE_PRODUCTION_URL`

4. **Archive Evidence:**
   - Export GA4 staging data (48h window)
   - Save all test reports
   - File in `evidence/agent3_validation_<date>/`

---

## 📧 Step 7: Notify Agent 3

**Use this communication template:**

---

**Subject:** Scholar AI Advisor – Staging E2E Validation Access (48h Window)

**Body:**
```
Hello Agent 3,

You now have access to our staging environment for E2E validation under CEO-approved controls.

**Access Details:**

📍 **Staging URL:** <STAGING_URL>
🗄️ **Read-Only DB:** postgresql://agent3_readonly:<password>@<host>/<db>?sslmode=require
⏰ **Expires:** <EXPIRY_TIMESTAMP> (48h from now)

**Validation Scope (CEO 5-Check Framework):**

✅ Sitemap coverage: ≥2,000 URLs, <1% 4xx/5xx on samples
✅ Canonical/metadata: 20-page sample with correct tags and unique H1s
✅ Robots/staging mode: robots.txt disallows all, x-robots-tag: noindex
✅ Performance: P95 TTFB ≤200ms cached, LCP ≤2.5s
✅ Integrity: 200-page crawl with 0 broken links, 0 structured data errors

**Data Containment:**

✅ Synthetic dataset only (no real student PII)
✅ FERPA/COPPA compliant (no educational records)
✅ SELECT-only permissions (48h time-boxed)

**Documentation:**

📚 Comprehensive Guide: evidence/AGENT3_VALIDATION_SETUP.md
📬 Postman Collection: evidence/AGENT3_POSTMAN_COLLECTION.json
🚀 Quick Start: evidence/AGENT3_QUICK_START.md

**Primary Contact:**

📞 <NAME>
💬 <SLACK_CHANNEL>
📧 <EMAIL>

**Incident Process:**

Report Sev-1 issues immediately via <CHANNEL> with:
- Timestamp
- URL/endpoint
- Request ID (from X-Request-ID header)
- Reproduction steps

Thank you for validating our low-CAC SEO growth engine!

Best,
Engineering Team
```

---

**Status:** ✅ READY TO EXECUTE  
**Next Action:** Deploy staging, run 5 verification commands, create DB user, notify Agent 3
