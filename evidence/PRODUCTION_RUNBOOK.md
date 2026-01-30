# auto_page_maker Production Deployment Runbook

**Version:** 1.0  
**Last Updated:** November 18, 2025  
**Owner:** Engineering Team  
**Deployment Target:** December 1, 2025 (ARR Ignition Date)

---

## Executive Summary

This runbook documents the deployment, monitoring, and incident response procedures for auto_page_maker, the Scholar AI Advisor Platform's primary low-CAC organic growth engine targeting $10M ARR. The system generates 2,000+ SEO-optimized scholarship landing pages to drive student acquisition.

**Key Metrics Target:**
- Year 1 ARR: $424.5K
- 5-Year ARR: $2.16M
- Total URLs: 3,216 (1 homepage + 2,015 landing pages + 1,200 scholarship detail pages)

---

## Pre-Deployment Checklist

### Environment Configuration
- [ ] `APP_BASE_URL` set to production domain
- [ ] `FRONTEND_ORIGINS` configured for CORS
- [ ] `DATABASE_URL` pointing to production Neon PostgreSQL
- [ ] `SENDGRID_API_KEY` or `POSTMARK_API_KEY` configured for email notifications
- [ ] `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for caching (if applicable)
- [ ] Object storage credentials (`DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS`)

### Code Verification
- [ ] All E2E tests passing (SEO meta tags, JSON-LD structured data, sitemap)
- [ ] LSP diagnostics reviewed (known non-blocking issues documented)
- [ ] Git changes reviewed and committed
- [ ] Architect approval received

### Database State
- [ ] 2,060 published landing pages (`is_published = true`)
- [ ] 1,200 active scholarships (`is_active = true`)
- [ ] Database migrations applied (if any)
- [ ] Backup verified and accessible

---

## Deployment Procedure

### Step 1: Deploy Backend
```bash
# Push changes to production branch
git push production main

# Or deploy via Replit publish button
# The workflow "Start application" will run: npm run dev
```

### Step 2: Verify Health Endpoints
```bash
# Check readiness
curl https://<PRODUCTION_URL>/readyz
# Expected: {"ready":true,"timestamp":"...","uptime":...,"service":"auto_page_maker"}

# Check health
curl https://<PRODUCTION_URL>/health
# Expected: {"status":"healthy","timestamp":"...","dependencies":[...]}
```

### Step 3: Verify SEO Features
```bash
# Test sitemap
curl https://<PRODUCTION_URL>/sitemap.xml | grep -c "<url>"
# Expected: 3216 URLs

# Test robots.txt
curl https://<PRODUCTION_URL>/robots.txt
# Expected: Contains production domain, not localhost

# Test meta tags (use browser dev tools)
# Navigate to: https://<PRODUCTION_URL>/scholarship/<any-id>
# Verify: document.title, meta[name="description"], JSON-LD schema
```

### Step 4: Verify API Performance
```bash
# Test stats API caching
curl -I https://<PRODUCTION_URL>/api/scholarships/stats
# Check X-Cache header: HIT or MISS

# Test response times (should be <120ms for cached, <600ms for cold)
time curl https://<PRODUCTION_URL>/api/scholarships/stats
```

### Step 5: Submit Sitemap to Google
```bash
# Submit via Google Search Console
# URL: https://<PRODUCTION_URL>/sitemap.xml

