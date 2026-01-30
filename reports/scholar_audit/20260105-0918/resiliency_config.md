# Resiliency Configuration - Phase 1

| Service | Timeout | Retries | Circuit Breaker |
|---------|---------|---------|-----------------|
| A1 | Default | 3 | CLOSED (healthy) |
| A4 | Configurable | 3 | CLOSED (0 failures) |
| A6 | 150ms | 3 | N/A |
| A7 | 30s | 3 | N/A |

## Findings

- **A2 /ready missing**: Orchestrators may retry indefinitely on 404
- **Recommendation**: Add /ready returning 200/503
