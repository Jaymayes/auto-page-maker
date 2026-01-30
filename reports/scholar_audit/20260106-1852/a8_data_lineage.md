# A8 Data Lineage Report

**Audit Date:** 2026-01-06

---

## Data Flow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Scholar Ecosystem Data Flows                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────┐    ┌─────┐    ┌─────┐                                 │
│  │ A5  │───▶│ A2  │───▶│ A8  │  Student → API → Telemetry      │
│  │Student│  │ API │    │Cmd  │                                  │
│  └─────┘    └─────┘    └─────┘                                 │
│                                                                  │
│  ┌─────┐    ┌─────┐    ┌─────┐                                 │
│  │ A6  │───▶│ A2  │───▶│ A8  │  Provider → API → Telemetry     │
│  │Prov.│    │ API │    │Cmd  │  ⚠️ BLOCKED (A6 DOWN)           │
│  └─────┘    └─────┘    └─────┘                                 │
│                                                                  │
│  ┌─────┐              ┌─────┐                                  │
│  │ A7  │─────────────▶│ A8  │  SEO Events → Telemetry          │
│  │SEO  │              │Cmd  │                                  │
│  └─────┘              └─────┘                                 │
│                                                                  │
│  ┌─────┐    ┌─────┐    ┌─────┐                                 │
│  │ A4  │───▶│ A3  │───▶│ A8  │  LLM → Agent → Telemetry        │
│  │Sage │    │Agent│    │Cmd  │                                  │
│  └─────┘    └─────┘    └─────┘                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Event Types and Sources

| Event Type | Source | Schema Version | Status |
|------------|--------|----------------|--------|
| PAGE_VIEW | A7 | msp_v3 | ACTIVE |
| SITEMAP_UPDATE | A7 | msp_v3 | ACTIVE |
| SCHOLARSHIP_SEARCH | A2 | v1.0 | ACTIVE |
| STUDENT_SIGNUP | A5 | v1.0 | ACTIVE |
| ESSAY_GENERATED | A4 | v1.0 | ACTIVE |
| PROVIDER_SIGNUP | A6 | v1.0 | BLOCKED |
| REVENUE_EVENT | A6 | v1.0 | BLOCKED |
| SYSTEM_HEALTH | All | msp_v3 | ACTIVE |

---

## A8 Tiles and Data Sources

| Tile | Data Source | Status | Notes |
|------|-------------|--------|-------|
| SEO Overview | A7 events | ACTIVE | Page generation metrics |
| Traffic Ticker | A7, A5 | ACTIVE | Visitor counts |
| Revenue B2C | A2, Stripe | ACTIVE | Student conversions |
| Revenue B2B | A6, Stripe | BLOCKED | Provider revenue |
| Lead Pipeline | A5, A6 | PARTIAL | Student leads active |
| Finance Export | A2, A6 | PARTIAL | B2C data available |
| Fleet Health | All | PARTIAL | A6 showing DOWN |

---

## Namespace Isolation

| Namespace | Purpose | Data Isolation |
|-----------|---------|----------------|
| production | Live data | Full isolation |
| simulated_audit | Test/demo data | Separate tiles |
| test | Development | Not in A8 |

---

## Schema Compliance

| Field | Required | Status |
|-------|----------|--------|
| event_type | Yes | ✓ All events |
| timestamp | Yes | ✓ All events |
| namespace | Yes | ✓ All events |
| version | Yes | ✓ msp_v3 |
| correlation_id | Optional | ✓ When available |
| env | Yes | ✓ All events |

---

## Data Quality Issues

| Issue | Severity | Impact |
|-------|----------|--------|
| A6 data missing | HIGH | B2B revenue not tracked |
| Some events lack correlation_id | LOW | Tracing incomplete |

---

## Lineage Score

**Data Completeness:** 6/8 sources active (75%)
**Schema Compliance:** 100%
**Namespace Isolation:** Properly implemented
