# Issue A: A2 /ready Endpoint Implementation

**Target Repository:** scholarship-api (A2)
**Status:** PATCH SPECIFICATION (Requires A2 codebase access)

---

## Problem Statement

A2 currently lacks a proper `/ready` endpoint, or the existing contract is misaligned with Fleet Health requirements. The `/health` endpoint conflates liveness with readiness checks.

## Solution Design

### Before
- `/health` performs all checks (DB, email, third-party) in a single endpoint
- No distinction between liveness and readiness
- Cannot gracefully drain traffic during deploys

### After
- `/ready` - Readiness probe (DB + queue + upstream connectivity)
- `/health` - Liveness probe (process alive, basic sanity)
- Kubernetes/Fleet Health can route traffic only to ready instances

---

## Implementation Specification

### New Endpoint: GET /ready

```typescript
// server/routes.ts or equivalent

interface ReadinessCheck {
  name: string;
  status: 'ok' | 'fail';
  latency_ms: number;
  error?: string;
}

interface ReadinessResponse {
  ready: boolean;
  timestamp: string;
  checks: ReadinessCheck[];
}

app.get('/ready', async (req, res) => {
  const checks: ReadinessCheck[] = [];
  
  // Check 1: Database connectivity
  const dbStart = Date.now();
  try {
    await db.raw('SELECT 1');
    checks.push({ name: 'database', status: 'ok', latency_ms: Date.now() - dbStart });
  } catch (e) {
    checks.push({ name: 'database', status: 'fail', latency_ms: Date.now() - dbStart, error: e.message });
  }
  
  // Check 2: Queue connectivity (if applicable)
  const queueStart = Date.now();
  try {
    await messageQueue.ping();
    checks.push({ name: 'queue', status: 'ok', latency_ms: Date.now() - queueStart });
  } catch (e) {
    checks.push({ name: 'queue', status: 'fail', latency_ms: Date.now() - queueStart, error: e.message });
  }
  
  // Check 3: Upstream services (critical dependencies only)
  // Omit slow third-party checks (SendGrid, etc.) - those belong in /health
  
  const ready = checks.every(c => c.status === 'ok');
  res.status(ready ? 200 : 503).json({
    ready,
    timestamp: new Date().toISOString(),
    checks
  });
});
```

### Feature Flag

```bash
# Enable /ready endpoint (default OFF)
READY_ENDPOINT_ENABLED=true
```

---

## Risk Analysis

| Risk | Mitigation | Severity |
|------|------------|----------|
| Breaking existing monitoring | Feature flag, backward compatible | Low |
| Added latency to health checks | Separate fast checks from slow | Low |
| Queue dependency failure | Graceful degradation | Medium |

---

## Rollback Plan

1. Set `READY_ENDPOINT_ENABLED=false`
2. Existing `/health` endpoint continues to work
3. No code deployment needed for rollback

---

## Security Review

- No authentication required (probe endpoints)
- No sensitive data exposed
- Rate limit recommended but not required for internal probes

---

## Tests Required

1. Unit test: /ready returns 200 when all checks pass
2. Unit test: /ready returns 503 when DB fails
3. Integration test: Queue connectivity check
4. E2E: Fleet Health polling behavior

---

## Merge Instructions

1. Apply this patch to the A2 (scholarship-api) repository
2. Add tests per specification
3. Set `READY_ENDPOINT_ENABLED=true` in staging
4. Verify Fleet Health recognizes the endpoint
5. Roll out to production with flag ON
