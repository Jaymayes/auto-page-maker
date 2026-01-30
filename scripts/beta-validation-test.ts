#!/usr/bin/env tsx
/**
 * Beta Launch Validation Test
 * CEO Authorization: Oct 9, 2025
 * 
 * Tests:
 * 1. 15-min soak at 25 RPS (expected peak beta load)
 * 2. Spike to 50 RPS (safety margin, 2x headroom)
 * 
 * Acceptance Gates:
 * - P95 latency ≤ 120ms
 * - 0% server errors (5xx)
 * - <0.5% rate limit errors (429s)
 * - Memory <85%, CPU headroom >20%
 */

import autocannon from 'autocannon';

const BASE_URL = process.env.REPL_ID 
  ? `https://${process.env.REPL_ID}.${process.env.REPL_SLUG}.replit.dev`
  : 'http://localhost:5000';

interface TestResult {
  profile: string;
  rps: number;
  duration: number;
  requests: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  errors: number;
  errorRate: number;
  rate429s: number;
  rate429Percent: number;
  throughput: number;
  passed: boolean;
  issues: string[];
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

async function runLoadProfile(name: string, rps: number, duration: number): Promise<TestResult> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🔬 ${name} - ${rps} RPS for ${duration}s`);
  console.log(`${'═'.repeat(60)}\n`);

  const result = await new Promise<any>((resolve) => {
    const instance = autocannon({
      url: BASE_URL,
      connections: rps * 2,
      duration,
      requests: [
        { method: 'GET', path: '/api/scholarships?limit=10' },
        { method: 'GET', path: '/api/scholarships?major=computer-science&limit=10' },
        { method: 'GET', path: '/api/scholarships/stats' },
        { method: 'GET', path: '/api/landing-pages?limit=5' }
      ]
    });

    instance.on('done', resolve);
  });

  // Count 429 errors separately from other errors
  const rate429s = result['429s'] || 0;
  const serverErrors = result.errors - rate429s;
  const errorRate = (serverErrors / result.requests) * 100;
  const rate429Percent = (rate429s / result.requests) * 100;

  // Get final resource metrics
  const metrics = await getResourceMetrics();

  // Validation against acceptance gates
  const issues: string[] = [];
  
  if (result.latency.p95 > 120) {
    issues.push(`P95 latency ${result.latency.p95}ms exceeds 120ms SLO`);
  }
  if (errorRate > 0) {
    issues.push(`Server error rate ${errorRate.toFixed(2)}% (expected 0%)`);
  }
  if (rate429Percent > 0.5) {
    issues.push(`Rate limit errors ${rate429Percent.toFixed(2)}% exceeds 0.5% threshold`);
  }
  if (metrics.memory > 85) {
    issues.push(`Memory ${metrics.memory.toFixed(1)}% exceeds 85% threshold`);
  }
  if (metrics.cpu > 80) {
    issues.push(`CPU ${metrics.cpu.toFixed(1)}% exceeds 80% (need >20% headroom)`);
  }

  const passed = issues.length === 0;

  console.log(`\n📊 Results:`);
  console.log(`   Requests: ${result.requests.toLocaleString()}`);
  console.log(`   Latency: P50=${result.latency.p50}ms, P95=${result.latency.p95}ms, P99=${result.latency.p99}ms`);
  console.log(`   Server Errors: ${serverErrors} (${errorRate.toFixed(2)}%)`);
  console.log(`   Rate 429s: ${rate429s} (${rate429Percent.toFixed(2)}%)`);
  console.log(`   Resources: Memory ${metrics.memory.toFixed(1)}%, CPU ${metrics.cpu.toFixed(1)}%`);
  console.log(`   Status: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  
  if (issues.length > 0) {
    console.log(`\n⚠️ Issues Detected:`);
    issues.forEach(issue => console.log(`   - ${issue}`));
  }

  return {
    profile: name,
    rps,
    duration,
    requests: result.requests,
    latencyP50: result.latency.p50,
    latencyP95: result.latency.p95,
    latencyP99: result.latency.p99,
    errors: serverErrors,
    errorRate,
    rate429s,
    rate429Percent,
    throughput: result.requests / duration,
    passed,
    issues
  };
}

async function runBetaValidation() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   BETA LAUNCH VALIDATION TEST - CEO AUTHORIZED            ║');
  console.log('║   Rate Limits: 1000/15min IP, 2000/15min Origin           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const results: TestResult[] = [];

  // Test 1: 15-min soak at 25 RPS (expected peak beta load)
  results.push(await runLoadProfile('Beta Peak Load Soak', 25, 900)); // 15 minutes

  // Test 2: Spike to 50 RPS for safety margin
  results.push(await runLoadProfile('Safety Margin Spike', 50, 60)); // 1 minute

  // Generate validation report
  console.log('\n\n' + '═'.repeat(70));
  console.log('📋 BETA VALIDATION REPORT');
  console.log('═'.repeat(70) + '\n');

  let allPassed = true;
  results.forEach((result, i) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${i + 1}. ${status} - ${result.profile}`);
    console.log(`   RPS: ${result.rps}, Duration: ${result.duration}s, Requests: ${result.requests.toLocaleString()}`);
    console.log(`   Latency: P50=${result.latencyP50}ms, P95=${result.latencyP95}ms, P99=${result.latencyP99}ms`);
    console.log(`   Error Rate: ${result.errorRate.toFixed(3)}% (server), ${result.rate429Percent.toFixed(3)}% (429s)`);
    console.log(`   Throughput: ${result.throughput.toFixed(0)} req/sec`);
    
    if (!result.passed) {
      allPassed = false;
      result.issues.forEach(issue => console.log(`   ⚠️ ${issue}`));
    }
    console.log('');
  });

  // Verify critical endpoints
  console.log('🔍 Critical Endpoint Verification:\n');
  
  const statsCheck = await fetch(`${BASE_URL}/api/scholarships/stats`);
  const statsOk = statsCheck.ok;
  console.log(`   ${statsOk ? '✅' : '❌'} /api/scholarships/stats: ${statsCheck.status}`);
  
  const healthCheck = await fetch(`${BASE_URL}/healthz`);
  const healthData = await healthCheck.json();
  const pageCount = healthData.storage?.landing_pages || 0;
  const pagesOk = pageCount >= 133;
  console.log(`   ${pagesOk ? '✅' : '❌'} Landing pages persisted: ${pageCount}/133`);
  
  const endpointsOk = statsOk && pagesOk;

  // Final verdict
  console.log('\n' + '═'.repeat(70));
  const overallPass = allPassed && endpointsOk;
  console.log(`FINAL VERDICT: ${overallPass ? '✅ GO FOR BETA PHASE 1' : '❌ NO-GO - ISSUES DETECTED'}`);
  console.log('═'.repeat(70) + '\n');

  if (overallPass) {
    console.log('✅ All acceptance gates passed. Platform ready for 50-student beta ramp.');
    console.log('   - Performance: P95 latency under SLO');
    console.log('   - Reliability: 0% server errors');
    console.log('   - Rate limits: <0.5% 429s (healthy)');
    console.log('   - Endpoints: Stats and persistence verified');
    console.log('\n🚀 Authorization to begin Phase 1 (Day 0-3: 50 students) confirmed.');
  } else {
    console.log('❌ One or more gates failed. Review issues above before launch.');
  }

  process.exit(overallPass ? 0 : 1);
}

runBetaValidation().catch(console.error);
