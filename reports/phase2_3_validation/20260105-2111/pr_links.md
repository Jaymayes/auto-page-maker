# PR Links - Phase 2 Implementation

**Date:** 2026-01-05T21:30 UTC

---

## Implementations in Current Repository (A7)

### Issue B: A7 Async Health Checks

**Status:** ✅ IMPLEMENTED (Draft Ready)

**Branch:** Current working branch

**Files Changed:**
| File | Change |
|------|--------|
| `server/lib/async-health-checks.ts` | NEW - Async health check module |
| `server/routes.ts` | MODIFIED - Use async checks when enabled |
| `server/index.ts` | MODIFIED - Start background worker |

**Feature Flag:** `ASYNC_HEALTH_CHECKS=true`

**Documentation:** `pr_docs/issue_b_a7_async/implementation_summary.md`

---

## Patch Specifications (External Repos)

### Issue A: A2 /ready Endpoint

**Status:** 📋 PATCH SPECIFICATION

**Target Repository:** scholarship-api (A2)

**Patch File:** `pr_docs/issue_a_a2_ready/patch_specification.md`

**Merge Instructions:**
1. Review specification document
2. Implement in A2 repository
3. Add tests per specification
4. Enable `READY_ENDPOINT_ENABLED=true` in staging

---

### Issue C: A8 Stale Banners

**Status:** 📋 PATCH SPECIFICATION

**Target Repository:** auto-com-center (A8)

**Patch File:** `pr_docs/issue_c_a8_banners/patch_specification.md`

**Merge Instructions:**
1. Review specification document
2. Implement in A8 repository
3. Add database migration for new fields
4. Enable `BANNER_AUTO_CLEAR=true` in staging

---

### Issue D: A8 Demo Mode

**Status:** 📋 PATCH SPECIFICATION

**Target Repository:** auto-com-center (A8)

**Patch File:** `pr_docs/issue_d_a8_demo/patch_specification.md`

**Merge Instructions:**
1. Review specification document
2. Implement DemoModeContext in A8 repository
3. Update tiles to respect demo mode
4. Enable `DEMO_MODE_ENABLED=true` in staging

---

## Summary Table

| Issue | Repository | Status | Artifact |
|-------|------------|--------|----------|
| A | A2 (scholarship-api) | 📋 SPEC | `pr_docs/issue_a_a2_ready/` |
| B | A7 (auto_page_maker) | ✅ IMPL | `pr_docs/issue_b_a7_async/` |
| C | A8 (auto-com-center) | 📋 SPEC | `pr_docs/issue_c_a8_banners/` |
| D | A8 (auto-com-center) | 📋 SPEC | `pr_docs/issue_d_a8_demo/` |

---

## Deployment Order

Recommended implementation order:

1. **Issue B (A7)** - Can be validated immediately
2. **Issue A (A2)** - Independent, low risk
3. **Issue C (A8)** - Depends on banner schema
4. **Issue D (A8)** - Can be parallel with C
