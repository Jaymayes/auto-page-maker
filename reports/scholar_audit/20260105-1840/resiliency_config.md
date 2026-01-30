# Resiliency Configuration

## Timeout & Retry Config

| Service | Timeout | Retries | Backoff | Circuit Breaker |
|---------|---------|---------|---------|-----------------|
| A1 | Default | 3 | Exponential | CLOSED (healthy) |
| A4 | Configurable | 3 | Yes | CLOSED (0 failures) |
| A6 | 150ms | 3 | Yes | N/A |
| A7 | 30s | 3 | Exponential | N/A |

## Circuit Breaker States

- A1: CLOSED, 0 failures, healthy
- A4: CLOSED, 0 failures, threshold=5

## Induced Fault Simulation

| Test | Result | Notes |
|------|--------|-------|
| Transient failure | ✅ Retry succeeds | 3 retries with backoff |
| A8 unreachable | ✅ Soft-fail | telemetry_outbound: "soft-fail-allowed" |

## Clock Skew Analysis

| Service Pair | Skew | Status |
|--------------|------|--------|
| A7 → A8 | <100ms | ✅ Acceptable |
| All services | <500ms | ✅ Acceptable |

**False Positive Source:** Clock skew NOT a factor in current alerts.
