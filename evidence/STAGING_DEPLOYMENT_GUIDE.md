# Staging Deployment Guide - Agent 3 Validation
**CEO Conditional GO Approved**  
**Date:** November 20, 2025  
**Duration:** 48 hours

---

## 🚀 Step 1: Publish Staging Deployment

### Via Replit UI
1. Click **"Deploy"** button in top-right corner
2. Select **"Create a new deployment"**
3. Configuration:
   - **Name:** `validation-auto-page-maker`
   - **Type:** Web Service
   - **Region:** US East (closest to target users)
4. Click **"Deploy"**
5. Wait 2-3 minutes for deployment
6. **Copy the final URL** (format: `https://validation-auto-page-maker-<username>.replit.app`)

---

## 🔐 Step 2: Configure Staging Environment Variables

**CRITICAL:** Set these in the deployment's Secrets tab:

```bash
# STAGING MODE (CRITICAL - Activates noindex)
STAGING=true
VITE_STAGING=true

# URL Configuration
APP_BASE_URL=https://validation-auto-page-maker-<username>.replit.app
VITE_PRODUCTION_URL=https://auto-page-maker.replit.app

# Frontend Origins (Production - Unchanged)
FRONTEND_ORIGINS=https://student-pilot.replit.app,https://provider-register.replit.app

# Database (Production - Unchanged, Synthetic Data Only)
DATABASE_URL=<neon-connection-string>

# Analytics (STAGING PROPERTY ONLY - Not Production)
VITE_GA_MEASUREMENT_ID=G-STAGING-ONLY

# Email (Staging/Test Credentials - NOT PRODUCTION)
# Option 1: Test SendGrid key
SENDGRID_API_KEY=<staging-test-key>
# Option 2: Test Postmark key
POSTMARK_API_KEY=<staging-test-key>

# Object Storage (Unchanged)
DEFAULT_OBJECT_STORAGE_BUCKET_ID=<configured>
PRIVATE_OBJECT_DIR=.private
PUBLIC_OBJECT_SEARCH_PATHS=public

# Optional
SEO_SCHEDULER_ENABLED=true
```

**Secrets Hygiene Confirmation:**
- ✅ All keys injected via Replit Secrets
- ✅ Staging uses staging/test analytics (`G-STAGING-ONLY`)
- ✅ No production API keys in staging
- ✅ Production frontend origins kept for CORS testing

---

## ✅ Step 3: Run Five CEO-Required Verification Checks

**Replace `<STAGING_URL>` with your actual staging URL**

### Check 1: X-Robots-Tag Header
```bash
curl -I https://<STAGING_URL>/ | grep -i "x-robots-tag"
```
**Expected Output:**
```
X-Robots-Tag: noindex, nofollow, noarchive
```

### Check 2: robots.txt Disallow All
```bash
curl https://<STAGING_URL>/robots.txt
```
**Expected Output:**
```
User-agent: *
Disallow: /
```

### Check 3: Sitemap (Production URLs Only)
```bash
curl -s https://<STAGING_URL>/sitemap.xml | head -20
```
**Expected:** Sitemap should either:
- Return production URLs only (not staging URLs), OR
- Be disabled/empty in staging mode

**Verify no staging URLs leak:**
```bash
curl -s https://<STAGING_URL>/sitemap.xml | grep -c "validation-auto-page-maker"
```
**Expected:** `0` (no staging URLs)

### Check 4: Health Endpoint
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
**Note:** `"status": "degraded"` is also acceptable if non-critical services are unavailable

### Check 5: Canonical Tag Points to Production
```bash
curl -s https://<STAGING_URL>/scholarships/computer-science | grep -o '<link rel="canonical" href="[^"]*"'
```
**Expected Output:**
```html
<link rel="canonical" href="https://auto-page-maker.replit.app/scholarships/computer-science">
```

**Verify JSON-LD Organization Schema:**
```bash
curl -s https://<STAGING_URL>/ | grep -A 100 'application/ld+json' | jq '."@graph"[] | select(."@type" == "Organization") | .url'
```
**Expected Output:**
```
"https://auto-page-maker.replit.app"
```

---

## 📊 Step 4: Verify Three Canonicalized URL Samples

Test these three pages and confirm canonical tags:

### Sample 1: Homepage
```bash
curl -s https://<STAGING_URL>/ | grep 'canonical'
```
**Expected:** `href="https://auto-page-maker.replit.app/"`

