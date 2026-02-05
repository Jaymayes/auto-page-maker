/**
 * Playwright Configuration for Full Auth E2E Tests
 *
 * This configuration targets the production domain www.scholaraiadvisor.com
 * for validating browser-based authentication flow, cookie/session management,
 * and CORS compliance.
 *
 * Priority: P1 - Non-negotiable before B2B deployment
 *
 * Usage:
 *   npx playwright test --config=e2e/auth/playwright.config.auth.ts
 *   npx playwright test --config=e2e/auth/playwright.config.auth.ts --project=chromium
 *   npx playwright test --config=e2e/auth/playwright.config.auth.ts --grep "@security"
 */

import { defineConfig, devices } from '@playwright/test';

// Production domain - canonical host
const BASE_URL = 'https://www.scholaraiadvisor.com';

export default defineConfig({
  testDir: './',
  fullyParallel: false, // Run tests sequentially for auth flow consistency
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1, // Single worker for session-dependent tests
  timeout: 60000, // 60s timeout for network operations

  reporter: [
    ['html', { outputFolder: '../../test-results/auth-html' }],
    ['list'],
    ['json', { outputFile: '../../test-results/auth-results.json' }],
    ['junit', { outputFile: '../../test-results/auth-junit.xml' }]
  ],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Browser context settings for production HTTPS
    ignoreHTTPSErrors: false,
    extraHTTPHeaders: {
      'Accept': 'text/html,application/json',
    },

    // Viewport for consistent testing
    viewport: { width: 1280, height: 720 },

    // Action timeouts
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  // Test execution settings
  expect: {
    timeout: 10000,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Chrome-specific settings for cookie testing
        launchOptions: {
          args: [
            '--disable-web-security=false',
            '--enable-features=SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure'
          ]
        }
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
      },
    },
  ],

  // No webServer - testing against production
  // webServer: undefined,

  // Global setup/teardown for database connections
  globalSetup: undefined, // Can add './global-setup.ts' if needed
  globalTeardown: undefined, // Can add './global-teardown.ts' if needed

  // Output directories
  outputDir: '../../test-results/auth-artifacts',

  // Metadata for test reports
  metadata: {
    environment: 'production',
    targetDomain: BASE_URL,
    testSuite: 'Full Auth E2E',
    priority: 'P1'
  }
});
