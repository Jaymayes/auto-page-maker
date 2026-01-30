# Backoff & Circuit Breaker Examples

## Overview
The resilience utilities in `shared/utils/resilience.ts` provide:
1. **Exponential Backoff with Jitter** - Retry failed requests with increasing delays
2. **Circuit Breaker** - Prevent cascade failures by failing fast when a service is down

## Usage Examples

### Basic Backoff
```typescript
import { withBackoff } from '../shared/utils/resilience';

const result = await withBackoff(async () => {
  const response = await fetch('https://api.example.com/data');
  if (!response.ok) throw new Error('Failed');
  return response.json();
}, {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 4000,
  jitter: true
});
```

### Circuit Breaker
```typescript
import { CircuitBreaker } from '../shared/utils/resilience';

const apiCircuit = new CircuitBreaker('external-api', {
  failureThreshold: 5,  // Open after 5 failures
  resetTimeout: 30000,  // Try again after 30s
  halfOpenRequests: 1   // Allow 1 test request
});

try {
  const result = await apiCircuit.execute(async () => {
    return fetch('https://api.example.com/data');
  });
} catch (error) {
  if (error.message.includes('Circuit breaker')) {
    // Service is temporarily unavailable
    return fallbackResponse();
  }
  throw error;
}
```

### Combined: Resilient Fetch
```typescript
import { resilientFetch, openaiCircuit } from '../shared/utils/resilience';

// Fetch with backoff + circuit breaker
const response = await resilientFetch(
  'https://api.openai.com/v1/completions',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt: 'Hello' })
  },
  openaiCircuit,  // Use OpenAI circuit breaker
  { maxRetries: 3, baseDelay: 2000 }
);
```

## Pre-configured Circuit Breakers

| Name | Failure Threshold | Reset Timeout | Use Case |
|------|-------------------|---------------|----------|
| `openaiCircuit` | 3 | 60s | OpenAI API calls |
| `stripeCircuit` | 3 | 30s | Stripe API calls |
| `dataServiceCircuit` | 5 | 15s | Internal DataService |

## Inter-Service Communication

### DataService → Orchestrator
```typescript
import { resilientFetch, dataServiceCircuit } from '../shared/utils/resilience';

async function notifyOrchestrator(event: any) {
  return resilientFetch(
    `${ORCHESTRATOR_URL}/events/document_uploaded`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify(event)
    },
    dataServiceCircuit,
    { maxRetries: 3, baseDelay: 1000, maxDelay: 4000 }
  );
}
```

### Orchestrator → OpenAI (with fallback)
```typescript
import { resilientFetch, openaiCircuit } from '../shared/utils/resilience';

async function analyzeWithAI(text: string) {
  try {
    const response = await resilientFetch(
      'https://api.openai.com/v1/completions',
      { /* options */ },
      openaiCircuit
    );
    return response.json();
  } catch (error) {
    // Fallback to stub analysis if OpenAI is down
    console.log('[fallback] Using stub analysis');
    return { analysis: 'pending', source: 'stub' };
  }
}
```

## Monitoring Circuit State

```typescript
console.log(`OpenAI circuit: ${openaiCircuit.getState()}`);
// Output: "closed" | "open" | "half-open"

// Manual reset (admin action)
openaiCircuit.reset();
```
