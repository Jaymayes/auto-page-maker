# Resiliency Configuration Report

**Audit Date:** 2026-01-06

---

## Circuit Breaker Configurations

### A1 scholar-auth
```json
{
  "auth_db": {
    "circuitBreaker": {
      "state": "CLOSED",
      "failures": 0,
      "threshold": 5,
      "isHealthy": true
    }
  }
}
```

### A4 scholarship-sage
```json
{
  "circuitBreaker": {
    "open": false,
    "failureCount": 0,
    "threshold": 5,
    "openedAt": null,
    "timeUntilReset": 0
  }
}
```

### A7 auto-page-maker
- Async health checks with background caching
- Email provider circuit breaker: 5 failures to open
- Database connection pooling with retry

---

## Timeout Configurations

| Service | Operation | Timeout | Status |
|---------|-----------|---------|--------|
| A1 | Database query | 5s | Configured |
| A1 | External auth | 10s | Configured |
| A2 | Database query | 5s | Configured |
| A3 | LLM call | 30s | Configured |
| A4 | OpenAI API | 60s | Configured |
| A7 | Email send | 10s | Async (cached) |
| A7 | Database | 5s | Configured |

---

## Retry/Backoff Configurations

| Service | Pattern | Max Retries | Backoff |
|---------|---------|-------------|---------|
| A7 | Exponential | 3 | 1s, 2s, 4s |
| A4 | Exponential | 2 | 2s, 4s |
| A2 | Linear | 2 | 1s, 1s |

---

## Health Check Endpoints

| Service | Endpoint | Interval | Deep Check |
|---------|----------|----------|------------|
| A1 | /health | 30s | Yes (DB, Email, JWKS) |
| A2 | /health | 30s | Yes (DB) |
| A3 | /health | 30s | Yes (App status) |
| A4 | /health | 30s | Yes (DB, OpenAI, API) |
| A5 | /health | 30s | Yes (DB, Agent) |
| A6 | /health | N/A | **DOWN** |
| A7 | /health | 30s | Yes (DB, Email - async) |
| A8 | /health | 30s | Yes |

---

## Graceful Degradation

| Service | Strategy | Status |
|---------|----------|--------|
| A1 | Cache JWKS for 24h | ACTIVE |
| A4 | Fallback to shorter prompts on timeout | CONFIGURED |
| A7 | Async email with cached status | ACTIVE |
| A8 | Read-only mode on write failures | CONFIGURED |

---

## Prior Alert Analysis

| Alert | Type | Finding | Evidence |
|-------|------|---------|----------|
| AUTH_FAILURE | Noise | False Positive | Threshold too sensitive |
| A6_DOWN | Real | Confirmed Issue | Service returning 500 |
| A1_SLOW | Real | Confirmed Issue | auth_db 247ms |

---

## Resiliency Score

| Category | Score (0-5) | Notes |
|----------|-------------|-------|
| Circuit Breakers | 4 | Implemented on critical paths |
| Timeouts | 4 | Configured appropriately |
| Retries | 3 | Some services lack retry logic |
| Health Checks | 4 | Comprehensive but A6 down |
| Graceful Degradation | 4 | Good patterns in place |

**Overall Resiliency Score:** 19/25 (76%)
