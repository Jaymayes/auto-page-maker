# student_pilot E2E Smoke Test Verification Checklist

**DRI**: Frontend Lead  
**Trigger**: After Gates 1 & 2 are GREEN  
**Deadline**: T+60 minutes post-trigger  
**Objective**: Validate end-to-end student experience

---

## PREREQUISITES

✅ **GATE 1 (scholar_auth) GREEN** - JWKS endpoint operational  
✅ **GATE 2 (scholarship_api) GREEN** - /canary v2.7 deployed  
✅ **Dependency Check:** scholar_auth + scholarship_api + scholarship_sage all responding

---

## E2E SMOKE TEST SEQUENCE

### Test 1: Homepage Load (Public)

**URL:** https://student-pilot-jamarrlmayes.replit.app/

**Steps:**
1. Navigate to homepage (unauthenticated)
2. Verify page loads successfully
3. Check stats section displays scholarship data
4. Verify "Get My Matches" and "Browse All Scholarships" CTAs present

**Success Criteria:**
- ✅ HTTP 200 response
- ✅ Page load (TTFB) < 500ms
- ✅ Stats display: scholarship count, total amount, average award
- ✅ No critical console errors
- ✅ All images/assets load

**Evidence Required:**
- Screenshot of homepage
- Browser DevTools Network tab (TTFB timing)

---

### Test 2: Browse Scholarships (Public)

**URL:** https://student-pilot-jamarrlmayes.replit.app/scholarships

**Steps:**
1. Click "Browse All Scholarships" button
2. Verify scholarship listing page loads
3. Check filters sidebar present
4. Verify scholarship cards display correctly

**Success Criteria:**
- ✅ HTTP 200 response
- ✅ Multiple scholarship cards visible (≥10)
- ✅ Each card shows: title, amount, deadline, category
- ✅ Filters functional (Award Amount, Deadline, School Level)
- ✅ Page responsive on mobile (no horizontal scroll)

**Evidence Required:**
- Screenshot of scholarship browse page

---

### Test 3: Scholarship Detail View (Public)

**URL:** https://student-pilot-jamarrlmayes.replit.app/scholarship/:id

**Steps:**
1. Click on any scholarship card
2. Verify detail page loads
3. Check all scholarship information displayed
4. Verify "Apply Now" button present

**Success Criteria:**
- ✅ HTTP 200 response
- ✅ Scholarship details: title, description, amount, deadline, eligibility
- ✅ "Apply Now" button visible
- ✅ Source organization displayed

**Evidence Required:**
- Screenshot of scholarship detail page

---

### Test 4: OIDC Authentication Flow (CRITICAL)

**URL:** https://student-pilot-jamarrlmayes.replit.app/

**Steps:**
1. Click "Get My Matches" button (header or hero)
2. Observe redirect to /api/login
3. Complete Replit Auth OIDC flow
4. Verify successful callback to homepage
5. Check authenticated state (user profile/logout button visible)

**Success Criteria:**
- ✅ Click "Get My Matches" → redirects to /api/login
- ✅ OIDC flow initiates (redirect to Replit Auth)
- ✅ After auth, callback to /api/callback
- ✅ Final redirect to / or /dashboard
- ✅ Session cookie set (HttpOnly, Secure)
- ✅ User authenticated (logout button or profile visible)

**Critical Test: Session Validation**
```bash
# From browser DevTools Console (after login):
fetch('/api/auth/user', {credentials: 'include'})
  .then(r => r.json())
  .then(console.log)
```

**Expected Response (200):**
```json
{
  "id": "...",
  "email": "user@example.com",
  "firstName": "Test",
  "lastName": "User",
  "profileImageUrl": "...",
  "createdAt": "...",
  "updatedAt": "..."
}
```

**Failure Indicators:**
- ❌ 401 Unauthorized - Auth flow broken
- ❌ 404 User not found - upsertUser() issue
- ❌ Popup window opens - Old code (should redirect, not popup)

**Evidence Required:**
- HAR file of full auth flow (login → callback → /api/auth/user)
- Screenshot of DevTools showing 200 response from /api/auth/user
- Screenshot of authenticated homepage

---

### Test 5: Scholarship Search (Authenticated)

