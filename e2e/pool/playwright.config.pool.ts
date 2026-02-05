/**
 * Playwright Configuration for Connection Pool Stress Tests
 *
 * Targets production www.scholaraiadvisor.com for validating
 * database connection pool behavior under load.
 *
 * Priority: P1 - A12 Connection Pooling Stress Test
 *
 * Usage:
 *   npx playwright test --config=e2e/pool/playwright.config.pool.ts
 *   npx playwright test --config=e2e/pool/playwright.config.pool.ts --grep "@load"
 *   npx playwright test --config=e2e/pool/playwright.config.pool.ts --grep "@sustained"
 */

import { defineConfig, devices } from '@playwright/test';

const BASE_URL = 'https://www.scholaraiadvisor.com';

export default defineConfig({
  testDir: './',
  fullyParallel: false, // Sequential for accurate latency measurement
  forbidOnly: !!process.env.CI,
  retries: 0, // No retries for stress tests - we want real failure data
  workers: 1, // Single worker for consistent measurements
  timeout: 120000, // 2 minute timeout for sustained tests

  reporter: [
    ['html', { outputFolder: '../../test-results/pool-html' }],
    ['list'],
    ['json', { outputFile: '../../test-results/pool-results.json' }],
    ['junit', { outputFile: '../../test-results/pool-junit.xml' }]
  ],

  use: {
    baseURL: BASE_URL,
    trace: 'off', // Disable tracing for performance tests
    screenshot: 'off',
    video: 'off',

    // Longer timeouts for stress testing
    actionTimeout: 30000,
    navigationTimeout: 30000,

    // Request-specific settings
    extraHTTPHeaders: {
      'Accept': 'application/json',
      'X-Test-Suite': 'pool-stress',
    },
  },

  projects: [
    {
      name: 'pool-stress',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],

  // Output directories
  outputDir: '../../test-results/pool-artifacts',

  // Metadata
  metadata: {
    environment: 'production',
    targetDomain: BASE_URL,
    testSuite: 'A12 Connection Pool Stress',
    priority: 'P1',
    poolConfig: {
      max: 6,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      maxUses: 500
    }
  }
});