# Or ping Google directly
curl "https://www.google.com/ping?sitemap=https://<PRODUCTION_URL>/sitemap.xml"
```

---

## Monitoring & Observability

### Key Metrics Dashboard

**Traffic Metrics:**
- Page views per landing page
- Bounce rate (<60% target)
- Time on page (>60s target)
- Conversion rate to "Get Matches" CTA

**Performance Metrics:**
- P95 latency for /api/scholarships/stats (<120ms cached, <600ms cold)
- P95 latency for /health (<200ms acceptable)
- Cache hit ratio (>80% target)
- Error rate (<1% target)

**SEO Metrics:**
- Indexed pages in Google Search Console (target: 3,216)
- Organic traffic from Google
- Click-through rate from search results
- Average search ranking position

**Business Metrics:**
- Daily active users (DAU)
- Monthly active users (MAU)
- Lead generation rate (email captures)
- Conversion to paid pilot ($15/mo)

### Monitoring Tools

**Google Analytics 4:**
- Dashboard: https://analytics.google.com
- Key events: page_view, get_matches, filter_change, scholarship_view
- Custom dimensions: landing page type, scholarship category

**Google Search Console:**
- Dashboard: https://search.google.com/search-console
- Monitor: indexed pages, crawl errors, mobile usability
- Submit: sitemap.xml, request indexing for new pages

**Application Logs:**
- Access via Replit console: Workflow "Start application" logs
- Monitor for: ERROR level logs, 5xx responses, CORS issues
- Key patterns: "[CORS]", "[SEO Scheduler]", "[IndexNow]"

**Health Check Monitoring:**
- Endpoint: https://<PRODUCTION_URL>/health
- Frequency: Every 5 minutes
- Alert on: status !== "healthy" for >3 consecutive checks

---

## Alerting Thresholds

### Critical Alerts (Page Immediately)
- **Service Down**: /health returns 503 or times out for >5 minutes
- **Database Unavailable**: dependency.database.status !== "healthy"
- **Error Rate Spike**: >5% of requests returning 5xx errors for >10 minutes
- **Sitemap Missing**: /sitemap.xml returns 404 or <3000 URLs

### High Priority (Notify Within 1 Hour)
- **Performance Degradation**: P95 latency >1000ms for >15 minutes
- **Cache Failure**: Cache hit ratio <50% for >30 minutes
- **SEO Issue**: Google Search Console reports >50 crawl errors
- **Zero Traffic**: No organic traffic for >4 hours during business hours

### Medium Priority (Review Next Day)
- **Slow Queries**: Database health check >250ms for >1 hour
- **Low Conversion**: CTA click rate <1% for >24 hours
- **Landing Page Staleness**: >100 landing pages not refreshed in >30 days

---

## Incident Response Procedures

### Service Outage (5xx Errors)
1. **Check health endpoint**: `curl https://<PRODUCTION_URL>/health`
2. **Review logs**: Replit console → Workflow logs
3. **Check database**: `curl https://<PRODUCTION_URL>/health` → dependencies.database
4. **If database down**: Contact Neon support, check DATABASE_URL
5. **If application error**: Review error logs, check recent deployments
6. **If CORS issue**: Verify FRONTEND_ORIGINS env var
7. **Escalate**: If unresolved in 30 minutes, execute rollback

### Performance Degradation
1. **Check cache**: `curl -I https://<PRODUCTION_URL>/api/scholarships/stats` (verify X-Cache: HIT)
2. **Check database latency**: Review /health → dependencies.database.responseTime
3. **Check traffic spike**: Google Analytics → Real-time dashboard
4. **If cache miss rate high**: Restart application to clear corrupted cache
5. **If database slow**: Review slow query logs, consider read replica
6. **If traffic spike**: Monitor for organic spike vs bot attack (check user agents)

### SEO Issues
1. **Verify sitemap**: `curl https://<PRODUCTION_URL>/sitemap.xml | grep -c "<url>"`
2. **Verify robots.txt**: `curl https://<PRODUCTION_URL>/robots.txt`
3. **Check meta tags**: Browser dev tools → Elements → <head>
4. **Check JSON-LD**: Browser dev tools → script[type="application/ld+json"]
5. **Verify Organization/WebSite URLs**: Ensure using site origin, not page URL
6. **If schema invalid**: Review client/src/components/seo-meta.tsx
7. **If sitemap missing URLs**: Review server/services/sitemapGenerator.ts
8. **Re-submit to Google**: Search Console → Sitemaps → Re-submit

### Rollback Procedure
1. **Identify last known good version**: Review deployment history
2. **Execute rollback**:
   ```bash
   git revert <commit-hash>
   git push production main
   ```
   Or use Replit rollback UI if available
3. **Verify health**: Repeat deployment verification steps
4. **Notify stakeholders**: Email team with rollback reason and timeline
5. **Post-mortem**: Document root cause and prevention measures

---

## Post-Deployment Verification

### Immediate (Within 30 Minutes)
- [ ] All health checks passing
- [ ] Sitemap contains 3,216 URLs
- [ ] robots.txt uses production domain
- [ ] SEO meta tags present on homepage and scholarship detail pages
- [ ] JSON-LD Organization/WebSite schemas use site origin
- [ ] Stats API cache working (X-Cache: HIT)
- [ ] No 5xx errors in logs

### Short-Term (Within 24 Hours)
- [ ] Google Analytics tracking events (page_view, get_matches)
- [ ] No crawl errors in Google Search Console
- [ ] Sitemap submitted and processing in Search Console
- [ ] Organic traffic baseline established
- [ ] Cache hit ratio >80%
- [ ] P95 latency <200ms

### Medium-Term (Within 7 Days)
- [ ] Google indexing 3,000+ pages
- [ ] Organic search impressions increasing
- [ ] Landing pages appearing in search results
- [ ] User feedback positive (no UX issues)
- [ ] Performance stable under traffic
- [ ] No memory leaks or resource exhaustion

---

## Key URLs & Endpoints