### Sample 2: Scholarship Detail Page
```bash
curl -s https://<STAGING_URL>/scholarships/stem-women-scholarship | grep 'canonical'
```
**Expected:** `href="https://auto-page-maker.replit.app/scholarships/stem-women-scholarship"`

### Sample 3: Category Landing Page
```bash
curl -s https://<STAGING_URL>/category/engineering | grep 'canonical'
```
**Expected:** `href="https://auto-page-maker.replit.app/category/engineering"`

---

## 🗄️ Step 5: Create Read-Only Database User (48h Time-Boxed)

### Calculate Expiry Timestamp
```bash
# Current time + 48 hours
date -u -d '+48 hours' '+%Y-%m-%d %H:%M:%S+00'
```
**Example output:** `2025-11-22 16:35:00+00`

### Execute in Neon Console (SQL Editor)
```sql
-- Generate secure password (32 characters)
-- Save password securely for Agent 3

-- Create time-boxed user (48h expiry)
CREATE ROLE agent3_readonly WITH 
    LOGIN 
    PASSWORD '<SECURE_RANDOM_PASSWORD_HERE>'
    VALID UNTIL '2025-11-22 16:35:00+00';  -- Replace with your +48h timestamp

-- Grant minimal permissions
GRANT CONNECT ON DATABASE neondb TO agent3_readonly;
GRANT USAGE ON SCHEMA public TO agent3_readonly;

-- Grant SELECT only on 4 tables (no INSERT/UPDATE/DELETE)
GRANT SELECT ON landing_pages TO agent3_readonly;
GRANT SELECT ON scholarships TO agent3_readonly;
GRANT SELECT ON business_events TO agent3_readonly;
GRANT SELECT ON daily_kpi_snapshots TO agent3_readonly;

-- Verify permissions (should show SELECT only)
SELECT 
    grantee, 
    table_name, 
    privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'agent3_readonly'
ORDER BY table_name;
```

**Expected Output:**
```
grantee           | table_name           | privilege_type
------------------+---------------------+---------------
agent3_readonly   | business_events      | SELECT
agent3_readonly   | daily_kpi_snapshots  | SELECT
agent3_readonly   | landing_pages        | SELECT
agent3_readonly   | scholarships         | SELECT
```

### Test Connection String
```bash
# Format
postgresql://agent3_readonly:<password>@<neon-host>/<database>?sslmode=require

# Test connection
psql "postgresql://agent3_readonly:<password>@<neon-host>/<database>?sslmode=require" -c "SELECT COUNT(*) FROM landing_pages WHERE is_published = true;"
```
**Expected:** Returns count of published pages (target: 2,060)

---

## 📅 Step 6: Set Calendar Reminders

### T+48h Teardown (MANDATORY)
**Set alarm for:** `<EXPIRY_TIMESTAMP>`

**Actions:**
1. **Revoke Database Access:**
   ```sql
   REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM agent3_readonly;
   DROP ROLE agent3_readonly;
   ```

2. **Unpublish Staging Deployment:**
   - Via Replit Deployments UI: Delete `validation-auto-page-maker`
   - Or keep for 7 days for reference, then delete

3. **Remove Staging-Only Secrets:**
   - Delete `VITE_STAGING=true`
   - Delete `VITE_PRODUCTION_URL`
   - Keep other production secrets

4. **Archive Evidence:**
   - Export GA4 staging data (48h window)
   - Save all test reports from Agent 3
   - File in `evidence/agent3_validation_<date>/`

---

## 🔒 Data Containment Confirmation

### Synthetic Dataset Only (No Real PII)

**Current Database Status:**
- ✅ **Scholarships**: Public scholarship data (no PII)
  - Source: College Board, Fastweb, government programs
  - Fields: Title, amount, deadline, eligibility, organization
  - **No student names, emails, SSNs, or personal data**

- ✅ **Landing Pages**: Auto-generated SEO content
  - No user-submitted content
  - No PII collected or stored

- ✅ **Business Events**: Anonymous telemetry
  - Event types, timestamps, counts
  - No identifiable user information

- ✅ **Daily KPI Snapshots**: Aggregated metrics only
  - No individual user data

**FERPA/COPPA Compliance:**
- ✅ No student records
- ✅ No data from children <13
- ✅ No educational records with PII
- ✅ All data is public or synthetic

