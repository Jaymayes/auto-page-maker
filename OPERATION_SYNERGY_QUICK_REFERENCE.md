# Operation Synergy - Quick Reference Card

**T+0 Clock Started:** 2025-11-02  
**Mission:** B2C DRY-RUN launch with 20-student pilot cohort

---

## 🚨 CRITICAL PATH (Next 1 Hour)

**AUTH DRI - HAR CAPTURE (SLA: T+1h)**

**Action:** Capture OAuth flow evidence for student_pilot and provider_register

**Steps:**
1. Open Chrome DevTools (F12) → Network tab
2. Check "Preserve log"
3. Navigate to: `https://student-pilot-jamarrlmayes.replit.app/api/login`
4. Complete OAuth flow
5. Right-click Network tab → "Save all as HAR with content"
6. Save as: `student_pilot_oauth_flow.har`
7. Repeat for: `https://provider-register-jamarrlmayes.replit.app/api/login`
8. Save as: `provider_register_oauth_flow.har`

**What HAR Should Show:**
- ✅ `/api/login` request
- ✅ Replit OIDC authorization redirect
- ✅ `/api/callback?code=...` with authorization code
- ✅ Response with `access_token`, `refresh_token`, `id_token`
- ✅ `connect.sid` session cookie

**Time:** ~10-15 minutes  
**Unblocks:** Everything else

---

## ⏱️ TIMELINE

| Deadline | Owner | Task |
|----------|-------|------|
| **T+1h** | Auth DRI | HAR capture (student_pilot + provider_register) |
| **T+3h** | Frontend DRI | student_pilot E2E harness ready (after auth GREEN) |
| **T+6h** | Comms DRI | auto_com_center DRY-RUN validation |
| **T+6h** | Sage DRI | scholarship_sage routing evidence |
| **T+12h** | SEO DRI | auto_page_maker 10 test pages |
| **T+12h** | B2B DRI | provider_register RBAC evidence (after auth GREEN) |
| **T+24h** | All DRIs | Section 7 reports (4 remaining) |

---

## ✅ GOOD NEWS UPDATES

### scholarship_api: SUSTAIN MODE ✅
- **P95:** 71ms (target: ≤120ms)
- **Status:** Performance CLOSED
- **Action:** Maintain for 24 hours, freeze index changes

### provider_register: PERFORMANCE CLEARED ✅
- **P95:** ~2ms (CEO accepted)
- **Status:** Ready for B2B DRY-RUN path
- **Action:** Await auth evidence + RBAC proof

### auto_com_center: ALREADY VERIFIED ✅
- **P95:** 2ms
- **DRY-RUN:** Confirmed active
- **Action:** T+6h validation with queue health

---

## 📊 B2C DRY-RUN GO CRITERIA

**Approved, Contingent on:**

### Preconditions (Must Pass Before Launch):
1. ✅ scholar_auth: HAR evidence (T+1h) ⏳
2. ✅ student_pilot: E2E harness (T+3h) 🚫 BLOCKED
3. ✅ auto_com_center: DRY-RUN validation (T+6h) ⏳

### Success Metrics (24-Hour Pilot):
- Registration → first recommendation: ≥60%
- Registration → application started (7 days): ≥25%
- Sev1 incidents: 0
- Unsubscribe flow: 100% functional
- Live sends: 0

**Pilot Size:** Up to 20 students  
**Mode:** DRY-RUN only (no live comms)

---

## 🚫 B2B DRY-RUN - ON HOLD

**Performance:** CLEARED (P95 ~2ms)

**Still Needed:**
1. Auth evidence: Same HAR as student_pilot (T+1h)
2. RBAC isolation: 30-sample evidence with Provider tokens (T+12h after auth)

**Decision:** Deferred until both preconditions met

---

## 📋 SECTION 7 REPORTS

**Received (4/8, 50% complete):**
- ✅ scholar_auth
- ✅ auto_com_center
- ✅ scholarship_sage
- ✅ scholarship_api

**Due T+24h (4/8, 50% remaining):**
- ⏳ student_pilot (Frontend DRI)
- ⏳ provider_register (B2B DRI)
- ⏳ scholarship_agent (Agent DRI)
- ⏳ auto_page_maker (SEO DRI)

**Format:**
- ≥30 latency samples
- 6/6 security headers
- Lifecycle estimate (specific quarter)
- Risk triggers and budget envelope

