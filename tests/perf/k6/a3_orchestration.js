import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5003';
const NAMESPACE = 'perf_test';
const VERSION = __ENV.VERSION || 'local';

const preflightLatency = new Trend('preflight_latency');
const orchestrationLatency = new Trend('orchestration_run_latency');
const healthLatency = new Trend('health_latency');
const preflightRequests = new Counter('preflight_requests_total');
const orchestrationRequests = new Counter('orchestration_requests_total');
const errorRate = new Rate('error_rate');

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 5,
      duration: '5m',
      tags: { test_type: 'smoke' },
      exec: 'smokeTest',
    },
    baseline: {
      executor: 'constant-vus',
      vus: 20,
      duration: '15m',
      startTime: '6m',
      tags: { test_type: 'baseline' },
      exec: 'baselineTest',
    },
    ramp: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '5m', target: 20 },
        { duration: '5m', target: 40 },
        { duration: '5m', target: 60 },
        { duration: '5m', target: 10 },
      ],
      startTime: '22m',
      tags: { test_type: 'ramp' },
      exec: 'rampTest',
    },
    spike: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '10s', target: 100 },
        { duration: '2m', target: 100 },
        { duration: '30s', target: 5 },
      ],
      startTime: '43m',
      tags: { test_type: 'spike' },
      exec: 'spikeTest',
    },
    soak: {
      executor: 'constant-vus',
      vus: 20,
      duration: '60m',
      startTime: '46m',
      tags: { test_type: 'soak' },
      exec: 'soakTest',
    },
  },
  thresholds: {
    'http_req_duration{test_type:smoke}': ['p(95)<500'],
    'http_req_duration{test_type:baseline}': ['p(95)<500'],
    'http_req_duration{test_type:ramp}': ['p(95)<500'],
    'http_req_duration{test_type:spike}': ['p(95)<500'],
    'http_req_duration{test_type:soak}': ['p(95)<500'],
    'preflight_latency': ['p(95)<150'],
    'orchestration_run_latency': ['p(95)<500'],
    'health_latency': ['p(95)<100'],
    'error_rate': ['rate<0.01'],
  },
};

function getHeaders(includeIdempotencyKey = false) {
  const headers = {
    'X-Test-Namespace': NAMESPACE,
    'X-Test-Version': VERSION,
    'User-Agent': `k6-perf-test/${VERSION}`,
    'Content-Type': 'application/json',
  };
  
  if (includeIdempotencyKey) {
    headers['Idempotency-Key'] = uuidv4();
  }
  
  return headers;
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

function testPreflight() {
  const url = `${BASE_URL}/preflight`;
  const payload = JSON.stringify({
    user_id: `test_user_${__VU}_${__ITER}`,
    context: {
      test: true,
      namespace: NAMESPACE,
    },
  });
  
  const res = http.post(url, payload, { headers: getHeaders() });
  
  const success = check(res, {
    'preflight status 200': (r) => r.status === 200,
    'preflight latency ok': (r) => r.timings.duration < 150,
    'preflight has valid response': (r) => {
      if (r.status !== 200) return true;
      try {
        const body = JSON.parse(r.body);
        return body !== null;
      } catch {
        return false;
      }
    },
  });
  
  preflightLatency.add(res.timings.duration);
  preflightRequests.add(1);
  errorRate.add(!success);
  
  return res;
}

function testOrchestrationRun() {
  const url = `${BASE_URL}/orchestration/run`;
  const payload = JSON.stringify({
    user_id: `test_user_${__VU}_${__ITER}`,
    workflow: 'test_workflow',
    parameters: {
      test: true,
      namespace: NAMESPACE,
      timestamp: Date.now(),
    },
  });
  
  const res = http.post(url, payload, { headers: getHeaders(true) });
  
  const success = check(res, {
    'orchestration/run status 200 or 202': (r) => r.status === 200 || r.status === 202,
    'orchestration/run latency ok': (r) => r.timings.duration < 500,
    'orchestration/run has valid response': (r) => {
      if (r.status >= 400) return true;
      try {
        const body = JSON.parse(r.body);
        return body !== null;
      } catch {
        return false;
      }
    },
  });
  
  orchestrationLatency.add(res.timings.duration);
  orchestrationRequests.add(1);
  errorRate.add(res.status >= 500);
  
  return res;
}

function testFullFlow() {
  const preflightRes = testPreflight();
  sleep(0.1);
  
  if (preflightRes.status === 200) {
    testOrchestrationRun();
  }
}

export function smokeTest() {
  group('A3 Orchestration Smoke Test', () => {
    testHealth();
    sleep(0.5);
    testPreflight();
    sleep(0.5);
    testOrchestrationRun();
  });
  sleep(1);
}

export function baselineTest() {
  group('A3 Orchestration Baseline Test', () => {
    const action = Math.random();
    if (action < 0.1) {
      testHealth();
    } else if (action < 0.5) {
      testPreflight();
    } else if (action < 0.8) {
      testOrchestrationRun();
    } else {
      testFullFlow();
    }
  });
  sleep(0.5);
}

export function rampTest() {
  group('A3 Orchestration Ramp Test', () => {
    const action = Math.random();
    if (action < 0.4) {
      testPreflight();
    } else if (action < 0.8) {
      testOrchestrationRun();
    } else {
      testFullFlow();
    }
  });
  sleep(0.3);
}

export function spikeTest() {
  group('A3 Orchestration Spike Test', () => {
    testPreflight();
    testOrchestrationRun();
  });
  sleep(0.1);
}

export function soakTest() {
  group('A3 Orchestration Soak Test', () => {
    testHealth();
    sleep(0.2);
    testFullFlow();
    sleep(0.2);
    testPreflight();
  });
  sleep(1);
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    namespace: NAMESPACE,
    version: VERSION,
    base_url: BASE_URL,
    app: 'a3_agent',
    metrics: {
      preflight_p95: data.metrics.preflight_latency?.values['p(95)'] || null,
      orchestration_run_p95: data.metrics.orchestration_run_latency?.values['p(95)'] || null,
      health_p95: data.metrics.health_latency?.values['p(95)'] || null,
      error_rate: data.metrics.error_rate?.values.rate || 0,
      total_requests: data.metrics.http_reqs?.values.count || 0,
      preflight_requests: data.metrics.preflight_requests_total?.values.count || 0,
      orchestration_requests: data.metrics.orchestration_requests_total?.values.count || 0,
    },
    thresholds: data.thresholds,
  };
  
  return {
    'tests/perf/reports/a3_results.json': JSON.stringify(summary, null, 2),
    stdout: JSON.stringify(summary, null, 2),
  };
}
