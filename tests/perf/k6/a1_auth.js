import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5001';
const NAMESPACE = 'perf_test';
const VERSION = __ENV.VERSION || 'local';

const authLatency = new Trend('oidc_auth_latency');
const tokenLatency = new Trend('oidc_token_latency');
const healthLatency = new Trend('health_latency');
const oidcFlowLatency = new Trend('oidc_flow_latency');
const authRequests = new Counter('auth_requests_total');
const tokenRequests = new Counter('token_requests_total');
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
    'http_req_duration{test_type:smoke}': ['p(95)<150'],
    'http_req_duration{test_type:baseline}': ['p(95)<150'],
    'http_req_duration{test_type:ramp}': ['p(95)<150'],
    'http_req_duration{test_type:spike}': ['p(95)<150'],
    'http_req_duration{test_type:soak}': ['p(95)<150'],
    'http_req_duration': ['p(95)<150'],
    'oidc_auth_latency': ['p(95)<150'],
    'oidc_token_latency': ['p(95)<150'],
    'health_latency': ['p(95)<100'],
    'oidc_flow_latency': ['p(95)<300'],
    'error_rate': ['rate<0.01'],
  },
};

function getHeaders() {
  return {
    'X-Test-Namespace': NAMESPACE,
    'X-Test-Version': VERSION,
    'User-Agent': `k6-perf-test/${VERSION}`,
    'Content-Type': 'application/json',
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

function testOidcAuth() {
  const state = uuidv4();
  const nonce = uuidv4();
  const url = `${BASE_URL}/oidc/auth?client_id=test_client&redirect_uri=${encodeURIComponent('http://localhost:5000/callback')}&response_type=code&scope=openid%20profile%20email&state=${state}&nonce=${nonce}`;
  
  const res = http.get(url, { headers: getHeaders(), redirects: 0 });
  
  const success = check(res, {
    'oidc/auth status 200 or 302': (r) => r.status === 200 || r.status === 302,
    'oidc/auth latency ok': (r) => r.timings.duration < 150,
  });
  
  authLatency.add(res.timings.duration);
  authRequests.add(1);
  errorRate.add(!success);
  
  return { res, state, nonce };
}

function testOidcToken(authCode = 'test_auth_code') {
  const url = `${BASE_URL}/oidc/token`;
  const payload = JSON.stringify({
    grant_type: 'authorization_code',
    code: authCode,
    redirect_uri: 'http://localhost:5000/callback',
    client_id: 'test_client',
    client_secret: 'test_secret',
  });
  
  const res = http.post(url, payload, { headers: getHeaders() });
  
  const success = check(res, {
    'oidc/token status 200 or 400': (r) => r.status === 200 || r.status === 400,
    'oidc/token latency ok': (r) => r.timings.duration < 150,
  });
  
  tokenLatency.add(res.timings.duration);
  tokenRequests.add(1);
  errorRate.add(res.status >= 500);
  
  return res;
}

function simulateOidcFlow() {
  const flowStart = Date.now();
  
  const authResult = testOidcAuth();
  sleep(0.1);
  
  let authCode = 'simulated_auth_code';
  if (authResult.res.status === 302) {
    const location = authResult.res.headers['Location'];
    if (location) {
      const match = location.match(/code=([^&]+)/);
      if (match) authCode = match[1];
    }
  }
  
  const tokenResult = testOidcToken(authCode);
  
  const flowDuration = Date.now() - flowStart;
  oidcFlowLatency.add(flowDuration);
  
  return { auth: authResult, token: tokenResult };
}

export function smokeTest() {
  group('A1 Auth Smoke Test', () => {
    testHealth();
    sleep(0.5);
    testOidcAuth();
    sleep(0.5);
    testOidcToken();
  });
  sleep(1);
}

export function baselineTest() {
  group('A1 Auth Baseline Test', () => {
    const action = Math.random();
    if (action < 0.1) {
      testHealth();
    } else if (action < 0.5) {
      testOidcAuth();
    } else if (action < 0.8) {
      testOidcToken();
    } else {
      simulateOidcFlow();
    }
  });
  sleep(0.5);
}

export function rampTest() {
  group('A1 Auth Ramp Test', () => {
    const action = Math.random();
    if (action < 0.4) {
      testOidcAuth();
    } else if (action < 0.8) {
      testOidcToken();
    } else {
      simulateOidcFlow();
    }
  });
  sleep(0.3);
}

export function spikeTest() {
  group('A1 Auth Spike Test', () => {
    testOidcAuth();
    testOidcToken();
  });
  sleep(0.1);
}

export function soakTest() {
  group('A1 Auth Soak Test', () => {
    testHealth();
    sleep(0.2);
    simulateOidcFlow();
    sleep(0.2);
    testOidcAuth();
  });
  sleep(1);
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    namespace: NAMESPACE,
    version: VERSION,
    base_url: BASE_URL,
    app: 'a1_auth',
    metrics: {
      oidc_auth_p95: data.metrics.oidc_auth_latency?.values['p(95)'] || null,
      oidc_token_p95: data.metrics.oidc_token_latency?.values['p(95)'] || null,
      health_p95: data.metrics.health_latency?.values['p(95)'] || null,
      oidc_flow_p95: data.metrics.oidc_flow_latency?.values['p(95)'] || null,
      error_rate: data.metrics.error_rate?.values.rate || 0,
      total_requests: data.metrics.http_reqs?.values.count || 0,
      auth_requests: data.metrics.auth_requests_total?.values.count || 0,
      token_requests: data.metrics.token_requests_total?.values.count || 0,
    },
    thresholds: data.thresholds,
  };
  
  return {
    'tests/perf/reports/a1_results.json': JSON.stringify(summary, null, 2),
    stdout: JSON.stringify(summary, null, 2),
  };
}
