import { a6CircuitBreaker, getA6BreakerMetrics } from './circuit-breaker-a6';

interface MetricPoint {
  timestamp: number;
  p95_ms: number;
  error_rate: number;
  cache_hit_pct: number;
  autoscaling_reserves_pct: number;
  backlog_depth: number;
  throttle_state: 'none' | 'throttled' | 'killed';
  breaker_state: 'closed' | 'open' | 'half-open';
}

interface TrendAnalysis {
  current_p95_ms: number;
  slope_5min: number;
  trendline_10min: number;
  vs_gate_1250ms: 'below' | 'at' | 'above';
  recommendation: 'GO' | 'THROTTLE' | 'KILL';
}

interface StateTransition {
  timestamp: number;
  from: string;
  to: string;
  event: 'breaker' | 'deploy' | 'rollback';
}

class P95Monitor {
  private metrics1min: MetricPoint[] = [];
  private metrics10sec: MetricPoint[] = [];
  private transitions: StateTransition[] = [];
  private lastBreakerState: string = 'closed';

  recordMetric(point: Omit<MetricPoint, 'timestamp'>): void {
    const now = Date.now();
    const fullPoint: MetricPoint = { ...point, timestamp: now };
    
    this.metrics1min.push(fullPoint);
    this.metrics10sec.push(fullPoint);
    
    const fifteenMinAgo = now - 15 * 60 * 1000;
    const tenMinAgo = now - 10 * 60 * 1000;
    
    this.metrics1min = this.metrics1min.filter(m => m.timestamp > fifteenMinAgo);
    this.metrics10sec = this.metrics10sec.filter(m => m.timestamp > tenMinAgo);

    if (point.breaker_state !== this.lastBreakerState) {
      this.transitions.push({
        timestamp: now,
        from: this.lastBreakerState,
        to: point.breaker_state,
        event: 'breaker',
      });
      this.lastBreakerState = point.breaker_state;
    }
  }

  recordDeployEvent(type: 'deploy' | 'rollback', buildId: string): void {
    this.transitions.push({
      timestamp: Date.now(),
      from: buildId,
      to: type,
      event: type,
    });
  }

