import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5005';
const A4_URL = process.env.A4_URL || 'http://localhost:5004';
const A8_URL = process.env.A8_URL || 'http://localhost:5008';
const NAMESPACE = 'perf_test';

test.describe('A5 Document Upload → A4 (LLM) → Outcomes Tile', () => {
  test.beforeEach(async ({ page }) => {
    await page.setExtraHTTPHeaders({
      'X-Test-Namespace': NAMESPACE,
    });
  });

  test('E2E Flow 2: Document upload routed to A4, outcomes populated', async ({ page }) => {
    const startTime = Date.now();

    await test.step('Navigate to dashboard', async () => {
      await page.goto(`${BASE_URL}/dashboard`);
      await expect(page.locator('[data-testid="dashboard-main"]')).toBeVisible({ timeout: 10000 });
    });

    await test.step('Navigate to document upload', async () => {
      await page.click('[data-testid="nav-documents"]');
      await expect(page.locator('[data-testid="upload-area"]')).toBeVisible();
    });

    await test.step('Upload test document', async () => {
      const testContent = `
        Personal Statement Draft
        
        I am passionate about computer science and want to pursue a career in AI.
        My goal is to contribute to research that makes technology more accessible.
      `;
      
      const fileBuffer = Buffer.from(testContent, 'utf-8');
      await page.setInputFiles('[data-testid="input-file"]', {
        name: 'essay_draft.txt',
        mimeType: 'text/plain',
        buffer: fileBuffer,
      });
    });

    await test.step('Submit for AI analysis', async () => {
      await page.click('[data-testid="button-analyze"]');
      await page.waitForSelector('[data-testid="analysis-complete"]', { timeout: 60000 });
    });

    await test.step('Verify A4 LLM processing', async () => {
      const statusResponse = await page.request.get(`${BASE_URL}/api/documents/latest`);
      expect(statusResponse.ok()).toBeTruthy();
      const doc = await statusResponse.json();
      expect(doc.ai_analysis).toBeDefined();
      expect(doc.processed_by).toBe('A4');
    });

    await test.step('Verify A8 Outcomes tile populated', async () => {
      await page.waitForTimeout(5000);
      
      const a8Response = await page.request.get(
        `${A8_URL}/api/dashboard/outcomes?namespace=${NAMESPACE}`
      );
      
      if (a8Response.ok()) {
        const outcomes = await a8Response.json();
        expect(outcomes.documents_processed).toBeGreaterThan(0);
      }
    });

    const endTime = Date.now();
    const totalFlowTime = endTime - startTime;
    
    console.log(`E2E Flow 2 completed in ${totalFlowTime}ms`);
    expect(totalFlowTime).toBeLessThan(120000);
  });

  test('Verify A4 chat/completions latency', async ({ page }) => {
    const chatStart = Date.now();
    
    const response = await page.request.post(`${A4_URL}/chat/completions`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Namespace': NAMESPACE,
      },
      data: {
        messages: [
          { role: 'user', content: 'Analyze this brief essay sample for scholarship applications.' }
        ],
        model: 'gpt-4o',
        max_tokens: 500,
      },
    });
    
    const chatEnd = Date.now();
    const chatLatency = chatEnd - chatStart;
    
    console.log(`A4 chat/completions latency: ${chatLatency}ms`);
    
    expect(response.status()).toBeLessThan(500);
    expect(chatLatency).toBeLessThan(30000);
  });
});
