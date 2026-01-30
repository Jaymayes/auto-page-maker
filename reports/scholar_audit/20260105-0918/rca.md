# RCA - Root Cause Analysis (Phase 1)

**Audit Date:** 2026-01-05T09:18 UTC  
**Mode:** Read-Only Diagnostic  
**Status:** 4 Issues Confirmed, Awaiting Approval

---

## Executive Summary

The Scholar Ecosystem is **OPERATIONALLY HEALTHY** (8/8 apps responding) but has 4 confirmed issues requiring staged fixes.

---

## Issues Confirmed

### Issue A: A2 Readiness Endpoint Missing (P1)
- **Evidence**: `GET /ready` returns 404
- **Impact**: Orchestrators cannot distinguish "not ready" from "not found"
- **Root Cause**: Endpoint never implemented
- **Fix**: Add /ready route with dependency checks

### Issue B: A7 Ingestion Latency (P1)
- **Evidence**: P50 = 216ms (target: ≤150ms)
- **Impact**: SLO breach, potential backpressure
- **Root Cause**: Synchronous DB writes on event ingestion
- **Fix**: Async ingestion with 202 Accepted pattern

### Issue C: A8 Stale Incident Banners (P2)
- **Evidence**: Red banners persist after A6 recovery
- **Impact**: Dashboard "split-brain" (green tiles + red incidents)
- **Root Cause**: No auto-clear logic; incidents persist indefinitely
- **Fix**: TTL + health reconciliation + admin clear action

### Issue D: Revenue Visualization Drift (P0 perception)
- **Evidence**: Demo environments show $0 revenue
- **Impact**: Stakeholder confusion during demos
- **Root Cause**: A8 Finance tiles filter out STRIPE_MODE=test events
- **Fix**: Demo Mode toggle with "Test Data" labeling

---

## False Positives Triaged

| Alert | Classification | Evidence |
|-------|----------------|----------|
| "A6 Ghost Ship" | RESOLVED | /health returns 200 with all checks healthy |
| "Revenue Blocked" | FALSE POSITIVE | Revenue path functional; test data filtered |
| "A2 Down" | FALSE POSITIVE | /health returns 200; only /ready is 404 |

---

## 5-Whys: Why does dashboard show issues when fleet is healthy?

1. **Why red banners?** → Incidents not cleared after recovery
2. **Why not cleared?** → No auto-clear mechanism exists
3. **Why no auto-clear?** → A8 designed for manual incident management
4. **Why manual only?** → Original design assumed ops team clears incidents
5. **Why still stale?** → Ops team unaware or automated health checks not triggering clears

**Root Cause**: A8 lacks automated incident lifecycle management

---

## Phase 1 Deliverables

| Artifact | Status |
|----------|--------|
| system_map.json | ✅ Created |
| slo_metrics.json | ✅ Created |
| connectivity_matrix.csv | ✅ Created |
| security_checklist.md | ✅ Created |
| resiliency_config.md | ✅ Created |
| a8_data_lineage.md | ✅ Created |
| a8_validation_results.json | ✅ Created |
| latency_profiles.csv | ✅ Created |
| pr_stubs.md | ✅ Created |
| rca.md | ✅ Created |

---

## HUMAN_APPROVAL_REQUIRED

Phase 1 complete. Awaiting approval to proceed with:

1. **Phase 2**: Implement PR stubs in staging (no production changes)
2. **Phase 3**: Run E2E validation in staging with simulated_audit namespace
3. **Phase 4**: Promote fixes to production (requires separate approval)

**PR Diffs available in**: `pr_stubs.md`
**Risk Matrix available in**: `pr_stubs.md`
