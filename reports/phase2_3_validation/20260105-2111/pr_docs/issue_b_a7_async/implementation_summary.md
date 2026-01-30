# Issue B: A7 Async Health Checks Implementation

**Target Repository:** auto_page_maker (A7)
**Status:** IMPLEMENTED (Current Repository)

---

## Problem Statement

A7 health checks were slow (P95=365ms) due to synchronous SendGrid/Postmark API calls on the hot request path. This caused:
- SLO breaches on /health endpoint
- Fleet Health timeouts during email provider slowdowns
- Increased latency for monitoring queries

## Solution Design

### Before
- `/health` makes synchronous call to SendGrid API (~150-200ms)
- Every health check query blocked waiting for email provider
- P95 latency: 365ms

### After
- Background worker checks email provider every 30 seconds
- Results cached with 60-second TTL
- `/health` reads from cache (~1ms)
- P95 latency target: ~150ms

---

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `server/lib/async-health-checks.ts` | NEW | Async health check module with caching |
| `server/routes.ts` | MODIFIED | Use async checks when flag enabled |
| `server/index.ts` | MODIFIED | Start background worker on boot |

---

## Feature Flags

| Flag | Default | Description |
|------|---------|-------------|
| `ASYNC_HEALTH_CHECKS` | `false` | Enable async mode with caching |
| `EMAIL_HEALTH_CACHE_TTL_MS` | `60000` | Cache TTL (ms) |
| `HEALTH_CHECK_INTERVAL_MS` | `30000` | Background check interval (ms) |

---

## Key Implementation Details

### Background Worker
- Runs `checkEmailProviderFresh()` every 30s
- Caches result with timestamp
- Logs errors but doesn't crash

### Cold-Start Protection
- `startBackgroundHealthChecks()` awaits initial check
- Cache is seeded BEFORE `app.listen()`
- No degraded responses on cold start

### Response Format Preservation
- Version remains `v2.9` (matches legacy)
- `async_mode` field only added when flag ON
- `/api/health/cache-stats` only registered when flag ON

---

## Rollback Plan

```bash
# Instant rollback via environment variable
ASYNC_HEALTH_CHECKS=false
```

No code deployment needed.

---

## Validation Endpoints

- `/health` - Main health check (async when enabled)
- `/api/health` - API-prefixed health check
- `/healthz` - Kubernetes-style readiness probe
- `/api/health/cache-stats` - Cache monitoring (when enabled)

---

## Expected Results

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| P50 | 226ms | ~100ms | 56% |
| P95 | 365ms | ~150ms | 59% |
| P99 | 424ms | ~180ms | 58% |
