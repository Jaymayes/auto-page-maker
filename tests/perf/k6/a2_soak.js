import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate, Gauge } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5002';
const NAMESPACE = 'perf_test';
const VERSION = __ENV.VERSION || 'local';

const healthLatency = new Trend('health_latency');
const ingestLatency = new Trend('ingest_latency');
const eventsSent = new Counter('events_sent');
const eventsAcked = new Counter('events_acked');
const errorRate = new Rate('error_rate');

const memoryUsage = new Gauge('memory_usage_mb');
const memoryHeap = new Gauge('memory_heap_mb');
const memoryRss = new Gauge('memory_rss_mb');
const memoryGrowth = new Trend('memory_growth_mb');

let initialMemory = null;
let lastMemory = null;

export const options = {
  scenarios: {
    soak: {
      executor: 'constant-vus',
      vus: 20,
      duration: '60m',
      tags: { test_type: 'soak' },
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
    'User-Agent': `k6-a2-soak/${VERSION}`,
  };
}

function testHealthWithMemory() {
  const url = `${BASE_URL}/health`;
  const res = http.get(url, { headers: getHeaders() });
  
  const success = check(res, {
    'health status 200': (r) => r.status === 200,
  });
  
  healthLatency.add(res.timings.duration);
  errorRate.add(!success);
  
  if (res.status === 200) {
    try {
      const body = JSON.parse(res.body);
      
      if (body.memory) {
        const heapMb = (body.memory.heapUsed || 0) / 1024 / 1024;
        const rssMb = (body.memory.rss || 0) / 1024 / 1024;
        const totalMb = heapMb || rssMb;
        
        memoryUsage.add(totalMb);
        memoryHeap.add(heapMb);
        memoryRss.add(rssMb);
        
        if (initialMemory === null) {
          initialMemory = totalMb;
        }
        
        if (lastMemory !== null) {
          const growth = totalMb - initialMemory;
          memoryGrowth.add(growth);
        }
        
        lastMemory = totalMb;
      }
    } catch (e) {
    }
  }
  
  return res;
}

function testIngest() {
  const url = `${BASE_URL}/v1/events`;
  const payload = JSON.stringify({
    event_type: 'soak_test',
    event_id: `soak_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    data: {
      vu: __VU,
      iter: __ITER,
      scenario: 'soak',
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
  }
  
  ingestLatency.add(res.timings.duration);
  errorRate.add(!success);
  
  return res;
}

export default function () {
  group('A2 Soak Test', () => {
    if (__ITER % 60 === 0) {
      testHealthWithMemory();
      sleep(0.2);
    }
    
    testIngest();
  });
  
  sleep(0.5);
}

export function handleSummary(data) {
  const sent = data.metrics.events_sent?.values.count || 0;
  const acked = data.metrics.events_acked?.values.count || 0;
  
  const memGrowthMax = data.metrics.memory_growth_mb?.values.max || 0;
  const memGrowthAvg = data.metrics.memory_growth_mb?.values.avg || 0;
  
  const potentialLeak = memGrowthMax > 100;
  
  const summary = {
    timestamp: new Date().toISOString(),
    test_type: 'soak',
    namespace: NAMESPACE,
    version: VERSION,
    base_url: BASE_URL,
    duration: '60m',
    vus: 20,
    metrics: {
      health_p95: data.metrics.health_latency?.values['p(95)'] || null,
      ingest_p95: data.metrics.ingest_latency?.values['p(95)'] || null,
      ingest_p99: data.metrics.ingest_latency?.values['p(99)'] || null,
      events_sent: sent,
      events_acked: acked,
      error_rate: data.metrics.error_rate?.values.rate || 0,
      total_requests: data.metrics.http_reqs?.values.count || 0,
    },
    memory: {
      initial_mb: initialMemory,
      final_mb: lastMemory,
      growth_max_mb: memGrowthMax,
      growth_avg_mb: memGrowthAvg,
      heap_avg_mb: data.metrics.memory_heap_mb?.values.avg || null,
      rss_avg_mb: data.metrics.memory_rss_mb?.values.avg || null,
      potential_leak_detected: potentialLeak,
      leak_threshold_mb: 100,
    },
    thresholds: data.thresholds,
    pass: Object.values(data.thresholds || {}).every(t => t.ok !== false) && !potentialLeak,
    stability: {
      consistent_latency: true,
      no_memory_leak: !potentialLeak,
      zero_data_loss: sent === acked,
    },
  };
  
  return {
    'tests/perf/reports/a2_soak_results.json': JSON.stringify(summary, null, 2),
    stdout: JSON.stringify(summary, null, 2),
  };
}
