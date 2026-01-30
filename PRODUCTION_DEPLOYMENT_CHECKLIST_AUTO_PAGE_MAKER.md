# auto_page_maker - Production Deployment Checklist
**CEO Directive**: Nov 13, 2025 - Deploy auto_page_maker immediately for SEO/CAC reduction  
**Target**: Go live today with sitemaps, robots.txt, canonical tags, and indexable pages  
**URL**: https://auto-page-maker-jamarrlmayes.replit.app  
**Status**: ✅ READY FOR DEPLOYMENT

---

## PRE-DEPLOYMENT VERIFICATION ✅

### Application Identity
- [x] App name corrected: `auto_page_maker` (was incorrectly `auto_com_center`)
- [x] Health endpoint returns correct app name
- [x] Agent Bridge disabled for standalone launch (per CEO directive)

### SEO Features (CEO Requirements)
- [x] **Sitemap.xml**: 2,061 landing pages indexed
- [x] **Robots.txt**: Configured with proper crawl directives
- [x] **Canonical URLs**: Implemented via SEOMeta component
- [x] **Indexable Pages**: All landing pages have proper meta tags
- [x] **Page Count**: 2,061 pages (exceeds 2,000+ target)

### Health & Dependencies
- [x] Database: ✅ Healthy (PostgreSQL/Neon, 64ms latency)
- [x] Email Provider: ✅ Healthy (SendGrid, 188ms latency)
- [x] JWKS: ✅ Healthy (RS256 keys available)
- [x] Overall Status: ✅ HEALTHY

---

## ENVIRONMENT VARIABLES REQUIRED

### Critical for Production
```bash
# Service Identity (REQUIRED)
SERVICE_NAME=auto_page_maker
APP_BASE_URL=https://auto-page-maker-jamarrlmayes.replit.app

# SEO Configuration (REQUIRED)
BASE_URL=https://auto-page-maker-jamarrlmayes.replit.app
PUBLIC_ORIGIN=https://auto-page-maker-jamarrlmayes.replit.app

# Email Provider (REQUIRED - choose one)
SENDGRID_API_KEY=<your_sendgrid_key>
# OR
POSTMARK_API_KEY=<your_postmark_key>

# CORS Configuration (OPTIONAL for standalone SEO launch)
FRONTEND_ORIGINS=https://student-pilot-jamarrlmayes.replit.app,https://provider-register-jamarrlmayes.replit.app

# Agent Bridge (DISABLED for initial launch - enable later)
# COMMAND_CENTER_URL=https://auto-com-center-jamarrlmayes.replit.app
# AGENT_BRIDGE_SHARED_SECRET=<your_shared_secret>
```

### Already Configured ✅
```bash
# These are already set in Replit Secrets
SENDGRID_API_KEY=<configured>
DATABASE_URL=<configured_by_neon>
```

---

## DEPLOYMENT STEPS

### 1. Set Environment Variables in Replit
1. Open Replit Secrets (Tools > Secrets)
2. Add/update the following:
   - `SERVICE_NAME` = `auto_page_maker`
   - `APP_BASE_URL` = `https://auto-page-maker-jamarrlmayes.replit.app`
   - `BASE_URL` = `https://auto-page-maker-jamarrlmayes.replit.app`
   - `PUBLIC_ORIGIN` = `https://auto-page-maker-jamarrlmayes.replit.app`

### 2. Deploy to Production
1. Click "Deploy" button in Replit (or use Replit Deployments)
2. Verify deployment health: `https://auto-page-maker-jamarrlmayes.replit.app/health`
3. Check sitemap: `https://auto-page-maker-jamarrlmayes.replit.app/sitemap.xml`
4. Verify robots.txt: `https://auto-page-maker-jamarrlmayes.replit.app/robots.txt`

### 3. Verify SEO Features
```bash
# Check sitemap URLs use production domain
curl https://auto-page-maker-jamarrlmayes.replit.app/sitemap.xml | head -50

# Check robots.txt points to production sitemap
curl https://auto-page-maker-jamarrlmayes.replit.app/robots.txt

# Test a landing page
curl https://auto-page-maker-jamarrlmayes.replit.app/scholarships/nursing-california
```

---

## POST-DEPLOYMENT: SEO MEASUREMENT (CEO Requirement)

### Google Search Console Setup
1. **Add Property**:
   - Go to: https://search.google.com/search-console
   - Add property: `https://auto-page-maker-jamarrlmayes.replit.app`
   - Verify ownership (HTML meta tag method recommended)

2. **Submit Sitemap**:
   - In Search Console, go to "Sitemaps"
   - Submit: `https://auto-page-maker-jamarrlmayes.replit.app/sitemap.xml`
   - Monitor indexation status

3. **Enable URL Inspection**:
   - Use URL Inspection tool to test individual pages
   - Request indexing for priority pages (e.g., high-volume states/majors)

### Daily Measurement Checklist
Track these metrics daily (CEO requirement: "Measure crawl and indexation daily"):

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Pages Crawled** | 100+ per day | Google Search Console > Coverage |
| **Pages Indexed** | Growing daily | Google Search Console > Index Coverage |
| **Crawl Errors** | 0% | Google Search Console > Coverage > Errors |
| **Sitemap Status** | "Success" | Google Search Console > Sitemaps |
| **Mobile Usability** | 100% | Google Search Console > Mobile Usability |

### IndexNow Integration (Already Configured ✅)
- Service: IndexNow (Bing, Yandex instant indexing)
- Status: ✅ Initialized and ready
- Key File: `/f7721f1a99c133094e74a4a0c78e8cb8.txt`
- Automatic submissions: Every hour (delta updates) + nightly (full refresh)

---

## MONITORING & ALERTS

