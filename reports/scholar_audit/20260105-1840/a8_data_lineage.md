# A8 Data Lineage

## Event Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Source Applications                       │
│  A1-A7 (Marketing, Lead Gen, Revenue, Learning)             │
└──────────────────────────┬──────────────────────────────────┘
                           │ POST /api/events
                           │ Headers: x-scholar-protocol, x-app-label, x-event-id
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    A8 Command Center                         │
│  Ingestion: 205ms avg (sync DB write)                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL (Neon)                         │
│  Events table with: event_type, payload, source, tags       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Dashboard Tiles                           │
│  Finance: STRIPE_MODE=live filter (excludes test)           │
│  B2B Supply: Provider onboarding metrics                    │
│  SEO Traffic: PageView/NewLead aggregations                 │
└─────────────────────────────────────────────────────────────┘
```

## Revenue Visualization Issue - Root Cause

### Why "$0 Revenue" in Dashboard?

1. **Filter**: A8 Finance tiles filter `WHERE stripe_mode = 'live'`
2. **Demo/Test**: Demo environments use `STRIPE_MODE=test`
3. **Result**: Test transactions excluded → $0 displayed

### "Revenue Blocked" Banner - Operational vs Fault?

**VERDICT: OPERATIONAL (NOT A FAULT)**

| Hypothesis | Evidence | Conclusion |
|------------|----------|------------|
| A3 not orchestrating | No A3 events in A8 | Likely - A3 silent |
| Revenue pipeline broken | 6/6 PaymentSuccess events persisted | ❌ False |
| A6 crashed | A6 /health returns 200, all checks healthy | ❌ False |

**Root Cause**: A3 scholarship_agent orchestration not triggered → no matching → no premium conversions → no revenue events. This is **operational mode**, not a fault.

### A3 Orchestration Dependency

```
Student requests match (A5)
        │
        ▼
A3 scholarship_agent orchestrates matching
        │
        ▼
Premium upgrade offered → PaymentSuccess (A5→A8)
        │
        ▼
Finance tile shows revenue
```

If A3 is not triggered, revenue flow stops at step 1.
