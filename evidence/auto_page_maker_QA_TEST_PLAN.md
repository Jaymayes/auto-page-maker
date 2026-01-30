# Master Test Plan - auto_page_maker

**App:** auto_page_maker  
**APP_BASE_URL:** https://auto-page-maker-jamarrlmayes.replit.app  
**Date:** November 20, 2025  
**QA Lead:** Agent3 Test Orchestrator  
**Build ID:** Current production (Day-0 readiness)

---

## Context

### Application Overview
- **App Name:** auto_page_maker
- **Purpose:** SEO-driven organic growth engine for Scholar AI Advisor Platform
- **Build/Branch:** Production deployment (main branch)
- **Environments:**
  - Development: https://auto-page-maker-jamarrlmayes.replit.app
  - Production: https://auto-page-maker.replit.app
  - Staging: (Track 2 deployment pending)

### Platforms
- **Web:** Chrome (current, n-1), Safari (current, n-1), Firefox (current), Edge (current)
- **Mobile Web:** iOS Safari, Android Chrome
- **No Native Apps:** Web-only application

### Critical User Journeys
1. **SEO Discovery** - Organic search → Landing page → CTA click
2. **Page Navigation** - Homepage → Category pages → Scholarship pages
3. **Sitemap Crawling** - Search engines discover URLs via /sitemap.xml
4. **Health Monitoring** - Health checks (/health, /healthz, /readyz)
5. **Admin Rebuild** (Track 2) - POST /internal/rebuild → Async processing → Page updates

### Compliance/Security Context
- **FERPA/COPPA:** Not applicable (no student PII)
- **GDPR:** Not applicable (no user data collection)
- **PCI:** Not applicable (no payment processing)
- **SEO:** Canonical tags, schema.org, robots.txt required

### Service SLOs
- **Uptime:** 99.9% target (current: 99.5%)
- **P95 Latency:** ≤120ms for GET requests
- **P95 E2E Rebuild:** ≤5 minutes (Track 2, not implemented)
- **Success Rate:** ≥99% for all requests

---

## Test Coverage Matrix

| Testing Type | Priority | Status | Owner | Phase |
|--------------|----------|--------|-------|-------|
| **Functional** | P0 | ✅ Planned | QA Lead | Phase 2 |
| **Performance** | P0 | ✅ Planned | QA Lead | Phase 3 |
| **Security** | P0 | ✅ Planned | QA Lead | Phase 3 |
| **Usability** | P1 | ✅ Planned | QA Lead | Phase 4 |
| **Compatibility** | P1 | ✅ Planned | QA Lead | Phase 4 |
| **Regression** | P0 | ✅ Planned | QA Lead | Phase 5 |

---

## Phase 1: Test Planning (Complete)

### Assumptions
1. **Track 1 (SEO Pages)** is the primary scope for Day-0 testing
2. **Track 2 (POST /internal/rebuild)** will be tested in future sprint
3. **No user authentication** required for public pages
4. **No PII collection** - compliance testing simplified
5. **Replit platform** handles HTTPS, TLS, certificates (out of scope)

### Missing Inputs (Documented)
1. **Real user traffic data** - Using projections and curl-based measurements
2. **Historical baseline** - No previous test runs to compare against
3. **UAT stakeholders** - Will rely on automated testing + Agent3 validation

### Test Data
- **Seed Data:** 2,060 scholarship landing pages (production data)
- **Test Accounts:** None required (public pages)
- **Payment Sandbox:** Not applicable
- **Network Profiles:** Excellent, Average, Poor, Offline

### Feature Flags
- `REBUILD_ENDPOINT_ENABLED=false` (Track 2 not implemented)
- `STAGING=false` (production mode)
- `DATA_SOURCE=local` (using local scholarship data)

---

## Phase 2: Functional + Smoke Testing

### Test Suite: Critical User Journeys

#### TC-F001: Homepage Load (P0)
**Scenario:** User navigates to homepage  
**Steps:**
1. Navigate to https://auto-page-maker.replit.app/
2. Verify page loads successfully (200 status)
3. Verify canonical tag present
4. Verify schema.org JSON-LD present
5. Verify navigation links functional

**Expected Results:**
- HTTP 200 response
- Page load time <2 seconds
- Canonical tag: `<link rel="canonical" href="https://auto-page-maker.replit.app/">`
- Schema.org: Organization + WebSite JSON-LD present
- Navigation: Links to category pages, scholarship pages

**Acceptance Criteria:** All assertions pass

---