**URL:** https://student-pilot-jamarrlmayes.replit.app/scholarships

**Steps:**
1. Navigate to /scholarships (as authenticated user)
2. Use search/filter functionality
3. Verify results update correctly

**Success Criteria:**
- ✅ Search field functional
- ✅ Filters apply correctly (major, location, level)
- ✅ Results render from scholarship_api
- ✅ API call: GET /api/scholarships with query params

**Evidence Required:**
- DevTools Network tab showing successful API calls

---

### Test 6: Personalized Recommendations (scholarship_sage)

**URL:** https://student-pilot-jamarrlmayes.replit.app/ (authenticated dashboard)

**Steps:**
1. From authenticated homepage
2. Verify personalized recommendations section
3. Check recommendations load from scholarship_sage

**Success Criteria:**
- ✅ Recommendations section visible
- ✅ API call to scholarship_sage succeeds
- ✅ Recommendations display relevant scholarships
- ✅ Each recommendation shows match score or reason

**Evidence Required:**
- Screenshot of recommendations section
- DevTools Network tab showing scholarship_sage API call

---

### Test 7: Application Draft (End-to-End)

**URL:** https://student-pilot-jamarrlmayes.replit.app/scholarship/:id

**Steps:**
1. Navigate to scholarship detail (authenticated)
2. Click "Apply Now" button
3. Verify application form loads
4. Fill out basic information
5. Save draft (do not submit)

**Success Criteria:**
- ✅ Application form accessible
- ✅ Form fields render correctly
- ✅ Draft save succeeds
- ✅ Data persists (reload page, draft still there)

**Evidence Required:**
- Screenshot of application form
- DevTools showing successful POST /api/applications

---

### Test 8: Logout Flow

**URL:** https://student-pilot-jamarrlmayes.replit.app/

**Steps:**
1. Click logout button/link
2. Verify redirect to /api/logout
3. Confirm session cleared
4. Check redirected to homepage (unauthenticated state)

**Success Criteria:**
- ✅ Logout button functional
- ✅ Redirect to /api/logout
- ✅ Session cookie cleared
- ✅ Subsequent /api/auth/user returns 401
- ✅ Redirected to public homepage

**Evidence Required:**
- Screenshot of public homepage post-logout

---

### Test 9: Security Headers (All Pages)

**URL:** Any student_pilot page

**Steps:**
```bash
curl -I https://student-pilot-jamarrlmayes.replit.app/
curl -I https://student-pilot-jamarrlmayes.replit.app/scholarships
```

**Success Criteria:**
- ✅ All 6 security headers present on every page:
  - Strict-Transport-Security
  - Content-Security-Policy
  - X-Frame-Options
  - X-Content-Type-Options
  - Referrer-Policy
  - Permissions-Policy

**Evidence Required:**
- curl -I output showing all headers

---

### Test 10: Mobile Responsiveness

**Device:** iPhone 12/13 (390x844) or Chrome DevTools mobile emulation

**Steps:**
1. Open homepage on mobile viewport
2. Navigate through key pages
3. Test authentication flow on mobile
4. Verify scholarship browse on mobile

**Success Criteria:**
- ✅ No horizontal scroll
- ✅ Touch targets ≥48px
- ✅ Navigation accessible (hamburger menu if present)
- ✅ Forms usable on mobile
- ✅ Images responsive

**Evidence Required:**
- Screenshots of mobile homepage, browse, detail pages

---

### Test 11: Accessibility Quick Check

**Tool:** Browser DevTools Lighthouse (Accessibility audit)

**Steps:**
1. Run Lighthouse on 3 key pages:
   - Homepage
   - Scholarship browse
   - Scholarship detail
2. Check for critical issues

**Success Criteria:**
- ✅ Lighthouse Accessibility score ≥90 on all pages
- ✅ No critical contrast issues
- ✅ All interactive elements keyboard-accessible
- ✅ Form fields have proper labels

**Evidence Required:**
- Lighthouse report JSON exports

---

## PERFORMANCE METRICS (Required)

### Page Load Times (TTFB)

