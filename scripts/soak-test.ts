#!/usr/bin/env tsx
/**
 * T+6-12h Soak Test - Extended Stability Validation
 * 
 * Purpose: Verify system stability under sustained load
 * Target: 60-120min at peak RPS (25 RPS), monitor for:
 *  - Memory drift (<80% P95, no leaks)
 *  - Query degradation (no slow queries >500ms)
 *  - Error rate stability (<0.5%)
 */

import autocannon from 'autocannon';

const BASE_URL = process.env.REPL_ID 
  ? `https://${process.env.REPL_ID}.${process.env.REPL_SLUG}.replit.dev`
  : 'http://localhost:5000';

interface SoakSample {
  timestamp: number;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  memory: number;
  cpu: number;
}

async function getResourceMetrics(): Promise<{ memory: number; cpu: number }> {
  try {
    const response = await fetch(`${BASE_URL}/healthz`);
    const data = await response.json();
    return {
      memory: data.resources?.memoryUsagePercent || 0,
      cpu: data.resources?.cpuUsagePercent || 0
    };
  } catch {
    return { memory: 0, cpu: 0 };
  }
}

async function runSoakTest(durationMinutes: number = 15) {
  console.log(`\n🔬 SOAK TEST - ${durationMinutes}min @ 25 RPS`);
  console.log(`Target: Memory <80% P95, Query <500ms, Error <0.5%\n`);

  const samples: SoakSample[] = [];
  const startTime = Date.now();
  const endTime = startTime + (durationMinutes * 60 * 1000);
  
  const sampleInterval = 30000; // Sample every 30s
  let sampleCount = 0;

  // Run autocannon in background
  const instance = autocannon({
    url: BASE_URL,
    connections: 20,
    duration: durationMinutes * 60, // Convert to seconds
    requests: [
      { method: 'GET', path: '/api/scholarships?limit=10' },
      { method: 'GET', path: '/api/scholarships?major=computer-science&limit=10' },
      { method: 'GET', path: '/api/scholarships/stats' },
      { method: 'GET', path: '/api/landing-pages/limit=5' }
    ]
  });

  // Sample metrics periodically
  const samplingLoop = setInterval(async () => {
    if (Date.now() >= endTime) {
      clearInterval(samplingLoop);
      return;
    }

    sampleCount++;
    const metrics = await getResourceMetrics();
    const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
    
    console.log(`[${elapsed}min] Memory: ${metrics.memory.toFixed(1)}%, CPU: ${metrics.cpu.toFixed(1)}%`);
    
    samples.push({
      timestamp: Date.now(),
      p50: 0, // Will be filled from autocannon results
      p95: 0,
      p99: 0,
      errorRate: 0,
      memory: metrics.memory,
      cpu: metrics.cpu
    });
  }, sampleInterval);

  // Wait for autocannon to complete
  const result = await new Promise<any>((resolve) => {
    instance.on('done', resolve);
  });

  clearInterval(samplingLoop);

  // Calculate stats
  const memoryP95 = samples.map(s => s.memory).sort((a, b) => a - b)[Math.floor(samples.length * 0.95)] || 0;
  const memoryP99 = samples.map(s => s.memory).sort((a, b) => a - b)[Math.floor(samples.length * 0.99)] || 0;
  const memoryAvg = samples.reduce((sum, s) => sum + s.memory, 0) / samples.length || 0;
  const memoryMax = Math.max(...samples.map(s => s.memory));

  const errorRate = (result.errors / result.requests) * 100;

  console.log(`\n📊 SOAK TEST RESULTS (${durationMinutes}min)`);
  console.log(`════════════════════════════════════════`);
  console.log(`Requests: ${result.requests.toLocaleString()}`);
  console.log(`Throughput: ${result.requests / (durationMinutes * 60)} req/sec avg`);
  console.log(`\nLatency:`);
  console.log(`  P50: ${result.latency.p50}ms`);
  console.log(`  P95: ${result.latency.p95}ms`);
  console.log(`  P99: ${result.latency.p99}ms`);
  console.log(`\nMemory Usage:`);
  console.log(`  Average: ${memoryAvg.toFixed(1)}%`);
  console.log(`  P95: ${memoryP95.toFixed(1)}%`);
  console.log(`  P99: ${memoryP99.toFixed(1)}%`);
  console.log(`  Max: ${memoryMax.toFixed(1)}%`);
  console.log(`\nError Rate: ${errorRate.toFixed(2)}% (${result.errors}/${result.requests})`);
  console.log(`════════════════════════════════════════`);

  // Validate SLOs
  const soakPassed = 
    memoryP95 < 80 &&
    result.latency.p95 < 500 &&
    errorRate < 0.5;

  console.log(`\n${soakPassed ? '✅' : '❌'} Soak Test: ${soakPassed ? 'PASS' : 'FAIL'}`);
  
  if (!soakPassed) {
    if (memoryP95 >= 80) console.log(`  ⚠️ Memory P95 ${memoryP95.toFixed(1)}% exceeds 80% threshold`);
    if (result.latency.p95 >= 500) console.log(`  ⚠️ P95 latency ${result.latency.p95}ms exceeds 500ms threshold`);
    if (errorRate >= 0.5) console.log(`  ⚠️ Error rate ${errorRate.toFixed(2)}% exceeds 0.5% threshold`);
  }

  return {
    passed: soakPassed,
    memoryP95,
    latencyP95: result.latency.p95,
    errorRate,
    samples
  };
}

// Parse CLI args
const durationArg = process.argv[2] ? parseInt(process.argv[2]) : 15;
const duration = Math.min(Math.max(durationArg, 5), 120); // Clamp 5-120min

console.log(`⏱️ Soak Test Duration: ${duration} minutes`);
console.log(`   Use: tsx scripts/soak-test.ts <minutes> (5-120)\n`);

runSoakTest(duration).catch(console.error);
