/**
 * Provider Scholarship Creation E2E Test
 * Tests direct database write workflow for provider_register
 */

import { storage } from '../server/storage.js';
import { emitBusinessEvent, calculateProviderFee } from '../server/lib/business-events.js';

interface TestResult {
  step: string;
  status: 'PASS' | 'FAIL';
  details: string;
  error?: string;
}

async function testProviderScholarshipCreation(): Promise<void> {
  const results: TestResult[] = [];
  console.log('\n🧪 Testing Provider Scholarship Creation (Direct DB)...\n');

  const testProviderId = `test_provider_${Date.now()}`;
  const testProviderName = 'Test Provider Organization';

  // Step 1: Create scholarship via storage layer (simulating provider_register flow)
  try {
    const scholarshipData = {
      title: `Provider Test Scholarship ${Date.now()}`,
      description: 'Test scholarship created via provider_register flow',
      amount: 5000,
      deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      eligibility: 'Must be enrolled in accredited university',
      requirements: { gpa: 3.0, essay: true },
      category: 'STEM',
      major: 'Engineering',
      state: 'CA',
      city: 'San Francisco',
      level: 'undergraduate',
      providerId: testProviderId,
      providerName: testProviderName,
      sourceUrl: `https://provider-register-jamarrlmayes.replit.app/providers/${testProviderId}`,
      sourceOrganization: testProviderName,
      isActive: true
    };

    const created = await storage.createScholarship(scholarshipData);

    if (created && created.id) {
      results.push({
        step: '1. Create scholarship via storage layer',
        status: 'PASS',
        details: `Scholarship created with ID: ${created.id}, providerId: ${created.providerId}`
      });
    } else {
      results.push({
        step: '1. Create scholarship via storage layer',
        status: 'FAIL',
        details: 'Scholarship creation returned no ID'
      });
    }
  } catch (error: any) {
    results.push({
      step: '1. Create scholarship via storage layer',
      status: 'FAIL',
      details: 'Scholarship creation failed',
      error: error.message
    });
  }

  // Step 2: Emit scholarship_posted business event (B2B telemetry)
  try {
    const feeCalc = calculateProviderFee(5000);
    
    await emitBusinessEvent(
      'scholarship_posted',
      {
        scholarship_id: 'test_scholarship_id',
        scholarship_amount_usd: 5000,
        ...feeCalc
      },
      {
        actorType: 'provider',
        actorId: testProviderId,
        orgId: testProviderId,
        requestId: `test_req_${Date.now()}`
      }
    );

    results.push({
      step: '2. Emit scholarship_posted event',
      status: 'PASS',
      details: `Event emitted with fee: $${feeCalc.fee_usd} (3% of $5000)`
    });
  } catch (error: any) {
    results.push({
      step: '2. Emit scholarship_posted event',
      status: 'FAIL',
      details: 'Event emission failed',
      error: error.message
    });
  }

  // Step 3: Verify scholarship is retrievable
  try {
    const scholarships = await storage.getScholarships({ 
      limit: 100,
      offset: 0
    });

    const providerScholarships = scholarships.filter(s => s.providerId === testProviderId);

    if (providerScholarships.length > 0) {
      results.push({
        step: '3. Retrieve provider scholarships',
        status: 'PASS',
        details: `Found ${providerScholarships.length} scholarship(s) for provider ${testProviderId}`
      });
    } else {
      results.push({
        step: '3. Retrieve provider scholarships',
        status: 'FAIL',
        details: `No scholarships found for provider ${testProviderId}`
      });
    }
  } catch (error: any) {
    results.push({
      step: '3. Retrieve provider scholarships',
      status: 'FAIL',
      details: 'Retrieval failed',
      error: error.message
    });
  }

  // Step 4: Verify business events were logged
  try {
    const events = await storage.getBusinessEvents({
      app: 'provider_register',
      eventName: 'scholarship_posted',
      limit: 10
    });

    if (events.length > 0) {
      const testEvent = events.find(e => e.orgId === testProviderId);
      results.push({
        step: '4. Verify business event logging',
        status: testEvent ? 'PASS' : 'FAIL',
        details: testEvent 
          ? `Found scholarship_posted event for provider ${testProviderId}` 
          : 'No matching event found (may be async delay)'
      });
    } else {
      results.push({
        step: '4. Verify business event logging',
        status: 'FAIL',
        details: 'No scholarship_posted events found in database'
      });
    }
  } catch (error: any) {
    results.push({
      step: '4. Verify business event logging',
      status: 'FAIL',
      details: 'Event query failed',
      error: error.message
    });
  }

  // Print results
  console.log('═'.repeat(80));
  console.log('PROVIDER SCHOLARSHIP CREATION TEST RESULTS');
  console.log('═'.repeat(80));
  results.forEach((result, idx) => {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    console.log(`\n${icon} ${result.step}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Details: ${result.details}`);
    if (result.error) console.log(`   Error: ${result.error}`);
  });

  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;

  console.log('\n' + '═'.repeat(80));
  console.log(`SUMMARY: ${passCount}/${results.length} tests PASSED, ${failCount} FAILED`);
  console.log('═'.repeat(80));

  if (failCount > 0) {
    console.log('\n❌ TEST FAILURE: Provider scholarship creation flow has issues');
    process.exit(1);
  } else {
    console.log('\n✅ ALL TESTS PASSED: Provider scholarship creation flow is functional');
    console.log('\nArchitecture: Direct database writes via storage layer (monolith pattern)');
    console.log('No HTTP callbacks needed - all apps share same PostgreSQL database');
    process.exit(0);
  }
}

testProviderScholarshipCreation().catch(error => {
  console.error('\n💥 Fatal test error:', error);
  process.exit(1);
});
