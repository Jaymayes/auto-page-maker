/**
 * Playwright Configuration for A7 Content Generation Validation Tests
 *
 * Targets production www.scholaraiadvisor.com for validating
 * content generation system health, sitemap, rate limits, and security.
 *
 * Priority: P1 - Phase 1 Foundation & Brand Building
 *
 * Usage:
 *   npx playwright test --config=e2e/content/playwright.config.content.ts
 *   npx playwright test --config=e2e/content/playwright.config.content.ts --grep "@sitemap"
 *   npx playwright test --config=e2e/content/playwright.config.content.ts --grep "@security"
 */

import { defineConfig, devices } from '@playwright/test';

const BASE_URL = 'https://www.scholaraiadvisor.com';

export default defineConfig({
  testDir: './',
  fullyParallel: false, // Sequential for rate limit testing accuracy
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Single worker for consistent measurements
  timeout: 60000, // 1 minute timeout per test

  reporter: [
    ['html', { outputFolder: '../../test-results/content-html' }],
    ['list'],
    ['json', { outputFile: '../../test-results/content-results.json' }],
    ['junit', { outputFile: '../../test-results/content-junit.xml' }]
  ],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Action timeouts
    actionTimeout: 15000,
    navigationTimeout: 30000,

    // Browser context
    ignoreHTTPSErrors: false,
    extraHTTPHeaders: {
      'Accept': 'text/html,application/json,application/xml',
      'X-Test-Suite': 'content-validation',
    },

    // Viewport
    viewport: { width: 1280, height: 720 },
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],

  // Output directories
  outputDir: '../../test-results/content-artifacts',

  // Metadata
  metadata: {
    environment: 'production',
    targetDomain: BASE_URL,
    testSuite: 'A7 Content Generation Validation',
    priority: 'P1',
    phase: 'Foundation & Brand Building'
  }
});
