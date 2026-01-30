# Agent 3 External E2E Validation Setup Guide

**Document Version:** 1.0  
**Date:** November 20, 2025  
**Validation Window:** 48 hours from deployment  
**Owner:** Engineering Team

---

## 🎯 Executive Summary

This document provides comprehensive setup instructions for Agent 3's external E2E validation testing of the auto_page_maker validation deployment. This validation de-risks SEO-driven acquisition, API reliability, and production deployment readiness before broader rollout.

**Validation Scope:**
- Public pages and SEO infrastructure
- API endpoints (read-only operations)
- Performance and reliability (SLO conformance)
- Security and configuration hygiene
- Data quality and KPI tracking
- Light load testing (≤200 RPS peak, 10-15 min)

---

## 🔧 Staging Configuration

### Environment Variables (Validation Deployment)

Set these via Replit Secrets for the validation deployment:

```bash
# CRITICAL: Enable staging mode to prevent search engine indexing
STAGING=true

# Core Configuration
APP_BASE_URL=https://validation-auto-page-maker-<username>.replit.app
FRONTEND_ORIGINS=https://student-pilot.replit.app,https://provider-register.replit.app

# Database (Production Neon PostgreSQL)
DATABASE_URL=<neon-postgresql-connection-string>

# Email Provider (choose one)
SENDGRID_API_KEY=<key>  # or
POSTMARK_API_KEY=<key>

# Object Storage (auto-configured)
DEFAULT_OBJECT_STORAGE_BUCKET_ID=<configured>
PRIVATE_OBJECT_DIR=.private
PUBLIC_OBJECT_SEARCH_PATHS=public

# Analytics (STAGING PROPERTY ONLY - do not contaminate production)
VITE_GA_MEASUREMENT_ID=G-STAGING-ONLY

# Optional: SEO Scheduler (enabled for functionality checks)
SEO_SCHEDULER_ENABLED=true
```

### Staging Mode Features

When `STAGING=true` is set:

1. **X-Robots-Tag Headers**: All responses include `noindex, nofollow, noarchive`
2. **robots.txt Disallow**: Robots file shows `Disallow: /` to prevent all crawling
3. **No Search Engine Indexing**: Ensures validation deployment won't be indexed by Google

**Verification Commands:**
```bash
# Verify X-Robots-Tag header
curl -I https://validation-auto-page-maker.replit.app/ | grep -i "x-robots-tag"
# Expected: X-Robots-Tag: noindex, nofollow, noarchive

# Verify robots.txt
curl https://validation-auto-page-maker.replit.app/robots.txt
# Expected: Disallow: /
```

---

## 🌐 URLs & Endpoints

### Base URLs
- **Validation Deployment**: `https://validation-auto-page-maker-<username>.replit.app`
- **Workspace Preview**: `http://localhost:5000` (development only, not accessible externally)

### Public Pages (No Auth Required)

| Route | Description | Expected Count |
|-------|-------------|----------------|
| `/` | Homepage | 1 |
| `/scholarships/<slug>` | Landing pages | 2,015 variations |
| `/scholarship/<id>` | Scholarship detail pages | 1,200 IDs |
| `/sitemap.xml` | Full sitemap | 3,216 URLs |
| `/robots.txt` | Robots file | 1 |

**Sample Landing Page Slugs:**
- `/scholarships/computer-science-california`
- `/scholarships/nursing-texas`
- `/scholarships/engineering-new-york`
- `/scholarships/business-florida`

**Sample Scholarship IDs:**
Get from API: `GET /api/scholarships?limit=10`

### API Endpoints (Read-Only, No Auth Required)

#### Scholarship Endpoints
```bash
# List scholarships (paginated)
GET /api/scholarships?limit=10&offset=0&category=<category>&state=<state>

# Get scholarship by ID
GET /api/scholarships/:id

# Get scholarship statistics (cached, 120s TTL)
GET /api/scholarships/stats
```

#### Landing Page Endpoints
```bash
# Get landing page by slug
GET /api/landing-pages/:slug(*)
# Example: GET /api/landing-pages/computer-science-california
```

#### Health & Monitoring Endpoints
```bash
# Readiness check (fast, <10ms)
GET /readyz

# Health check (comprehensive, includes dependencies)
GET /health
```

#### SEO & Sitemap Endpoints
```bash
# Full sitemap (3,216 URLs)
GET /sitemap.xml

# Robots file (staging: Disallow: /)
GET /robots.txt

# RSS feed (50 most recent pages)
GET /rss.xml
```

---

## 🔐 Database Access (Read-Only)

### Creating Read-Only User (PostgreSQL)

**SQL Commands to Execute (via Neon SQL Editor):**

