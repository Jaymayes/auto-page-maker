# Manual E2E Validation Guide - student_pilot
## CEO Decision: LIMITED GO for B2C (2-Hour Deadline)

**Deadline:** 2 hours from CEO decision (2025-11-01T21:15:00Z)  
**DRI:** Frontend Lead / Human Operator  
**Objective:** Validate full B2C student journey to unlock Limited FOC

---

## Pre-Validation Checklist

✅ **Production Status Verified:**
- scholar_auth: GREEN (JWKS live, tokens validating)
- scholarship_api: GREEN (data layer operational)
- scholarship_sage: GREEN (recommendations engine ready)
- student_pilot: Deployed, awaiting E2E validation
- auto_com_center: GREEN in DRY-RUN mode

✅ **Tools Required:**
- Modern web browser (Chrome/Firefox recommended)
- Browser DevTools (F12) for HAR file and Console
- Stopwatch or browser network timing
- Screenshot tool
- Notepad for recording latency measurements

---

## Test Sequence: Full B2C Student Journey

### Step 1: Homepage Load & First Impression
**URL:** https://workspace-jamarrlmayes.replit.app

**IMPORTANT:** The production deployment uses ONE canonical URL (workspace-jamarrlmayes.replit.app), not separate subdomains for each app. This is the ONLY valid production URL. See CRITICAL_DEPLOYMENT_ARCHITECTURE_FINDINGS.md for details.

**Actions:**
1. Navigate to student_pilot homepage at https://workspace-jamarrlmayes.replit.app
2. Open Browser DevTools (F12) → Network tab
3. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)

**Verify:**
- [ ] Page loads without errors
- [ ] Logo and branding visible
- [ ] Main heading displays "Find Your Perfect Scholarship Match" or similar
- [ ] Call-to-action buttons visible ("Get Started", "Sign In", "Login")
- [ ] No JavaScript errors in Console tab
- [ ] No CORS errors in Console tab

**Record:**
- Screenshot of homepage
- Page load time from Network tab
- Any errors from Console (if any)

---

### Step 2: Authentication Flow (Replit Auth/OIDC)
**Actions:**
1. Click "Sign In" or "Login" or "Get Started" button
2. You should be redirected to Replit Auth login page
3. Complete login with your Replit account
4. You should be redirected back to student_pilot

**Verify:**
- [ ] Login redirect works (no 404 or 500 errors)
- [ ] After login, you're redirected back to student_pilot
- [ ] Your name/email appears somewhere on the page (header, profile, etc.)
- [ ] Session persists (refresh page, still logged in)
- [ ] No authentication errors in Console

**Record:**
- Screenshot of logged-in state
- Network tab: Measure latency for `/api/login` and `/api/callback` endpoints
- Record P95 latency (if multiple requests, note the slowest)
- Confirm JWT token exists (check Application → Cookies → look for `connect.sid` or similar)

**Target:** Authentication P95 ≤120ms (excluding external Replit Auth page load)

---

### Step 3: Profile Creation/Edit
**Actions:**
1. Navigate to profile page (look for "Profile", "My Account", or similar)
2. Fill in or update profile information:
   - Name, email (may be pre-filled)
   - GPA, field of study, graduation year, etc.
3. Save profile

**Verify:**
- [ ] Profile form loads correctly
- [ ] All required fields editable
- [ ] Save button functional
- [ ] Success message displays after save
- [ ] Data persists (refresh page, data still there)
- [ ] No validation errors for valid input

**Record:**
- Screenshot of profile page
- Network tab: Measure latency for profile GET and POST/PUT requests
- Record P95 latency for data save operation

**Target:** Profile CRUD P95 ≤120ms

---

### Step 4: Scholarship Search (scholarship_api integration)
**Actions:**
1. Navigate to scholarship search/browse page
2. Use search functionality (search by keyword, amount, deadline, etc.)
3. Browse results

**Verify:**
- [ ] Search interface loads
- [ ] Search returns results (should show scholarships from database)
- [ ] At least 5-10 scholarships visible
- [ ] Scholarship cards display: title, amount, deadline, description
- [ ] Filtering/sorting works (if available)
- [ ] No API errors in Console

