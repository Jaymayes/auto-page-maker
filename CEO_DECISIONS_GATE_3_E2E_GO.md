# CEO Decisions - Gate 3 E2E Authorization: GO

**Issued:** 2025-11-02 T+0  
**Status:** 🟢 **E2E TESTING AUTHORIZED - START NOW**

---

## EXECUTIVE DECISIONS

### 1. Recommendations Endpoint Ownership: scholarship_sage ✅

**Decision:** scholarship_sage is the system of record for intelligent/personalized recommendations

**Endpoint Configuration:**
- **Primary:** `GET /recommendations` (JWT-subject, preferred)
- **Admin:** `GET /recommendations/{student_id}` (Admin/SystemService only, for support and batch operations)

**Auth Requirements:**
- JWT required for all requests
- Scopes enforced via RBAC
- JWT-subject pattern preferred (no PII in URLs)

**Data Flow:**
- scholarship_sage pulls current profile and scholarship data from scholarship_api via M2M
- Returns ranked recommendations
- Includes request_id in responses
- Standardized error format

**student_pilot Integration:**
- Feature flag: Primary path points to scholarship_sage /recommendations
- Fallback flag ready but **OFF by default**

---

### 2. Shadow /campaigns Endpoint: NO ❌

**Decision:** Do NOT introduce a shadow /campaigns endpoint in scholarship_sage

**Rationale:**
- Avoid scope creep and tech debt
- Keep marketing/campaigns decoupled from matching intelligence
- If/when needed, source via auto_com_center or dedicated content service

**Action:** Defer campaigns to separate track (not gating for FOC)

---

### 3. Gate 3 E2E Authorization: GO 🚀

**Decision:** E2E testing is authorized **immediately**

**Preconditions:**
- ✅ Use already-registered OIDC client (production ready)
- ✅ Production URLs only
- ✅ Do not expose secrets in client-side code
- ✅ PKCE enabled if client is public

**Key Implication:** OIDC clients are already registered. Proceed directly to E2E execution.

---

## PRIORITY EXECUTION PLAN

### 🔥 Frontend DRI (student_pilot) - START NOW

**Timeline:** 2 hours for complete evidence bundle

**Actions:**
1. ✅ Configure production OIDC and endpoint env vars (already delivered)
2. 🚀 Deploy to production
3. 🚀 Execute B2C E2E run with ≥30 samples
4. 📊 Deliver evidence bundle

**Evidence Bundle Requirements (2-hour deadline):**
- HAR files
- Latency distribution (P50/P95/P99)
- Success/failure counts (401/403/4xx/5xx)
- Lighthouse accessibility report (target ≥90)
- Security headers verification
- CSRF verification

**Feature Flag:**
- Primary path: scholarship_sage /recommendations
- Fallback: OFF by default (keep ready)

**Status:** ✅ AUTHORIZED TO START

---

### 🔥 Sage DRI (scholarship_sage) - START NOW (Parallel)

**Actions:**
1. Confirm production availability:
   - `GET /recommendations` (JWT-subject)
   - `GET /recommendations/{student_id}` (Admin/SystemService)
2. Enforce scopes and RBAC
3. Document response schema (version v1)
4. Validate M2M calls to scholarship_api
5. Include request_id in responses
6. Implement standardized errors
7. Publish API contract one-pager

**Deliverable:** Link to Section 7 evidence with API contract

**Status:** ✅ AUTHORIZED TO START

---

### 🔥 API DRI (scholarship_api) - START NOW (Parallel)

**Ownership:** Remain source of truth for:
- Profiles
- Scholarships
- Applications

**Actions:**
1. Provide cached "last-known" recommendations read-through endpoint
   - **Feature-flagged failover only** (if Sage is down)
   - TTL ≤24h
   - **Default: OFF**
2. Ensure JWKS validation GREEN
3. Ensure RBAC GREEN
4. Maintain P95 ≤120ms

**Status:** ✅ SUSTAIN MODE (already GREEN at P95 71ms)

---

### ⏳ Auth DRI (scholar_auth) - Continue HAR Capture

**Actions:**
1. Produce HAR capture (auth code → token exchange)
2. Close remaining evidence gap
3. Confirm JWKS endpoint health
4. Verify CORS allowlist (student_pilot, provider_register)
5. Verify rate limiting
6. Plan client secret rotation (first GA milestone, ≤30 days)

**Status:** ⏳ PENDING HAR delivery (for complete evidence, not blocking E2E)

---

### ⏳ B2B DRI (provider_register) - Start After student_pilot Auth Confirmation

