/**
 * A8 Command Center Filter Performance Test
 * 
 * Tests dashboard filtering endpoints to measure impact of query parameters
 * on latency performance.
 * 
 * KNOWN ISSUE: A8-PERF-001
 * - Route: /api/executive/overview
 * - Current P95: ~1085ms (exceeds 150ms SLO target)
 * - Filtering may exacerbate latency due to additional query processing
 * - Status: OPEN
 * 
 * Filter Parameters Tested:
 * - date_range: 7d, 30d, 90d, 365d
 * - app_filter: individual apps (a1-a8) and combinations
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5008';
const NAMESPACE = 'perf_test';
const VERSION = __ENV.VERSION || 'local';

const noFilterLatency = new Trend('no_filter_latency');
const dateRangeFilterLatency = new Trend('date_range_filter_latency');
const appFilterLatency = new Trend('app_filter_latency');
const combinedFilterLatency = new Trend('combined_filter_latency');
const filterImpactLatency = new Trend('filter_impact_latency');
const errorRate = new Rate('error_rate');

const dateRanges = ['7d', '30d', '90d', '365d'];
const appFilters = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'];

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 5,
      duration: '5m',
      tags: { test_type: 'smoke' },
      exec: 'smokeTest',
    },
  },
  thresholds: {
    'http_req_duration{test_type:smoke}': ['p(95)<150'],
    'no_filter_latency': ['p(95)<150'],
    'date_range_filter_latency': ['p(95)<150'],
    'app_filter_latency': ['p(95)<150'],
    'combined_filter_latency': ['p(95)<150'],
    'filter_impact_latency': ['p(95)<150'],
    'error_rate': ['rate<0.01'],
  },
};

function makeFilterRequest(path, queryParams = {}, trend) {
  const url = new URL(path, BASE_URL);
  Object.entries(queryParams).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });
  
  const headers = {
    'X-Test-Namespace': NAMESPACE,
    'X-Test-Version': VERSION,
    'User-Agent': `k6-perf-test/${VERSION}`,
    'namespace': NAMESPACE,
  };
  
  const res = http.get(url.toString(), { headers });
  
  const filterDesc = Object.keys(queryParams).length > 0 
    ? `with filters: ${JSON.stringify(queryParams)}` 
    : 'no filters';
  
  const success = check(res, {
    [`${path} ${filterDesc} status 200`]: (r) => r.status === 200,
    [`${path} ${filterDesc} no timeout`]: (r) => r.timings.duration < 5000,
  });
  
  trend.add(res.timings.duration);
  filterImpactLatency.add(res.timings.duration);
  errorRate.add(!success);
  
  return res;
}

export function smokeTest() {
  group('A8 Filter - No Filters Baseline', () => {
    makeFilterRequest('/api/executive/overview', {}, noFilterLatency);
    sleep(0.5);
  });
  
  group('A8 Filter - Date Range Filters', () => {
    const dateRange = dateRanges[Math.floor(Math.random() * dateRanges.length)];
    makeFilterRequest('/api/executive/overview', { date_range: dateRange }, dateRangeFilterLatency);
    sleep(0.5);
  });
  
  group('A8 Filter - App Filters', () => {
    const appFilter = appFilters[Math.floor(Math.random() * appFilters.length)];
    makeFilterRequest('/api/executive/overview', { app_filter: appFilter }, appFilterLatency);
    sleep(0.5);
  });
  
  group('A8 Filter - Combined Filters', () => {
    const dateRange = dateRanges[Math.floor(Math.random() * dateRanges.length)];
    const appFilter = appFilters[Math.floor(Math.random() * appFilters.length)];
    makeFilterRequest(
      '/api/executive/overview', 
      { date_range: dateRange, app_filter: appFilter }, 
      combinedFilterLatency
    );
    sleep(0.5);
  });
  
  group('A8 Filter - Dashboard Status', () => {
    makeFilterRequest('/api/dashboard/status', {}, noFilterLatency);
    sleep(0.5);
  });
  
  group('A8 Filter - Health Check', () => {
    makeFilterRequest('/health', {}, noFilterLatency);
    sleep(0.5);
  });
  
  sleep(1);
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    namespace: NAMESPACE,
    version: VERSION,
    base_url: BASE_URL,
    test_type: 'filter_performance',
    known_issues: [
      {
        id: 'A8-PERF-001',
        route: '/api/executive/overview',
        description: 'Dashboard P95 exceeds SLO (~1085ms vs 150ms target)',
        filter_impact: 'Filtering may increase latency due to additional query processing',
        status: 'OPEN',
      }
    ],
    metrics: {
      no_filter_p95: data.metrics.no_filter_latency?.values['p(95)'] || null,
      no_filter_avg: data.metrics.no_filter_latency?.values.avg || null,
      date_range_filter_p95: data.metrics.date_range_filter_latency?.values['p(95)'] || null,
      date_range_filter_avg: data.metrics.date_range_filter_latency?.values.avg || null,
      app_filter_p95: data.metrics.app_filter_latency?.values['p(95)'] || null,
      app_filter_avg: data.metrics.app_filter_latency?.values.avg || null,
      combined_filter_p95: data.metrics.combined_filter_latency?.values['p(95)'] || null,
      combined_filter_avg: data.metrics.combined_filter_latency?.values.avg || null,
      overall_filter_impact_p95: data.metrics.filter_impact_latency?.values['p(95)'] || null,
      error_rate: data.metrics.error_rate?.values.rate || 0,
      total_requests: data.metrics.http_reqs?.values.count || 0,
    },
    filter_analysis: {
      date_ranges_tested: dateRanges,
      app_filters_tested: appFilters,
      notes: 'Compare no_filter_p95 vs filtered latencies to measure filter overhead',
    },
    slo_compliance: {
      meets_slo: (data.metrics.filter_impact_latency?.values['p(95)'] || 0) <= 150,
      note: 'Known issue A8-PERF-001: Executive overview may exceed 150ms SLO',
    },
    thresholds: data.thresholds,
  };
  
  return {
    'tests/perf/reports/a8_filter_results.json': JSON.stringify(summary, null, 2),
    stdout: JSON.stringify(summary, null, 2),
  };
}