**Record:**
- Screenshot of search results
- Network tab: Measure latency for `/api/scholarships` or search endpoint
- Record number of scholarships returned
- Record P95 latency for search requests (test search 5-10 times with different queries)

**Target:** Search P95 ≤120ms

---

### Step 5: Recommendations (scholarship_sage integration)
**Actions:**
1. Look for "Recommended for You", "Top Matches", or similar section
2. If not visible on main page, check dashboard or dedicated recommendations page
3. Review recommended scholarships

**Verify:**
- [ ] Recommendations section loads
- [ ] At least 3-5 recommended scholarships display
- [ ] Recommendations are personalized (based on profile if you completed Step 3)
- [ ] Can click through to scholarship details
- [ ] No errors from scholarship_sage integration

**Record:**
- Screenshot of recommendations
- Network tab: Look for requests to scholarship_sage (may be `/api/recommendations` or similar)
- Record P95 latency for recommendation requests
- Note accuracy: Do recommendations seem relevant to your profile?

**Target:** Recommendations P95 ≤120ms, Success rate ≥98%

---

### Step 6: Application Submission
**Actions:**
1. Select a scholarship from search or recommendations
2. Click "Apply" or "Submit Application"
3. Fill out application form (essays, personal statement, documents, etc.)
4. Submit application

**Verify:**
- [ ] Application form loads correctly
- [ ] All required fields present
- [ ] Form validation works (try submitting empty form, should show errors)
- [ ] Submit button functional
- [ ] Success message or confirmation displays
- [ ] Application saves (check next step for status)

**Record:**
- Screenshot of application form
- Screenshot of success confirmation
- Network tab: Measure latency for application POST request
- Record P95 latency

**Target:** Application submission P95 ≤120ms

---

### Step 7: Application Status Tracking
**Actions:**
1. Navigate to "My Applications", "Application Status", or similar page
2. Verify the application you just submitted appears
3. Check status information

**Verify:**
- [ ] Application list page loads
- [ ] Your submitted application appears in the list
- [ ] Status is correct (e.g., "Draft", "Submitted", "Pending Review")
- [ ] Can view application details
- [ ] Timestamp shows recent submission

**Record:**
- Screenshot of application status page
- Screenshot of application details
- Network tab: Measure latency for application list GET request

---

### Step 8: Overall Experience & Error Check
**Actions:**
1. Navigate back through the main user flows
2. Check for any persistent errors
3. Test on mobile viewport (Browser DevTools → Toggle device toolbar, select mobile device)

**Verify:**
- [ ] No CORS errors in any flow
- [ ] No authentication errors
- [ ] No 500 server errors
- [ ] No JavaScript exceptions
- [ ] Responsive design works on mobile (320px width)
- [ ] All CTAs accessible and functional

**Record:**
- Screenshot of mobile view
- Final Console check: Copy any errors/warnings
- Overall error rate: Count total requests vs. failed requests

**Target:** Error rate <1%, No CORS/auth errors, Mobile responsive

---

## Performance Summary (30-Sample Baseline)

For accurate P95 latency measurements, perform 30 requests for each critical endpoint:

**Method:**
1. Open Browser DevTools → Network tab
2. Click "Preserve log"
3. Perform the same action 30 times (e.g., search, refresh recommendations)
4. Export as HAR file or manually record timing

**Critical Endpoints:**
- [ ] `/api/auth/user` or login endpoint: P95 ≤120ms
- [ ] `/api/scholarships` or search: P95 ≤120ms
- [ ] Recommendations endpoint: P95 ≤120ms
- [ ] Application submission: P95 ≤120ms

**Calculate P95:**
- Sort 30 timing values from fastest to slowest
- P95 = value at position 29 (the 29th fastest request)

---

## Evidence Bundle (Required for War-Room Submission)

**Screenshots (Required):**
1. Homepage (logged out state)
2. Logged-in state showing user name/email
3. Profile page with data
4. Search results
5. Recommendations section
6. Application form
7. Application confirmation
8. Application status page
9. Mobile responsive view
10. Browser Console (showing zero errors)

