/**
 * A8 Command Center Dashboard Load Test
 * 
 * Tests core dashboard endpoints for the Command Center application.
 * 
 * KNOWN ISSUE: A8-PERF-001
 * - Route: /api/executive/overview
 * - Current P95: ~1085ms (exceeds 150ms SLO target)
 * - Root cause: Aggregated dashboard data requires caching layer
 * - Status: OPEN - test captures this for reporting purposes
 * 
 * Endpoints tested:
 * - /health (health check)
 * - /api/dashboard/status (dashboard status)
 * - /api/executive/overview (executive dashboard - known slow)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5008';
const NAMESPACE = 'perf_test';
const VERSION = __ENV.VERSION || 'local';

const healthLatency = new Trend('health_latency');
const dashboardStatusLatency = new Trend('dashboard_status_latency');
const executiveOverviewLatency = new Trend('executive_overview_latency');
const dashboardLatency = new Trend('dashboard_latency');
const cacheWarmRequests = new Counter('cache_warm_requests');
const errorRate = new Rate('error_rate');

const routes = [
  { 
    name: 'health', 
    path: '/health', 
    trend: healthLatency,
    slo_p95_ms: 100 
  },
  { 
    name: 'dashboard_status', 
    path: '/api/dashboard/status', 
    trend: dashboardStatusLatency,
    slo_p95_ms: 150 
  },
  { 
    name: 'executive_overview', 
    path: '/api/executive/overview', 
    trend: executiveOverviewLatency,
    slo_p95_ms: 150,
    known_issue: 'A8-PERF-001',
    current_p95_ms: 1085
  },
];

export const options = {
  scenarios: {
    cache_warm: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 5,
      maxDuration: '1m',
      tags: { test_type: 'cache_warm' },
      exec: 'cacheWarmTest',
    },
    smoke: {
      executor: 'constant-vus',
      vus: 5,
      duration: '5m',
      startTime: '1m',
      tags: { test_type: 'smoke' },
      exec: 'smokeTest',
    },
    baseline: {
      executor: 'constant-vus',
      vus: 20,
      duration: '15m',
      startTime: '7m',
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
      startTime: '23m',
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
      startTime: '44m',
      tags: { test_type: 'spike' },
      exec: 'spikeTest',
    },
    soak: {
      executor: 'constant-vus',
      vus: 20,
      duration: '60m',
      startTime: '47m',
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
    'health_latency': ['p(95)<100'],
    'dashboard_status_latency': ['p(95)<150'],
    'dashboard_latency': ['p(95)<150'],
    'error_rate': ['rate<0.01'],
  },
};

function makeRequest(route, params = {}) {
  const url = `${BASE_URL}${route.path}`;
  const headers = {
    'X-Test-Namespace': NAMESPACE,
    'X-Test-Version': VERSION,
    'User-Agent': `k6-perf-test/${VERSION}`,
    'namespace': NAMESPACE,
  };
  
  const res = http.get(url, { headers, ...params });
  
  const success = check(res, {
    [`${route.name} status 200`]: (r) => r.status === 200,
    [`${route.name} no timeout`]: (r) => r.timings.duration < 5000,
  });
  
  route.trend.add(res.timings.duration);
  dashboardLatency.add(res.timings.duration);
  errorRate.add(!success);
  
  return res;
}

export function cacheWarmTest() {
  group('A8 Cache Warm', () => {
    routes.forEach((route) => {
      makeRequest(route);
      cacheWarmRequests.add(1);
      sleep(1);
    });
  });
  sleep(2);
}

export function smokeTest() {
  group('A8 Smoke Test', () => {
    routes.forEach((route) => {
      makeRequest(route);
      sleep(0.5);
    });
  });
  sleep(1);
}

export function baselineTest() {
  group('A8 Baseline Test', () => {
    const route = routes[Math.floor(Math.random() * routes.length)];
    makeRequest(route);
  });
  sleep(0.5);
}

export function rampTest() {
  group('A8 Ramp Test', () => {
    const route = routes[Math.floor(Math.random() * routes.length)];
    makeRequest(route);
  });
  sleep(0.3);
}

export function spikeTest() {
  group('A8 Spike Test', () => {
    makeRequest(routes[0]);
    makeRequest(routes[1]);
  });
  sleep(0.1);
}

export function soakTest() {
  group('A8 Soak Test', () => {
    routes.forEach((route) => {
      makeRequest(route);
      sleep(0.2);
    });
  });
  sleep(1);
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    namespace: NAMESPACE,
    version: VERSION,
    base_url: BASE_URL,
    known_issues: [
      {
        id: 'A8-PERF-001',
        route: '/api/executive/overview',
        description: 'Dashboard P95 exceeds SLO (~1085ms vs 150ms target)',
        status: 'OPEN',
        remediation: 'Add caching layer for aggregated dashboard data',
      }
    ],
    metrics: {
      health_p95: data.metrics.health_latency?.values['p(95)'] || null,
      dashboard_status_p95: data.metrics.dashboard_status_latency?.values['p(95)'] || null,
      executive_overview_p95: data.metrics.executive_overview_latency?.values['p(95)'] || null,
      dashboard_p95: data.metrics.dashboard_latency?.values['p(95)'] || null,
      error_rate: data.metrics.error_rate?.values.rate || 0,
      total_requests: data.metrics.http_reqs?.values.count || 0,
      cache_warm_requests: data.metrics.cache_warm_requests?.values.count || 0,
    },
    slo_compliance: {
      health_meets_slo: (data.metrics.health_latency?.values['p(95)'] || 0) <= 100,
      dashboard_status_meets_slo: (data.metrics.dashboard_status_latency?.values['p(95)'] || 0) <= 150,
      executive_overview_meets_slo: (data.metrics.executive_overview_latency?.values['p(95)'] || 0) <= 150,
      executive_overview_note: 'Known issue A8-PERF-001: Current P95 ~1085ms exceeds 150ms SLO',
    },
    thresholds: data.thresholds,
  };
  
  return {
    'tests/perf/reports/a8_dashboard_results.json': JSON.stringify(summary, null, 2),
    stdout: JSON.stringify(summary, null, 2),
  };
}
