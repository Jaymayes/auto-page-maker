# Risk Register

**Audit Date:** 2026-01-06
**Status:** Active Monitoring

---

## Active Risks

### RISK-001: A6 Service Unavailable (P0 - CRITICAL)

| Field | Value |
|-------|-------|
| **ID** | RISK-001 |
| **Category** | Availability |
| **Severity** | P0 - Critical |
| **Status** | OPEN |
| **Owner** | SRE / TBD |
| **Detected** | 2026-01-06 |

**Description:**
A6 provider-register returns HTTP 500 on all endpoints, preventing provider registration and blocking the B2B revenue funnel.

**Impact:**
- B2B revenue funnel: BLOCKED
- Provider signups: 0
- Revenue loss: $X/day (pending baseline)

**Mitigation:**
1. Access A6 Replit project
2. Check logs for startup error
3. Verify DATABASE_URL and STRIPE secrets
4. Restart with debugging enabled

**Contingency:**
- Manual provider onboarding via database
- Direct communication with interested providers

---

### RISK-002: Auth Database Latency (P2)

| Field | Value |
|-------|-------|
| **ID** | RISK-002 |
| **Category** | Performance |
| **Severity** | P2 - Medium |
| **Status** | OPEN |
| **Owner** | A1 Team |
| **Detected** | 2026-01-06 |

**Description:**
A1 auth_db response time is 247ms, exceeding the 150ms SLO target.

**Impact:**
- User login latency increased
- Potential session timeouts
- Degraded user experience

**Mitigation:**
1. Review connection pool configuration
2. Implement connection pre-warming
3. Consider read replicas

---

### RISK-003: Auth Token Leakage Potential (P2)

| Field | Value |
|-------|-------|
| **ID** | RISK-003 |
| **Category** | Security |
| **Severity** | P2 - Medium |
| **Status** | MONITORING |
| **Owner** | A1 Team |
| **Detected** | 2026-01-06 |

**Description:**
Cross-subdomain auth flows on replit.app may be vulnerable to token leakage if cookie SameSite/Secure attributes are misconfigured.

**Impact:**
- Potential session hijacking
- Cross-site request forgery

**Mitigation:**
- Verify SameSite=Lax or Strict on auth cookies
- Ensure Secure flag set for HTTPS
- Audit redirect_uri allowlist

---

### RISK-004: Revenue Blindness (P1)

| Field | Value |
|-------|-------|
| **ID** | RISK-004 |
| **Category** | Data Quality |
| **Severity** | P1 - High |
| **Status** | BLOCKED |
| **Owner** | A6/A8 Teams |
| **Detected** | 2026-01-06 |

**Description:**
B2B revenue events are not flowing to A8 because A6 is down. Finance tiles may show stale or incomplete data.

**Impact:**
- Revenue reporting inaccurate
- Business decisions based on incomplete data
- Provider funnel metrics missing

**Mitigation:**
1. Restore A6 service
2. Verify 3% fee and 4x markup logic
3. Confirm Finance tile updates in A8

---

### RISK-005: No Pre-flight Health Checks (P2)

| Field | Value |
|-------|-------|
| **ID** | RISK-005 |
| **Category** | Resiliency |
| **Severity** | P2 - Medium |
| **Status** | OPEN |
| **Owner** | Platform Team |
| **Detected** | 2026-01-06 |

**Description:**
Services can start and accept traffic before dependencies are ready, leading to cascading failures.

**Impact:**
- User-facing errors on cold start
- Delayed failure detection
- Poor user experience

**Mitigation:**
- Implement readiness probes
- Add dependency checks before accepting traffic
- Configure startup health gates

---

## Risk Matrix

| Severity | Count | IDs |
|----------|-------|-----|
| P0 Critical | 1 | RISK-001 |
| P1 High | 1 | RISK-004 |
| P2 Medium | 3 | RISK-002, RISK-003, RISK-005 |
| P3 Low | 0 | - |

---

## Risk Trends

| Date | P0 | P1 | P2 | P3 | Total |
|------|----|----|----|----|-------|
| 2026-01-06 | 1 | 1 | 3 | 0 | 5 |

---

## Closed Risks

*No risks closed in this audit cycle*

---

## Review Schedule

| Risk | Next Review |
|------|-------------|
| RISK-001 | Immediate (after A6 access) |
| RISK-002 | 2026-01-07 |
| RISK-003 | 2026-01-10 |
| RISK-004 | After RISK-001 resolved |
| RISK-005 | 2026-01-13 |
