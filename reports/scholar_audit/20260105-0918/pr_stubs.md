# Phase 2 PR Stubs - Awaiting HUMAN_APPROVAL_REQUIRED

## Issue A: A2 Readiness Endpoint Missing (P1)

### PR Title: `A2: Add /ready endpoint + readiness contract`

### Proposed Code (server/routes.ts or equivalent):
```typescript
// Add to A2 scholarship_api routes
router.get('/ready', async (req, res) => {
  try {
    // Optional: Add dependency checks
    const dbPing = await db.execute(sql`SELECT 1`);
    res.json({ 
      status: 'ok',
      checks: {
        database: dbPing ? 'healthy' : 'unhealthy'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'not_ready',
      error: 'Dependency check failed'
    });
  }
});
```

### Expected Behavior:
- `GET /ready` returns 200 `{"status":"ok"}` when all dependencies healthy
- Returns 503 if any critical dependency fails
- Orchestrator stops retry loops on 200

### Rollback Plan:
- Remove route; revert to /health-only pattern

---

## Issue B: A7 Ingestion Synchronous Writes (P1)

### PR Title: `A7: Async ingestion path + idempotency`

### Current Behavior:
- A7 → POST /api/events to A8 → synchronous DB write → 200
- P50: 216ms (target: ≤100ms)

### Proposed Option 1 (Minimal - BackgroundTasks):
```typescript
// A8 server/routes.ts
router.post('/api/events', async (req, res) => {
  const eventId = generateEventId();
  
  // Return immediately with 202 Accepted
  res.status(202).json({ 
    accepted: true, 
    event_id: eventId,
    status: 'queued'
  });
  
  // Process asynchronously (fire-and-forget)
  setImmediate(async () => {
    try {
      await persistEvent(req.body, eventId);
    } catch (err) {
      console.error('Async persist failed:', eventId, err);
    }
  });
});
```

### Proposed Option 2 (Stronger - Queue):
- Use Redis queue (BullMQ) for durable processing
- Add idempotency key to prevent duplicates
- Implement dead-letter queue for failures

### Success Criteria:
- P95 ≤100ms at 100-event load
- No upstream backpressure
- 100% eventual persistence

### Rollback Plan:
- Revert to synchronous 200 pattern

---

## Issue C: A8 Stale Incident Banners (P2)

### PR Title: `A8: Incident auto-clear + TTL + admin clear`

### Current Behavior:
- Incidents persist indefinitely
- Dashboard shows red banners even after services recover

### Proposed Changes:
```typescript
// A8 incident management
interface Incident {
  id: string;
  app_label: string;
  message: string;
  created_at: Date;
  ttl_minutes: number; // NEW: Auto-expire after TTL
  last_health_check?: Date; // NEW: Track health status
}

// Add reconciliation job (runs every 5 min)
cron.schedule('*/5 * * * *', async () => {
  const incidents = await getActiveIncidents();
  for (const incident of incidents) {
    const healthOk = await checkAppHealth(incident.app_label);
    if (healthOk) {
      const greenDuration = Date.now() - incident.last_health_check;
      if (greenDuration > 10 * 60 * 1000) { // 10 min green
        await clearIncident(incident.id);
      }
    }
  }
});

// Admin action
router.post('/api/admin/clear-stale-incidents', authAdmin, async (req, res) => {
  const cleared = await clearStaleIncidents();
  res.json({ cleared: cleared.length });
});
```

### Rollback Plan:
- Disable cron job; keep manual-only clearing

---

## Issue D: Revenue Visualization Drift (P0 perception)

### PR Title: `A8: Demo Mode revenue visualization (test-mode aware)`

### Current Behavior:
- A8 Finance tiles filter out STRIPE_MODE=test events
- Demo environments show $0 revenue (confusing for stakeholders)

### Proposed Changes:
```typescript
// A8 dashboard API
router.get('/api/dashboard/finance', async (req, res) => {
  const demoMode = req.query.demo === 'true' || process.env.DEMO_MODE === 'true';
  
  let stripeFilter = { stripe_mode: 'live' };
  if (demoMode) {
    stripeFilter = {}; // Include all events
  }
  
  const revenue = await db.select()
    .from(events)
    .where(and(
      eq(events.event_type, 'PaymentSuccess'),
      ...stripeFilter
    ));
  
  res.json({
    demo_mode: demoMode,
    demo_label: demoMode ? '⚠️ Includes Test Data' : null,
    total_revenue_cents: sum(revenue.map(r => r.amount_cents)),
    transactions: revenue.length
  });
});
```

### UI Changes:
- Add "Demo Mode" toggle in dashboard header
- Show "Test Data" watermark when enabled
- Keep live data separate when demo=false

### Rollback Plan:
- Remove demo query param; revert to live-only filter

---

## Risk Matrix

| Issue | Severity | Risk if Fixed | Risk if Not Fixed | Rollback Time |
|-------|----------|---------------|-------------------|---------------|
| A | P1 | Low (additive) | Orchestrator retry loops | <1 min |
| B | P1 | Medium (async complexity) | Latency breach, backpressure | <5 min |
| C | P2 | Low (cron job) | Stale UX, false alarms | <1 min |
| D | P0 perception | Low (UI toggle) | Stakeholder confusion | <1 min |

---

## Phase 2 Approval Required

**HUMAN_APPROVAL_REQUIRED** to proceed with:
1. Implementing PR stubs in staging
2. Running validation tests
3. Promoting to production

