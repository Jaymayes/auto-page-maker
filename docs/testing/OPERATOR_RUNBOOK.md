# Universal Read-Only E2E Test - Operator Runbook

## Quick Start

### Step 1: Load the Universal Prompt into Agent3

Copy the contents of `universal-readonly-e2e-prompt.txt` and paste it into Agent3 as the system message.

### Step 2: Test Apps by Rollout Gate

**T+24h Gate (Infrastructure Apps):**
```
Test https://scholarship-api-jamarrlmayes.replit.app
Test https://scholarship-agent-jamarrlmayes.replit.app
```
**Success Criteria:** Both apps score ≥ 4

**T+48h Gate (Revenue Apps):**
```
Test https://student-pilot-jamarrlmayes.replit.app
Test https://provider-register-jamarrlmayes.replit.app
```
**Success Criteria:** Both apps score = 5 (revenue-critical)

**T+72h Gate (All Apps):**
```
Test https://auto-com-center-jamarrlmayes.replit.app
Test https://auto-page-maker-jamarrlmayes.replit.app
Test https://scholar-auth-jamarrlmayes.replit.app
Test https://scholarship-sage-jamarrlmayes.replit.app
```
**Success Criteria:**
- All apps ≥ 4
- Auto Page Maker = 5 (SEO gate)
- Scholar Auth = 5 (Auth gate)

### Step 3: Review Reports

Each app test produces a standardized report with:
- **Availability** (DNS, TLS, HTTP status)
- **Performance** (TTFB, timing)
- **Security headers** (present vs missing)
- **Console errors** (count)
- **SEO check** (title, meta, canonical, robots.txt, sitemap.xml)
- **Accessibility scan** (lang, alt attributes, landmarks)
- **Readiness score** (0-5)
- **Recommended actions**
- **Rollout gate status**

### Step 4: Fix and Retest

1. Review `recommended_actions` for each app
2. Prioritize fixes by severity
3. Retest until gate criteria pass
4. Proceed to next rollout phase

---

## App URLs and Types

| App | URL | Type | Revenue |
|-----|-----|------|---------|
| Auto Com Center | https://auto-com-center-jamarrlmayes.replit.app | Admin Dashboard | - |
| Scholarship Agent | https://scholarship-agent-jamarrlmayes.replit.app | Public Frontend | - |
| Scholarship Sage | https://scholarship-sage-jamarrlmayes.replit.app | Public Frontend | - |
| Scholarship API | https://scholarship-api-jamarrlmayes.replit.app | API/Backend | - |
| Student Pilot | https://student-pilot-jamarrlmayes.replit.app | Auth Frontend | B2C 💰 |
| Provider Register | https://provider-register-jamarrlmayes.replit.app | Public Frontend | B2B 💰 |
| Auto Page Maker | https://auto-page-maker-jamarrlmayes.replit.app | SEO Frontend | - |
| Scholar Auth | https://scholar-auth-jamarrlmayes.replit.app | Auth Service | - |

---

## Rollout Gate Criteria

### T+24h - Infrastructure Apps

**Apps:** Scholarship API, Scholarship Agent  
**Criteria:** Both ≥ 4  
**Focus:** Basic availability, performance, security headers

### T+48h - Revenue Apps (CRITICAL)

**Apps:** Student Pilot, Provider Register  
**Criteria:** Both = 5 (must be production-ready)  
**Focus:** Zero critical errors, strong security, payment CSP support

### T+72h - Full Deployment

**Apps:** All 8 apps  
**Criteria:**
- All apps ≥ 4
- Auto Page Maker = 5 (SEO-critical)
- Scholar Auth = 5 (Auth-critical)

**Goal:** First non-zero revenue report 🎯

---

## Readiness Scoring Guide

| Score | Status | Description |
|-------|--------|-------------|
| 0 | Not reachable | DNS/TLS failure |
| 1 | Major blockers | SSL invalid, JS fails, missing root route |
| 2 | Critical issues | Broken nav, severe errors, no security headers |
| 3 | Usable | Non-critical issues present |
| 4 | Near-ready | Only minor issues |
| 5 | Production-ready | Strong availability, performance, security |

---

## Safety Guardrails

**Agent3 will ONLY:**
- Use GET, HEAD, OPTIONS methods
- Respect robots.txt and rate limits
- Collect non-PII evidence
- Produce reports (no changes)

**Agent3 will NEVER:**
- Submit forms or authenticate
- Use POST, PUT, PATCH, DELETE
- Mutate server state
- Collect or store PII
- Bypass security measures

---

## Special Notes

### Auto Com Center (Admin Dashboard)

A 200 on the login page OR a 302/307 redirect to login is acceptable for availability.

**Do not attempt to authenticate.**

Focus on:
- Availability of login page
- Security headers
- No critical console errors
- No sensitive data in HTML source

### Provider Register

**Two possible URLs:**
- https://provider-register-jamarrlmayes.replit.app
- https://provider_register-jamarrlmayes.replit.app

If one fails, try the other.

---

## Troubleshooting

### App scores 0 (Not reachable)

**Check:**
- DNS resolution working
- TLS certificate valid
- App deployed and running
- No firewall blocking

### App scores 1-2 (Blockers/Critical issues)

**Common causes:**
- Missing security headers (HSTS, CSP, X-Frame-Options)
- Severe JavaScript console errors
- Broken navigation or assets
- Invalid SSL certificate

### App scores 3 (Usable but issues)

**Common causes:**
- Minor console errors
- Missing SEO metadata
- Some security headers missing
- Performance slower than ideal

### App scores 4 (Near-ready)

**Common causes:**
- Minor accessibility issues
- Some optional headers missing
- Small performance optimization needed

**Action:** Safe to proceed if not revenue/auth/SEO critical

### App scores 5 (Production-ready)

**All systems go.** Proceed with deployment.

---

## Quick Command Reference

**Test single app:**
```
Test https://student-pilot-jamarrlmayes.replit.app
```

**Test by gate:**
```
T+24h gate: Test Scholarship API and Scholarship Agent
T+48h gate: Test Student Pilot and Provider Register
T+72h gate: Test all apps
```

**Test all apps:**
```
Test all Scholar AI Advisor apps
```

---

## Report Artifacts

Each test produces:
- Structured YAML/JSON-style report
- Key findings (bullet list)
- Recommended actions (prioritized)
- Rollout gate status (pass/fail)

Save reports for:
- Gate approval documentation
- Trend analysis
- Compliance audit trail

---

## Support

**Documentation:**
- `universal-readonly-e2e-prompt.txt` - System prompt
- `OPERATOR_RUNBOOK.md` - This file
- `TESTING_STRATEGY.md` - Overall testing approach

**Questions:**
- Review standardized output format in prompt
- Check app-specific module requirements
- Verify rollout gate criteria

---

**Version:** 1.0  
**Last Updated:** October 28, 2025  
**Status:** ✅ CEO-Approved