  get15MinSeries(): { timestamp: number; p95_ms: number }[] {
    const buckets = new Map<number, number[]>();
    const now = Date.now();
    
    for (const m of this.metrics1min) {
      const bucket = Math.floor(m.timestamp / 60000) * 60000;
      if (!buckets.has(bucket)) buckets.set(bucket, []);
      buckets.get(bucket)!.push(m.p95_ms);
    }

    return Array.from(buckets.entries())
      .map(([ts, values]) => ({
        timestamp: ts,
        p95_ms: this.calculateP95(values),
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  get10MinSeries(): { timestamp: number; p95_ms: number }[] {
    const buckets = new Map<number, number[]>();
    
    for (const m of this.metrics10sec) {
      const bucket = Math.floor(m.timestamp / 10000) * 10000;
      if (!buckets.has(bucket)) buckets.set(bucket, []);
      buckets.get(bucket)!.push(m.p95_ms);
    }

    return Array.from(buckets.entries())
      .map(([ts, values]) => ({
        timestamp: ts,
        p95_ms: this.calculateP95(values),
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  private calculateP95(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * 0.95);
    return sorted[Math.min(idx, sorted.length - 1)];
  }

  private calculateSlope(series: { timestamp: number; p95_ms: number }[]): number {
    if (series.length < 2) return 0;
    const n = series.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += series[i].p95_ms;
      sumXY += i * series[i].p95_ms;
      sumX2 += i * i;
    }
    
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  analyzeTrend(): TrendAnalysis {
    const series15 = this.get15MinSeries();
    const series10 = this.get10MinSeries();
    const latest = this.metrics10sec[this.metrics10sec.length - 1];
    
    const currentP95 = latest?.p95_ms || 0;
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const last5Min = series15.filter(s => s.timestamp > fiveMinAgo);
    const slope5min = this.calculateSlope(last5Min);
    
    const trendline10min = series10.length > 0 
      ? series10.reduce((sum, s) => sum + s.p95_ms, 0) / series10.length 
      : 0;

    let vsGate: 'below' | 'at' | 'above';
    if (currentP95 < 1000) vsGate = 'below';
    else if (currentP95 <= 1250) vsGate = 'at';
    else vsGate = 'above';

    const errorRate = latest?.error_rate || 0;
    let recommendation: 'GO' | 'THROTTLE' | 'KILL';
    
    if (currentP95 >= 1500 || errorRate >= 0.01) {
      recommendation = 'KILL';
    } else if (currentP95 > 1250 || errorRate >= 0.005) {
      recommendation = 'THROTTLE';
    } else {
      recommendation = 'GO';
    }

    return {
      current_p95_ms: currentP95,
      slope_5min: slope5min,
      trendline_10min: trendline10min,
      vs_gate_1250ms: vsGate,
      recommendation,
    };
  }

  getOverlays(): {
    error_rate: number;
    throttle_state: string;
    autoscaling_reserves_pct: number;
    cache_hit_pct: number;
    backlog_depth: number;
  } {
    const latest = this.metrics10sec[this.metrics10sec.length - 1];
    return {
      error_rate: latest?.error_rate || 0,
      throttle_state: latest?.throttle_state || 'none',
      autoscaling_reserves_pct: latest?.autoscaling_reserves_pct || 0,
      cache_hit_pct: latest?.cache_hit_pct || 0,
      backlog_depth: latest?.backlog_depth || 0,
    };
  }

  getAnnotations(): StateTransition[] {
    const tenMinAgo = Date.now() - 10 * 60 * 1000;
    return this.transitions.filter(t => t.timestamp > tenMinAgo);
  }

  getFullDashboard() {
    const breakerMetrics = getA6BreakerMetrics();
    
    return {
      timestamp: new Date().toISOString(),
      series: {
        a6_provider_register: {
          '15min_1min_res': this.get15MinSeries(),
          '10min_10sec_res': this.get10MinSeries(),
        },
        a6_health: {
          '15min_1min_res': this.get15MinSeries(),
          '10min_10sec_res': this.get10MinSeries(),
        },
        a3_to_a6_call_path: {
          p95_ms: breakerMetrics.a3_call_p95_ms_to_a6,
          error_rate: breakerMetrics.a3_call_error_rate_to_a6,
        },
      },
      overlays: this.getOverlays(),
      annotations: this.getAnnotations(),
      callouts: this.analyzeTrend(),
      breaker: {
        state: breakerMetrics.breaker_state,
        backlog_depth: breakerMetrics.provider_backlog_depth,
        dlq_depth: breakerMetrics.dlq_depth,
        failures_last_5m: breakerMetrics.failures_last_5m,
        open_count_1h: breakerMetrics.open_count_1h,
      },
      thresholds: {
        gate_p95_ms: 1250,
        throttle_p95_ms: 1250,
        kill_p95_ms: 1500,
        gate_error_rate: 0.005,
        kill_error_rate: 0.01,
      },
    };
  }

  evaluateIfThen(): {
    condition: string;
    action: string;
    details: any;
  } {
    const trend = this.analyzeTrend();
    const overlays = this.getOverlays();
    const p95 = trend.current_p95_ms;
    const errRate = overlays.error_rate;
    const slope = trend.slope_5min;

    if (p95 >= 1500 || errRate >= 0.01) {
      return {
        condition: 'KILL',
        action: 'Roll back immediately; maintain Student-Only mode',
        details: { p95, errRate, trigger: p95 >= 1500 ? 'p95_spike' : 'error_rate' },
      };
    }

    if (p95 > 1250 || errRate >= 0.005) {
      return {
        condition: 'THROTTLE',
        action: 'Clamp to THROTTLE; page CEO; prepare rollback',
        details: { p95, errRate, slope },
      };
    }

    if (p95 >= 1000 && p95 <= 1250 && errRate < 0.005) {
      return {
        condition: 'HOLD',
        action: 'Hold posture; keep warming cache; ensure autoscaling_reserves >=10%',
        details: { p95, errRate, slope, autoscaling: overlays.autoscaling_reserves_pct },
      };
    }

    if (p95 <= 1000 && slope < 0 && errRate < 0.003) {
      return {
        condition: 'IMPROVING',
        action: 'Continue probes; keep breaker ON; cancel Maintenance auto-send if 30-min green before 09:21:13Z',
        details: { p95, errRate, slope, trend: 'falling' },
      };
    }

    return {
      condition: 'STABLE',
      action: 'Continue monitoring; proceed to precheck',
      details: { p95, errRate, slope },
    };
  }
}

export const p95Monitor = new P95Monitor();

export function recordP95Metric(point: Omit<MetricPoint, 'timestamp'>): void {
  p95Monitor.recordMetric(point);
}

export function getP95Dashboard() {
  return p95Monitor.getFullDashboard();
}

export function evaluateP95Condition() {
  return p95Monitor.evaluateIfThen();
}
