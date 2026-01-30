import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const NAMESPACE = 'perf_test';
const VERSION = __ENV.VERSION || 'local';

const sitemapLatency = new Trend('sitemap_latency');
const homepageLatency = new Trend('homepage_latency');
const browseLatency = new Trend('browse_latency');
const lpLatency = new Trend('landing_page_latency');
const attributionEvents = new Counter('attribution_events_sent');
const errorRate = new Rate('error_rate');

const routes = [
  { name: 'sitemap', path: '/sitemap.xml', trend: sitemapLatency },
  { name: 'homepage', path: '/', trend: homepageLatency },
  { name: 'browse', path: '/browse', trend: browseLatency },
  { name: 'browse_states', path: '/browse/states', trend: browseLatency },
  { name: 'browse_majors', path: '/browse/majors', trend: browseLatency },
];

const sampleLandingPages = [
  '/scholarship/stem-scholarship-for-women',
  '/scholarship/first-generation-college-student-award',
  '/state/california',
  '/major/computer-science',
];

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
    'http_req_duration{route:core}': ['p(95)<150'],
    'http_req_duration{route:sitemap}': ['p(95)<500'],
    'homepage_latency': ['p(95)<150'],
    'browse_latency': ['p(95)<150'],
    'landing_page_latency': ['p(95)<150'],
    'sitemap_latency': ['p(95)<500'],
    'error_rate': ['rate<0.01'],
  },
};

function makeRequest(route, params = {}) {
  const url = `${BASE_URL}${route.path}`;
  const headers = {
    'X-Test-Namespace': NAMESPACE,
    'X-Test-Version': VERSION,
    'User-Agent': `k6-perf-test/${VERSION}`,
  };
  
  const routeTag = route.name === 'sitemap' ? 'sitemap' : 'core';
  const res = http.get(url, { headers, tags: { route: routeTag }, ...params });
  
  const success = check(res, {
    [`${route.name} status 200`]: (r) => r.status === 200,
    [`${route.name} no timeout`]: (r) => r.timings.duration < 5000,
  });
  
  route.trend.add(res.timings.duration);
  errorRate.add(!success);
  
  return res;
}

function testLandingPage(path) {
  const url = `${BASE_URL}${path}?utm_source=perf_test&utm_medium=k6&utm_campaign=a7_load_test`;
  const headers = {
    'X-Test-Namespace': NAMESPACE,
    'X-Test-Version': VERSION,
  };
  
  const res = http.get(url, { headers });
  
  const success = check(res, {
    'landing page status 200 or 404': (r) => r.status === 200 || r.status === 404,
    'landing page latency ok': (r) => r.timings.duration < 150,
  });
  
  lpLatency.add(res.timings.duration);
  errorRate.add(res.status >= 500);
  
  if (res.status === 200) {
    attributionEvents.add(1);
  }
  
  return res;
}

export function smokeTest() {
  group('A7 Smoke Test', () => {
    routes.forEach((route) => {
      makeRequest(route);
      sleep(0.5);
    });
  });
  sleep(1);
}

export function baselineTest() {
  group('A7 Baseline Test', () => {
    const route = routes[Math.floor(Math.random() * routes.length)];
    makeRequest(route);
    
    if (Math.random() < 0.2) {
      const lp = sampleLandingPages[Math.floor(Math.random() * sampleLandingPages.length)];
      testLandingPage(lp);
    }
  });
  sleep(0.5);
}

export function rampTest() {
  group('A7 Ramp Test', () => {
    const route = routes[Math.floor(Math.random() * routes.length)];
    makeRequest(route);
  });
  sleep(0.3);
}

export function spikeTest() {
  group('A7 Spike Test', () => {
    makeRequest(routes[0]);
    makeRequest(routes[1]);
  });
  sleep(0.1);
}

export function soakTest() {
  group('A7 Soak Test', () => {
    routes.forEach((route) => {
      makeRequest(route);
      sleep(0.2);
    });
    
    const lp = sampleLandingPages[Math.floor(Math.random() * sampleLandingPages.length)];
    testLandingPage(lp);
  });
  sleep(1);
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    namespace: NAMESPACE,
    version: VERSION,
    base_url: BASE_URL,
    metrics: {
      sitemap_p95: data.metrics.sitemap_latency?.values['p(95)'] || null,
      homepage_p95: data.metrics.homepage_latency?.values['p(95)'] || null,
      browse_p95: data.metrics.browse_latency?.values['p(95)'] || null,
      landing_page_p95: data.metrics.landing_page_latency?.values['p(95)'] || null,
      error_rate: data.metrics.error_rate?.values.rate || 0,
      total_requests: data.metrics.http_reqs?.values.count || 0,
      attribution_events: data.metrics.attribution_events_sent?.values.count || 0,
    },
    thresholds: data.thresholds,
  };
  
  return {
    'tests/perf/reports/a7_results.json': JSON.stringify(summary, null, 2),
    stdout: JSON.stringify(summary, null, 2),
  };
}