**Timeline:** 12 hours after Gate 1 GREEN

**Actions:**
1. Start RBAC isolation tests (after student_pilot E2E confirms auth)
2. Deliver 30-sample evidence set

**Status:** 🚫 BLOCKED on student_pilot auth confirmation

---

### ⏳ SEO DRI (auto_page_maker) - T+24h

**Actions:**
1. Verify trigger on scholarship create/update
2. Metadata verification
3. Schema markup verification
4. Deployment proof

**Status:** ⏳ Section 7 submission due T+24h

---

### ⏳ Agent DRI (scholarship_agent) - T+24h

**Actions:**
1. Validate M2M auth
2. Retries/circuit breakers
3. Event dispatch to auto_com_center

**Status:** ⏳ Section 7 submission due T+24h

---

## ACCEPTANCE CRITERIA FOR FOC

### student_pilot E2E (B2C) ✅

**Performance:**
- ✅ P95 latency ≤120ms on UI's critical API calls

**Auth:**
- ✅ Auth success rate ≥98%
- ✅ Zero P0 auth defects

**Accessibility:**
- ✅ Lighthouse ≥90

**Reliability:**
- ✅ 0 critical 5xx during test window

**Integration:**
- ✅ Recommendations widget calling scholarship_sage /recommendations with valid JWT

---

### scholarship_sage ✅

**Endpoints:**
- ✅ /recommendations endpoints operational
- ✅ Documented schema (v1)

**Security:**
- ✅ RBAC/scopes enforced
- ✅ 401/403 verified

**Observability:**
- ✅ Standardized error format with request_id
- ✅ Logs correlate requests across services

---

### scholarship_api ✅

**Ownership:**
- ✅ Continues to pass RBAC and SLOs

**Failover:**
- ✅ Failover recommendations endpoint remains OFF

---

### scholar_auth ✅

**Evidence:**
- ⏳ HAR evidence delivered (in progress)

**Security:**
- ✅ CORS configured
- ✅ Rate-limiting active
- ✅ Password hashing secure
- ✅ JWKS validation green

---

## SCOPE DISCIPLINE AND RISK NOTES

### What NOT to Do ❌

1. **Do not ship /campaigns shadow endpoint** in scholarship_sage
   - Keep marketing/campaigns separate
   - Route via auto_com_center or dedicated service if needed later

2. **Do not expose PII in URLs**
   - Prefer JWT-subject-based access patterns
   - /recommendations (JWT) over /recommendations/{email}

3. **Do not expose secrets in client-side code**
   - Use secure env vars
   - PKCE for public clients

### What TO Do ✅

4. **Refresh-token handling compliance:**
   - HttpOnly cookies
   - Token rotation
   - Revocation support

5. **FERPA/COPPA/consent flows:**
   - Confirm no PII in URLs
   - JWT-subject access pattern
   - Consent tracking

---

## LIFECYCLE AND REVENUE PERSPECTIVE

**Architecture Alignment:** ✅ Confirmed

**Principles:**
- scholarship_api: Source of truth
- scholarship_sage: Intelligence layer for revenue-driving personalization

**Expected Refresh Horizons:**
- scholarship_sage (intelligence cycle): 2-3 years (model/logic refresh)
- student_pilot (UI): 3-4 years (UX/AI-UX evolution)

**Tech Debt:** None added (no shadow endpoints)

---

## DIRECTIVES SUMMARY

**Endpoint Owner:** scholarship_sage ✅

**Endpoint Paths:**
- `GET /recommendations` (JWT-subject) ✅
- `GET /recommendations/{student_id}` (Admin/SystemService) ✅

**Shadow /campaigns:** No (defer) ✅

**E2E Authorization:** GO NOW 🚀

**Deliverables:**
1. student_pilot E2E evidence bundle (2 hours)
2. provider_register RBAC evidence (12 hours post-auth GREEN)
3. Remaining Section 7 reports (T+24h)

---

## REPORT BACK WHEN

**Success Signals:**

1. ✅ student_pilot E2E bundle uploaded and GREEN
2. ✅ scholarship_sage publishes API contract for /recommendations
3. ✅ provider_register completes RBAC evidence set

**This sequencing keeps us on track for FOC while protecting long-term maintainability and revenue velocity.**

---

**STATUS:** 🟢 **E2E TESTING AUTHORIZED - EXECUTION IN PROGRESS**  
**CLOCK:** T+0 (2-hour E2E window started)  
**NEXT CHECKPOINT:** T+2h (student_pilot E2E bundle delivery)