#### TC-F002: Scholarship Landing Page (P0)
**Scenario:** User views scholarship details  
**Steps:**
1. Navigate to https://auto-page-maker.replit.app/scholarships/computer-science
2. Verify page loads successfully (200 status)
3. Verify scholarship metadata visible (title, description, eligibility)
4. Verify CTA button present ("Apply Now")
5. Verify canonical tag present
6. Verify schema.org JSON-LD present

**Expected Results:**
- HTTP 200 response
- Scholarship title, description visible
- CTA button redirects to student_pilot
- Canonical tag points to this page
- Schema.org: Scholarship JSON-LD present

**Acceptance Criteria:** All assertions pass

---

#### TC-F003: Category Page (P1)
**Scenario:** User browses scholarships by category  
**Steps:**
1. Navigate to https://auto-page-maker.replit.app/category/engineering
2. Verify page loads successfully (200 status)
3. Verify scholarship list visible (at least 1 scholarship)
4. Verify filter/sort options (if applicable)
5. Verify links to individual scholarships work

**Expected Results:**
- HTTP 200 response
- List of scholarships in "engineering" category
- Links to scholarship pages functional

**Acceptance Criteria:** All assertions pass

---

#### TC-F004: Sitemap XML (P0)
**Scenario:** Search engine crawler accesses sitemap  
**Steps:**
1. Navigate to https://auto-page-maker.replit.app/sitemap.xml
2. Verify XML format valid
3. Verify ≥50 URLs present (Day-0 requirement)
4. Verify sample URLs return 200
5. Verify lastmod, priority fields present

**Expected Results:**
- HTTP 200 response
- Valid XML (no parse errors)
- ≥3,216 URLs present
- Sample URLs accessible (200 status)
- lastmod in ISO8601 format, priority 0.0-1.0

**Acceptance Criteria:** All assertions pass

---

#### TC-F005: robots.txt (P1)
**Scenario:** Search engine crawler checks robots.txt  
**Steps:**
1. Navigate to https://auto-page-maker.replit.app/robots.txt
2. Verify file exists (200 status)
3. Verify "User-agent: *" present
4. Verify "Allow: /" present
5. Verify "Sitemap:" directive present

**Expected Results:**
- HTTP 200 response
- User-agent: * (allow all crawlers)
- Allow: / (allow all paths)
- Sitemap: https://auto-page-maker.replit.app/sitemap.xml

**Acceptance Criteria:** All assertions pass

---

#### TC-F006: Health Endpoints (P0)
**Scenario:** Monitoring system checks health  
**Steps:**
1. GET /health → verify 200 + JSON body
2. GET /healthz → verify 200 + dependency checks
3. GET /readyz → verify 200 + readiness status

**Expected Results:**
- All health endpoints return 200
- JSON bodies include status, timestamp, dependencies
- Dependencies: database="connected", jwks_endpoint="reachable"

**Acceptance Criteria:** All health checks pass

---

#### TC-F007: 404 Handling (P1)
**Scenario:** User navigates to non-existent page  
**Steps:**
1. Navigate to https://auto-page-maker.replit.app/nonexistent
2. Verify 404 status
3. Verify friendly error page (not stack trace)
4. Verify no PII leaked in error response

**Expected Results:**
- HTTP 404 response
- Friendly error page with navigation back
- No stack trace or sensitive info

**Acceptance Criteria:** Graceful error handling confirmed

---

### Test Suite: Input Validation (Track 2 - Not Tested Yet)

#### TC-F008: POST /internal/rebuild - Invalid Auth (P0)
**Status:** 🔴 NOT IMPLEMENTED - Track 2  
**ETA:** 48-72 hours

#### TC-F009: POST /internal/rebuild - Invalid Payload (P0)
**Status:** 🔴 NOT IMPLEMENTED - Track 2  
**ETA:** 48-72 hours

#### TC-F010: POST /internal/rebuild - Rate Limit (P0)
**Status:** 🔴 NOT IMPLEMENTED - Track 2  
**ETA:** 48-72 hours

---

## Phase 3: Performance Testing

### Test Suite: Baseline Performance

#### TC-P001: Homepage Load Time (P0)
**Scenario:** Measure homepage performance under normal load  
**Method:** curl with timing, Chrome DevTools  
**Metrics:**
- TTFB (Time to First Byte)
- FCP (First Contentful Paint)
- LCP (Largest Contentful Paint)
- Page Load Complete