**HAR File (Required):**
1. Browser DevTools → Network tab → Right-click → "Save all as HAR with content"
2. Upload HAR file or share via link

**Performance Metrics (Required):**
| Endpoint | P50 (ms) | P95 (ms) | Success Rate | Notes |
|----------|----------|----------|--------------|-------|
| Login/Auth | ___ | ___ | ___% | |
| Profile Load | ___ | ___ | ___% | |
| Profile Save | ___ | ___ | ___% | |
| Search | ___ | ___ | ___% | |
| Recommendations | ___ | ___ | ___% | |
| Application Submit | ___ | ___ | ___% | |

**Error Summary:**
- Total requests: ___
- Failed requests (4xx/5xx): ___
- Error rate: ___% (Target: <1%)
- CORS errors: Yes / No
- Auth errors: Yes / No
- JavaScript exceptions: ___ (List if any)

---

## Exit Criteria (All Must Pass)

✅ **Functional:**
- [ ] Login completes successfully
- [ ] Profile CRUD works
- [ ] Search returns results
- [ ] Recommendations load
- [ ] Application submission succeeds
- [ ] Application status tracking works

✅ **Performance:**
- [ ] P95 ≤120ms for all critical endpoints (or document exceptions)
- [ ] Success rate ≥98% across all operations

✅ **Security:**
- [ ] Zero CORS errors
- [ ] Zero authentication errors
- [ ] Session persists correctly
- [ ] No sensitive data exposed in Console

✅ **UX:**
- [ ] Mobile responsive (tested at 320px-375px width)
- [ ] No broken layouts
- [ ] All CTAs accessible and functional

---

## Submission Format (Post to War-Room)

```
STUDENT_PILOT E2E VALIDATION RESULTS

Date: 2025-11-01
Tester: [Your Name]
Duration: [XX minutes]

OVERALL STATUS: PASS / FAIL / PARTIAL

Functional Tests:
- Login: PASS / FAIL
- Profile: PASS / FAIL
- Search: PASS / FAIL  
- Recommendations: PASS / FAIL
- Application: PASS / FAIL
- Status Tracking: PASS / FAIL

Performance (P95):
- Auth: XX ms (Target: ≤120ms)
- Profile: XX ms
- Search: XX ms
- Recommendations: XX ms
- Application: XX ms

Error Rate: X.XX% (Target: <1%)
CORS Errors: Yes / No
Auth Errors: Yes / No

Mobile Responsive: PASS / FAIL

Evidence Bundle:
- Screenshots: [Link or attachment]
- HAR File: [Link or attachment]
- Performance Data: [See table above]

RECOMMENDATION: GO / NO-GO for B2C activation

Notes/Issues:
[Any concerns, bugs, or recommendations]
```

---

## If Validation FAILS

**Immediate Actions:**
1. Document all failures with screenshots and error messages
2. Note which specific flow failed
3. Check Browser Console for detailed error stack traces
4. Report to war-room immediately
5. Decision: Fix within 2 hours OR delay B2C activation

**Common Issues & Fixes:**
- **CORS errors**: Check CORS allowlist in server configuration
- **401/403 errors**: JWKS validation issue, verify scholar_auth is GREEN
- **Slow performance**: May need optimization or caching
- **Application errors**: Check scholarship_api integration

---

## If Validation PASSES

**Next Steps (Auto Approved by CEO Decision):**
1. Post evidence bundle to war-room
2. auto_com_center can be enabled for SEND mode (transactional emails only)
3. B2C student flows activated for Limited FOC
4. Begin B2C KPI tracking dashboard (T+1)
5. Monitor error rates and performance for 24 hours

**Post-Launch Monitoring (First 24 Hours):**
- Student acquisitions: Visits → signups → verified profiles
- Free→paid conversion tracking
- Recommendation engagement rate
- Application start/submit rates
- P50/P95 latency per endpoint
- Error rate monitoring (alert if >2% for 15 minutes)
- Comms deliverability (when SEND enabled)

---

**BEGIN MANUAL VALIDATION NOW - 2 Hour Deadline**