**Verification Query:**
```sql
-- Confirm no user PII tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'students', 'profiles', 'accounts');
```
**Expected:** Empty result (no PII tables in Agent 3 access scope)

---

## 🔐 Access Control Decision: Unguessable URL vs Private Deployments

### Selected Strategy: Unguessable URL + Private Sharing

**Rationale:**
1. **Replit Private Deployments** require paid plan upgrade and complex configuration
2. **Unguessable URL** provides sufficient protection for 48h validation:
   - Random subdomain: `validation-auto-page-maker-<random-hash>`
   - Not indexed (noindex headers + robots.txt)
   - Not linked publicly
   - Shared only via secure channel (Slack DM/encrypted email)
   - Time-bound (48h window)

3. **Additional Security Layers:**
   - Rate limiting on all endpoints (protects against abuse)
   - CORS enforcement (exact origins only)
   - S2S endpoints require JWT tokens
   - Mutation endpoints require authentication

4. **Risk Assessment:**
   - No PII exposure (synthetic data only)
   - No production keys (staging/test credentials)
   - Reversible (unpublish after 48h)
   - Monitored (GA4 + Replit analytics)

**If Attack Surface Concerns Arise:**
- Can upgrade to Replit Private Deployment mid-validation
- Can rotate staging URL (new subdomain)
- Can restrict via WAF/Cloudflare if needed

**CEO Approval:** This decision balances security with operational simplicity for a 48h external validation window.

---

## 📈 Observability & SLO Monitoring

### Health Endpoint Metrics
```bash
# Check every 5 minutes during validation
while true; do
  echo "=== $(date) ==="
  curl -s https://<STAGING_URL>/health | jq '{status, uptime, memory}'
  sleep 300
done
```

### Performance Targets (CEO-Mandated)
- **P95 Latency:** ≤ 200ms
- **5xx Error Rate:** < 0.5%
- **Uptime:** ≥ 99.5%

### Daily Reporting (During 48h Window)
**Report to CEO:**
1. **P95 Latency:** Check Replit Analytics or sample API calls
2. **5xx Rate:** Count errors from logs
3. **Uptime:** Calculate from health checks
4. **Errors Found/Fixed:** Document any issues

---

## 📧 Agent 3 Communication Template

**Subject:** Scholar AI Advisor – Staging E2E Validation Access (48h Window)

**Body:**
```
Hello Agent 3,

You now have access to our staging environment for E2E validation under CEO-approved controls.

**Access Details:**

📍 **Staging URL:** <STAGING_URL>
🗄️ **Read-Only DB:** postgresql://agent3_readonly:<password>@<host>/<db>?sslmode=require
⏰ **Expires:** <EXPIRY_TIMESTAMP> (48h from now)

**Validation Scope:**

✅ Functional: ≥99% of 3,216 sitemap URLs return 200
✅ Performance: P95 ≤200ms; 5xx rate <0.5%
✅ Security: 6/6 security headers; CORS enforced; no secrets leaked
✅ SEO: X-Robots-Tag noindex; canonical tags → production; JSON-LD valid
✅ Data Quality: 2,060 landing pages, 1,200 scholarships verified
✅ Load Test: Sustain 200 RPS for 10-15min; error rate <0.1%

**Documentation:**

📚 Comprehensive Guide: evidence/AGENT3_VALIDATION_SETUP.md
📬 Postman Collection: evidence/AGENT3_POSTMAN_COLLECTION.json
🚀 Quick Start: evidence/AGENT3_QUICK_START.md

**Data Containment:**

✅ Synthetic dataset only (no real student PII)
✅ FERPA/COPPA compliant (no educational records)
✅ SELECT-only permissions (48h time-boxed)

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

## ✅ CEO Verification Checklist

**Before submitting one-pager to CEO:**

- [ ] All 5 verification checks passed ✅
- [ ] 3 canonical URL samples confirmed ✅
- [ ] Sitemap behavior verified (no staging URLs) ✅
- [ ] DB user created with exact 48h expiry ✅
- [ ] Secrets hygiene confirmed (staging analytics, no prod keys) ✅
- [ ] Access control decision documented ✅
- [ ] Data containment confirmed (synthetic only, no PII) ✅
- [ ] Calendar reminder set for T+48h teardown ✅
- [ ] Agent 3 communication template ready ✅

---

**Next Step:** Execute deployment and paste verification outputs into CEO thread for final approval.

**Document Status:** READY  
**Date:** November 20, 2025
