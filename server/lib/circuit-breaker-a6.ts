import { EventEmitter } from 'events';

type BreakerState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerConfig {
  failureThreshold: number;
  failureWindow: number;
  openDuration: number;
  halfOpenProbeInterval: number;
  successThreshold: number;
}

interface BacklogEntry {
  id: string;
  idempotency_key: string;
  payload_json: string;
  first_seen_at: Date;
  next_retry_at: Date;
  attempts: number;
  status: 'pending' | 'processing' | 'completed' | 'dead_letter';
}

interface BreakerMetrics {
  breaker_state: BreakerState;
  failures_last_5m: number;
  open_count_1h: number;
  provider_backlog_depth: number;
  dlq_depth: number;
  a3_call_p95_ms_to_a6: number;
  a3_call_error_rate_to_a6: number;
}

export interface CircuitBreakerStatus {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  lastOpenTime: number | null;
  backlogSize: number;
  dlqSize: number;
}

const A6_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  failureWindow: 60000,
  openDuration: 300000,
  halfOpenProbeInterval: 30000,
  successThreshold: 2,
};

const RETRY_CONFIG = {
  baseDelay: 30000,
  maxDelay: 900000,
  maxAttempts: 10,
  jitterFactor: 1.0,
};

class A6CircuitBreaker extends EventEmitter {
  private state: BreakerState = 'closed';
  private failures: number[] = [];
  private consecutiveSuccesses: number = 0;
  private openCount1h: number = 0;
  private lastOpenTime: number = 0;
  private lastProbeTime: number = 0;
  private enabled: boolean = false;
  private backlog: BacklogEntry[] = [];
  private dlq: BacklogEntry[] = [];
  private callLatencies: number[] = [];
  private callErrors: number = 0;
  private callTotal: number = 0;

  constructor(private config: CircuitBreakerConfig = A6_CIRCUIT_BREAKER_CONFIG) {
    super();
  }

  enable(): void {
    this.enabled = true;
    this.emit('enabled');
  }