---

## 🎯 IMMEDIATE ACTIONS BY ROLE

### Auth DRI (URGENT - T+1h)
- [ ] Capture student_pilot HAR
- [ ] Capture provider_register HAR
- [ ] Verify both contain access_token + refresh_token
- [ ] Submit to CEO

### Frontend DRI (BLOCKED - T+3h after auth)
- [ ] Wait for auth GREEN
- [ ] Configure student_pilot env vars
- [ ] Run E2E tests (30 samples)
- [ ] Lighthouse a11y ≥90
- [ ] Submit evidence

### Comms DRI (T+6h)
- [ ] Execute /api/send DRY-RUN test
- [ ] Verify queue health (depth, latency, errors)
- [ ] Prove suppression list enforcement
- [ ] Document circuit breaker and retries

### Sage DRI (T+6h)
- [ ] Test /recommendations/{student_id} without auth (expect 401)
- [ ] Test /recommendations/{student_id} with JWT (expect 200)
- [ ] Capture security headers and latency
- [ ] Resolve routing conflict (404 vs no issue)

### B2B DRI (T+12h after auth)
- [ ] Wait for auth GREEN
- [ ] Generate 30 Provider role tokens
- [ ] Verify tenant isolation (org-scoped queries only)
- [ ] Submit RBAC evidence

### SEO DRI (T+12h)
- [ ] Wait for scholarship_api GREEN
- [ ] Generate 10 test scholarship pages
- [ ] Verify trigger integrity from API events
- [ ] Confirm SEO metadata (titles, descriptions, schema.org)
- [ ] Add noindex during DRY-RUN

---

## 🎬 WHAT HAPPENS AFTER HAR CAPTURE

**Immediate Effects (T+1h):**
- ✅ Auth DRI deliverable: COMPLETE
- ✅ Gate 1: Full GREEN
- ✅ B2C DRY-RUN: APPROVED (no longer contingent)
- ✅ Frontend DRI: UNBLOCKED (can start E2E)
- ✅ B2B DRI: UNBLOCKED (can prepare RBAC evidence)

**Next 2 Hours (T+1h to T+3h):**
- Frontend DRI runs student_pilot E2E tests
- Platform team prepares for pilot cohort
- Monitoring dashboards go live

**Next 6 Hours (T+1h to T+6h):**
- Comms DRI validates DRY-RUN mode
- Sage DRI resolves routing investigation
- All systems monitored for stability

**Launch Decision (T+6h):**
- If all preconditions met → B2C DRY-RUN GO
- Pilot cohort: 20 students
- Duration: 24 hours initial window
- Review: T+24h for expansion decision

---

## 🔍 TROUBLESHOOTING

### If HAR Capture Fails:

**"Redirect URI mismatch"**
→ Check REPLIT_DOMAINS env var on production Repl  
→ Should be single domain, not comma-separated list

**"Client not found"**
→ REPL_ID missing or incorrect  
→ Should be auto-provided by Replit platform

**"Invalid scope"**
→ Check server/replitAuth.ts line 93  
→ Should include: openid, email, profile, offline_access

**No redirect**
→ Verify production URL (not localhost)  
→ Ensure workflow running  
→ Check browser console for errors

---

## 📞 ESCALATION

**If Critical Path Blocked:**
1. Attempt troubleshooting (see above)
2. Document error with screenshots
3. Escalate to CEO immediately
4. Do not wait until SLA expires

**Current Critical Path:**
- Auth HAR capture (T+1h) → Everything else depends on this

---

## 🎯 SUCCESS DEFINITION

**Operation Synergy Succeeds When:**
- ✅ B2C DRY-RUN launched with 20-student pilot
- ✅ Zero live sends (DRY-RUN enforced)
- ✅ ≥60% reach first recommendation
- ✅ ≥25% start application (7-day proxy)
- ✅ Zero Sev1 incidents
- ✅ All 8 Section 7 reports submitted
- ✅ FOC decision made at T+24h

**Long-term Goal:**
- $10M profitable ARR via SEO-led organic growth
- Low CAC through auto_page_maker landing pages
- B2C credit sales + B2B provider fees

---

**START NOW - CLOCK RUNNING**

The entire operation depends on the 1-hour HAR capture. Everything else cascades from this single action.

**Good luck!** 🚀
