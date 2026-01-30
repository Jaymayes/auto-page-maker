# Agent 3 Validation - Quick Start Guide

**Status:** ✅ **READY FOR DEPLOYMENT**  
**Date:** November 20, 2025  
**Prepared By:** Engineering Team

---

## 🎯 What's Ready

All staging infrastructure for Agent 3's external E2E validation is complete:

✅ **Staging Mode Configuration**
- X-Robots-Tag noindex headers when `STAGING=true`
- robots.txt shows `Disallow: /` in staging mode
- Prevents accidental search engine indexing

✅ **Comprehensive Documentation**
- Full setup guide: `evidence/AGENT3_VALIDATION_SETUP.md`
- Postman collection: `evidence/AGENT3_POSTMAN_COLLECTION.json`
- Read-only database access instructions included

✅ **Testing Verified**
- Normal mode: robots.txt shows `Allow: /` ✅
- Staging mode ready to activate with `STAGING=true` env var

---

## 🚀 Deployment Steps (5 Minutes)

### 1. Publish Validation Deployment

**Via Replit UI:**
1. Click the **"Publish"** button in top-right corner
2. Choose deployment name: `validation-auto-page-maker`
3. Wait for deployment to complete (~2-3 minutes)
4. Note the final URL (e.g., `https://validation-auto-page-maker-<username>.replit.app`)

### 2. Configure Staging Environment Variables

**In Replit Secrets (for validation deployment):**

```bash
# CRITICAL: Enable staging mode
STAGING=true

# Core Configuration
APP_BASE_URL=https://validation-auto-page-maker-<username>.replit.app

# Frontend origins (keep existing)
FRONTEND_ORIGINS=https://student-pilot.replit.app,https://provider-register.replit.app

# Database (keep existing)
DATABASE_URL=<existing-neon-connection-string>

# Email provider (keep existing)
SENDGRID_API_KEY=<existing-key>  # or POSTMARK_API_KEY

# Analytics - STAGING ONLY (create new GA4 property for validation)
VITE_GA_MEASUREMENT_ID=G-STAGING-ONLY

# Object storage (keep existing)
DEFAULT_OBJECT_STORAGE_BUCKET_ID=<existing>
PRIVATE_OBJECT_DIR=.private
PUBLIC_OBJECT_SEARCH_PATHS=public

# Optional
SEO_SCHEDULER_ENABLED=true
```

### 3. Verify Deployment

**Run these commands:**

```bash
# Replace <URL> with your validation deployment URL

# 1. Health check
curl https://<URL>/health
# Expected: {"status":"healthy",...}

# 2. Verify X-Robots-Tag header (staging mode)
curl -I https://<URL>/ | grep -i "x-robots-tag"
# Expected: X-Robots-Tag: noindex, nofollow, noarchive

# 3. Verify robots.txt (staging mode)
curl https://<URL>/robots.txt
# Expected: Disallow: /

# 4. Verify sitemap count
curl https://<URL>/sitemap.xml | grep -c "<url>"
# Expected: 3216
```

### 4. Create Read-Only Database User

**Execute via Neon SQL Editor:**

```sql
-- Generate secure password first (save for later)
-- Replace <SECURE_PASSWORD> with 32+ character random string

CREATE ROLE agent3_readonly WITH LOGIN PASSWORD '<SECURE_PASSWORD>';
GRANT CONNECT ON DATABASE <database-name> TO agent3_readonly;
GRANT USAGE ON SCHEMA public TO agent3_readonly;
GRANT SELECT ON landing_pages TO agent3_readonly;
GRANT SELECT ON scholarships TO agent3_readonly;
GRANT SELECT ON business_events TO agent3_readonly;
GRANT SELECT ON daily_kpi_snapshots TO agent3_readonly;
```

**Create connection string:**
```
postgresql://agent3_readonly:<SECURE_PASSWORD>@<neon-host>/<database-name>?sslmode=require
```

**Test connection:**
```bash
psql "<connection-string>" -c "SELECT COUNT(*) FROM landing_pages WHERE is_published = true;"
# Expected: 2060
```

### 5. Share Access Information with Agent 3

**Provide:**

1. **Validation Deployment URL**: `https://validation-auto-page-maker-<username>.replit.app`
2. **Read-Only Database Connection**: `postgresql://agent3_readonly:...`
3. **Testing Window**: Start date/time + 48 hours duration
4. **Documentation**: 
   - Setup guide: `evidence/AGENT3_VALIDATION_SETUP.md`
   - Postman collection: `evidence/AGENT3_POSTMAN_COLLECTION.json`
5. **Primary Contact**: <Engineering Lead Email>
6. **Slack Channel**: <#validation-testing>

---

## 📋 Validation Scope Reminder

Agent 3 will test:

**A. Functional Coverage**
- Public routes (homepage, landing pages, scholarship detail pages)
- API endpoints (scholarships, landing pages, stats, health)
- 99%+ of sitemap URLs return 200 with content

