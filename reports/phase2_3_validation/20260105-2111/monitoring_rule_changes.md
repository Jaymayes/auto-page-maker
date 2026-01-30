# Monitoring Rule Changes - Phase 2 Implementation

**Date:** 2026-01-05T21:30 UTC

---

## Overview

Monitoring rules updated to eliminate false positives identified in Phase 1 audit.

---

## Rule Changes

### AUTH_FAILURE Alert (False Positive Fix)

**Problem:** A2 /api/auth/verify returning 401 for valid "check if authenticated" patterns was flagged as AUTH_FAILURE.

**Resolution:**
- 401 responses to `/api/auth/verify` are intentional when checking unauthenticated state
- Updated alert threshold: Only trigger on >10 failures in 5 minutes
- Added exception for `/api/auth/verify` endpoint

**New Rule:**
```yaml
alert: AUTH_FAILURE
expr: |
  sum(rate(http_requests_total{status="401", endpoint!~"/api/auth/verify|/api/auth/check"}[5m])) > 10
for: 2m
labels:
  severity: warning
annotations:
  summary: "Elevated authentication failures (excluding verify endpoint)"
```

---

### A7 Health Check Latency (Issue B)

**Problem:** P95 latency of 365ms on /health endpoint exceeded 300ms SLO.

**Resolution:** Async health checks move email provider checks off hot path.

**New Rule:**
```yaml
alert: A7_HEALTH_LATENCY_HIGH
expr: |
  histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{app="auto_page_maker", endpoint="/health"}[5m])) > 0.200
for: 5m
labels:
  severity: warning
annotations:
  summary: "A7 health endpoint P95 > 200ms (target: 150ms with async mode)"
```

---

### A2 /ready Endpoint (Issue A)

**New Rule (when implemented):**
```yaml
alert: A2_READINESS_FAILURE
expr: |
  up{app="scholarship_api", endpoint="/ready"} == 0
for: 1m
labels:
  severity: critical
annotations:
  summary: "A2 readiness probe failing - traffic should drain"
```

---

### A8 Banner TTL (Issue C)

**New Rule (when implemented):**
```yaml
alert: A8_STALE_BANNER
expr: |
  (time() - a8_banner_created_timestamp) > (a8_banner_ttl_seconds * 1.5)
for: 10m
labels:
  severity: info
annotations:
  summary: "A8 banner exceeds 1.5x TTL - may be stale"
```

---

## Threshold Tuning

| Alert | Old Threshold | New Threshold | Reason |
|-------|--------------|---------------|--------|
| AUTH_FAILURE | 5 in 1m | 10 in 5m | Reduce noise from verify checks |
| A7_HEALTH_LATENCY | 300ms | 200ms | Tighter SLO with async mode |
| A2_READINESS | N/A | New | /ready endpoint monitoring |
| A8_STALE_BANNER | N/A | New | Banner TTL monitoring |

---

## Runbook Updates

1. **AUTH_FAILURE:** Check if failures are from /api/auth/verify - if so, this is expected behavior
2. **A7_HEALTH_LATENCY_HIGH:** Verify ASYNC_HEALTH_CHECKS=true; check email provider status
3. **A2_READINESS_FAILURE:** Check database, queue, upstream dependencies
4. **A8_STALE_BANNER:** Review active banners; consider manual clear if resolved

---

## Implementation Status

| Rule | Status | Target |
|------|--------|--------|
| AUTH_FAILURE threshold | PROPOSED | A2/A8 |
| A7_HEALTH_LATENCY | PROPOSED | A7 |
| A2_READINESS | PROPOSED | A2 |
| A8_STALE_BANNER | PROPOSED | A8 |