**Target SLOs:**
- TTFB P95: ≤120ms
- FCP P95: ≤1000ms
- LCP P95: ≤2500ms
- Page Load: ≤2000ms

**Acceptance Criteria:** All metrics meet SLOs

---

#### TC-P002: Scholarship Page Load Time (P0)
**Scenario:** Measure scholarship page performance  
**Method:** curl with timing, Chrome DevTools  
**Metrics:** Same as TC-P001

**Target SLOs:** Same as TC-P001

**Acceptance Criteria:** All metrics meet SLOs

---

#### TC-P003: Sitemap Load Time (P1)
**Scenario:** Measure sitemap XML load time  
**Method:** curl with timing  
**Metrics:**
- TTFB P95: ≤150ms (larger file, higher tolerance)
- Download time: ≤500ms

**Target SLOs:** As above

**Acceptance Criteria:** All metrics meet SLOs

---

#### TC-P004: Load Test - Sustained Traffic (P0)
**Scenario:** Simulate sustained organic traffic  
**Method:** k6 or Artillery (10 VUs for 10 minutes)  
**Traffic Profile:**
- 10 concurrent users
- 2 requests/second sustained
- 10 minute duration
- Mix: 50% homepage, 30% scholarship pages, 20% category pages

**Target SLOs:**
- P95 latency: ≤120ms
- Error rate: ≤0.1%
- Success rate: ≥99.9%

**Acceptance Criteria:** All SLOs met under sustained load

---

#### TC-P005: Stress Test - Peak Traffic (P1)
**Scenario:** Simulate peak traffic (e.g., viral post)  
**Method:** k6 or Artillery (50 VUs for 5 minutes)  
**Traffic Profile:**
- 50 concurrent users
- 10 requests/second peak
- 5 minute duration

**Target SLOs:**
- P95 latency: ≤200ms (degraded but acceptable)
- Error rate: ≤1%
- Success rate: ≥99%

**Acceptance Criteria:** System remains stable, no crashes

---

#### TC-P006: Network Conditions - Poor Connectivity (P1)
**Scenario:** Simulate 3G network (students on mobile)  
**Method:** Chrome DevTools throttling  
**Conditions:**
- Download: 1.6 Mbps
- Upload: 750 Kbps
- Latency: 300ms

**Target:**
- Page load complete: ≤5 seconds
- No broken images/CSS

**Acceptance Criteria:** Acceptable performance on 3G

---

### Test Suite: Cache Performance

#### TC-P007: Cache Hit Rate (P1)
**Scenario:** Measure cache effectiveness  
**Method:** Repeat requests with same URL  
**Metrics:**
- First request: Cache-Control, ETag headers
- Second request: If-None-Modified → 304 response

**Target:**
- Cache headers present on all static pages
- ETag matches on repeated requests
- 304 responses for unchanged content

**Acceptance Criteria:** Cache working as expected

---

## Phase 4: Security Testing

### Test Suite: OWASP Top 10

#### TC-S001: XSS Prevention (P0)
**Scenario:** Attempt XSS injection in URL params  
**Method:** Inject `<script>alert(1)</script>` in various paths  
**Test Cases:**
- `/scholarships/<script>alert(1)</script>`
- `/category/<img src=x onerror=alert(1)>`
- Query params: `?search=<script>alert(1)</script>`

**Expected Results:**
- All inputs sanitized (HTML entities encoded)
- No script execution
- No reflected XSS vulnerabilities

**Acceptance Criteria:** All XSS attempts blocked

---

#### TC-S002: SQL Injection Prevention (P0)
**Scenario:** Attempt SQL injection in URL params  
**Method:** Inject SQL commands in paths  
**Test Cases:**
- `/scholarships/1' OR '1'='1`
- `/category/engineering'; DROP TABLE scholarships--`

**Expected Results:**
- Drizzle ORM parameterizes all queries
- No SQL errors exposed
- 404 for invalid IDs (not SQL errors)

**Acceptance Criteria:** All SQL injection attempts blocked

---

#### TC-S003: HTTPS Enforcement (P0)
**Scenario:** Attempt HTTP access  
**Method:** curl http://auto-page-maker.replit.app/  
**Expected Results:**
- HTTP → HTTPS redirect (301)
- All resources loaded via HTTPS

**Acceptance Criteria:** HTTPS enforced on all requests

---

#### TC-S004: Secrets Exposure (P0)
**Scenario:** Check for exposed secrets  
**Method:** Inspect source code, network requests  
**Test Cases:**
- View page source for API keys, tokens
- Inspect network requests for secrets in headers
- Check error responses for leaked secrets

