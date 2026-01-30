# A8 Data Lineage - Phase 1 Audit

## Event Flow

```
Source Apps (A1-A7)
        │
        ▼ POST /api/events (v3.5.1 headers)
┌───────────────────┐
│   A8 Ingestion    │──▶ 216ms P50 (BREACH)
└─────────┬─────────┘
          │ Synchronous DB Write
          ▼
┌───────────────────┐
│   PostgreSQL      │
│   (Neon)          │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│   Dashboard Tiles │
│   - Finance       │ ◀── STRIPE_MODE filter
│   - B2B Supply    │
│   - SEO Traffic   │
└───────────────────┘
```

## Stripe Mode Behavior

| Source | STRIPE_MODE | Visible in Finance? |
|--------|-------------|---------------------|
| A5 (live) | live | ✅ Yes |
| A6 (live) | live | ✅ Yes |
| A5 (test) | test | ❌ Filtered out |
| A6 (test) | test | ❌ Filtered out |

## Revenue Visualization Issue

- **Problem**: Demo/test transactions don't appear in Finance tiles
- **Impact**: Stakeholders see $0 during demos
- **Fix**: Add Demo Mode toggle (see pr_stubs.md Issue D)