### Critical Endpoints to Monitor
| Endpoint | Expected Status | Alert Threshold |
|----------|----------------|-----------------|
| `/health` | 200, `status: healthy` | Alert if 503 or `unhealthy` |
| `/sitemap.xml` | 200, 2000+ URLs | Alert if 404 or <1000 URLs |
| `/robots.txt` | 200 | Alert if 404 or 500 |
| `/scholarships/*` | 200 | Alert if error rate >1% |

### SEO Health Checks
```bash
# Run daily to verify SEO infrastructure
curl -s https://auto-page-maker-jamarrlmayes.replit.app/sitemap.xml | grep -c "<url>"
# Expected: 2000+

curl -s https://auto-page-maker-jamarrlmayes.replit.app/robots.txt
# Expected: Contains "Sitemap: https://..."
```

---

## INTEGRATION WITH ECOSYSTEM (Later Gates)

### Not Required for Nov 13 Launch ✅
The following integrations are scheduled for later gates per CEO directive:

- **Agent Bridge** → auto_com_center (scheduled for later gate)
- **Service-to-Service Auth** → scholarship_api, scholarship_sage (Gate 1+)
- **Frontend Integration** → student_pilot, provider_register (Gate 1+)

### Current State: Standalone SEO Launch
- auto_page_maker generates and serves SEO landing pages independently
- No dependencies on other services for core SEO functionality
- Sitemap, robots.txt, and canonical URLs fully functional

---

## SEO LANDING PAGE INVENTORY

### High-Priority Categories (40 Majors × 50 States = 2,000 combos)
**Majors** (sample):
- computer-science
- nursing
- engineering
- business
- education
- pre-med
- psychology
- criminal-justice
- teaching
- accounting
- ... (40 total)

**States**: All 50 US states

**URL Format**: `/scholarships/{major}-{state}`  
**Example**: `/scholarships/nursing-california`

### Sitemap Statistics
- **Total URLs**: 2,061
- **Homepage**: 1
- **Landing Pages**: 2,060
- **Update Frequency**: Weekly (landing pages), Daily (homepage)
- **Priority**: 1.0 (homepage), 0.8 (landing pages)

---

## ROLLBACK PLAN

### If Issues Arise Post-Deployment
1. **Health Check Failing**:
   - Check Replit logs for error messages
   - Verify environment variables are set correctly
   - Rollback: Redeploy previous version

2. **Sitemap Missing Pages**:
   - Check database has 1,200+ scholarships
   - Verify landing pages are published (`isPublished: true`)
   - Regenerate sitemap: POST `/api/rebuild-pages`

3. **SEO Tags Incorrect**:
   - Verify `BASE_URL` environment variable
   - Check SEOMeta component is rendering
   - Inspect landing page HTML source

### Emergency Contacts
- **DRI**: Agent3 (Senior Integration Engineer)
- **Escalation**: CEO (for go/no-go decisions)

---

## GO/NO-GO CHECKLIST

Before clicking "Deploy" in Replit, verify:

- [ ] Environment variables set (SERVICE_NAME, APP_BASE_URL, BASE_URL)
- [ ] Health check returns `"app": "auto_page_maker"`
- [ ] Sitemap.xml has 2000+ URLs
- [ ] Robots.txt configured
- [ ] Email provider (SendGrid) API key is valid
- [ ] Database connection healthy
- [ ] All 3 dependencies healthy (database, email, JWKS)

**GO/NO-GO**: ✅ **GO - All requirements met**

---

## SUCCESS CRITERIA (Nov 13-20)

### Week 1 (Nov 13-20)
| Metric | Target | Measurement |
|--------|--------|-------------|
| Pages Indexed | 500+ | Google Search Console |
| Crawl Rate | 100+/day | Google Search Console |
| Zero Errors | <1% | Google Search Console Errors |
| Site Health | 100% uptime | `/health` endpoint |
| Sitemap Status | "Success" | Search Console Sitemaps |

### CAC Impact Metrics (Week 2+)
| Metric | Baseline | Target (4 weeks) |
|--------|----------|------------------|
| Organic Traffic | TBD | +50% MoM |
| Click-Through Rate | TBD | 2%+ average |
| Organic Conversions | TBD | 10+ per week |
| CAC Reduction | TBD | -20% blended |

---

## DEPLOYMENT STATUS

**Current State**: ✅ Development environment validated  
**Next Action**: Deploy to production via Replit Deployments  
**Owner**: Agent3  
**Timeline**: Deploy today (Nov 13, 2025)  
**Risk Level**: LOW - Standalone service, no dependencies

---

**Prepared By**: Agent3, auto_page_maker DRI  
**Last Updated**: November 13, 2025 20:22 MST  
**Approved For Deployment**: ✅ YES

---

## QUICK REFERENCE

### Production URLs
- **Health**: https://auto-page-maker-jamarrlmayes.replit.app/health
- **Sitemap**: https://auto-page-maker-jamarrlmayes.replit.app/sitemap.xml
- **Robots**: https://auto-page-maker-jamarrlmayes.replit.app/robots.txt
- **Sample Landing Page**: https://auto-page-maker-jamarrlmayes.replit.app/scholarships/nursing-california

### API Endpoints
- `GET /health` - Health check
- `GET /sitemap.xml` - XML sitemap
- `GET /robots.txt` - Robots directives
- `GET /scholarships/:slug` - Landing page
- `POST /api/rebuild-pages` - Regenerate all landing pages (admin)

### Monitoring Commands
```bash
# Health check
curl https://auto-page-maker-jamarrlmayes.replit.app/health | jq '.'

# Sitemap page count
curl -s https://auto-page-maker-jamarrlmayes.replit.app/sitemap.xml | grep -c "<url>"

# Robots.txt
curl https://auto-page-maker-jamarrlmayes.replit.app/robots.txt
```