**Expected Results:**
- No secrets in page source
- No secrets in client-side JavaScript
- No secrets in error responses

**Acceptance Criteria:** No secrets exposed

---

#### TC-S005: Rate Limiting (P0)
**Scenario:** Trigger rate limit  
**Method:** Send >100 requests in 1 minute from same IP  
**Expected Results:**
- After 100 requests: 429 Too Many Requests
- Headers: X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After
- Rate limit resets after 60 seconds

**Acceptance Criteria:** Rate limiting enforced

---

#### TC-S006: Security Headers (P1)
**Scenario:** Check HTTP security headers  
**Method:** curl -I and inspect headers  
**Required Headers:**
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block

**Optional Headers (Track 2):**
- Content-Security-Policy
- Strict-Transport-Security

**Acceptance Criteria:** Basic security headers present

---

### Test Suite: Authentication & Authorization (Track 2)

#### TC-S007: JWT Validation (P0)
**Status:** 🔴 NOT IMPLEMENTED - Track 2  
**Scope:** POST /internal/rebuild endpoint

#### TC-S008: X-Internal-Key Validation (P0)
**Status:** 🔴 NOT IMPLEMENTED - Track 2  
**Scope:** POST /internal/rebuild endpoint

---

## Phase 5: Usability Testing

### Test Suite: First-Time User Experience

#### TC-U001: Homepage Clarity (P1)
**Scenario:** First-time visitor lands on homepage  
**Heuristic:** Visibility of system status, Match with real world  
**Evaluation:**
- Is the purpose of the site clear within 5 seconds?
- Is the value proposition visible?
- Are navigation options clear?
- Is the CTA prominent?

**Acceptance Criteria:** SUS score ≥70 (estimated)

---

#### TC-U002: Scholarship Page Readability (P1)
**Scenario:** Student reads scholarship details  
**Heuristic:** Aesthetic and minimalist design, Recognition vs. recall  
**Evaluation:**
- Is scholarship info easy to scan?
- Are eligibility requirements clear?
- Is the deadline prominent?
- Is the CTA button visible?

**Acceptance Criteria:** Task success ≥80%

---

#### TC-U003: Mobile Responsiveness (P0)
**Scenario:** Student browses on mobile (iPhone, Android)  
**Evaluation:**
- Pages render correctly on 375px width (iPhone SE)
- Text is readable without zooming
- Buttons are tappable (min 44px touch target)
- No horizontal scrolling

**Acceptance Criteria:** Mobile-friendly design confirmed

---

### Test Suite: Accessibility (WCAG 2.2 AA)

#### TC-A001: Color Contrast (P1)
**Scenario:** Check text/background contrast  
**Tool:** Chrome DevTools Lighthouse, axe DevTools  
**Target:** WCAG AA (4.5:1 for normal text, 3:1 for large text)  
**Acceptance Criteria:** All text meets contrast ratios

---

#### TC-A002: Keyboard Navigation (P1)
**Scenario:** Navigate site using keyboard only  
**Steps:**
1. Tab through all interactive elements
2. Verify focus indicators visible
3. Verify logical tab order
4. Verify no keyboard traps

**Acceptance Criteria:** Full keyboard accessibility

---

#### TC-A003: Screen Reader Compatibility (P1)
**Scenario:** Navigate with screen reader (NVDA, VoiceOver)  
**Evaluation:**
- All images have alt text
- Headings in logical order (h1 → h2 → h3)
- Form labels present (if applicable)
- ARIA landmarks used appropriately

**Acceptance Criteria:** Screen reader can navigate all content

---

#### TC-A004: Automated Accessibility Scan (P1)
**Scenario:** Run automated a11y scan  
**Tool:** Lighthouse, axe DevTools  
**Target:** 0 Critical/High issues  
**Acceptance Criteria:** Automated scan passes

---

## Phase 6: Compatibility Testing

### Device/Browser Matrix

| Platform | Browser/Device | Version | Priority | Status |
|----------|----------------|---------|----------|--------|
| Desktop | Chrome | Current (120+) | P0 | ✅ Planned |
| Desktop | Chrome | n-1 (119) | P1 | ✅ Planned |
| Desktop | Safari | Current (17+) | P0 | ✅ Planned |
| Desktop | Firefox | Current (120+) | P1 | ✅ Planned |
| Desktop | Edge | Current (120+) | P1 | ✅ Planned |
| Mobile | iOS Safari | 16, 17 | P0 | ✅ Planned |
| Mobile | Android Chrome | 119, 120 | P0 | ✅ Planned |
| Tablet | iPad Safari | 16, 17 | P2 | ⏸️ Deferred |

