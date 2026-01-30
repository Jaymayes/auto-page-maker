# PR Proposal: Issue B - A7 Async Ingestion

## Title
`A7: Async ingestion path + idempotency`

## Problem
A7 auto_page_maker shows P50=271ms, P95=324ms (target: ≤150ms).

Root causes:
1. SendGrid health check on /health (~100-200ms)
2. Synchronous DB writes on event ingestion

## Evidence
```
A7 /health: P50=271ms P95=324ms P99=340ms (n=20)
A8 ingestion: avg=205ms
```

## Proposed Implementation

### Option 1: Fire-and-Forget (Minimal Change)
```typescript
// server/lib/telemetry-client.ts
export async function emitEvent(event: TelemetryEvent): Promise<void> {
  const eventId = generateEventId();
  
  // Fire-and-forget - don't await
  setImmediate(async () => {
    try {
      await fetch(A8_ENDPOINT, {
        method: 'POST',
        headers: { ...TELEMETRY_HEADERS, 'x-event-id': eventId },
        body: JSON.stringify(event)
      });
    } catch (err) {
      console.error('Telemetry emit failed:', eventId, err);
      // Optional: Write to local fallback queue
    }
  });
}
```

### Option 2: 202 Accepted Pattern (A8 side)
```typescript
// A8 server/routes.ts
router.post('/api/events', async (req, res) => {
  const eventId = generateEventId();
  
  // Validate schema synchronously
  const validation = validateEventSchema(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.errors });
  }
  
  // Return immediately
  res.status(202).json({ 
    accepted: true, 
    event_id: eventId,
    status: 'queued'
  });
  
  // Process asynchronously
  setImmediate(async () => {
    await persistEventToDb(req.body, eventId);
  });
});
```

### Option 3: Queue-based (BullMQ + Redis)
```typescript
// Durable queue with retries
import { Queue } from 'bullmq';

const eventQueue = new Queue('telemetry-events', { connection: redis });

router.post('/api/events', async (req, res) => {
  const eventId = generateEventId();
  
  await eventQueue.add('persist', { ...req.body, eventId }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true
  });
  
  res.status(202).json({ accepted: true, event_id: eventId });
});
```

## Expected Improvement

| Metric | Before | After (Option 1/2) | After (Option 3) |
|--------|--------|--------------------| -----------------|
| P50 | 271ms | ~150ms | ~100ms |
| P95 | 324ms | ~180ms | ~120ms |

## Idempotency Key
```typescript
// Prevent duplicate events
const idempotencyKey = `${event.source}:${event.event_type}:${event.actor_id}:${event.occurred_at}`;
const exists = await redis.exists(`idem:${idempotencyKey}`);
if (exists) return { deduplicated: true };
await redis.setex(`idem:${idempotencyKey}`, 3600, '1'); // 1hr TTL
```

## Performance Test Plan
```bash
# 100-event load test
for i in $(seq 1 100); do
  curl -s -X POST "$A8/api/events" -H "..." -d '...' &
done
wait
# Measure P95
```

## Rollback Plan
- Revert to synchronous 200 pattern
- Rollback time: <5 minutes

## Risk Assessment
| Factor | Rating | Notes |
|--------|--------|-------|
| Complexity | Medium | Async patterns require careful handling |
| Data loss risk | Low | Fire-and-forget acceptable for telemetry |
| Rollback | Fast | Revert async wrapper |
