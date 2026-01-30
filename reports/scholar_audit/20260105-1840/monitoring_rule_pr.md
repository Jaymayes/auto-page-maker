# Monitoring Rule Adjustments

## Current Issues
- False positives from tight thresholds
- Stale alerts not clearing
- SLO targets unrealistic for cross-network calls

## Proposed Changes

### 1. Adjust Latency SLO
```yaml
# Before
slo:
  p95_latency_ms: 150

# After
slo:
  p95_latency_ms: 250  # Realistic for cross-network
  p50_latency_ms: 150  # Aspirational target
```

### 2. Add Deduplication
```yaml
alerting:
  dedupe_key: "${app}:${alert_type}"
  dedupe_window: 15m
  min_occurrences: 3  # Alert only after 3 failures
```

### 3. Auto-Clear on Recovery
```yaml
incident_lifecycle:
  auto_resolve_after_healthy: 10m
  ttl_hours: 24
  require_manual_ack: false  # For P2/P3 only
```

### 4. Improve Alert Descriptions
```yaml
alerts:
  - name: "A2 Readiness"
    description: "/ready endpoint status (404 = missing, 503 = not ready, 200 = ready)"
    condition: "http_status != 200"
    severity: P1
    
  - name: "Revenue Pipeline"
    description: "PaymentSuccess events in last hour"
    condition: "count == 0 AND stripe_mode == 'live'"
    severity: P1
    note: "Exclude demo/test environments"
```

## Implementation
- Update A8 alerting config
- Deploy with feature flag
- Validate in staging for 24h
- Promote to production
