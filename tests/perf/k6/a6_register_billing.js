import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5006';
const NAMESPACE = 'perf_test';
const VERSION = __ENV.VERSION || 'local';

const registerLatency = new Trend('register_latency');
const billingLatency = new Trend('billing_latency');
const healthLatency = new Trend('health_latency');
const registerRequests = new Counter('register_requests_total');
const billingRequests = new Counter('billing_requests_total');
const billingValidationPassed = new Counter('billing_validation_passed');
const billingValidationFailed = new Counter('billing_validation_failed');
const errorRate = new Rate('error_rate');

const EXPECTED_PROVIDER_FEE_PCT = 3;
const EXPECTED_AI_MARKUP = 4;
const EXPECTED_FEE_AMOUNT = 30;
const EXPECTED_AI_MARKUP_AMOUNT = 40;

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
      vus: 10,
      duration: '15m',
      startTime: '6m',
      tags: { test_type: 'baseline' },
      exec: 'baselineTest',
    },
    ramp: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '5m', target: 10 },
        { duration: '5m', target: 20 },
        { duration: '5m', target: 40 },
        { duration: '5m', target: 5 },
      ],
      startTime: '22m',
      tags: { test_type: 'ramp' },
      exec: 'rampTest',
    },
    spike: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '10s', target: 80 },
        { duration: '2m', target: 80 },
        { duration: '30s', target: 5 },
      ],
      startTime: '43m',
      tags: { test_type: 'spike' },
      exec: 'spikeTest',
    },
    soak: {
      executor: 'constant-vus',
      vus: 10,
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
    'register_latency': ['p(95)<150'],
    'billing_latency': ['p(95)<150'],
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

function testRegister() {
  const url = `${BASE_URL}/register`;
  const uniqueId = uuidv4().substring(0, 8);
  
  const payload = JSON.stringify({
    provider_name: `Test Provider ${uniqueId}`,
    email: `provider_${uniqueId}@test.example.com`,
    organization: `Test Org ${uniqueId}`,
    contact_name: `Test Contact ${uniqueId}`,
    phone: '+1-555-0100',
    address: {
      street: '123 Test Street',
      city: 'Test City',
      state: 'CA',
      zip: '90210',
    },
    provider_type: 'scholarship_provider',
    test_mode: true,
  });
  
  const res = http.post(url, payload, { headers: getHeaders() });
  
  const success = check(res, {
    'register status 200 or 201': (r) => r.status === 200 || r.status === 201,
    'register latency ok': (r) => r.timings.duration < 150,
    'register has valid response': (r) => {
      if (r.status >= 400) return true;
      try {
        const body = JSON.parse(r.body);
        return body.id || body.provider_id;
      } catch {
        return false;
      }
    },
  });
  
  registerLatency.add(res.timings.duration);
  registerRequests.add(1);
  errorRate.add(res.status >= 500);
  
  return res;
}

function testBilling() {
  const url = `${BASE_URL}/api/billing`;
  const res = http.get(url, { headers: getHeaders() });
  
  let billingValid = false;
  
  const success = check(res, {
    'billing status 200': (r) => r.status === 200,
    'billing latency ok': (r) => r.timings.duration < 150,
    'billing has valid structure': (r) => {
      if (r.status !== 200) return true;
      try {
        const body = JSON.parse(r.body);
        return body !== null;
      } catch {
        return false;
      }
    },
    'billing provider fee is 3%': (r) => {
      if (r.status !== 200) return true;
      try {
        const body = JSON.parse(r.body);
        const feeValid = body.provider_fee_pct === EXPECTED_PROVIDER_FEE_PCT ||
                        body.provider_fee_percent === EXPECTED_PROVIDER_FEE_PCT ||
                        body.fee_percentage === EXPECTED_PROVIDER_FEE_PCT;
        return feeValid;
      } catch {
        return false;
      }
    },
    'billing AI markup is 4x': (r) => {
      if (r.status !== 200) return true;
      try {
        const body = JSON.parse(r.body);
        const markupValid = body.ai_markup === EXPECTED_AI_MARKUP ||
                          body.ai_markup_multiplier === EXPECTED_AI_MARKUP;
        return markupValid;
      } catch {
        return false;
      }
    },
    'billing expected fee is $30': (r) => {
      if (r.status !== 200) return true;
      try {
        const body = JSON.parse(r.body);
        const feeAmountValid = body.expected_fee === EXPECTED_FEE_AMOUNT ||
                              body.fee_amount === EXPECTED_FEE_AMOUNT ||
                              body.sample_fee === EXPECTED_FEE_AMOUNT;
        return feeAmountValid;
      } catch {
        return false;
      }
    },
    'billing expected AI markup is $40': (r) => {
      if (r.status !== 200) return true;
      try {
        const body = JSON.parse(r.body);
        const markupAmountValid = body.expected_ai_markup === EXPECTED_AI_MARKUP_AMOUNT ||
                                 body.ai_markup_amount === EXPECTED_AI_MARKUP_AMOUNT ||
                                 body.sample_ai_cost === EXPECTED_AI_MARKUP_AMOUNT;
        return markupAmountValid;
      } catch {
        return false;
      }
    },
  });
  
  if (res.status === 200) {
    try {
      const body = JSON.parse(res.body);
      const feeValid = (body.provider_fee_pct === EXPECTED_PROVIDER_FEE_PCT ||
                       body.provider_fee_percent === EXPECTED_PROVIDER_FEE_PCT ||
                       body.fee_percentage === EXPECTED_PROVIDER_FEE_PCT);
      const markupValid = (body.ai_markup === EXPECTED_AI_MARKUP ||
                          body.ai_markup_multiplier === EXPECTED_AI_MARKUP);
      const feeAmountValid = (body.expected_fee === EXPECTED_FEE_AMOUNT ||
                             body.fee_amount === EXPECTED_FEE_AMOUNT ||
                             body.sample_fee === EXPECTED_FEE_AMOUNT);
      const markupAmountValid = (body.expected_ai_markup === EXPECTED_AI_MARKUP_AMOUNT ||
                                body.ai_markup_amount === EXPECTED_AI_MARKUP_AMOUNT ||
                                body.sample_ai_cost === EXPECTED_AI_MARKUP_AMOUNT);
      
      billingValid = feeValid && markupValid && feeAmountValid && markupAmountValid;
      
      if (billingValid) {
        billingValidationPassed.add(1);
      } else {
        billingValidationFailed.add(1);
      }
    } catch {
      billingValidationFailed.add(1);
    }
  }
  
  billingLatency.add(res.timings.duration);
  billingRequests.add(1);
  errorRate.add(!success);
  
  return res;
}

function testFullProviderFlow() {
  const registerRes = testRegister();
  sleep(0.2);
  
  if (registerRes.status === 200 || registerRes.status === 201) {
    testBilling();
  }
}

export function smokeTest() {
  group('A6 Provider Smoke Test', () => {
    testHealth();
    sleep(0.5);
    testRegister();
    sleep(0.5);
    testBilling();
  });
  sleep(1);
}

export function baselineTest() {
  group('A6 Provider Baseline Test', () => {
    const action = Math.random();
    if (action < 0.1) {
      testHealth();
    } else if (action < 0.4) {
      testRegister();
    } else if (action < 0.7) {
      testBilling();
    } else {
      testFullProviderFlow();
    }
  });
  sleep(0.5);
}

export function rampTest() {
  group('A6 Provider Ramp Test', () => {
    const action = Math.random();
    if (action < 0.4) {
      testRegister();
    } else if (action < 0.8) {
      testBilling();
    } else {
      testFullProviderFlow();
    }
  });
  sleep(0.3);
}

export function spikeTest() {
  group('A6 Provider Spike Test', () => {
    testRegister();
    testBilling();
  });
  sleep(0.1);
}

export function soakTest() {
  group('A6 Provider Soak Test', () => {
    testHealth();
    sleep(0.2);
    testFullProviderFlow();
    sleep(0.2);
    testBilling();
  });
  sleep(1);
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    namespace: NAMESPACE,
    version: VERSION,
    base_url: BASE_URL,
    app: 'a6_provider',
    billing_validation: {
      expected_provider_fee_pct: EXPECTED_PROVIDER_FEE_PCT,
      expected_ai_markup: EXPECTED_AI_MARKUP,
      expected_fee_amount: EXPECTED_FEE_AMOUNT,
      expected_ai_markup_amount: EXPECTED_AI_MARKUP_AMOUNT,
      validations_passed: data.metrics.billing_validation_passed?.values.count || 0,
      validations_failed: data.metrics.billing_validation_failed?.values.count || 0,
    },
    metrics: {
      register_p95: data.metrics.register_latency?.values['p(95)'] || null,
      billing_p95: data.metrics.billing_latency?.values['p(95)'] || null,
      health_p95: data.metrics.health_latency?.values['p(95)'] || null,
      error_rate: data.metrics.error_rate?.values.rate || 0,
      total_requests: data.metrics.http_reqs?.values.count || 0,
      register_requests: data.metrics.register_requests_total?.values.count || 0,
      billing_requests: data.metrics.billing_requests_total?.values.count || 0,
    },
    thresholds: data.thresholds,
  };
  
  return {
    'tests/perf/reports/a6_results.json': JSON.stringify(summary, null, 2),
    stdout: JSON.stringify(summary, null, 2),
  };
}
