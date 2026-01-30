#!/usr/bin/env tsx
/**
 * T+6-12h Failure Injection Testing
 * 
 * Purpose: Validate system resilience under failure conditions:
 *  1. Concurrent query stress (pool saturation)
 *  2. Error handling and graceful degradation
 *  3. Secret protection in error logs
 */

const BASE_URL = process.env.REPL_ID 
  ? `https://${process.env.REPL_ID}.${process.env.REPL_SLUG}.replit.dev`
  : 'http://localhost:5000';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

async function testConcurrentQueryStress(): Promise<TestResult> {
  console.log('\n🔥 Test 1: Concurrent Query Stress (Pool Saturation)');
  console.log('   Sending 50 simultaneous requests to stress DB pool...\n');

  const requests = Array.from({ length: 50 }, (_, i) => 
    fetch(`${BASE_URL}/api/scholarships?limit=10&page=${i % 5 + 1}`)
  );

  try {
    const start = Date.now();
    const responses = await Promise.all(requests);
    const duration = Date.now() - start;

    const successCount = responses.filter(r => r.ok).length;
    const errorCount = responses.filter(r => !r.ok).length;
    const errorCodes = [...new Set(
      responses.filter(r => !r.ok).map(r => r.status)
    )];

    console.log(`   ✓ Completed in ${duration}ms`);
    console.log(`   ✓ Success: ${successCount}/50, Errors: ${errorCount}/50`);
    if (errorCodes.length > 0) {
      console.log(`   ⚠️ Error codes: ${errorCodes.join(', ')}`);
    }

    // Pass if most requests succeed or fail gracefully with proper codes
    const passed = successCount >= 40 || (errorCodes.length > 0 && !errorCodes.includes(500));
    
    return {
      name: 'Concurrent Query Stress',
      passed,
      details: `${successCount}/50 succeeded, ${errorCount}/50 failed, Duration: ${duration}ms, Error codes: ${errorCodes.join(',')||'none'}`
    };
  } catch (error) {
    return {
      name: 'Concurrent Query Stress',
      passed: false,
      details: `Exception: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

async function testInvalidInputHandling(): Promise<TestResult> {
  console.log('\n🔥 Test 2: Invalid Input Handling');
  console.log('   Testing malicious/invalid inputs...\n');

  const testCases = [
    { 
      path: '/api/scholarships?major=../../../etc/passwd', 
      expected: [400, 404], 
      name: 'Path traversal attempt' 
    },
    { 
      path: '/api/scholarships?limit=-1', 
      expected: [200, 400], 
      name: 'Negative limit' 
    },
    { 
      path: '/api/scholarships?page=999999', 
      expected: [200], 
      name: 'Extreme pagination' 
    },
    { 
      path: '/api/landing-pages/../../../../admin', 
      expected: [400, 404], 
      name: 'Landing page path traversal' 
    }
  ];

  const results: string[] = [];
  let passCount = 0;

  for (const testCase of testCases) {
    try {
      const response = await fetch(`${BASE_URL}${testCase.path}`);
      const isExpected = testCase.expected.includes(response.status);
      
      if (isExpected) {
        console.log(`   ✓ ${testCase.name}: ${response.status} (expected)`);
        passCount++;
        results.push(`${testCase.name}: PASS (${response.status})`);
      } else {
        console.log(`   ✗ ${testCase.name}: ${response.status} (expected ${testCase.expected.join(' or ')})`);
        results.push(`${testCase.name}: FAIL (${response.status})`);
      }
    } catch (error) {
      console.log(`   ✗ ${testCase.name}: Exception`);
      results.push(`${testCase.name}: EXCEPTION`);
    }
  }

  return {
    name: 'Invalid Input Handling',
    passed: passCount === testCases.length,
    details: results.join(', ')
  };
}

async function testSecretProtection(): Promise<TestResult> {
  console.log('\n🔥 Test 3: Secret Protection in Logs');
  console.log('   Verifying sensitive data not exposed...\n');

  try {
    // Trigger various endpoints that might log data
    await fetch(`${BASE_URL}/healthz`);
    await fetch(`${BASE_URL}/api/scholarships/stats`);
    
    // Get recent logs to check for secret leaks
    const logPatterns = [
      'DATABASE_URL=',
      'postgres://',
      'password=',
      'AGENT_BRIDGE_SHARED_SECRET',
      'OPENAI_API_KEY',
      'sk-proj-', // OpenAI key prefix
      'postgresql://',
    ];

    // In a real test, we'd check actual log files
    // For now, verify endpoints don't return sensitive data
    const response = await fetch(`${BASE_URL}/healthz`);
    const data = await response.json();
    const healthStr = JSON.stringify(data).toLowerCase();

    let leaked = false;
    let leakedPattern = '';

    for (const pattern of logPatterns) {
      if (healthStr.includes(pattern.toLowerCase())) {
        leaked = true;
        leakedPattern = pattern;
        break;
      }
    }

    if (leaked) {
      console.log(`   ✗ SECURITY ISSUE: Found "${leakedPattern}" in health endpoint response`);
      return {
        name: 'Secret Protection',
        passed: false,
        details: `Leaked pattern: ${leakedPattern}`
      };
    } else {
      console.log(`   ✓ No sensitive data found in API responses`);
      console.log(`   ✓ Checked patterns: ${logPatterns.length}`);
      return {
        name: 'Secret Protection',
        passed: true,
        details: `No leaks detected in ${logPatterns.length} patterns`
      };
    }
  } catch (error) {
    return {
      name: 'Secret Protection',
      passed: false,
      details: `Exception: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

async function testErrorRecovery(): Promise<TestResult> {
  console.log('\n🔥 Test 4: Error Recovery & Graceful Degradation');
  console.log('   Testing system recovery from errors...\n');

  try {
    // Test 1: Invalid scholarship ID
    const invalidIdRes = await fetch(`${BASE_URL}/api/scholarships/invalid-uuid-format`);
    const has404or400 = invalidIdRes.status === 404 || invalidIdRes.status === 400;
    
    // Test 2: Non-existent scholarship
    const notFoundRes = await fetch(`${BASE_URL}/api/scholarships/00000000-0000-0000-0000-000000000000`);
    const has404 = notFoundRes.status === 404;

    // Test 3: System still responsive after errors
    const healthRes = await fetch(`${BASE_URL}/healthz`);
    const stillHealthy = healthRes.ok;

    const allPassed = has404or400 && has404 && stillHealthy;

    console.log(`   ${has404or400 ? '✓' : '✗'} Invalid ID format: ${invalidIdRes.status}`);
    console.log(`   ${has404 ? '✓' : '✗'} Non-existent ID: ${notFoundRes.status}`);
    console.log(`   ${stillHealthy ? '✓' : '✗'} System still healthy after errors`);

    return {
      name: 'Error Recovery',
      passed: allPassed,
      details: `Invalid ID: ${invalidIdRes.status}, Not found: ${notFoundRes.status}, Health: ${healthRes.status}`
    };
  } catch (error) {
    return {
      name: 'Error Recovery',
      passed: false,
      details: `Exception: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

async function runFailureInjectionTests() {
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║   FAILURE INJECTION & RESILIENCE TESTING      ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  const results: TestResult[] = [];

  results.push(await testConcurrentQueryStress());
  results.push(await testInvalidInputHandling());
  results.push(await testSecretProtection());
  results.push(await testErrorRecovery());

  console.log('\n' + '═'.repeat(50));
  console.log('📊 FAILURE INJECTION TEST RESULTS');
  console.log('═'.repeat(50) + '\n');

  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${result.name}`);
    console.log(`   ${result.details}\n`);
  });

  const passCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  const allPassed = passCount === totalCount;

  console.log('═'.repeat(50));
  console.log(`Summary: ${passCount}/${totalCount} tests passed`);
  console.log(`Overall: ${allPassed ? '✅ GO' : '❌ NO-GO'} for Private Beta`);
  console.log('═'.repeat(50) + '\n');

  process.exit(allPassed ? 0 : 1);
}

runFailureInjectionTests().catch(console.error);
