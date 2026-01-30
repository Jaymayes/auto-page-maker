# PR Proposal: Issue A - A2 /ready Endpoint

## Title
`A2: Add /ready endpoint + readiness contract`

## Problem
A2 scholarship_api returns 404 on `/ready`, causing orchestrators to:
- Confuse "not ready" with "not found"
- Potentially retry indefinitely

## Evidence
```
Probe 1: HTTP 404, Latency 143ms
Probe 2: HTTP 404, Latency 146ms
Probe 3: HTTP 404, Latency 113ms
Probe 4: HTTP 404, Latency 141ms
Probe 5: HTTP 404, Latency 149ms
```

## Proposed Implementation

### server/routes.ts (or equivalent)
```typescript
// Health vs Readiness Semantics:
// /health = "process is alive" (liveness probe)
// /ready = "process can serve traffic" (readiness probe)

router.get('/ready', async (req, res) => {
  try {
    // Check critical dependencies
    const dbOk = await db.execute(sql`SELECT 1`).then(() => true).catch(() => false);
    const cacheOk = cache ? await cache.ping().then(() => true).catch(() => false) : true;
    
    if (dbOk && cacheOk) {
      res.json({ 
        status: 'ready',
        checks: { database: 'ok', cache: 'ok' },
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({ 
        status: 'not_ready',
        checks: { database: dbOk ? 'ok' : 'fail', cache: cacheOk ? 'ok' : 'fail' }
      });
    }
  } catch (error) {
    res.status(503).json({ status: 'not_ready', error: 'Dependency check failed' });
  }
});
```

## Contract
| Condition | Response |
|-----------|----------|
| All dependencies healthy | 200 `{"status":"ready"}` |
| Any dependency unhealthy | 503 `{"status":"not_ready"}` |

## Test Cases
```typescript
describe('/ready endpoint', () => {
  it('returns 200 when dependencies healthy', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
  });
  
  it('returns 503 when database unavailable', async () => {
    // Mock db failure
    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
  });
});
```

## Rollback Plan
- Remove route; revert to /health-only pattern
- Rollback time: <1 minute

## Risk Assessment
| Factor | Rating | Notes |
|--------|--------|-------|
| Complexity | Low | Single additive endpoint |
| Breaking change | None | New endpoint only |
| Rollback | Instant | Route removal |