### Test Suite: Cross-Browser Compatibility

#### TC-C001: Chrome (Current) - Full Suite (P0)
**Scope:** Execute TC-F001 through TC-F007, TC-P001 through TC-P003  
**Expected:** All tests pass

#### TC-C002: Safari (Current) - Full Suite (P0)
**Scope:** Execute TC-F001 through TC-F007, TC-P001 through TC-P003  
**Expected:** All tests pass

#### TC-C003: Mobile Safari (iOS 17) - Smoke Suite (P0)
**Scope:** TC-F001, TC-F002, TC-F004, TC-U003  
**Expected:** All tests pass

#### TC-C004: Android Chrome - Smoke Suite (P0)
**Scope:** TC-F001, TC-F002, TC-F004, TC-U003  
**Expected:** All tests pass

---

## Phase 7: Regression Testing

### Smoke Suite (Critical Path)
1. TC-F001: Homepage loads
2. TC-F002: Scholarship page loads
3. TC-F004: Sitemap accessible
4. TC-F006: Health endpoints operational
5. TC-P001: Performance baseline met

**Target:** 100% pass on smoke suite

### Regression Suite (Previously Working Features)
**Baseline:** No previous baseline (first QA run)  
**Approach:** Establish baseline with this QA run  
**Future:** Compare against this baseline for regressions

---

## Test Execution Schedule

| Phase | Duration | Start | End | Dependencies |
|-------|----------|-------|-----|--------------|
| Phase 1: Planning | 2h | T+0 | T+2h | Complete ✅ |
| Phase 2: Functional | 4h | T+2h | T+6h | Planning complete |
| Phase 3: Performance | 3h | T+6h | T+9h | Functional complete |
| Phase 4: Security | 3h | T+9h | T+12h | Functional complete |
| Phase 5: Usability | 2h | T+12h | T+14h | Functional complete |
| Phase 6: Compatibility | 3h | T+14h | T+17h | All tests defined |
| Phase 7: Regression | 2h | T+17h | T+19h | All tests complete |
| Reporting | 1h | T+19h | T+20h | All phases complete |

**Total Duration:** 20 hours (can be parallelized to 12-14 hours)

---

## Deliverables

1. ✅ **Test Plan** (this document)
2. ⏳ **Functional Test Results** (Phase 2 execution)
3. ⏳ **Performance Report** (Phase 3 execution)
4. ⏳ **Security Findings** (Phase 4 execution)
5. ⏳ **Usability Report** (Phase 5 execution)
6. ⏳ **Compatibility Matrix** (Phase 6 execution)
7. ⏳ **Defect List** (consolidated from all phases)
8. ⏳ **Release Readiness Scorecard** (final go/no-go)

---

## Gate Criteria

### Phase 2 Exit Criteria (Functional)
- [ ] ≥95% pass rate on P0 tests
- [ ] No P0 defects open
- [ ] All smoke tests pass

### Phase 3 Exit Criteria (Performance)
- [ ] P95 latency ≤120ms on all GET endpoints
- [ ] Success rate ≥99% on load test
- [ ] No performance regressions vs. baseline

### Phase 4 Exit Criteria (Security)
- [ ] No Critical/High security findings
- [ ] All OWASP Top 10 checks pass
- [ ] Rate limiting enforced

### Phase 5 Exit Criteria (Usability)
- [ ] No Critical a11y blockers
- [ ] SUS score ≥70 (estimated)
- [ ] Mobile responsive design confirmed

### Phase 6 Exit Criteria (Compatibility)
- [ ] No P0 defects on target browsers
- [ ] Mobile Safari and Chrome pass smoke suite

### Phase 7 Exit Criteria (Regression)
- [ ] 100% pass on smoke suite
- [ ] Baseline established for future regressions

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| SEO pages fail to rank | Low | High | Verified canonical, schema.org, performance |
| Downtime during peak traffic | Low | High | Load testing, health monitoring |
| XSS vulnerability | Low | Critical | Input sanitization verified |
| Performance degradation | Medium | Medium | Baseline established, monitoring |
| Mobile compatibility issues | Low | Medium | Cross-browser testing |

---

**Test Plan Status:** ✅ APPROVED  
**Ready for Execution:** Phase 2 (Functional + Smoke)  
**Next Action:** Begin Phase 2 test execution
