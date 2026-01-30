# PR Proposal: Issue D - A8 Demo Mode

## Title
`A8: Demo Mode revenue visualization (test-mode aware)`

## Problem
A8 Finance tiles show $0 in demo/test environments because:
- Filter: `WHERE stripe_mode = 'live'`
- Demo uses: `stripe_mode = 'test'`
- Result: Test transactions excluded

## Impact
- Stakeholders see $0 during demos
- Confusion about whether revenue pipeline works

## Proposed Implementation

### 1. Demo Mode Toggle
```typescript
// A8 server/routes.ts
router.get('/api/dashboard/finance', async (req, res) => {
  const demoMode = req.query.demo === 'true' || process.env.DEMO_MODE === 'true';
  
  let query = db.select({
    total_cents: sum(events.payload.amount_cents),
    count: count()
  }).from(events).where(eq(events.event_type, 'PaymentSuccess'));
  
  // Apply filter based on mode
  if (!demoMode) {
    query = query.where(eq(events.payload.stripe_mode, 'live'));
  }
  
  const [result] = await query;
  
  res.json({
    demo_mode: demoMode,
    demo_label: demoMode ? '⚠️ Includes Test Data' : null,
    total_revenue_cents: result.total_cents || 0,
    transactions: result.count || 0,
    currency: 'USD'
  });
});
```

### 2. UI Badge Component
```tsx
// Dashboard header
function DemoModeBadge({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  
  return (
    <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
      ⚠️ Demo Mode: Showing Test Data
    </div>
  );
}
```

### 3. Namespace Filter
```typescript
// Ensure simulated_audit data is filterable
const isSimulated = event.payload?.namespace === 'simulated_audit';
if (isSimulated && !demoMode) {
  // Exclude from production view
  continue;
}
```

### 4. Environment Variable
```bash
# .env
DEMO_MODE=false  # Production
DEMO_MODE=true   # Demo/staging
```

## UI Changes

| Mode | Finance Tile | Badge |
|------|--------------|-------|
| Production (default) | Live transactions only | None |
| Demo (`?demo=true`) | All transactions | "⚠️ Test Data" |

## Schema/Tag Updates
```typescript
// Event payload includes stripe_mode
interface PaymentEvent {
  amount_cents: number;
  currency: string;
  stripe_mode: 'live' | 'test';
  namespace?: 'simulated_audit';
}
```

## Rollback Plan
- Remove demo query param
- Revert to live-only filter
- Rollback time: <1 minute

## Risk Assessment
| Factor | Rating | Notes |
|--------|--------|-------|
| Complexity | Low | Query param + UI badge |
| Production impact | None | Default remains live-only |
| Rollback | Instant | Remove feature flag |
