/**
 * Playwright Configuration for A11 Environment Drift Detection Tests
 *
 * Validates production environment matches expected configuration
 * by testing database schema, API endpoints, and environment variables.
 *
 * Priority: P1 - Critical for deployment validation
 *
 * Usage:
 *   npx playwright test --config=e2e/drift/playwright.config.drift.ts
 *   npx playwright test --config=e2e/drift/playwright.config.drift.ts --grep "@schema"
 *   npx playwright test --config=e2e/drift/playwright.config.drift.ts --grep "@summary"
 */

import { defineConfig, devices } from '@playwright/test';

const BASE_URL = 'https://www.scholaraiadvisor.com';

export default defineConfig({
  testDir: './',
  fullyParallel: false, // Sequential for database tests
  forbidOnly: !!process.env.CI,
  retries: 0, // No retries - we want to see actual drift
  workers: 1, // Single worker for database connections
  timeout: 60000, // 1 minute timeout per test

  reporter: [
    ['html', { outputFolder: '../../test-results/drift-html' }],
    ['list'],
    ['json', { outputFile: '../../test-results/drift-results.json' }],
    ['junit', { outputFile: '../../test-results/drift-junit.xml' }]
  ],

  use: {
    baseURL: BASE_URL,
    trace: 'off', // No tracing for drift tests
    screenshot: 'off',
    video: 'off',

    // Action timeouts
    actionTimeout: 15000,
    navigationTimeout: 30000,

    // Request settings
    extraHTTPHeaders: {
      'Accept': 'application/json',
      'X-Test-Suite': 'drift-detection',
    },
  },

  projects: [
    {
      name: 'drift-detection',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],

  // Output directories
  outputDir: '../../test-results/drift-artifacts',

  // Metadata
  metadata: {
    environment: 'production',
    targetDomain: BASE_URL,
    testSuite: 'A11 Environment Drift Detection',
    priority: 'P1',
    databaseHost: 'caboose.proxy.rlwy.net:36327',
    databaseName: 'scholarship_prod'
  }
});