### Public Endpoints
- **Homepage**: `https://<PRODUCTION_URL>/`
- **Landing Pages**: `https://<PRODUCTION_URL>/scholarships/<slug>`
- **Scholarship Detail**: `https://<PRODUCTION_URL>/scholarship/<id>`
- **Sitemap**: `https://<PRODUCTION_URL>/sitemap.xml`
- **Robots**: `https://<PRODUCTION_URL>/robots.txt`

### API Endpoints
- **Stats**: `GET /api/scholarships/stats` (cached, 120s TTL)
- **Scholarships List**: `GET /api/scholarships?limit=10`
- **Scholarship Detail**: `GET /api/scholarships/:id`
- **Landing Pages**: `GET /api/landing-pages/:slug(*)`

### Health & Monitoring
- **Readiness**: `GET /readyz`
- **Health**: `GET /health`
- **Version**: `GET /version`

### External Services
- **Google Analytics**: https://analytics.google.com (requires VITE_GA_MEASUREMENT_ID)
- **Google Search Console**: https://search.google.com/search-console
- **Neon Database**: https://console.neon.tech (DATABASE_URL)

---

## Known Issues & Limitations

### Non-Blocking Issues
1. **LSP Diagnostics (scholarship-category.tsx)**:
   - Missing properties: `content.h1`, `content.introText`, `updatedAt`
   - Impact: None - TypeScript warnings only, runtime works correctly
   - Resolution: Type definitions can be updated in follow-up

2. **Health Endpoint Variability**:
   - Latency: 97-257ms (exceeds 120ms SLO occasionally)
   - Cause: Database/email provider health checks
   - Impact: Acceptable - not user-facing
   - Mitigation: Caching strategy in place

3. **CSP Blocks Google Tag Manager**:
   - Console warnings: GTM image requests blocked by CSP
   - Impact: Expected behavior in development
   - Resolution: Verify GTM loads correctly in production

### Follow-Up Improvements
1. **Performance Optimization**:
   - Optimize database health check query (target <120ms)
   - Consider read replica for high traffic
   - Implement Redis caching for landing pages

2. **Schema Validation**:
   - Add automated JSON-LD validation in tests
   - Integrate schema-dts or structured data testing tool
   - Prevent schema regressions

3. **Monitoring Enhancements**:
   - Add Slack integration for critical alerts
   - Implement custom dashboard for business metrics
   - Set up automated weekly SEO reports

---

## Emergency Contacts

**Engineering Team:**
- Primary: [Engineering Lead Email]
- Secondary: [DevOps Engineer Email]
- On-Call Rotation: [PagerDuty/On-Call Schedule]

**External Services:**
- Replit Support: https://replit.com/support
- Neon Support: https://neon.tech/docs/introduction/support
- Google Search Console Help: https://support.google.com/webmasters

**Escalation Path:**
1. Engineering Lead (0-30 minutes)
2. CTO (30-60 minutes)
3. CEO (>60 minutes or business-critical impact)

---

## Change Log

### v1.0 (November 18, 2025)
- Initial production runbook
- Documented deployment procedures
- Established monitoring and alerting thresholds
- Defined incident response procedures
- Added post-deployment verification checklist

---

## Appendix: Critical Code Paths

### SEO Implementation
- **Component**: `client/src/components/seo-meta.tsx`
- **Key Fix**: Organization/WebSite schemas use `siteOrigin` (not page URL)
- **Pages**: `landing.tsx`, `scholarship-detail.tsx`, `scholarship-category.tsx`

### Sitemap Generation
- **Service**: `server/services/sitemapGenerator.ts`
- **Key Enhancement**: Includes 1,200 scholarship detail URLs
- **Schedule**: Nightly refresh at 2:00 AM EST, hourly delta updates

### Caching Strategy
- **Implementation**: `server/routes.ts` (lines 413-439)
- **Endpoints**: `/api/scholarships/stats`, `/api/scholarships/listing`
- **TTL**: 120 seconds
- **Headers**: X-Cache (HIT/MISS), Cache-Control

### Environment Variables (Production)
```bash
# Core Configuration
APP_BASE_URL=https://auto-page-maker.replit.app
FRONTEND_ORIGINS=https://student-pilot.replit.app,https://provider-register.replit.app

# Database
DATABASE_URL=postgresql://...(Neon connection string)

# Email Provider (choose one)
SENDGRID_API_KEY=SG.xxx
POSTMARK_API_KEY=xxx

# Object Storage
DEFAULT_OBJECT_STORAGE_BUCKET_ID=xxx
PRIVATE_OBJECT_DIR=.private
PUBLIC_OBJECT_SEARCH_PATHS=public

# Analytics
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Optional: Redis Cache
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# Optional: SEO Automation
SEO_SCHEDULER_ENABLED=true
```

---

**Document End**
