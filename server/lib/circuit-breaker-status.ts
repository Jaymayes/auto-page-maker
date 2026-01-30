import { a6CircuitBreaker, CircuitBreakerStatus } from './circuit-breaker-a6.js';

export interface AllCircuitBreakerStatuses {
  a6: CircuitBreakerStatus;
  timestamp: string;
}

export function getCircuitBreakerStatus(): AllCircuitBreakerStatuses {
  return {
    a6: a6CircuitBreaker.getStatus(),
    timestamp: new Date().toISOString()
  };
}

export function getCircuitBreakerHealthSummary(): {
  healthy: boolean;
  openBreakers: string[];
  totalBacklogSize: number;
  totalDlqSize: number;
} {
  const statuses = getCircuitBreakerStatus();
  const openBreakers: string[] = [];
  let totalBacklogSize = 0;
  let totalDlqSize = 0;

  if (statuses.a6.state === 'open') {
    openBreakers.push('a6');
  }
  totalBacklogSize += statuses.a6.backlogSize;
  totalDlqSize += statuses.a6.dlqSize;

  return {
    healthy: openBreakers.length === 0,
    openBreakers,
    totalBacklogSize,
    totalDlqSize
  };
}
