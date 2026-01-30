import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5002';
const NAMESPACE = 'perf_test';
const VERSION = __ENV.VERSION || 'local';

const healthLatency = new Trend('health_latency');
const ingestLatency = new Trend('ingest_latency');
const burstLatency = new Trend('burst_latency');
const eventsSent = new Counter('events_sent');
const eventsAcked = new Counter('events_acked');
const eventsFailed = new Counter('events_failed');
const errorRate = new Rate('error_rate');
const dataLossRate = new Rate('data_loss_rate');

export const options = {
  scenarios: {
    burst: {
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 50,
      maxVUs: 200,
      tags: { test_type: 'burst' },
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<125'],
    'ingest_latency': ['p(95)<125'],
    'burst_latency': ['p(95)<125'],
    'error_rate': ['rate<0.01'],
    'data_loss_rate': ['rate<0.001'],
  },
};

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Namespace': NAMESPACE,
    'X-Test-Version': VERSION,
    'User-Agent': `k6-a2-burst/${VERSION}`,
  };
}

function testIngest() {
  const url = `${BASE_URL}/v1/events`;
  const eventId = `burst_${Date.now()}_${__VU}_${__ITER}_${Math.random().toString(36).substr(2, 9)}`;
  const payload = JSON.stringify({
    event_type: 'burst_test',
    event_id: eventId,
    timestamp: new Date().toISOString(),
    data: {
      vu: __VU,
      iter: __ITER,
      scenario: 'burst',
      high_throughput: true,
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
    dataLossRate.add(false);
  } else {
    eventsFailed.add(1);
    dataLossRate.add(true);
  }
  
  ingestLatency.add(res.timings.duration);
  burstLatency.add(res.timings.duration);
  errorRate.add(!success);
  
  return res;
}

function testBatchIngest() {
  const url = `${BASE_URL}/v1/events/batch`;
  const batchSize = 5;
  const events = [];
  
  for (let i = 0; i < batchSize; i++) {
    events.push({
      event_type: 'burst_batch_test',
      event_id: `burst_batch_${Date.now()}_${__VU}_${i}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      data: {
        vu: __VU,
        iter: __ITER,
        batch_index: i,
        scenario: 'burst',
      },
    });
  }
  
  eventsSent.add(batchSize);
  
  const payload = JSON.stringify({ events });
  const res = http.post(url, payload, { headers: getHeaders() });
  
  const success = check(res, {
    'batch ingest status 200 or 201': (r) => r.status === 200 || r.status === 201,
    'batch latency ok': (r) => r.timings.duration < 200,
  });
  
  if (res.status === 200 || res.status === 201) {
    eventsAcked.add(batchSize);
    for (let i = 0; i < batchSize; i++) {
      dataLossRate.add(false);
    }
  } else {
    eventsFailed.add(batchSize);
    for (let i = 0; i < batchSize; i++) {
      dataLossRate.add(true);
    }
  }
  
  burstLatency.add(res.timings.duration);
  errorRate.add(!success);
  
  return res;
}

export default function () {
  group('A2 Burst Test', () => {
    if (__ITER % 10 === 0) {
      testBatchIngest();
    } else {
      testIngest();
    }
  });
}

export function handleSummary(data) {
  const sent = data.metrics.events_sent?.values.count || 0;
  const acked = data.metrics.events_acked?.values.count || 0;
  const failed = data.metrics.events_failed?.values.count || 0;
  
  const dataLoss = sent - acked;
  const dataLossPct = sent > 0 ? ((dataLoss / sent) * 100).toFixed(4) : 0;
  
  const summary = {
    timestamp: new Date().toISOString(),
    test_type: 'burst',
    namespace: NAMESPACE,
    version: VERSION,
    base_url: BASE_URL,
    duration: '2m',
    target_rps: 100,
    metrics: {
      ingest_p95: data.metrics.ingest_latency?.values['p(95)'] || null,
      burst_p95: data.metrics.burst_latency?.values['p(95)'] || null,
      burst_p99: data.metrics.burst_latency?.values['p(99)'] || null,
      burst_max: data.metrics.burst_latency?.values.max || null,
      burst_avg: data.metrics.burst_latency?.values.avg || null,
      events_sent: sent,
      events_acked: acked,
      events_failed: failed,
      error_rate: data.metrics.error_rate?.values.rate || 0,
      data_loss_rate: data.metrics.data_loss_rate?.values.rate || 0,
      total_requests: data.metrics.http_reqs?.values.count || 0,
      actual_rps: data.metrics.http_reqs?.values.rate || 0,
    },
    data_integrity: {
      events_sent: sent,
      events_acked: acked,
      data_loss: dataLoss,
      data_loss_pct: dataLossPct,
      zero_data_loss: dataLoss === 0,
    },
    thresholds: data.thresholds,
    pass: Object.values(data.thresholds || {}).every(t => t.ok !== false) && dataLoss === 0,
    burst_resilience: {
      sustained_100rps: (data.metrics.http_reqs?.values.rate || 0) >= 90,
      p95_within_slo: (data.metrics.burst_latency?.values['p(95)'] || 0) <= 125,
      zero_data_loss: dataLoss === 0,
    },
  };
  
  return {
    'tests/perf/reports/a2_burst_results.json': JSON.stringify(summary, null, 2),
    stdout: JSON.stringify(summary, null, 2),
  };
}
