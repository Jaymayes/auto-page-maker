# PR Proposal: Issue C - A8 Stale Banners

## Title
`A8: Incident auto-clear + TTL + admin clear`

## Problem
A8 dashboard shows incident banners that persist after services recover, causing:
- Dashboard "split-brain" (green tiles + red incidents)
- Operator confusion
- Alert fatigue

## Evidence
- A6 was crashed, now healthy (all checks pass)
- "Revenue Blocked" banner still visible
- No auto-clear mechanism exists

## Proposed Implementation

### 1. Add TTL to Incidents
```typescript
// Incident schema update
interface Incident {
  id: string;
  app_label: string;
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  message: string;
  created_at: Date;
  resolved_at?: Date;
  ttl_minutes: number; // Auto-expire after TTL
  last_health_ok_at?: Date; // Track recovery
}
```

### 2. Health Reconciliation Job
```typescript
// Run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  const activeIncidents = await db.select()
    .from(incidents)
    .where(isNull(incidents.resolved_at));
  
  for (const incident of activeIncidents) {
    const healthOk = await checkAppHealth(incident.app_label);
    
    if (healthOk) {
      // Update last_health_ok_at
      await db.update(incidents)
        .set({ last_health_ok_at: new Date() })
        .where(eq(incidents.id, incident.id));
      
      // Auto-resolve if healthy for 10 minutes
      const greenDuration = Date.now() - incident.last_health_ok_at?.getTime();
      if (greenDuration > 10 * 60 * 1000) {
        await db.update(incidents)
          .set({ resolved_at: new Date(), resolution: 'auto_cleared' })
          .where(eq(incidents.id, incident.id));
        
        console.log(`Auto-cleared incident ${incident.id} after 10min green`);
      }
    } else {
      // Reset green timer if unhealthy
      await db.update(incidents)
        .set({ last_health_ok_at: null })
        .where(eq(incidents.id, incident.id));
    }
  }
});
```

### 3. Admin Clear Endpoint
```typescript
router.post('/api/admin/clear-stale-incidents', authAdmin, async (req, res) => {
  const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h
  
  const cleared = await db.update(incidents)
    .set({ resolved_at: new Date(), resolution: 'admin_cleared' })
    .where(and(
      isNull(incidents.resolved_at),
      lt(incidents.created_at, staleThreshold)
    ))
    .returning();
  
  res.json({ cleared: cleared.length, incidents: cleared.map(i => i.id) });
});
```

## UX Acceptance Tests
```typescript
describe('Incident auto-clear', () => {
  it('clears incident after 10 min of green health', async () => {
    // Create incident
    const incident = await createIncident('A6', 'Test');
    
    // Simulate 10 min of health checks
    for (let i = 0; i < 3; i++) {
      await runReconciliationJob();
      await sleep(5 * 60 * 1000); // 5 min
    }
    
    const updated = await getIncident(incident.id);
    expect(updated.resolved_at).not.toBeNull();
  });
});
```

## Rollback Plan
- Disable cron job
- Keep manual-only clearing
- Rollback time: <1 minute
