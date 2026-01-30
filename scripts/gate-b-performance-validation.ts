// Using native fetch instead of axios (no extra dependencies)

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

interface LatencyStats {
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
}

function calculateStats(latencies: number[]): LatencyStats {
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: sum / sorted.length,
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)]
  };
}

async function testReadOperations() {
  console.log('\n=== TEST 1: READ OPERATIONS (Provider Dashboard/Listings) ===');
  console.log('Target: P95 ≤120ms (hard SLO)\n');

  const latencies: number[] = [];
  const errors: string[] = [];
  const testCount = 200; // Realistic load, avoids rate limiting
  
  const endpoints = [
    '/api/health',
    '/api/scholarships?offset=0&limit=20',
    '/api/scholarships/stats',
  ];

  for (let i = 0; i < testCount; i++) {
    const endpoint = endpoints[i % endpoints.length];
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, { 
        signal: AbortSignal.timeout(5000) 
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const latency = Date.now() - startTime;
      latencies.push(latency);
      
      if ((i + 1) % 50 === 0) {
        process.stdout.write(`\rCompleted: ${i + 1}/${testCount} requests...`);
      }
    } catch (error: any) {
      errors.push(`${endpoint}: ${error.message}`);
    }
  }

  console.log('\n');
  const stats = calculateStats(latencies);
  
  console.log('Results:');
  console.log(`  Requests: ${latencies.length}/${testCount}`);
  console.log(`  Errors: ${errors.length} (${(errors.length / testCount * 100).toFixed(2)}%)`);
  console.log(`  Min: ${stats.min}ms`);
  console.log(`  Mean: ${stats.mean.toFixed(2)}ms`);
  console.log(`  P50: ${stats.p50}ms`);
  console.log(`  P95: ${stats.p95}ms ← TARGET ≤120ms`);
  console.log(`  P99: ${stats.p99}ms`);
  console.log(`  Max: ${stats.max}ms`);
  
  const pass = stats.p95 <= 120;
  console.log(`\n  Status: ${pass ? '✅ PASS' : '❌ FAIL'} (P95 ${stats.p95}ms ${pass ? '≤' : '>'} 120ms)`);
  
  if (errors.length > 0) {
    console.log('\n  Sample errors:');
    errors.slice(0, 5).forEach(err => console.log(`    - ${err}`));
  }

  return { pass, stats, errorRate: errors.length / testCount };
}