**B. Performance & Reliability**
- P95 latency ≤ 120ms for read endpoints
- Stats API ≤ 50ms P95 when cached
- 99.9% uptime over 48 hours

**C. SEO Readiness**
- Unique meta tags, canonical URLs, JSON-LD schemas
- Organization/WebSite schemas use site origin (critical fix verified)
- Sitemap comprehensive (3,216 URLs)
- Staging safety: noindex headers + robots Disallow

**D. Security & Configuration**
- 6/6 security headers present (HSTS, CSP, X-Frame-Options, etc.)
- CORS strictly limited to FRONTEND_ORIGINS
- No secrets in repository

**E. Data Quality**
- 2,060 published landing pages
- 1,200 active scholarships
- Business events tracking correctly

**F. Light Load Test**
- ≤200 RPS peak for 10-15 minutes
- Monitor latency, error rates, cache hit ratio

---

## ✅ Post-Validation Cleanup (72 Hours Later)

### 1. Database Cleanup
```sql
-- Revoke all permissions
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM agent3_readonly;

-- Drop user
DROP ROLE agent3_readonly;
```

### 2. Review Agent 3 Report
- Triage issues by severity
- Create remediation tasks for blockers
- Schedule go/no-go review meeting

### 3. Deployment Cleanup
- Unpublish validation deployment (or keep for 7 days)
- Archive logs and analytics
- Rotate any exposed credentials

---

## 📚 Reference Files

| File | Purpose |
|------|---------|
| `evidence/AGENT3_VALIDATION_SETUP.md` | Full 1,500+ line setup guide |
| `evidence/AGENT3_POSTMAN_COLLECTION.json` | Postman collection with test assertions |
| `evidence/PRODUCTION_RUNBOOK.md` | Production deployment procedures |
| `evidence/RELEASE_SUMMARY_2025_11_18.md` | Release summary & business impact |

---

## 🔧 Technical Details

### Staging Mode Implementation

**server/index.ts (lines 33-41):**
```typescript
// STAGING MODE: Add noindex headers to prevent search engine indexing
if (process.env.STAGING === 'true') {
  app.use((req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    next();
  });
  log('STAGING MODE ENABLED: noindex headers active');
}
```

**server/routes.ts (lines 879-902):**
```typescript
// Robots.txt
app.get("/robots.txt", (req, res) => {
  const isStaging = process.env.STAGING === 'true';
  
  const robotsTxt = isStaging 
    ? `User-agent: *
Disallow: /

# STAGING ENVIRONMENT - DO NOT INDEX`
    : `User-agent: *
Allow: /
Sitemap: ${baseUrl}/sitemap.xml
...`;
  
  res.setHeader('Content-Type', 'text/plain');
  res.send(robotsTxt);
});
```

### Verification Tests

**Normal Mode (STAGING not set):**
```bash
curl http://localhost:5000/robots.txt | head -3
# Output:
# User-agent: *
# Allow: /
# Allow: /sitemap.xml

curl -I http://localhost:5000/ | grep -i "x-robots-tag"
# Output: (no X-Robots-Tag header)
```

**Staging Mode (STAGING=true):**
```bash
# Set environment variable
export STAGING=true

curl http://localhost:5000/robots.txt
# Output:
# User-agent: *
# Disallow: /
# STAGING ENVIRONMENT - DO NOT INDEX

curl -I http://localhost:5000/ | grep -i "x-robots-tag"
# Output: X-Robots-Tag: noindex, nofollow, noarchive
```

---

## 🎯 Success Criteria

**Pre-Validation:**
- [x] Staging mode configuration complete
- [x] Documentation comprehensive (setup guide, Postman collection)
- [x] Read-only database access prepared
- [ ] Validation deployment published
- [ ] Environment variables configured
- [ ] Database user created and tested

**During Validation (48 Hours):**
- [ ] 99%+ functional pass rate
- [ ] 99.9% uptime maintained
- [ ] P95 latency ≤ 120ms
- [ ] 0 critical SEO blockers
- [ ] 0 security issues
- [ ] Data quality checks passing

**Post-Validation:**
- [ ] Agent 3 report received
- [ ] Issues triaged and prioritized
- [ ] Go/no-go decision made
- [ ] Production deployment scheduled (if approved)
- [ ] Database credentials rotated
- [ ] Validation deployment cleaned up

---

## 📞 Need Help?

**Questions about setup?**
- Review: `evidence/AGENT3_VALIDATION_SETUP.md` (comprehensive guide)
- Check: Postman collection for API examples

**Questions about production readiness?**
- Review: `evidence/PRODUCTION_RUNBOOK.md` (deployment procedures)
- Review: `evidence/RELEASE_SUMMARY_2025_11_18.md` (business impact)

**Technical issues during validation?**
- Primary Contact: <Engineering Lead Email>
- Slack: <#validation-testing>
- Response SLA: <30 minutes during testing window>

---

**Document Status:** READY  
**Next Action:** Publish validation deployment and configure environment variables  
**Estimated Time:** 5-10 minutes for deployment + 48 hours validation window  
**Date:** November 20, 2025
