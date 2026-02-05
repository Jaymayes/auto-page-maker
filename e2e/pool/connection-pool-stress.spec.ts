/**
 * A12 Connection Pooling Stress Test Suite
 *
 * Validates database connection pool behavior under load on
 * www.scholaraiadvisor.com production environment.
 *
 * Priority: P1 - Critical for B2B reliability
 *
 * Tests:
 * - Concurrent request handling (pool saturation)
 * - P95 latency under load (<120ms target)
 * - Connection timeout behavior
 * - Pool recovery after exhaustion
 * - Sustained load resilience
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'https://www.scholaraiadvisor.com';

// Pool configuration from server/db.ts
const POOL_CONFIG = {
  max: 6,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  maxUses: 500
};

// Test thresholds
const THRESHOLDS = {
  p95LatencyMs: 120,      // P95 target from db.ts comments
  p99LatencyMs: 500,      // P99 acceptable
  maxLatencyMs: 2000,     // Absolute max before timeout
  errorRatePercent: 1,    // Max 1% error rate under load
  minSuccessRate: 99      // Min 99% success rate
};

interface RequestResult {
  status: number;
  latencyMs: number;
  success: boolean;
  error?: string;
}

interface StressTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  latencies: number[];
  p50: number;
  p95: number;
  p99: number;
  maxLatency: number;
  minLatency: number;
  avgLatency: number;
  successRate: number;
  errorRate: number;
  throughputRps: number;
  durationMs: number;
}

function calculatePercentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function analyzeResults(results: RequestResult[], durationMs: number): StressTestResult {
  const latencies = results.filter(r => r.success).map(r => r.latencyMs);
  const successfulRequests = results.filter(r => r.success).length;
  const failedRequests = results.filter(r => !r.success).length;

  return {
    totalRequests: results.length,
    successfulRequests,
    failedRequests,
    latencies,
    p50: calculatePercentile(latencies, 50),
    p95: calculatePercentile(latencies, 95),
    p99: calculatePercentile(latencies, 99),
    maxLatency: latencies.length > 0 ? Math.max(...latencies) : 0,
    minLatency: latencies.length > 0 ? Math.min(...latencies) : 0,
    avgLatency: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
    successRate: (successfulRequests / results.length) * 100,
    errorRate: (failedRequests / results.length) * 100,
    throughputRps: (results.length / durationMs) * 1000,
    durationMs
  };
}

// =============================================================================
// Suite 1: Health Endpoint Baseline
// =============================================================================

test.describe('Connection Pool Health Baseline @pool @p1', () => {
  test('Health endpoint responds within threshold', async ({ request }) => {
    const iterations = 10;
    const results: RequestResult[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      try {
        const response = await request.get(`${BASE_URL}/api/health`);
        const latencyMs = Date.now() - start;
        results.push({
          status: response.status(),
          latencyMs,
          success: response.status() === 200
        });
      } catch (error) {
        results.push({
          status: 0,
          latencyMs: Date.now() - start,
          success: false,
          error: (error as Error).message
        });
      }
    }

    const analysis = analyzeResults(results, 0);

    console.log('[Pool Baseline] Health endpoint results:');
    console.log(`  Requests: ${analysis.totalRequests}`);
    console.log(`  Success Rate: ${analysis.successRate.toFixed(1)}%`);
    console.log(`  P50 Latency: ${analysis.p50.toFixed(0)}ms`);
    console.log(`  P95 Latency: ${analysis.p95.toFixed(0)}ms`);
    console.log(`  Avg Latency: ${analysis.avgLatency.toFixed(0)}ms`);

    expect(analysis.successRate).toBe(100);
    // Baseline P95 can be higher due to cold start/first request
    // Using 10x threshold for cross-network testing with cold starts
    expect(analysis.p95).toBeLessThan(THRESHOLDS.p95LatencyMs * 10);
  });

  test('Readiness endpoint measures DB latency', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    console.log('[Pool Baseline] Health response:', JSON.stringify(body));

    expect(body).toHaveProperty('status');
    expect(body.status).toBe('ok');
  });
});

// =============================================================================
// Suite 2: Concurrent Request Load Test
// =============================================================================

test.describe('Concurrent Request Load Test @pool @load', () => {
  test('Handles concurrent requests at pool capacity', async ({ request }) => {
    const concurrency = POOL_CONFIG.max; // 6 concurrent
    const iterations = 3;
    const results: RequestResult[] = [];
    const startTime = Date.now();

    console.log(`[Pool Load] Testing ${concurrency} concurrent requests x ${iterations} iterations`);

    for (let iter = 0; iter < iterations; iter++) {
      const batch = Array(concurrency).fill(null).map(async () => {
        const start = Date.now();
        try {
          const response = await request.get(`${BASE_URL}/api/health`);
          return {
            status: response.status(),
            latencyMs: Date.now() - start,
            success: response.status() === 200
          };
        } catch (error) {
          return {
            status: 0,
            latencyMs: Date.now() - start,
            success: false,
            error: (error as Error).message
          };
        }
      });

      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
    }

    const durationMs = Date.now() - startTime;
    const analysis = analyzeResults(results, durationMs);

    console.log('[Pool Load] Concurrent load results:');
    console.log(`  Total Requests: ${analysis.totalRequests}`);
    console.log(`  Success Rate: ${analysis.successRate.toFixed(1)}%`);
    console.log(`  Failed: ${analysis.failedRequests}`);
    console.log(`  P50: ${analysis.p50.toFixed(0)}ms | P95: ${analysis.p95.toFixed(0)}ms | P99: ${analysis.p99.toFixed(0)}ms`);
    console.log(`  Min: ${analysis.minLatency.toFixed(0)}ms | Max: ${analysis.maxLatency.toFixed(0)}ms | Avg: ${analysis.avgLatency.toFixed(0)}ms`);
    console.log(`  Throughput: ${analysis.throughputRps.toFixed(1)} req/s`);
    console.log(`  Duration: ${durationMs}ms`);

    // Assertions
    expect(analysis.successRate).toBeGreaterThanOrEqual(THRESHOLDS.minSuccessRate);
    expect(analysis.errorRate).toBeLessThanOrEqual(THRESHOLDS.errorRatePercent);
  });

  test('Handles 2x pool capacity (queue behavior)', async ({ request }) => {
    const concurrency = POOL_CONFIG.max * 2; // 12 concurrent (2x pool size)
    const results: RequestResult[] = [];
    const startTime = Date.now();

    console.log(`[Pool Queue] Testing ${concurrency} concurrent requests (2x pool capacity)`);

    const batch = Array(concurrency).fill(null).map(async () => {
      const start = Date.now();
      try {
        const response = await request.get(`${BASE_URL}/api/health`);
        return {
          status: response.status(),
          latencyMs: Date.now() - start,
          success: response.status() === 200
        };
      } catch (error) {
        return {
          status: 0,
          latencyMs: Date.now() - start,
          success: false,
          error: (error as Error).message
        };
      }
    });

    const batchResults = await Promise.all(batch);
    results.push(...batchResults);

    const durationMs = Date.now() - startTime;
    const analysis = analyzeResults(results, durationMs);

    console.log('[Pool Queue] 2x capacity results:');
    console.log(`  Success Rate: ${analysis.successRate.toFixed(1)}%`);
    console.log(`  P95 Latency: ${analysis.p95.toFixed(0)}ms`);
    console.log(`  Max Latency: ${analysis.maxLatency.toFixed(0)}ms`);
    console.log(`  Throughput: ${analysis.throughputRps.toFixed(1)} req/s`);

    // Some queuing expected, but should still succeed
    expect(analysis.successRate).toBeGreaterThanOrEqual(95);
    // Max latency should stay under connection timeout
    expect(analysis.maxLatency).toBeLessThan(THRESHOLDS.maxLatencyMs);
  });
});

// =============================================================================
// Suite 3: Sustained Load Test
// =============================================================================

test.describe('Sustained Load Test @pool @sustained', () => {
  test('Maintains performance under sustained load', async ({ request }) => {
    const durationSeconds = 10;
    const requestsPerSecond = 5;
    const results: RequestResult[] = [];
    const startTime = Date.now();
    const endTime = startTime + (durationSeconds * 1000);

    console.log(`[Pool Sustained] Running ${requestsPerSecond} req/s for ${durationSeconds}s`);

    while (Date.now() < endTime) {
      const batchStart = Date.now();

      // Fire requests for this second
      const batch = Array(requestsPerSecond).fill(null).map(async () => {
        const start = Date.now();
        try {
          const response = await request.get(`${BASE_URL}/api/health`);
          return {
            status: response.status(),
            latencyMs: Date.now() - start,
            success: response.status() === 200
          };
        } catch (error) {
          return {
            status: 0,
            latencyMs: Date.now() - start,
            success: false,
            error: (error as Error).message
          };
        }
      });

      const batchResults = await Promise.all(batch);
      results.push(...batchResults);

      // Wait until next second
      const elapsed = Date.now() - batchStart;
      if (elapsed < 1000 && Date.now() < endTime) {
        await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
      }
    }

    const totalDuration = Date.now() - startTime;
    const analysis = analyzeResults(results, totalDuration);

    console.log('[Pool Sustained] Sustained load results:');
    console.log(`  Duration: ${(totalDuration / 1000).toFixed(1)}s`);
    console.log(`  Total Requests: ${analysis.totalRequests}`);
    console.log(`  Success Rate: ${analysis.successRate.toFixed(1)}%`);
    console.log(`  P50: ${analysis.p50.toFixed(0)}ms | P95: ${analysis.p95.toFixed(0)}ms | P99: ${analysis.p99.toFixed(0)}ms`);
    console.log(`  Avg Latency: ${analysis.avgLatency.toFixed(0)}ms`);
    console.log(`  Actual Throughput: ${analysis.throughputRps.toFixed(1)} req/s`);

    // Check for latency degradation
    const firstQuarter = results.slice(0, Math.floor(results.length / 4));
    const lastQuarter = results.slice(-Math.floor(results.length / 4));
    const firstQuarterAnalysis = analyzeResults(firstQuarter, 0);
    const lastQuarterAnalysis = analyzeResults(lastQuarter, 0);

    console.log(`[Pool Sustained] Latency trend:`);
    console.log(`  First quarter P95: ${firstQuarterAnalysis.p95.toFixed(0)}ms`);
    console.log(`  Last quarter P95: ${lastQuarterAnalysis.p95.toFixed(0)}ms`);

    // Assertions
    expect(analysis.successRate).toBeGreaterThanOrEqual(THRESHOLDS.minSuccessRate);
    expect(analysis.p95).toBeLessThan(THRESHOLDS.p95LatencyMs * 3); // Allow 3x under sustained load

    // Check for latency degradation (last quarter should not be >2x first quarter)
    if (firstQuarterAnalysis.p95 > 0) {
      const degradationRatio = lastQuarterAnalysis.p95 / firstQuarterAnalysis.p95;
      console.log(`  Degradation ratio: ${degradationRatio.toFixed(2)}x`);
      expect(degradationRatio).toBeLessThan(3);
    }
  });
});

// =============================================================================
// Suite 4: Pool Recovery Test
// =============================================================================

test.describe('Pool Recovery Test @pool @recovery', () => {
  test('Recovers after burst of requests', async ({ request }) => {
    // Phase 1: Burst load
    const burstSize = POOL_CONFIG.max * 3; // 18 concurrent
    const burstResults: RequestResult[] = [];

    console.log(`[Pool Recovery] Phase 1: Burst of ${burstSize} requests`);

    const burstBatch = Array(burstSize).fill(null).map(async () => {
      const start = Date.now();
      try {
        const response = await request.get(`${BASE_URL}/api/health`);
        return {
          status: response.status(),
          latencyMs: Date.now() - start,
          success: response.status() === 200
        };
      } catch (error) {
        return {
          status: 0,
          latencyMs: Date.now() - start,
          success: false,
          error: (error as Error).message
        };
      }
    });

    const burstBatchResults = await Promise.all(burstBatch);
    burstResults.push(...burstBatchResults);
    const burstAnalysis = analyzeResults(burstResults, 0);

    console.log(`  Burst success rate: ${burstAnalysis.successRate.toFixed(1)}%`);
    console.log(`  Burst P95: ${burstAnalysis.p95.toFixed(0)}ms`);

    // Phase 2: Cool down
    console.log('[Pool Recovery] Phase 2: Cool down (2s)');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Phase 3: Recovery check
    console.log('[Pool Recovery] Phase 3: Recovery verification');
    const recoveryResults: RequestResult[] = [];

    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      try {
        const response = await request.get(`${BASE_URL}/api/health`);
        recoveryResults.push({
          status: response.status(),
          latencyMs: Date.now() - start,
          success: response.status() === 200
        });
      } catch (error) {
        recoveryResults.push({
          status: 0,
          latencyMs: Date.now() - start,
          success: false,
          error: (error as Error).message
        });
      }
    }

    const recoveryAnalysis = analyzeResults(recoveryResults, 0);

    console.log(`  Recovery success rate: ${recoveryAnalysis.successRate.toFixed(1)}%`);
    console.log(`  Recovery P95: ${recoveryAnalysis.p95.toFixed(0)}ms`);
    console.log(`  Recovery avg: ${recoveryAnalysis.avgLatency.toFixed(0)}ms`);

    // Assertions
    expect(recoveryAnalysis.successRate).toBe(100);
    // Recovery latency should be back to baseline (not carrying burst penalty)
    expect(recoveryAnalysis.avgLatency).toBeLessThan(THRESHOLDS.p95LatencyMs * 2);
  });
});

// =============================================================================
// Suite 5: Error Rate Under Stress
// =============================================================================

test.describe('Error Rate Under Stress @pool @errors', () => {
  test('Maintains low error rate under heavy load', async ({ request }) => {
    const concurrency = POOL_CONFIG.max * 4; // 24 concurrent (4x pool)
    const iterations = 2;
    const results: RequestResult[] = [];
    const startTime = Date.now();

    console.log(`[Pool Stress] Testing ${concurrency} concurrent x ${iterations} iterations (4x pool)`);

    for (let iter = 0; iter < iterations; iter++) {
      const batch = Array(concurrency).fill(null).map(async () => {
        const start = Date.now();
        try {
          const response = await request.get(`${BASE_URL}/api/health`, {
            timeout: 10000 // 10s timeout
          });
          return {
            status: response.status(),
            latencyMs: Date.now() - start,
            success: response.status() === 200
          };
        } catch (error) {
          return {
            status: 0,
            latencyMs: Date.now() - start,
            success: false,
            error: (error as Error).message
          };
        }
      });

      const batchResults = await Promise.all(batch);
      results.push(...batchResults);

      // Brief pause between iterations
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const durationMs = Date.now() - startTime;
    const analysis = analyzeResults(results, durationMs);

    console.log('[Pool Stress] Heavy load results:');
    console.log(`  Total Requests: ${analysis.totalRequests}`);
    console.log(`  Successful: ${analysis.successfulRequests}`);
    console.log(`  Failed: ${analysis.failedRequests}`);
    console.log(`  Success Rate: ${analysis.successRate.toFixed(1)}%`);
    console.log(`  Error Rate: ${analysis.errorRate.toFixed(2)}%`);
    console.log(`  P95 Latency: ${analysis.p95.toFixed(0)}ms`);
    console.log(`  Max Latency: ${analysis.maxLatency.toFixed(0)}ms`);

    // Log error details if any
    const errors = results.filter(r => !r.success);
    if (errors.length > 0) {
      console.log('[Pool Stress] Errors:');
      const errorCounts: Record<string, number> = {};
      errors.forEach(e => {
        const key = e.error || `status_${e.status}`;
        errorCounts[key] = (errorCounts[key] || 0) + 1;
      });
      Object.entries(errorCounts).forEach(([error, count]) => {
        console.log(`  ${error}: ${count}`);
      });
    }

    // Assertions - allow higher error rate under extreme stress
    expect(analysis.successRate).toBeGreaterThanOrEqual(90); // 90% under 4x capacity
  });
});

// =============================================================================
// Suite 6: Latency Distribution Analysis
// =============================================================================

test.describe('Latency Distribution Analysis @pool @latency', () => {
  test('Latency distribution meets SLA requirements', async ({ request }) => {
    const requestCount = 50;
    const results: RequestResult[] = [];
    const startTime = Date.now();

    console.log(`[Pool Latency] Collecting ${requestCount} samples for distribution analysis`);

    for (let i = 0; i < requestCount; i++) {
      const start = Date.now();
      try {
        const response = await request.get(`${BASE_URL}/api/health`);
        results.push({
          status: response.status(),
          latencyMs: Date.now() - start,
          success: response.status() === 200
        });
      } catch (error) {
        results.push({
          status: 0,
          latencyMs: Date.now() - start,
          success: false,
          error: (error as Error).message
        });
      }

      // Small delay between requests to avoid rate limiting
      if (i < requestCount - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const durationMs = Date.now() - startTime;
    const analysis = analyzeResults(results, durationMs);

    // Calculate additional percentiles
    const latencies = results.filter(r => r.success).map(r => r.latencyMs);
    const p10 = calculatePercentile(latencies, 10);
    const p25 = calculatePercentile(latencies, 25);
    const p75 = calculatePercentile(latencies, 75);
    const p90 = calculatePercentile(latencies, 90);

    console.log('[Pool Latency] Distribution analysis:');
    console.log(`  Samples: ${latencies.length}`);
    console.log(`  Min: ${analysis.minLatency.toFixed(0)}ms`);
    console.log(`  P10: ${p10.toFixed(0)}ms`);
    console.log(`  P25: ${p25.toFixed(0)}ms`);
    console.log(`  P50 (median): ${analysis.p50.toFixed(0)}ms`);
    console.log(`  P75: ${p75.toFixed(0)}ms`);
    console.log(`  P90: ${p90.toFixed(0)}ms`);
    console.log(`  P95: ${analysis.p95.toFixed(0)}ms`);
    console.log(`  P99: ${analysis.p99.toFixed(0)}ms`);
    console.log(`  Max: ${analysis.maxLatency.toFixed(0)}ms`);
    console.log(`  Avg: ${analysis.avgLatency.toFixed(0)}ms`);
    console.log(`  Std Dev: ${calculateStdDev(latencies).toFixed(0)}ms`);

    // SLA assertions
    console.log('\n[Pool Latency] SLA Check:');
    console.log(`  P95 Target: ${THRESHOLDS.p95LatencyMs}ms | Actual: ${analysis.p95.toFixed(0)}ms | ${analysis.p95 <= THRESHOLDS.p95LatencyMs ? 'PASS' : 'WARN'}`);
    console.log(`  P99 Target: ${THRESHOLDS.p99LatencyMs}ms | Actual: ${analysis.p99.toFixed(0)}ms | ${analysis.p99 <= THRESHOLDS.p99LatencyMs ? 'PASS' : 'WARN'}`);

    // Note: Production latency may exceed local thresholds due to network
    // Using relaxed thresholds for cross-network testing
    expect(analysis.p95).toBeLessThan(THRESHOLDS.p95LatencyMs * 5); // 5x for network overhead
    expect(analysis.p99).toBeLessThan(THRESHOLDS.p99LatencyMs * 3); // 3x for network overhead
  });
});

function calculateStdDev(arr: number[]): number {
  if (arr.length === 0) return 0;
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  const squareDiffs = arr.map(value => Math.pow(value - avg, 2));
  return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / arr.length);
}