  disable(): void {
    this.enabled = false;
    this.state = 'closed';
    this.emit('disabled');
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getState(): BreakerState {
    if (!this.enabled) return 'closed';
    
    if (this.state === 'open') {
      const elapsed = Date.now() - this.lastOpenTime;
      if (elapsed >= this.config.openDuration) {
        this.state = 'half-open';
        this.consecutiveSuccesses = 0;
        this.emit('state_change', { from: 'open', to: 'half-open' });
      }
    }
    return this.state;
  }

  private recordFailure(): void {
    const now = Date.now();
    this.failures.push(now);
    this.failures = this.failures.filter(t => now - t < this.config.failureWindow);
    this.callErrors++;
    this.callTotal++;
    
    if (this.failures.length >= this.config.failureThreshold && this.state === 'closed') {
      this.tripOpen();
    } else if (this.state === 'half-open') {
      this.tripOpen();
    }
  }

  private recordSuccess(latencyMs: number): void {
    this.callLatencies.push(latencyMs);
    if (this.callLatencies.length > 100) {
      this.callLatencies.shift();
    }
    this.callTotal++;
    
    if (this.state === 'half-open') {
      this.consecutiveSuccesses++;
      if (this.consecutiveSuccesses >= this.config.successThreshold) {
        this.state = 'closed';
        this.failures = [];
        this.emit('state_change', { from: 'half-open', to: 'closed' });
      }
    }
  }

  private tripOpen(): void {
    const prevState = this.state;
    this.state = 'open';
    this.lastOpenTime = Date.now();
    this.openCount1h++;
    this.consecutiveSuccesses = 0;
    this.emit('state_change', { from: prevState, to: 'open' });
    this.emit('circuit_opened');
  }

  canProbe(): boolean {
    if (this.state !== 'half-open') return false;
    const elapsed = Date.now() - this.lastProbeTime;
    return elapsed >= this.config.halfOpenProbeInterval;
  }

  markProbeAttempt(): void {
    this.lastProbeTime = Date.now();
  }

  async execute<T>(
    operation: () => Promise<T>,
    fallback: (payload: any) => void,
    payload: any,
    idempotencyKey: string
  ): Promise<T | null> {
    if (!this.enabled) {
      return operation();
    }

    const currentState = this.getState();

    if (currentState === 'open') {
      this.enqueueBacklog(payload, idempotencyKey);
      fallback(payload);
      return null;
    }

    if (currentState === 'half-open' && !this.canProbe()) {
      this.enqueueBacklog(payload, idempotencyKey);
      fallback(payload);
      return null;
    }

    if (currentState === 'half-open') {
      this.markProbeAttempt();
    }

    const start = Date.now();
    try {
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 2000)
        )
      ]);
      this.recordSuccess(Date.now() - start);
      return result;
    } catch (error: any) {
      this.recordFailure();
      if (currentState === 'closed' || currentState === 'half-open') {
        this.enqueueBacklog(payload, idempotencyKey);
        fallback(payload);
      }
      return null;
    }
  }

  private enqueueBacklog(payload: any, idempotencyKey: string): void {
    const existing = this.backlog.find(e => e.idempotency_key === idempotencyKey);
    if (existing) return;

    const entry: BacklogEntry = {
      id: `bl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      idempotency_key: idempotencyKey,
      payload_json: JSON.stringify(payload),
      first_seen_at: new Date(),
      next_retry_at: new Date(Date.now() + this.calculateBackoff(0)),
      attempts: 0,
      status: 'pending',
    };
    this.backlog.push(entry);
    this.emit('backlog_enqueued', entry);
  }

  private calculateBackoff(attempts: number): number {
    const delay = Math.min(
      RETRY_CONFIG.baseDelay * Math.pow(2, attempts),
      RETRY_CONFIG.maxDelay
    );
    const jitter = delay * RETRY_CONFIG.jitterFactor * Math.random();
    return delay + jitter;
  }

  async processBacklog(
    processor: (payload: any) => Promise<boolean>,
    maxRps: number = 5
  ): Promise<void> {
    if (this.getState() !== 'closed') return;

    const now = Date.now();
    const ready = this.backlog.filter(
      e => e.status === 'pending' && e.next_retry_at.getTime() <= now
    );

    for (const entry of ready.slice(0, maxRps)) {
      entry.status = 'processing';
      entry.attempts++;

      try {
        const payload = JSON.parse(entry.payload_json);
        const success = await processor(payload);
        
        if (success) {
          entry.status = 'completed';
          this.backlog = this.backlog.filter(e => e.id !== entry.id);
        } else {
          throw new Error('Processing failed');
        }
      } catch (error) {
        if (entry.attempts >= RETRY_CONFIG.maxAttempts) {
          entry.status = 'dead_letter';
          this.dlq.push(entry);
          this.backlog = this.backlog.filter(e => e.id !== entry.id);
          this.emit('dead_letter', entry);
        } else {
          entry.status = 'pending';
          entry.next_retry_at = new Date(now + this.calculateBackoff(entry.attempts));
        }
      }
    }
  }

  getMetrics(): BreakerMetrics {
    const now = Date.now();
    const fiveMinAgo = now - 300000;
    
    const sorted = [...this.callLatencies].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p95 = sorted[p95Index] || 0;

    return {
      breaker_state: this.getState(),
      failures_last_5m: this.failures.filter(t => t > fiveMinAgo).length,
      open_count_1h: this.openCount1h,
      provider_backlog_depth: this.backlog.filter(e => e.status === 'pending').length,
      dlq_depth: this.dlq.length,
      a3_call_p95_ms_to_a6: p95,
      a3_call_error_rate_to_a6: this.callTotal > 0 ? this.callErrors / this.callTotal : 0,
    };
  }

  shouldThrottle(): boolean {
    const metrics = this.getMetrics();
    return (
      (metrics.provider_backlog_depth >= 10 && metrics.provider_backlog_depth <= 30) ||
      (metrics.a3_call_p95_ms_to_a6 >= 1250 && metrics.a3_call_p95_ms_to_a6 < 1500)
    );
  }

  shouldKill(): boolean {
    const metrics = this.getMetrics();
    return (
      metrics.provider_backlog_depth > 30 ||
      metrics.a3_call_p95_ms_to_a6 >= 1500 ||
      metrics.a3_call_error_rate_to_a6 >= 0.01
    );
  }

  resetHourlyCounters(): void {
    this.openCount1h = 0;
  }

  getStatus(): CircuitBreakerStatus {
    return {
      state: this.getState(),
      failures: this.failures.length,
      lastOpenTime: this.lastOpenTime > 0 ? this.lastOpenTime : null,
      backlogSize: this.backlog.filter(e => e.status === 'pending').length,
      dlqSize: this.dlq.length
    };
  }
}

export const a6CircuitBreaker = new A6CircuitBreaker();

export function getA6BreakerMetrics(): BreakerMetrics {
  return a6CircuitBreaker.getMetrics();
}

export function enableA6CircuitBreaker(): void {
  a6CircuitBreaker.enable();
}

export function disableA6CircuitBreaker(): void {
  a6CircuitBreaker.disable();
}
