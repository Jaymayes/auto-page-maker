import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5004';
const NAMESPACE = 'perf_test';
const VERSION = __ENV.VERSION || 'local';

const chatCompletionsLatency = new Trend('chat_completions_latency');
const healthLatency = new Trend('health_latency');
const chatRequests = new Counter('chat_requests_total');
const chatTokensGenerated = new Counter('chat_tokens_generated');
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
      vus: 15,
      duration: '15m',
      startTime: '6m',
      tags: { test_type: 'baseline' },
      exec: 'baselineTest',
    },
  },
  thresholds: {
    'http_req_duration{test_type:smoke}': ['p(95)<2000'],
    'http_req_duration{test_type:baseline}': ['p(95)<2000'],
    'chat_completions_latency': ['p(95)<2000'],
    'health_latency': ['p(95)<100'],
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

const samplePrompts = [
  'What scholarships are available for computer science students?',
  'How do I apply for financial aid?',
  'What are the eligibility requirements for STEM scholarships?',
  'Can you help me write a scholarship essay?',
  'What is the deadline for federal student aid?',
  'Are there scholarships for first-generation college students?',
  'How do merit-based scholarships work?',
  'What documents do I need for scholarship applications?',
];

function testChatCompletions() {
  const url = `${BASE_URL}/chat/completions`;
  const prompt = samplePrompts[Math.floor(Math.random() * samplePrompts.length)];
  
  const payload = JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful scholarship advisor assistant.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    max_tokens: 150,
    temperature: 0.7,
    stream: false,
  });
  
  const res = http.post(url, payload, { 
    headers: getHeaders(),
    timeout: '30s',
  });
  
  const success = check(res, {
    'chat/completions status 200': (r) => r.status === 200,
    'chat/completions latency within LLM SLO': (r) => r.timings.duration < 2000,
    'chat/completions has valid response': (r) => {
      if (r.status !== 200) return true;
      try {
        const body = JSON.parse(r.body);
        return body.choices && body.choices.length > 0;
      } catch {
        return false;
      }
    },
    'chat/completions has content': (r) => {
      if (r.status !== 200) return true;
      try {
        const body = JSON.parse(r.body);
        return body.choices?.[0]?.message?.content?.length > 0;
      } catch {
        return false;
      }
    },
  });
  
  chatCompletionsLatency.add(res.timings.duration);
  chatRequests.add(1);
  errorRate.add(res.status >= 500);
  
  if (res.status === 200) {
    try {
      const body = JSON.parse(res.body);
      if (body.usage?.completion_tokens) {
        chatTokensGenerated.add(body.usage.completion_tokens);
      }
    } catch {
    }
  }
  
  return res;
}

function testChatCompletionsWithVariedLength() {
  const url = `${BASE_URL}/chat/completions`;
  const maxTokens = [50, 100, 150, 200][Math.floor(Math.random() * 4)];
  const prompt = samplePrompts[Math.floor(Math.random() * samplePrompts.length)];
  
  const payload = JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful scholarship advisor assistant. Be concise.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    max_tokens: maxTokens,
    temperature: 0.5,
    stream: false,
  });
  
  const res = http.post(url, payload, { 
    headers: getHeaders(),
    timeout: '30s',
  });
  
  const success = check(res, {
    'varied chat/completions status 200': (r) => r.status === 200,
    'varied chat/completions latency ok': (r) => r.timings.duration < 2000,
  });
  
  chatCompletionsLatency.add(res.timings.duration);
  chatRequests.add(1);
  errorRate.add(res.status >= 500);
  
  return res;
}

export function smokeTest() {
  group('A4 Sage Smoke Test', () => {
    testHealth();
    sleep(0.5);
    testChatCompletions();
  });
  sleep(2);
}

export function baselineTest() {
  group('A4 Sage Baseline Test', () => {
    const action = Math.random();
    if (action < 0.1) {
      testHealth();
    } else if (action < 0.6) {
      testChatCompletions();
    } else {
      testChatCompletionsWithVariedLength();
    }
  });
  sleep(1);
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    namespace: NAMESPACE,
    version: VERSION,
    base_url: BASE_URL,
    app: 'a4_sage',
    llm_constraints: {
      max_concurrency: 15,
      p95_target_ms: 2000,
      error_rate_target: 0.01,
    },
    metrics: {
      chat_completions_p95: data.metrics.chat_completions_latency?.values['p(95)'] || null,
      chat_completions_p50: data.metrics.chat_completions_latency?.values['p(50)'] || null,
      chat_completions_avg: data.metrics.chat_completions_latency?.values.avg || null,
      health_p95: data.metrics.health_latency?.values['p(95)'] || null,
      error_rate: data.metrics.error_rate?.values.rate || 0,
      total_requests: data.metrics.http_reqs?.values.count || 0,
      chat_requests: data.metrics.chat_requests_total?.values.count || 0,
      tokens_generated: data.metrics.chat_tokens_generated?.values.count || 0,
    },
    thresholds: data.thresholds,
  };
  
  return {
    'tests/perf/reports/a4_results.json': JSON.stringify(summary, null, 2),
    stdout: JSON.stringify(summary, null, 2),
  };
}
