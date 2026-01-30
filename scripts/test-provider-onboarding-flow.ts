/**
 * Provider Onboarding Flow Diagnostic Test
 * Tests the end-to-end provider registration and scholarship creation flow
 */

import fetch from 'node-fetch';

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5000';
const SCHOLARSHIP_API_URL = 'https://scholarship-api-jamarrlmayes.replit.app';

interface TestResult {
  step: string;
  status: 'PASS' | 'FAIL';
  details: string;
  responseTime?: number;
  statusCode?: number;
  error?: string;
}

async function testProviderOnboardingFlow(): Promise<void> {
  const results: TestResult[] = [];
  console.log('\n🧪 Testing Provider Onboarding Flow...\n');

  //Step 1: Test scholarship_api health endpoint
  try {
    const start = Date.now();
    const healthResponse = await fetch(`${SCHOLARSHIP_API_URL}/api/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    const responseTime = Date.now() - start;

    if (healthResponse.ok) {
      const data = await healthResponse.json();
      results.push({
        step: '1. scholarship_api health check',
        status: 'PASS',
        details: `scholarship_api is reachable and healthy`,
        responseTime,
        statusCode: healthResponse.status
      });
    } else {
      results.push({
        step: '1. scholarship_api health check',
        status: 'FAIL',
        details: `scholarship_api returned non-200 status`,
        statusCode: healthResponse.status,
        responseTime
      });
    }
  } catch (error: any) {
    results.push({
      step: '1. scholarship_api health check',
      status: 'FAIL',
      details: `Cannot reach scholarship_api`,
      error: error.message
    });
  }

  // Step 2: Test scholarship creation endpoint (unauthenticated - should work for API calls)
  try {
    const start = Date.now();
    const scholarshipData = {
      title: `Test Scholarship ${Date.now()}`,
      description: 'Diagnostic test scholarship for provider onboarding flow validation',
      amount: 1000,
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      eligibility: 'Test eligibility criteria',
      requirements: 'Test requirements',
      category: 'STEM',
      major: 'Computer Science',
      state: 'CA',
      city: 'San Francisco',
      level: 'undergraduate',
      providerId: 'test_provider_diagnostic',
      providerName: 'Test Provider Org'
    };

    const createResponse = await fetch(`${SCHOLARSHIP_API_URL}/api/scholarships`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scholarshipData)
    });
    const responseTime = Date.now() - start;

    if (createResponse.ok || createResponse.status === 201) {
      const created = await createResponse.json();
      results.push({
        step: '2. Create scholarship via API',
        status: 'PASS',
        details: `Scholarship created successfully (ID: ${created.id})`,
        responseTime,
        statusCode: createResponse.status
      });
    } else {
      const errorText = await createResponse.text();
      results.push({
        step: '2. Create scholarship via API',
        status: 'FAIL',
        details: `Scholarship creation failed: ${errorText}`,
        statusCode: createResponse.status,
        responseTime
      });
    }
  } catch (error: any) {
    results.push({
      step: '2. Create scholarship via API',
      status: 'FAIL',
      details: `API call failed`,
      error: error.message
    });
  }

  // Step 3: Test if scholarship is retrievable
  try {
    const start = Date.now();
    const listResponse = await fetch(`${SCHOLARSHIP_API_URL}/api/scholarships?limit=1`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    const responseTime = Date.now() - start;

    if (listResponse.ok) {
      const scholarships = await listResponse.json();
      results.push({
        step: '3. Retrieve scholarships',
        status: 'PASS',
        details: `Retrieved ${scholarships.length} scholarship(s)`,
        responseTime,
        statusCode: listResponse.status
      });
    } else {
      results.push({
        step: '3. Retrieve scholarships',
        status: 'FAIL',
        details: `Failed to retrieve scholarships`,
        statusCode: listResponse.status,
        responseTime
      });
    }
  } catch (error: any) {
    results.push({
      step: '3. Retrieve scholarships',
      status: 'FAIL',
      details: `API call failed`,
      error: error.message
    });
  }

  // Print results
  console.log('═'.repeat(80));
  console.log('PROVIDER ONBOARDING FLOW TEST RESULTS');
  console.log('═'.repeat(80));
  results.forEach((result, idx) => {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    console.log(`\n${icon} ${result.step}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Details: ${result.details}`);
    if (result.responseTime) console.log(`   Response Time: ${result.responseTime}ms`);
    if (result.statusCode) console.log(`   HTTP Status: ${result.statusCode}`);
    if (result.error) console.log(`   Error: ${result.error}`);
  });

  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;

  console.log('\n' + '═'.repeat(80));
  console.log(`SUMMARY: ${passCount}/${results.length} tests PASSED, ${failCount} FAILED`);
  console.log('═'.repeat(80));

  if (failCount > 0) {
    console.log('\n❌ DIAGNOSTIC FAILURE: One or more integration points failing');
    console.log('\nNext Steps:');
    console.log('1. Review failed steps above');
    console.log('2. Check server logs for errors');
    console.log('3. Verify CORS configuration allows cross-app communication');
    console.log('4. Validate database connectivity and schema');
    process.exit(1);
  } else {
    console.log('\n✅ ALL TESTS PASSED: Provider onboarding flow is functional');
    process.exit(0);
  }
}

testProviderOnboardingFlow().catch(error => {
  console.error('\n💥 Fatal test error:', error);
  process.exit(1);
});