```bash
# Measure 5 samples for each page
for i in {1..5}; do
  curl -s -w 'TTFB: %{time_starttransfer}s\n' -o /dev/null \
    https://student-pilot-jamarrlmayes.replit.app/
  sleep 0.5
done
```

**Acceptance:**
- ✅ Homepage TTFB < 500ms
- ✅ Scholarship browse < 800ms
- ✅ Scholarship detail < 600ms

---

### API Response Times (P95)

```bash
# Measure /api/scholarships endpoint (30 samples)
for i in {1..30}; do
  curl -s -w '%{time_total}\n' -o /dev/null \
    "https://student-pilot-jamarrlmayes.replit.app/api/scholarships?limit=10"
  sleep 0.1
done | sort -n | awk 'NR==29 {printf "P95: %.0f ms\n", $1*1000}'
```

**Acceptance:** P95 ≤ 120ms

---

### Auth Success Rate

**Calculation:** (Successful logins / Total login attempts) × 100

**Method:**
1. Attempt 10 OIDC login flows
2. Record successes vs failures
3. Calculate success rate

**Acceptance:** ≥98% (9.8/10 must succeed)

**Note:** In development/staging, all 10 should succeed. In production with real users, allow for network issues.

---

## HAR FILE CAPTURE (Required)

**Critical Path HAR:**

1. Open Chrome DevTools
2. Network tab → "Preserve log" ON
3. Execute full E2E flow:
   - Homepage load
   - Click "Get My Matches"
   - Complete OIDC flow
   - Load /api/auth/user
   - Browse scholarships
   - View detail
   - Load recommendations
   - Logout
4. Right-click Network tab → "Save all as HAR with content"

**Submit:** `student_pilot_e2e_smoke.har`

---

## FAILURE SCENARIOS & ROLLBACK TRIGGERS

### Critical Failures (NO-GO)

- ❌ OIDC login broken (cannot authenticate)
- ❌ /api/auth/user returns 404 (user persistence broken)
- ❌ scholarship_api requests fail (dependency issue)
- ❌ Security headers missing (compliance issue)

**Action:** Report to CEO immediately, halt launch

---

### Warning Issues (Document but proceed)

- ⚠️ P95 > 120ms but < 250ms (monitor)
- ⚠️ Lighthouse accessibility 85-90 (minor issues)
- ⚠️ Non-critical console warnings

**Action:** Document in Section 7 report, add to post-launch backlog

---

## GATE 3 SUCCESS CRITERIA (Report to CEO)

```
GATE 3 STATUS: GREEN

End-to-End Flow:
✅ Login → OIDC flow complete → /api/auth/user returns 200
✅ Profile loaded with correct user data
✅ Scholarships fetched from scholarship_api
✅ Recommendations loaded from scholarship_sage
✅ Application draft saved successfully
✅ Logout flow functional

Performance:
✅ Homepage TTFB: <X>ms (< 500ms)
✅ API P95: <X>ms (≤ 120ms)
✅ Auth success rate: 100% (10/10)

Security:
✅ 6/6 security headers on all pages
✅ Session cookies HttpOnly + Secure
✅ RBAC enforced (401 on protected routes)

Accessibility:
✅ Lighthouse score ≥90 on key pages
✅ Keyboard navigation functional
✅ Mobile responsive (no horizontal scroll)

Evidence Attached:
- student_pilot_e2e_smoke.har
- Screenshots (8 total: homepage, browse, detail, auth, mobile, recommendations, application, logout)
- Lighthouse reports (3 pages)
- Performance metrics (TTFB, P95, auth success rate)

Gate 3 Status: GREEN - Ready for soft launch
```

---

## TIMELINE

- **T+0**: Gates 1 & 2 confirmed GREEN
- **T+15**: Begin E2E smoke test execution
- **T+45**: Complete all test sequences
- **T+60**: Submit HAR file + evidence bundle + Gate 3 report to CEO

---

## EMERGENCY ESCALATION

**If any critical failure:**
1. Stop testing immediately
2. Report to CEO with failure details
3. NO soft launch until issue resolved

**Critical blocker examples:**
- Auth broken (404 on /api/auth/user)
- scholarship_api unreachable
- Security headers missing
- Data loss or corruption

---

**END OF CHECKLIST**
