import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5002';
const NAMESPACE = 'perf_test';
const VERSION = __ENV.VERSION || 'local';

const healthLatency = new Trend('health_latency');
const ingestLatency = new Trend('ingest_latency');
const eventsSent = new Counter('events_sent');
const eventsAcked = new Counter('events_acked');
const errorRate = new Rate('error_rate');

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 5,
      duration: '5m',
      tags: { test_type: 'smoke' },
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<125'],
    'ingest_latency': ['p(95)<125'],
    'health_latency': ['p(95)<100'],
    'error_rate': ['rate<0.01'],
  },
};

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Namespace': NAMESPACE,
    'X-Test-Version': VERSION,
    'User-Agent': `k6-a2-smoke/${VERSION}`,
  };
}

function testHealth() {
  const url = `${BASE_URL}/health`;
  const res = http.get(url, { headers: getHeaders() });
  
  const success = check(res, {
    'health status 200': (r) => r.status === 200,
    'health latency ok': (r) => r.timings.duration < 100,
  });
  
  healthLatency.add(res.timings.duration);
  errorRate.add(!success);
  
  return res;
}

function testIngest() {
  const url = `${BASE_URL}/v1/events`;
  const payload = JSON.stringify({
    event_type: 'smoke_test',
    timestamp: new Date().toISOString(),
    data: {
      test_id: `smoke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      vu: __VU,
      iter: __ITER,
    },
  });
  
  eventsSent.add(1);
  
  const res = http.post(url, payload, { headers: getHeaders() });
  
  const success = check(res, {
    'ingest status 200 or 201': (r) => r.status === 200 || r.status === 201,
    'ingest latency P95 ok': (r) => r.timings.duration < 125,
    'ingest has response': (r) => r.body && r.body.length > 0,
  });
  
  if (res.status === 200 || res.status === 201) {
    eventsAcked.add(1);
  }
  
  ingestLatency.add(res.timings.duration);
  errorRate.add(!success);
  
  return res;
}

export default function () {
  group('A2 Smoke Test', () => {
    testHealth();
    sleep(0.5);
    
    testIngest();
    sleep(0.5);
  });
  
  sleep(1);
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    test_type: 'smoke',
    namespace: NAMESPACE,
    version: VERSION,
    base_url: BASE_URL,
    duration: '5m',
    vus: 5,
    metrics: {
      health_p95: data.metrics.health_latency?.values['p(95)'] || null,
      ingest_p95: data.metrics.ingest_latency?.values['p(95)'] || null,
      events_sent: data.metrics.events_sent?.values.count || 0,
      events_acked: data.metrics.events_acked?.values.count || 0,
      error_rate: data.metrics.error_rate?.values.rate || 0,
      total_requests: data.metrics.http_reqs?.values.count || 0,
    },
    thresholds: data.thresholds,
    pass: Object.values(data.thresholds || {}).every(t => t.ok !== false),
  };
  
  return {
    'tests/perf/reports/a2_smoke_results.json': JSON.stringify(summary, null, 2),
    stdout: JSON.stringify(summary, null, 2),
  };
}
