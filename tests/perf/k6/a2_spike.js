import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5002';
const NAMESPACE = 'perf_test';
const VERSION = __ENV.VERSION || 'local';

const healthLatency = new Trend('health_latency');
const ingestLatency = new Trend('ingest_latency');
const spikeLatency = new Trend('spike_latency');
const eventsSent = new Counter('events_sent');
const eventsAcked = new Counter('events_acked');
const eventsFailed = new Counter('events_failed');
const errorRate = new Rate('error_rate');
const spikeErrorRate = new Rate('spike_error_rate');

export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '30s', target: 5 },
        { duration: '30s', target: 100 },
        { duration: '5m', target: 100 },
        { duration: '30s', target: 5 },
        { duration: '3m30s', target: 5 },
      ],
      tags: { test_type: 'spike' },
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<125'],
    'ingest_latency': ['p(95)<125'],
    'spike_latency': ['p(95)<150'],
    'error_rate': ['rate<0.05'],
    'spike_error_rate': ['rate<0.05'],
  },
};

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Namespace': NAMESPACE,
    'X-Test-Version': VERSION,
    'User-Agent': `k6-a2-spike/${VERSION}`,
  };
}

function testHealth() {
  const url = `${BASE_URL}/health`;
  const res = http.get(url, { headers: getHeaders() });
  
  const success = check(res, {
    'health status 200': (r) => r.status === 200,
  });
  
  healthLatency.add(res.timings.duration);
  errorRate.add(!success);
  
  return res;
}

function testIngest() {
  const url = `${BASE_URL}/v1/events`;
  const payload = JSON.stringify({
    event_type: 'spike_test',
    event_id: `spike_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    data: {
      vu: __VU,
      iter: __ITER,
      scenario: 'spike',
      active_vus: __VU,
    },
  });
  
  eventsSent.add(1);
  
  const res = http.post(url, payload, { headers: getHeaders() });
  
  const success = check(res, {
    'ingest status 200 or 201': (r) => r.status === 200 || r.status === 201,
    'ingest latency ok': (r) => r.timings.duration < 125,
  });
  
  if (res.status === 200 || res.status === 201) {
    eventsAcked.add(1);
    spikeErrorRate.add(false);
  } else {
    eventsFailed.add(1);
    spikeErrorRate.add(true);
  }
  
  ingestLatency.add(res.timings.duration);
  spikeLatency.add(res.timings.duration);
  errorRate.add(!success);
  
  return res;
}

export default function () {
  group('A2 Spike Test', () => {
    if (__ITER % 100 === 0) {
      testHealth();
    }
    
    testIngest();
  });
  
  sleep(0.1);
}

export function handleSummary(data) {
  const sent = data.metrics.events_sent?.values.count || 0;
  const acked = data.metrics.events_acked?.values.count || 0;
  const failed = data.metrics.events_failed?.values.count || 0;
  
  const summary = {
    timestamp: new Date().toISOString(),
    test_type: 'spike',
    namespace: NAMESPACE,
    version: VERSION,
    base_url: BASE_URL,
    duration: '10m',
    spike_pattern: '5→100→5 VUs',
    metrics: {
      health_p95: data.metrics.health_latency?.values['p(95)'] || null,
      ingest_p95: data.metrics.ingest_latency?.values['p(95)'] || null,
      spike_p95: data.metrics.spike_latency?.values['p(95)'] || null,
      spike_p99: data.metrics.spike_latency?.values['p(99)'] || null,
      spike_max: data.metrics.spike_latency?.values.max || null,
      events_sent: sent,
      events_acked: acked,
      events_failed: failed,
      error_rate: data.metrics.error_rate?.values.rate || 0,
      spike_error_rate: data.metrics.spike_error_rate?.values.rate || 0,
      total_requests: data.metrics.http_reqs?.values.count || 0,
      requests_per_second: data.metrics.http_reqs?.values.rate || 0,
    },
    thresholds: data.thresholds,
    pass: Object.values(data.thresholds || {}).every(t => t.ok !== false),
    spike_resilience: {
      survived_spike: (data.metrics.spike_error_rate?.values.rate || 0) < 0.05,
      recovery_time_estimate: 'check latency drop after spike',
    },
  };
  
  return {
    'tests/perf/reports/a2_spike_results.json': JSON.stringify(summary, null, 2),
    stdout: JSON.stringify(summary, null, 2),
  };
}
