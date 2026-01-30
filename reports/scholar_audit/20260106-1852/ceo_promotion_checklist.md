# CEO Promotion Checklist

**Audit Date:** 2026-01-06  
**Protocol:** AGENT3_HANDSHAKE  
**Promotion Path:** A6 → A8 → A1

## Executive Summary

This checklist gates the promotion of critical fixes from staging to production. Each section requires explicit sign-off before proceeding.

**Current Status:** ❌ NOT READY FOR PROMOTION  
**Blocker:** A6 (provider_register) returning 500 on /register endpoint

---

## Phase 1: A6 (provider_register) Promotion

### Prerequisites

| Requirement | Status | Owner | Notes |
|-------------|--------|-------|-------|
| Migration validated on shadow DB | ⬜ PENDING | A6 Team | Schema diff + validation required |
| /register returns 200 on staging | ⬜ PENDING | A6 Team | Currently 500 |
| /api/billing smoke test passes | ⬜ PENDING | A6 Team | Verify billing endpoints |
| Provider funnel E2E (Lead→Demo→Contract→Live) | ⬜ PENDING | A6 Team | Full flow validation |
| Finance events: 3% fee ($30) verified | ⬜ PENDING | A6 Team | For $1000 GMV simulation |
| Finance events: 4x markup ($40) verified | ⬜ PENDING | A6 Team | For $10 AI cost simulation |
| A8 Finance tile shows events | ⬜ PENDING | A8 Team | Namespace: simulated_audit |

### Sign-offs

| Role | Name | Date | Signature |
|------|------|------|-----------|
| A6 Workspace Owner | _____________ | ____/____/____ | _____________ |
| A8 Workspace Owner | _____________ | ____/____/____ | _____________ |
| Engineering Lead | _____________ | ____/____/____ | _____________ |

### Rollback Plan

1. **Trigger:** /register 5xx rate > 1% post-promotion OR Finance tile shows incorrect values
2. **Action:** Revert to previous deployment via Replit checkpoint
3. **Verification:** Confirm /register returns 200, Finance tile stable
4. **Notify:** Slack #scholar-ops channel

---

## Phase 2: A8 (scholar_command_center) Promotion

### Prerequisites

| Requirement | Status | Owner | Notes |
|-------------|--------|-------|-------|
| All tiles receiving simulated_audit data | ⬜ PENDING | A8 Team | Growth, Finance, SEO, Outcomes |
| Dashboard queries updated | ⬜ PENDING | A8 Team | Include namespace filter |
| READ_ONLY_LOCK verified | ⬜ PENDING | A8 Team | No unauthorized writes |
| Lineage proven: event_id → A2 → A8 | ⬜ PENDING | A8 Team | Document in a8_data_lineage.md |

### Sign-offs

| Role | Name | Date | Signature |
|------|------|------|-----------|
| A8 Workspace Owner | _____________ | ____/____/____ | _____________ |
| Engineering Lead | _____________ | ____/____/____ | _____________ |

### Rollback Plan

1. **Trigger:** Tiles show no data OR dashboard errors
2. **Action:** Revert dashboard queries via checkpoint
3. **Verification:** Confirm all tiles populating correctly
4. **Notify:** Slack #scholar-ops channel

---

## Phase 3: A1 (scholar_auth) Promotion

### Prerequisites

| Requirement | Status | Owner | Notes |
|-------------|--------|-------|-------|
| 10/10 OIDC flows pass on staging | ⬜ PENDING | A1 Team | Full redirect chain |
| Cookie flags correct (SameSite=None, Secure=True) | ⬜ PENDING | A1 Team | Inspect Set-Cookie header |
| P95 auth ≤ 150ms | ⬜ PENDING | A1 Team | Latency validation |
| client_id allowlist verified | ⬜ PENDING | A1 Team | Security check |

### Sign-offs

| Role | Name | Date | Signature |
|------|------|------|-----------|
| A1 Workspace Owner | _____________ | ____/____/____ | _____________ |
| Security Lead | _____________ | ____/____/____ | _____________ |
| Engineering Lead | _____________ | ____/____/____ | _____________ |

### Rollback Plan

1. **Trigger:** OIDC flows failing > 5% OR session loop detected
2. **Action:** Revert to previous auth deployment
3. **Verification:** Confirm 10/10 OIDC flows pass
4. **Notify:** Slack #scholar-ops channel + page on-call

---

## Post-Promotion Monitoring

| Metric | Threshold | Dashboard | Alert |
|--------|-----------|-----------|-------|
| A6 /register 5xx rate | < 1% | A8 Reliability | PagerDuty |
| A8 tile latency | P95 < 500ms | A8 Performance | Slack |
| A1 OIDC success rate | > 99% | A8 Auth Health | PagerDuty |
| Finance tile data freshness | < 5 min | A8 Finance | Slack |

---

## Final Approval

**EGRS Target:** 100/100  
**Current EGRS:** 71/100 (Not Ready)

| Criterion | Required | Current |
|-----------|----------|---------|
| A6 /register 200 | ✅ | ❌ |
| All tiles live | ✅ | ⏳ |
| All E2E green | ✅ | ⏳ |
| P95 ≤ 150ms all apps | ✅ | A7 ✅, others ⏳ |
| 0% 5xx in staged flows | ✅ | A6 ❌ |

### CEO Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| CEO | _____________ | ____/____/____ | _____________ |

**Authorization:** This promotion is APPROVED / NOT APPROVED (circle one)
