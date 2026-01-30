# Rollback Readiness - Issue B: A7 Async Health Checks

**Date:** 2026-01-05T21:17 UTC

---

## Feature Flag Status

| Flag | Default | Purpose |
|------|---------|---------|
| `ASYNC_HEALTH_CHECKS` | `false` | Enable/disable async health check mode |
| `EMAIL_HEALTH_CACHE_TTL_MS` | `60000` | Cache TTL for email provider status |
| `HEALTH_CHECK_INTERVAL_MS` | `30000` | Background check interval |

---

## Rollback Instructions

### Immediate Rollback (< 30 seconds)

```bash
# Option 1: Disable via environment variable
ASYNC_HEALTH_CHECKS=false

# Option 2: Remove environment variable entirely
# (defaults to sync mode)
```

### Full Code Rollback

If needed, revert these files:
- `server/lib/async-health-checks.ts` (remove)
- `server/routes.ts` (revert to previous health check logic)
- `server/index.ts` (remove import and background check start)

---

## Test Evidence

### Feature Flag OFF (Default)
- Health endpoint uses synchronous SendGrid/Postmark checks
- P95 expected: ~365ms (baseline)

### Feature Flag ON
- Health endpoint uses cached email provider status
- Background worker refreshes cache every 30s
- P95 expected: ~150ms (target improvement)

---

## Risk Assessment

| Risk | Mitigation | Severity |
|------|------------|----------|
| Stale email status | 60s cache TTL, background refresh | Low |
| Background worker failure | Graceful degradation to sync | Low |
| Cache not initialized | Returns "initializing" status | Low |
| Feature flag misconfiguration | Defaults to safe sync mode | Low |

---

## Verification Checklist

- [ ] Feature flag defaults to OFF
- [ ] `/health` works with flag OFF
- [ ] `/health` works with flag ON
- [ ] `/api/health/cache-stats` returns expected data
- [ ] Background worker starts when flag ON
- [ ] Rollback via flag change is instant

---

## Approval Gate

**Status:** READY FOR GATE 1 APPROVAL

This implementation is feature-flagged and defaults to OFF. No staging deploy is required until CEO approval.
