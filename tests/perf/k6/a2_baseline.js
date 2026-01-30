import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5002';
const NAMESPACE = 'perf_test';
const VERSION = __ENV.VERSION || 'local';

const healthLatency = new Trend('health_latency');
const ingestLatency = new Trend('ingest_latency');
const batchLatency = new Trend('batch_ingest_latency');
const eventsSent = new Counter('events_sent');
const eventsAcked = new Counter('events_acked');
const eventsIngested = new Counter('events_ingested');
const eventsFailed = new Counter('events_failed');
const errorRate = new Rate('error_rate');
const persistenceRate = new Rate('persistence_rate');

export const options = {
  scenarios: {
    baseline: {
      executor: 'constant-vus',
      vus: 20,
      duration: '15m',
      tags: { test_type: 'baseline' },
    },
  },
  thresholds: {
    'http_req_duration{endpoint:single}': ['p(95)<125'],
    'http_req_duration{endpoint:batch}': ['p(95)<200'],
    'http_req_duration{endpoint:health}': ['p(95)<100'],
    'ingest_latency': ['p(95)<125'],
    'batch_ingest_latency': ['p(95)<200'],
    'health_latency': ['p(95)<100'],
    'error_rate': ['rate<0.01'],
    'persistence_rate': ['rate>0.99'],
  },
};

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Namespace': NAMESPACE,
    'X-Test-Version': VERSION,
    'User-Agent': `k6-a2-baseline/${VERSION}`,
  };
}

function testHealth() {
  const url = `${BASE_URL}/health`;
  const res = http.get(url, { headers: getHeaders(), tags: { endpoint: 'health' } });
  
  const success = check(res, {
    'health status 200': (r) => r.status === 200,
  });
  
  healthLatency.add(res.timings.duration);
  errorRate.add(!success);
  
  return res;
}

function testSingleIngest() {
  const url = `${BASE_URL}/v1/events`;
  const eventId = `baseline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const payload = JSON.stringify({
    event_type: 'baseline_test',
    event_id: eventId,
    timestamp: new Date().toISOString(),
    data: {
      vu: __VU,
      iter: __ITER,
      scenario: 'baseline',
    },
  });
  
  eventsSent.add(1);
  
  const res = http.post(url, payload, { headers: getHeaders(), tags: { endpoint: 'single' } });
  
  const success = check(res, {
    'ingest status 200 or 201': (r) => r.status === 200 || r.status === 201,
    'ingest latency ok': (r) => r.timings.duration < 125,
  });
  
  if (res.status === 200 || res.status === 201) {
    eventsAcked.add(1);
    eventsIngested.add(1);
    persistenceRate.add(true);
  } else {
    eventsFailed.add(1);
    persistenceRate.add(false);
  }
  
  ingestLatency.add(res.timings.duration);
  errorRate.add(!success);
  
  return res;
}

function testBatchIngest() {
  const url = `${BASE_URL}/v1/events/batch`;
  const batchSize = 10;
  const events = [];
  
  for (let i = 0; i < batchSize; i++) {
    events.push({
      event_type: 'baseline_batch_test',
      event_id: `batch_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      data: {
        vu: __VU,
        iter: __ITER,
        batch_index: i,
      },
    });
  }
  
  eventsSent.add(batchSize);
  
  const payload = JSON.stringify({ events });
  const res = http.post(url, payload, { headers: getHeaders(), tags: { endpoint: 'batch' } });
  
  const success = check(res, {
    'batch ingest status 200 or 201': (r) => r.status === 200 || r.status === 201,
    'batch latency ok': (r) => r.timings.duration < 200,
  });
  
  if (res.status === 200 || res.status === 201) {
    eventsAcked.add(batchSize);
    eventsIngested.add(batchSize);
    for (let i = 0; i < batchSize; i++) {
      persistenceRate.add(true);
    }
  } else {
    eventsFailed.add(batchSize);
    for (let i = 0; i < batchSize; i++) {
      persistenceRate.add(false);
    }
  }
  
  batchLatency.add(res.timings.duration);
  errorRate.add(!success);
  
  return res;
}

export default function () {
  group('A2 Baseline Test', () => {
    if (__ITER % 30 === 0) {
      testHealth();
    }
    
    testSingleIngest();
    sleep(0.3);
    
    if (__ITER % 5 === 0) {
      testBatchIngest();
      sleep(0.5);
    }
  });
  
  sleep(0.5);
}

export function handleSummary(data) {
  const sent = data.metrics.events_sent?.values.count || 0;
  const acked = data.metrics.events_acked?.values.count || 0;
  const ingested = data.metrics.events_ingested?.values.count || 0;
  const failed = data.metrics.events_failed?.values.count || 0;
  
  const summary = {
    timestamp: new Date().toISOString(),
    test_type: 'baseline',
    namespace: NAMESPACE,
    version: VERSION,
    base_url: BASE_URL,
    duration: '15m',
    vus: 20,
    metrics: {
      health_p95: data.metrics.health_latency?.values['p(95)'] || null,
      ingest_p95: data.metrics.ingest_latency?.values['p(95)'] || null,
      batch_p95: data.metrics.batch_ingest_latency?.values['p(95)'] || null,
      events_sent: sent,
      events_acked: acked,
      events_ingested: ingested,
      events_failed: failed,
      persistence_rate: sent > 0 ? (acked / sent) : 1,
      data_loss: sent - acked,
      error_rate: data.metrics.error_rate?.values.rate || 0,
      total_requests: data.metrics.http_reqs?.values.count || 0,
    },
    thresholds: data.thresholds,
    pass: Object.values(data.thresholds || {}).every(t => t.ok !== false),
    data_integrity: {
      zero_data_loss: sent === acked,
      persistence_100_pct: sent > 0 && sent === acked,
    },
  };
  
  return {
    'tests/perf/reports/a2_baseline_results.json': JSON.stringify(summary, null, 2),
    stdout: JSON.stringify(summary, null, 2),
  };
}
