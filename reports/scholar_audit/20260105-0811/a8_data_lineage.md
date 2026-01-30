# A8 Data Lineage - Scholar Ecosystem

**Audit Date:** 2026-01-05T08:11 UTC

## A8 Event Ingestion Pipeline

```
┌─────────────────┐     POST /api/events     ┌──────────────────┐
│   Source Apps   │ ─────────────────────────▶│   A8 Command     │
│  A1-A7 Fleet    │     v3.5.1 Headers        │   Center         │
└─────────────────┘                           └────────┬─────────┘
                                                       │
                                              ┌────────▼─────────┐
                                              │   PostgreSQL     │
                                              │   Event Store    │
                                              └────────┬─────────┘
                                                       │
                                              ┌────────▼─────────┐
                                              │   Dashboard      │
                                              │   Tiles          │
                                              └──────────────────┘
```

## Event Sources (Last 100 Events)

| Source App | Event Count | % of Total | Status |
|------------|-------------|------------|--------|
| student_pilot | 87 | 87% | ✅ Active |
| auto_com_center | 13 | 13% | ✅ Self-events |
| scholar_auth | 0 | 0% | ⚠️ Silent (no native emitter) |
| scholarship_api | 0 | 0% | ⚠️ Silent (no native emitter) |
| scholarship_agent | 0 | 0% | ⚠️ Silent (no native emitter) |
| scholarship_sage | 0 | 0% | ⚠️ Silent (no native emitter) |
| provider_register | 0 | 0% | ⚠️ Silent (recovered but not emitting) |
| auto_page_maker | Canary only | N/A | ✅ Operational (v3.5.1) |

## Telemetry Protocol v3.5.1

### Required Headers
- `content-type: application/json`
- `x-scholar-protocol: v3.5.1`
- `x-app-label: <app_name>`
- `x-event-id: <uuid-v4>`
- `Authorization: Bearer <A8_KEY>` (optional)

### Event Types
| Type | Purpose | Source Apps |
|------|---------|-------------|
| PageView | Traffic tracking | A7 |
| NewLead | Lead capture | A7 |
| NewUser | User registration | A1 |
| PaymentSuccess | Revenue tracking | A5, A6 |
| ScholarshipMatchRequested | Match initiation | A5 |
| ScholarshipMatchResult | Match completion | A3 |
| SageAssist | AI assistance | A4 |
| ProviderOnboarded | B2B registration | A6 |

## Canary Validation Results

| Test | Event ID | Persisted | Latency |
|------|----------|-----------|---------|
| PageView | evt_1767595159834_wekdogcel | ✅ true | 215ms |
| NewLead | evt_1767595160100_y6i5dqeqo | ✅ true | 200ms |
| NewUser | evt_1767595160405_y8bwb8mhk | ✅ true | 257ms |
| PaymentSuccess | evt_1767595160677_lu7cc5x60 | ✅ true | 214ms |
| ScholarshipMatchResult | evt_1767595160967_rmj6ipnzn | ✅ true | 216ms |
| SageAssist | evt_1767595161259_9j1sf498n | ✅ true | 226ms |

**Result:** 6/6 events persisted successfully

## A8 Internal Type Mapping

Note: A8 accepts event_type from clients but maps internally to `SYSTEM_HEALTH` type. This is expected behavior - the original event_type is preserved in the event payload.

```json
{
  "accepted": true,
  "event_type": "NewLead",        // Client-sent
  "internal_type": "SYSTEM_HEALTH", // A8 internal
  "persisted": true
}
```

## Data Tagging

All audit events tagged with `simulated_audit: true` in payload to prevent production analytics pollution.