```sql
-- Create read-only role (time-boxed for 72 hours from creation)
CREATE ROLE agent3_readonly WITH LOGIN PASSWORD '<secure-random-password>';

-- Grant CONNECT to database
GRANT CONNECT ON DATABASE <database-name> TO agent3_readonly;

-- Grant USAGE on schema
GRANT USAGE ON SCHEMA public TO agent3_readonly;

-- Grant SELECT on specific tables
GRANT SELECT ON landing_pages TO agent3_readonly;
GRANT SELECT ON scholarships TO agent3_readonly;
GRANT SELECT ON business_events TO agent3_readonly;
GRANT SELECT ON daily_kpi_snapshots TO agent3_readonly;

-- Verify permissions
\dp landing_pages
\dp scholarships
\dp business_events
\dp daily_kpi_snapshots
```

### Read-Only Connection String

**Format:**
```
postgresql://agent3_readonly:<password>@<neon-host>/<database-name>?sslmode=require
```

**Security Requirements:**
- ✅ Time-boxed: Revoke access after 72 hours
- ✅ Least privilege: SELECT only on 4 tables
- ✅ No PII: Tables don't contain user PII (scholarships are public data)
- ✅ Delivered via Replit Secrets (encrypted at rest)

**Revocation Command (Execute After Validation):**
```sql
-- Revoke all permissions and drop user
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM agent3_readonly;
DROP ROLE agent3_readonly;
```

### Key Tables Schema

**landing_pages:**
- `id` (serial): Primary key
- `slug` (varchar): URL slug (e.g., "computer-science-california")
- `title` (varchar): Page title
- `metaDescription` (varchar): Meta description
- `category` (varchar): Scholarship category
- `state` (varchar): US state (optional)
- `is_published` (boolean): Published status
- `lastGenerated` (timestamp): Last content generation

**scholarships:**
- `id` (varchar): Primary key (UUID)
- `title` (varchar): Scholarship name
- `amount` (integer): Award amount in cents
- `deadline` (varchar): Application deadline
- `category` (varchar): Category
- `eligibility` (jsonb): Eligibility criteria
- `isActive` (boolean): Active status

**business_events:**
- `id` (serial): Primary key
- `eventType` (varchar): Event type (e.g., "page_view", "api_call")
- `eventData` (jsonb): Event metadata
- `timestamp` (timestamp): Event time

**daily_kpi_snapshots:**
- `id` (serial): Primary key
- `date` (date): Snapshot date
- `metric` (varchar): Metric name (e.g., "organic_sessions")
- `value` (numeric): Metric value
- `metadata` (jsonb): Additional data

---

## 📊 Test Scope & Success Criteria

### A. Functional Coverage

**Public Routes (99%+ success rate):**
- ✅ Homepage (`/`) returns 200 with SEO meta tags
- ✅ 99%+ of sitemap URLs return 200 with non-empty content
- ✅ Detail pages (`/scholarship/:id`) resolve with complete metadata
- ✅ Health checks (`/health`, `/readyz`) stable for 48 hours

**APIs (99%+ success rate):**
- ✅ `GET /api/scholarships` returns paginated results
- ✅ `GET /api/scholarships/:id` returns scholarship details
- ✅ `GET /api/scholarships/stats` returns cached stats (<50ms P95)
- ✅ `GET /api/landing-pages/:slug(*)` returns landing page data

### B. Performance & Reliability (SLO Conformance)

**Latency Targets:**
- ✅ P95 ≤ 120ms for read endpoints (light-moderate load)
- ✅ Stats endpoint ≤ 50ms P95 when warm-cached
- ✅ Health endpoint ≤ 200ms P95

**Uptime & Error Rate:**
- ✅ ≥ 99.9% uptime over 48-hour window
- ✅ Error rate < 0.1%

**Evidence Sources:**
- Replit deployment logs (request durations, status codes)
- Replit autoscale analytics (page views, error rates)

### C. SEO Readiness (B2C Organic Engine)

**Landing Pages:**
- ✅ Unique titles, H1 tags, meta descriptions
- ✅ Canonical tags present and correct
- ✅ JSON-LD structured data valid (Organization, WebSite, WebPage, ItemList)
- ✅ Sitemap comprehensive (3,216 URLs) and consistent with internal links

**Staging Safety:**
- ✅ X-Robots-Tag: noindex, nofollow, noarchive
- ✅ robots.txt Disallow: / (prevent accidental crawl)
- ✅ Schema validation passes (schema.org validator)

**Schema Requirements:**
- ✅ Organization schema uses site origin (not page URL)
- ✅ WebSite schema uses site origin (not page URL)
- ✅ WebPage schema uses page-specific URL
- ✅ 99%+ sitemap URLs respond with 200 and correct canonicalization