async function testWriteOperations() {
  console.log('\n=== TEST 2: WRITE OPERATIONS (Scholarship Creation) ===');
  console.log('Target: P95 ≤250ms (soft SLO)\n');

  const latencies: number[] = [];
  const errors: string[] = [];
  const testCount = 50; // Lower count for writes (realistic provider behavior)

  for (let i = 0; i < testCount; i++) {
    const startTime = Date.now();
    
    try {
      const scholarship = {
        title: `Performance Test Scholarship ${Date.now()}-${i}`,
        description: 'Test scholarship for performance validation',
        amount: 5000,
        deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        level: 'undergraduate',
        major: 'Computer Science',
        state: 'California',
        providerId: 'perf-test-provider',
        providerName: 'Performance Test Provider'
      };

      const response = await fetch(`${BASE_URL}/api/scholarships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scholarship),
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const latency = Date.now() - startTime;
      latencies.push(latency);
      
      if ((i + 1) % 10 === 0) {
        process.stdout.write(`\rCompleted: ${i + 1}/${testCount} writes...`);
      }
    } catch (error: any) {
      errors.push(error.message);
    }
  }

  console.log('\n');
  const stats = calculateStats(latencies);
  
  console.log('Results:');
  console.log(`  Requests: ${latencies.length}/${testCount}`);
  console.log(`  Errors: ${errors.length} (${(errors.length / testCount * 100).toFixed(2)}%)`);
  console.log(`  Min: ${stats.min}ms`);
  console.log(`  Mean: ${stats.mean.toFixed(2)}ms`);
  console.log(`  P50: ${stats.p50}ms`);
  console.log(`  P95: ${stats.p95}ms ← TARGET ≤250ms`);
  console.log(`  P99: ${stats.p99}ms`);
  console.log(`  Max: ${stats.max}ms`);
  
  const pass = stats.p95 <= 250;
  console.log(`\n  Status: ${pass ? '✅ PASS' : '❌ FAIL'} (P95 ${stats.p95}ms ${pass ? '≤' : '>'} 250ms)`);
  
  if (errors.length > 0) {
    console.log('\n  Sample errors:');
    errors.slice(0, 5).forEach(err => console.log(`    - ${err}`));
  }

  return { pass, stats, errorRate: errors.length / testCount };
}

async function testMixedWorkload() {
  console.log('\n=== TEST 3: MIXED WORKLOAD (70% Reads, 30% Writes) ===');
  console.log('Target: P95 ≤180ms\n');

  const latencies: number[] = [];
  const errors: string[] = [];
  const testCount = 100;
  
  const readEndpoints = [
    '/api/health',
    '/api/scholarships?offset=0&limit=20',
    '/api/scholarships/stats',
  ];

  for (let i = 0; i < testCount; i++) {
    const startTime = Date.now();
    const isWrite = Math.random() < 0.3; // 30% writes
    
    try {
      if (isWrite) {
        const scholarship = {
          title: `Mixed Test ${Date.now()}-${i}`,
          description: 'Mixed workload test',
          amount: 3000,
          deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          level: 'undergraduate',
          major: 'Engineering',
          state: 'Texas',
          providerId: 'mixed-test-provider',
          providerName: 'Mixed Test Provider'
        };
        const response = await fetch(`${BASE_URL}/api/scholarships`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scholarship),
          signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      } else {
        const endpoint = readEndpoints[i % readEndpoints.length];
        const response = await fetch(`${BASE_URL}${endpoint}`, { 
          signal: AbortSignal.timeout(5000) 
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      }
      
      const latency = Date.now() - startTime;
      latencies.push(latency);
      
      if ((i + 1) % 25 === 0) {
        process.stdout.write(`\rCompleted: ${i + 1}/${testCount} operations...`);
      }
    } catch (error: any) {
      errors.push(error.message);
    }
  }

  console.log('\n');
  const stats = calculateStats(latencies);
  
  console.log('Results:');
  console.log(`  Requests: ${latencies.length}/${testCount}`);
  console.log(`  Errors: ${errors.length} (${(errors.length / testCount * 100).toFixed(2)}%)`);
  console.log(`  Min: ${stats.min}ms`);
  console.log(`  Mean: ${stats.mean.toFixed(2)}ms`);
  console.log(`  P50: ${stats.p50}ms`);
  console.log(`  P95: ${stats.p95}ms ← TARGET ≤180ms`);
  console.log(`  P99: ${stats.p99}ms`);
  console.log(`  Max: ${stats.max}ms`);
  
  const pass = stats.p95 <= 180;
  console.log(`\n  Status: ${pass ? '✅ PASS' : '❌ FAIL'} (P95 ${stats.p95}ms ${pass ? '≤' : '>'} 180ms)`);
  
  if (errors.length > 0) {
    console.log('\n  Sample errors:');
    errors.slice(0, 5).forEach(err => console.log(`    - ${err}`));
  }

  return { pass, stats, errorRate: errors.length / testCount };
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Gate B Performance Validation - provider_register        ║');
  console.log('║  CEO-Approved Performance Targets                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nTesting against: ${BASE_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  try {
    const readResults = await testReadOperations();
    const writeResults = await testWriteOperations();
    const mixedResults = await testMixedWorkload();

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  FINAL RESULTS                                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const allPass = readResults.pass && writeResults.pass && mixedResults.pass;
    
    console.log(`READ Operations:   ${readResults.pass ? '✅ PASS' : '❌ FAIL'} (P95 ${readResults.stats.p95}ms / 120ms target)`);
    console.log(`WRITE Operations:  ${writeResults.pass ? '✅ PASS' : '❌ FAIL'} (P95 ${writeResults.stats.p95}ms / 250ms target)`);
    console.log(`MIXED Workload:    ${mixedResults.pass ? '✅ PASS' : '❌ FAIL'} (P95 ${mixedResults.stats.p95}ms / 180ms target)`);
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`OVERALL GATE B PERFORMANCE: ${allPass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`${'='.repeat(60)}\n`);

    if (allPass) {
      console.log('✅ All performance targets met. provider_register is READY FOR GO-LIVE.');
    } else {
      console.log('⚠️  Some targets not met. Review results above for details.');
    }

    console.log('\nRecommendation: ' + (allPass 
      ? 'PROCEED with go-live Nov 13, 19:00 UTC with approved guardrails.'
      : 'Apply CONDITIONAL PASS with enhanced monitoring per CEO directive.'));

  } catch (error) {
    console.error('\n❌ Test execution failed:', error);
    process.exit(1);
  }
}

main();
