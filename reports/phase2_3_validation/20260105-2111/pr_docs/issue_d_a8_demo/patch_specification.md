# Issue D: A8 Demo Mode Toggle

**Target Repository:** auto-com-center (A8)
**Status:** PATCH SPECIFICATION (Requires A8 codebase access)

---

## Problem Statement

A8 Command Center displays test/simulated data mixed with production data, creating confusion:
- Stripe test mode transactions appear in revenue tiles
- Simulated audit events pollute analytics
- No clear distinction between demo and live data

## Solution Design

### Before
- All data displayed uniformly
- Test mode transactions in revenue tiles
- Simulated events in telemetry views
- Confusion about what's real vs demo

### After
- Demo Mode toggle in UI
- Test data clearly labeled with badges
- Simulated events filtered or labeled
- Tile scoping by namespace
- Finance exports marked with data source

---

## Implementation Specification

### Demo Mode State

```typescript
// Context or Redux store
interface DemoModeState {
  enabled: boolean;
  showSimulated: boolean;  // Show simulated_audit namespace
  showStripeTest: boolean; // Show stripe_mode=test transactions
  badge: 'demo' | 'test' | 'simulated';
}

// Default: Demo mode OFF, hide simulated data
const defaultState: DemoModeState = {
  enabled: false,
  showSimulated: false,
  showStripeTest: false,
  badge: 'demo'
};
```

### Data Filtering Logic

```typescript
// Filter events based on demo mode
function filterEvents(events: TelemetryEvent[], demoMode: DemoModeState) {
  return events.filter(event => {
    const isSimulated = event.namespace === 'simulated_audit';
    const isStripeTest = event.stripe_mode === 'test';
    
    if (demoMode.enabled) {
      // Demo mode: show everything with labels
      return true;
    } else {
      // Production mode: hide demo data
      return !isSimulated && !isStripeTest;
    }
  });
}

// Tile data scoping
function getTileData(tileId: string, demoMode: DemoModeState) {
  const query = demoMode.enabled
    ? { /* include all namespaces */ }
    : { namespace: { $ne: 'simulated_audit' }, stripe_mode: { $ne: 'test' } };
    
  return fetchTileData(tileId, query);
}
```

### UI Badge Component

```tsx
// DemoDataBadge.tsx
interface DemoDataBadgeProps {
  type: 'simulated' | 'test' | 'demo';
}

export function DemoDataBadge({ type }: DemoDataBadgeProps) {
  const colors = {
    simulated: 'bg-yellow-100 text-yellow-800',
    test: 'bg-orange-100 text-orange-800',
    demo: 'bg-purple-100 text-purple-800'
  };
  
  const labels = {
    simulated: '🧪 Simulated',
    test: '💳 Test Mode',
    demo: '📋 Demo Data'
  };
  
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${colors[type]}`}>
      {labels[type]}
    </span>
  );
}
```

### Demo Mode Toggle

```tsx
// DemoModeToggle.tsx
export function DemoModeToggle() {
  const [demoMode, setDemoMode] = useDemoMode();
  
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm">Demo Mode</label>
      <Switch
        checked={demoMode.enabled}
        onCheckedChange={(checked) => setDemoMode({ ...demoMode, enabled: checked })}
      />
      {demoMode.enabled && (
        <DemoDataBadge type="demo" />
      )}
    </div>
  );
}
```

### Finance Tile Exports

```typescript
// When exporting finance data
function exportFinanceData(format: 'csv' | 'json') {
  const data = getFinanceData();
  
  // Add metadata header
  const metadata = {
    exported_at: new Date().toISOString(),
    demo_mode: demoMode.enabled,
    includes_simulated: demoMode.showSimulated,
    includes_stripe_test: demoMode.showStripeTest,
    data_source: demoMode.enabled ? 'MIXED (DEMO + PRODUCTION)' : 'PRODUCTION ONLY'
  };
  
  return { metadata, data };
}
```

---

## Feature Flags

| Flag | Default | Description |
|------|---------|-------------|
| `DEMO_MODE_ENABLED` | `false` | Enable demo mode toggle |
| `SHOW_DATA_BADGES` | `true` | Show source badges on data |
| `DEFAULT_HIDE_SIMULATED` | `true` | Hide simulated by default |

---

## Namespace Conventions

| Namespace | Description | Demo Mode Only |
|-----------|-------------|----------------|
| `production` | Real user data | No |
| `simulated_audit` | Synthetic test data | Yes |
| `stripe_mode=test` | Stripe test transactions | Yes |

---

## Risk Analysis

| Risk | Mitigation | Severity |
|------|------------|----------|
| Demo data in prod reports | Default filtering | Low |
| Badge confusion | Clear labels | Low |
| Export data mixing | Metadata headers | Low |

---

## Rollback Plan

1. Set `DEMO_MODE_ENABLED=false`
2. Toggle reverts to production-only view
3. Existing filtering remains in place

---

## Security Review

- Demo mode toggle requires authentication
- No PII exposure in demo data
- Audit log for demo mode changes

---

## Tests Required

1. Unit test: Event filtering by namespace
2. Unit test: Tile scoping
3. Unit test: Badge rendering
4. Integration test: Demo toggle state persistence
5. E2E: Finance export with demo data

---

## Merge Instructions

1. Apply this patch to the A8 (auto-com-center) repository
2. Add DemoModeContext/Provider
3. Update tiles to respect demo mode
4. Add badge components
5. Update finance exports
6. Add tests per specification
7. Deploy to staging with `DEMO_MODE_ENABLED=true`
8. Verify demo/prod data separation
9. Roll out to production