### D. Security & Configuration Hygiene

**Headers:**
- ✅ HSTS: `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- ✅ X-Content-Type-Options: `nosniff`
- ✅ Referrer-Policy: `strict-origin-when-cross-origin`
- ✅ Permissions-Policy: `camera=(), microphone=(), geolocation=(), payment=()`
- ✅ CSP: `default-src 'self'; frame-ancestors 'none'`

**CORS:**
- ✅ Strictly limited to `FRONTEND_ORIGINS` (no wildcard)
- ✅ Preflight requests handled correctly

**Secrets:**
- ✅ No secrets in repository
- ✅ All secrets delivered via Replit Secrets (encrypted)
- ✅ Deployment-specific config separated

### E. Data Quality & KPIs

**Database Consistency:**
- ✅ 2,060 published landing pages (`is_published = true`)
- ✅ 1,200 active scholarships (`isActive = true`)
- ✅ No broken references between tables
- ✅ Required fields have >99% coverage

**KPI Telemetry:**
- ✅ `business_events` table populates during validation
- ✅ Page views tracked correctly
- ✅ API calls logged with correct metadata
- ✅ SQL aggregate counts align with logs

**Verification Queries:**
```sql
-- Count published landing pages
SELECT COUNT(*) FROM landing_pages WHERE is_published = true;
-- Expected: 2060

-- Count active scholarships
SELECT COUNT(*) FROM scholarships WHERE is_active = true;
-- Expected: 1200

-- Check business events for validation window
SELECT event_type, COUNT(*) 
FROM business_events 
WHERE timestamp >= NOW() - INTERVAL '48 hours'
GROUP BY event_type;
```

### F. Light Load Test (Capped)

**Parameters:**
- ✅ Peak load: ≤200 RPS (requests per second)
- ✅ Duration: 10-15 minutes
- ✅ Endpoints: Read-only APIs and public pages

**Monitoring:**
- ✅ Request durations (P50, P95, P99)
- ✅ Error rate mix (4xx vs 5xx)
- ✅ Cache hit ratio (>80% target)

**Tools:**
- k6, autocannon, or similar load testing tool
- Monitor via Replit analytics/logs during run

---

## 📦 API Documentation (OpenAPI Format)

### OpenAPI 3.0 Specification

```yaml
openapi: 3.0.0
info:
  title: auto_page_maker API
  version: 1.0.0
  description: SEO-optimized scholarship discovery platform API

servers:
  - url: https://validation-auto-page-maker.replit.app
    description: Validation deployment (staging)

paths:
  /api/scholarships:
    get:
      summary: List scholarships
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            default: 10
            maximum: 100
        - name: offset
          in: query
          schema:
            type: integer
            default: 0
        - name: category
          in: query
          schema:
            type: string
        - name: state
          in: query
          schema:
            type: string
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Scholarship'

  /api/scholarships/{id}:
    get:
      summary: Get scholarship by ID
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Scholarship'
        '404':
          description: Scholarship not found

  /api/scholarships/stats:
    get:
      summary: Get scholarship statistics
      description: Cached endpoint with 120s TTL
      responses:
        '200':
          description: Successful response
          headers:
            X-Cache:
              schema:
                type: string
                enum: [HIT, MISS]
              description: Cache status
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Stats'

  /api/landing-pages/{slug}:
    get:
      summary: Get landing page by slug
      parameters:
        - name: slug
          in: path
          required: true
          schema:
            type: string
          description: Landing page slug (e.g., "computer-science-california")
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LandingPage'
        '404':
          description: Landing page not found

  /health:
    get:
      summary: Health check
      responses:
        '200':
          description: Service healthy or degraded
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Health'
        '503':
          description: Service unhealthy

  /readyz:
    get:
      summary: Readiness check
      responses:
        '200':
          description: Service ready
          content:
            application/json:
              schema:
                type: object
                properties:
                  ready:
                    type: boolean
                  timestamp:
                    type: string
                  uptime:
                    type: number
                  service:
                    type: string

components:
  schemas:
    Scholarship:
      type: object
      properties:
        id:
          type: string
        title:
          type: string
        amount:
          type: integer
        deadline:
          type: string
        category:
          type: string
        eligibility:
          type: object
        isActive:
          type: boolean

    LandingPage:
      type: object
      properties:
        id:
          type: integer
        slug:
          type: string
        title:
          type: string
        metaDescription:
          type: string
        category:
          type: string
        state:
          type: string
        is_published:
          type: boolean

    Stats:
      type: object
      properties:
        totalScholarships:
          type: integer
        activeScholarships:
          type: integer
        totalLandingPages:
          type: integer
        categories:
          type: array
          items:
            type: string

    Health:
      type: object
      properties:
        status:
          type: string
          enum: [healthy, degraded, unhealthy]
        timestamp:
          type: string
        version:
          type: string
        dependencies:
          type: array
          items:
            type: object
