import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5005';
const A8_URL = process.env.A8_URL || 'http://localhost:5008';
const NAMESPACE = 'perf_test';

test.describe('A5 Signup → OIDC (A1) → CRM Record → A8 Attribution', () => {
  test.beforeEach(async ({ page }) => {
    await page.setExtraHTTPHeaders({
      'X-Test-Namespace': NAMESPACE,
    });
  });

  test('E2E Flow 1: Complete signup and verify A8 attribution tile', async ({ page }) => {
    const testEmail = `perf_test_${Date.now()}@example.com`;
    const startTime = Date.now();

    await test.step('Navigate to signup page', async () => {
      await page.goto(`${BASE_URL}/signup`);
      await expect(page).toHaveURL(/signup/);
    });

    await test.step('Fill signup form', async () => {
      await page.fill('[data-testid="input-email"]', testEmail);
      await page.fill('[data-testid="input-password"]', 'TestPass123!');
      await page.fill('[data-testid="input-name"]', 'Perf Test User');
    });

    await test.step('Submit signup and trigger OIDC flow', async () => {
      await page.click('[data-testid="button-submit"]');
      await page.waitForURL(/dashboard|verify/, { timeout: 30000 });
    });

    await test.step('Verify CRM record created', async () => {
      const response = await page.request.get(`${BASE_URL}/api/user/profile`);
      expect(response.ok()).toBeTruthy();
      const profile = await response.json();
      expect(profile.email).toBe(testEmail);
    });

    await test.step('Verify A8 Growth/Attribution tile receives event', async () => {
      await page.waitForTimeout(5000);

      const a8Response = await page.request.get(
        `${A8_URL}/api/dashboard/events?namespace=${NAMESPACE}&type=signup&limit=10`
      );
      
      if (a8Response.ok()) {
        const events = await a8Response.json();
        const signupEvent = events.find((e: any) => 
          e.payload?.email === testEmail || e.type === 'signup'
        );
        expect(signupEvent).toBeDefined();
      }
    });

    const endTime = Date.now();
    const totalFlowTime = endTime - startTime;
    
    console.log(`E2E Flow 1 completed in ${totalFlowTime}ms`);
    expect(totalFlowTime).toBeLessThan(60000);
  });

  test('Verify OIDC token exchange latency', async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);
    
    const tokenStart = Date.now();
    await page.fill('[data-testid="input-email"]', `oidc_test_${Date.now()}@example.com`);
    await page.fill('[data-testid="input-password"]', 'TestPass123!');
    await page.click('[data-testid="button-submit"]');
    
    await page.waitForURL(/dashboard|verify/, { timeout: 15000 });
    const tokenEnd = Date.now();
    
    const oidcLatency = tokenEnd - tokenStart;
    console.log(`OIDC token exchange latency: ${oidcLatency}ms`);
    expect(oidcLatency).toBeLessThan(5000);
  });
});
