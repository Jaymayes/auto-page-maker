# Step-by-Step Merge Instructions

**Date:** 2026-01-06
**Status:** Ready for External Repo Implementation

---

## Overview

This document provides merge instructions for Issues A, C, and D which require implementation in external repositories (A2: scholarship-api, A8: auto-com-center).

---

## Issue A: A2 /ready Endpoint

**Target Repository:** scholarship-api (A2)
**Patch Specification:** `issue_a_a2_ready/patch_specification.md`

### Steps

1. **Create feature branch** named `feature/ready-endpoint`

2. **Implement /ready endpoint per specification:**
   - Add readiness checks for DB, queue, upstream
   - Separate from /health (liveness)
   - Add feature flag `READY_ENDPOINT_ENABLED=false`

3. **Add tests:**
   - Unit test: /ready returns 200 when all checks pass
   - Unit test: /ready returns 503 when DB fails
   - Integration test: Queue connectivity

4. **Update documentation:**
   - Add runbook entry
   - Update API docs

5. **Deploy to staging with READY_ENDPOINT_ENABLED=true**

6. **Verify with Fleet Health:**
   - Confirm /ready is polled
   - Confirm traffic draining works

7. **Merge to main and deploy to production**

---

## Issue C: A8 Stale Banners

**Target Repository:** auto-com-center (A8)
**Patch Specification:** `issue_c_a8_banners/patch_specification.md`

### Steps

1. **Create feature branch** named `feature/banner-ttl`

2. **Database migration:**
   - Add `expiresAt`, `autoCleared`, `clearedBy` columns to banners table

3. **Implement TTL logic:**
   - Default TTL: 4 hours
   - Auto-clear on recovery detection
   - Admin clear endpoint with auth

4. **Add feature flags:**
   - BANNER_TTL_HOURS=4
   - BANNER_AUTO_CLEAR=true

5. **Add tests:**
   - Unit test: Banner expires after TTL
   - Unit test: Auto-clear on recovery
   - Integration test: Audit logging

6. **Deploy to staging and verify:**
   - Create test banner
   - Trigger recovery event
   - Confirm auto-clear

7. **Merge to main and deploy to production**

---

## Issue D: A8 Demo Mode

**Target Repository:** auto-com-center (A8)
**Patch Specification:** `issue_d_a8_demo/patch_specification.md`

### Steps

1. **Create feature branch** named `feature/demo-mode`

2. **Implement DemoModeContext:**
   - React context for demo mode state
   - localStorage persistence
   - Toggle component

3. **Add data filtering:**
   - Filter events by namespace=simulated_audit
   - Filter by stripe_mode=test
   - Add DemoDataBadge component

4. **Update tiles:**
   - Scope tile queries by demo mode
   - Add badges to demo data

5. **Update finance exports:**
   - Add metadata header with data source
   - Mark demo exports clearly

6. **Add feature flag: DEMO_MODE_ENABLED=true**

7. **Add tests:**
   - Unit test: Event filtering
   - Unit test: Badge rendering
   - E2E: Demo toggle persistence

8. **Deploy to staging:**
   - Toggle demo mode
   - Verify simulated data labeled
   - Verify production data unchanged

9. **Merge to main and deploy to production**

---

## Rollback Procedures

All implementations use feature flags for instant rollback:

| Issue | Rollback Command | Recovery Time |
|-------|------------------|---------------|
| A | READY_ENDPOINT_ENABLED=false | <30s |
| C | BANNER_AUTO_CLEAR=false | <30s |
| D | DEMO_MODE_ENABLED=false | <30s |

---

## Contact

For questions about these specifications, refer to the Phase 2/3 validation artifacts in:
/reports/phase2_3_validation/20260105-2111/