```

---

## ✅ Deployment Checklist

### Pre-Deployment
- [ ] Environment variables configured in Replit Secrets
- [ ] `STAGING=true` set to enable noindex headers
- [ ] `APP_BASE_URL` points to validation deployment URL
- [ ] `VITE_GA_MEASUREMENT_ID` uses staging property (not production)
- [ ] Database verified (2,060 landing pages, 1,200 scholarships)

### Publish Deployment
- [ ] Click Replit "Publish" button for validation deployment
- [ ] Select deployment name (e.g., "validation-auto-page-maker")
- [ ] Wait for deployment to complete
- [ ] Note final URL: `https://validation-auto-page-maker-<username>.replit.app`

### Post-Deployment Verification
- [ ] Health check passing: `curl https://<URL>/health`
- [ ] X-Robots-Tag present: `curl -I https://<URL>/ | grep -i x-robots-tag`
- [ ] robots.txt shows Disallow: `curl https://<URL>/robots.txt`
- [ ] Sitemap contains 3,216 URLs: `curl https://<URL>/sitemap.xml | grep -c "<url>"`
- [ ] SEO meta tags present on homepage (check browser dev tools)

### Database Access
- [ ] Read-only user created: `agent3_readonly`
- [ ] Permissions granted (SELECT on 4 tables)
- [ ] Connection string generated and tested
- [ ] Credentials delivered via Replit Secrets
- [ ] Revocation date scheduled (72 hours from now)

### Observability
- [ ] Replit deployment logs accessible
- [ ] Replit autoscale analytics enabled
- [ ] Monitoring dashboard ready (Google Analytics staging property)
- [ ] Alert contacts confirmed

---

## 📞 Contact & Escalation

### Testing Window
- **Start**: <Deployment Date/Time>
- **Duration**: 48 hours
- **End**: <End Date/Time>

### Real-Time Escalations
- **Primary Contact**: <Engineering Lead Email>
- **Slack Channel**: <#validation-testing>
- **Response SLA**: <30 minutes during testing window>

### IP Allowlisting
- No IP allowlisting required (public endpoints)
- CORS enforcement via `FRONTEND_ORIGINS` environment variable

---

## 🎯 Deliverables from Agent 3

### 1. Validation Report
- Pass/fail per criterion (A-F)
- Issues prioritized by severity and ARR impact
- SEO blockers and uptime take precedence

### 2. Evidence Pack
- URL samples with screenshots
- Headers (security, CORS, caching)
- JSON-LD schema checks
- Latency distributions (P50, P95, P99)
- Log excerpts (errors, warnings)
- SQL snapshots (read-only queries with results)

### 3. Release Recommendation
- **Ship**: All critical criteria passed, minor issues documented
- **No-Ship**: Critical blockers identified with remediation plan
- **Owner**: Assign owner per remediation item

---

## 🔄 Post-Validation Cleanup

### Immediate (Within 24 Hours)
- [ ] Review Agent 3 validation report
- [ ] Triage identified issues by severity
- [ ] Create remediation tasks for blockers
- [ ] Schedule go/no-go review meeting

### Database Cleanup (72 Hours After Testing)
```sql
-- Revoke all permissions
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM agent3_readonly;

-- Drop read-only user
DROP ROLE agent3_readonly;

-- Verify cleanup
\du
```

### Deployment Cleanup
- [ ] Unpublish validation deployment (or keep for 7 days for reference)
- [ ] Archive logs and analytics from testing window
- [ ] Update `STAGING=false` if reusing deployment
- [ ] Rotate any exposed credentials

---

## 📚 Reference Documentation

### Internal Documentation
- Production Runbook: `evidence/PRODUCTION_RUNBOOK.md`
- Release Summary: `evidence/RELEASE_SUMMARY_2025_11_18.md`
- SEO Component: `client/src/components/seo-meta.tsx`
- Sitemap Generator: `server/services/sitemapGenerator.ts`

### External Resources
- **Google Schema Validator**: https://validator.schema.org/
- **Google Search Console**: https://search.google.com/search-console
- **Replit Docs**: https://docs.replit.com/
- **Neon PostgreSQL**: https://neon.tech/docs

---

**Document Status**: READY  
**Prepared by**: Engineering Team  
**For**: Agent 3 External Validation  
**Date**: November 20, 2025
