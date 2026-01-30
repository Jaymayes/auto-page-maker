# GO/NO-GO Cutover Plan (V2.0)
**RUN_ID:** CEOSPRINT-20260114-CUTOVER-V2-038 | **Protocol:** v30 DriftGuard
**Status:** PENDING CEO HITL APPROVAL

---

## Executive Summary

Platform Overhaul V2.0 introduces a modular microservices architecture with:
- **Database-as-a-Service** (DataService) for strict data isolation
- **First Upload** activation pivot replacing Magic Chat
- **Privacy/compliance guardrails** (FERPA delineation, under-18 safeguards)
- **Resilience patterns** (backoff, circuit breakers)

---

## Pre-Cutover Checklist

| Item | Status | Notes |
|------|--------|-------|
| V2 services built | ✓ | 4 services + shared utilities |
| Staging validation | Pending | Awaiting deployment |
| P95 ≤ 120ms | Pending | Awaiting SLO test |
| A8 round-trip | Pending | Awaiting deployment |
| Shadow mode (24h) | Pending | Awaiting HITL |
| HITL-CEO approval | REQUIRED | - |

---

## Cutover Steps (Requires HITL-CEO)

### Phase 1: Shadow Mode (24h)
1. Deploy V2 services to production as shadow
2. Route 10% traffic to V2 (read-only, no mutations)
3. Post shadow events to A8 with `shadow=true`
4. Compare metrics against legacy

### Phase 2: Routing Switch
1. Update A1/A5 flows to route to OnboardingOrchestrator-v2
2. Maintain legacy endpoints as fallback
3. Monitor error rates and latency

### Phase 3: Validation
1. Run INCIDENT VERIFY (032) with Scorched Earth
2. Confirm 2-of-3 second-confirmation per service
3. Verify P95 ≤ 120ms across all V2 endpoints

### Phase 4: Re-Freeze
1. Rebuild drift baselines with V2 hashes
2. Update version_manifest.json
3. Regenerate golden_freeze_bundle
4. POST bundle to A8, verify checksum
5. Re-enable FREEZE_LOCK=1

---

## Backout Plan (< 5 minutes)

1. Revert routing to legacy A1/A5 endpoints
2. Disable V2 shadow mode
3. Verify legacy health (7/8 fleet)
4. Post rollback event to A8
5. Resume Sentinel mode on legacy

---

## Impact Projections

### Upload Conversion
- Current: Magic Chat loop (high friction)
- V2: First Upload prompt (low friction)
- Expected: +15-25% activation rate

### Privacy Compliance
- Current: Manual enforcement
- V2: Automated age-gate + DoNotSell
- Expected: 100% compliance for minors

### Resilience
- Current: No circuit breakers
- V2: Automatic failover with backoff
- Expected: -40% cascade failures

---

## Acceptance Criteria for Cutover

| Criterion | Target | Required |
|-----------|--------|----------|
| V2 P95 | ≤ 120ms | Yes |
| Error rate | < 0.1% | Yes |
| A8 ingestion | ≥ 99% | Yes |
| Shadow parity | ≥ 95% | Yes |
| HITL approval | Logged | Yes |

---

## Safety Rails (Enforced)

- **FREEZE_LOCK**: Remains =1 until HITL override
- **Stripe**: No charges during cutover
- **B2C**: CONDITIONAL status maintained
- **Rollback**: < 5 minute recovery

---

## CEO Decision Required

To proceed with cutover:
1. Review shadow mode results (after 24h)
2. Confirm acceptance criteria met
3. Log HITL-CEO-XXX approval in hitl_approvals.log
4. Agent executes CUTOVER (038) → Re-Freeze (034)

---

## Attestation

**CUTOVER PLAN: READY**
**STATUS: AWAITING CEO HITL APPROVAL**

Production remains frozen until explicit override granted.
