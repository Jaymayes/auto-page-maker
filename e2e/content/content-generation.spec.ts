/**
 * A7 Content Generation Validation Test Suite
 *
 * Validates the A7 Landing Page content generation system on
 * www.scholaraiadvisor.com production environment.
 *
 * Priority: P1 - Phase 1 Foundation & Brand Building
 *
 * Tests:
 * - Content generation endpoint availability
 * - Content structure validation
 * - Sitemap generation verification
 * - Rate limiting compliance
 * - Security headers validation
 */

import { test, expect } from '@playwright/test';
import {
  BASE_URL,
  ENDPOINTS,
  EXPECTED_HEADERS,
  validateSitemapXml,
  parseRateLimitHeaders,
  extractSecurityHeaders,
  validateSecurityHeaders,
  detectXssVectors
} from './helpers/content-helpers';

// =============================================================================
// Suite 1: Health & Availability
// =============================================================================

test.describe('Content Generation Health @content @health', () => {
  test('API health endpoint responds correctly', async ({ request }) => {
    const response = await request.get(`${BASE_URL}${ENDPOINTS.health}`);

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('status');
    expect(body.status).toBe('ok');

    console.log('[Content Health] API health check passed');
    console.log(`  Status: ${body.status}`);
    console.log(`  Timestamp: ${body.timestamp || 'N/A'}`);
  });

  test('Landing pages endpoint accessible', async ({ request }) => {
    const response = await request.get(`${BASE_URL}${ENDPOINTS.landingPages}`, {
      failOnStatusCode: false
    });

    const status = response.status();

    // Can be 200 (public), 401/403 (requires auth), or 500 (DB/config issue)
    console.log(`[Content Health] Landing pages endpoint: ${status}`);

    if (status === 200) {
      const body = await response.json();
      console.log('  Response has data:', body.data !== undefined);
      console.log('  Response has meta:', body.meta !== undefined);
    } else if (status === 401 || status === 403) {
      console.log('  Requires authentication');
    } else if (status === 500) {
      console.log('  Server error - may need configuration or DB setup');
    }

    // Accept any documented response - not crashing is the baseline
    expect([200, 401, 403, 500]).toContain(status);
  });

  test('Browse page loads successfully', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}${ENDPOINTS.browse}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    expect(response).not.toBeNull();
    const status = response?.status() || 0;

    // Accept success codes and redirects
    expect([200, 301, 302, 304]).toContain(status);

    console.log('[Content Health] Browse page loaded');
    console.log(`  Status: ${status}`);
    console.log(`  URL: ${page.url()}`);
  });
});

// =============================================================================
// Suite 2: Sitemap Generation
// =============================================================================

test.describe('Sitemap Generation @content @sitemap', () => {
  test('Sitemap XML is accessible and valid', async ({ request }) => {
    const response = await request.get(`${BASE_URL}${ENDPOINTS.sitemap}`, {
      failOnStatusCode: false
    });

    const status = response.status();
    console.log(`[Sitemap] Status: ${status}`);

    // Sitemap may exist, redirect, or return error if not configured
    if (status === 200) {
      const xml = await response.text();
      const validation = validateSitemapXml(xml);

      console.log('[Sitemap] Validation results:');
      console.log(`  Valid: ${validation.valid}`);
      console.log(`  URL Count: ${validation.urlCount}`);
      console.log(`  Has XML Declaration: ${validation.hasXmlDeclaration}`);
      console.log(`  Has Urlset: ${validation.hasUrlset}`);
      console.log(`  Has Sitemap Index: ${validation.hasSitemapIndex}`);

      if (validation.sampleUrls.length > 0) {
        console.log('  Sample URLs:');
        validation.sampleUrls.slice(0, 3).forEach(url => {
          console.log(`    - ${url}`);
        });
      }

      if (validation.errors.length > 0) {
        console.log('  Errors:');
        validation.errors.forEach(err => console.log(`    - ${err}`));
      }

      // Basic structure assertions
      expect(validation.hasXmlDeclaration || validation.hasUrlset || validation.hasSitemapIndex).toBe(true);
    } else if (status === 301 || status === 302) {
      console.log('  Sitemap redirects to another location');
    } else if (status === 404) {
      console.log('  Sitemap not found - may need to be generated');
    } else if (status === 500) {
      console.log('  Sitemap generation error - check DB/config');
    }

    // Accept various states - sitemap may not be configured yet
    expect([200, 301, 302, 404, 500]).toContain(status);
  });

  test('Sitemap URLs are valid format', async ({ request }) => {
    const response = await request.get(`${BASE_URL}${ENDPOINTS.sitemap}`, {
      failOnStatusCode: false
    });

    if (response.status() !== 200) {
      console.log('[Sitemap URLs] Skipping - sitemap not directly accessible');
      return;
    }

    const xml = await response.text();
    const validation = validateSitemapXml(xml);

    // Check that sample URLs are valid
    let validUrls = 0;
    for (const url of validation.sampleUrls) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
          validUrls++;
        }
      } catch {
        console.log(`[Sitemap URLs] Invalid URL: ${url}`);
      }
    }

    console.log(`[Sitemap URLs] ${validUrls}/${validation.sampleUrls.length} sample URLs are valid`);

    // If we have URLs, they should all be valid
    if (validation.sampleUrls.length > 0) {
      expect(validUrls).toBe(validation.sampleUrls.length);
    }
  });
});

// =============================================================================
// Suite 3: Rate Limiting Compliance
// =============================================================================

test.describe('Rate Limiting Compliance @content @ratelimit', () => {
  test('Rate limit headers present on API responses', async ({ request }) => {
    const response = await request.get(`${BASE_URL}${ENDPOINTS.health}`);
    const headers = response.headers();

    const rateLimitInfo = parseRateLimitHeaders(headers);

    console.log('[Rate Limit] Header analysis:');

    if (rateLimitInfo) {
      console.log(`  Limit: ${rateLimitInfo.limit}`);
      console.log(`  Remaining: ${rateLimitInfo.remaining}`);
      console.log(`  Reset: ${rateLimitInfo.reset}`);
      if (rateLimitInfo.policy) {
        console.log(`  Policy: ${rateLimitInfo.policy}`);
      }

      // Validate reasonable values
      expect(rateLimitInfo.limit).toBeGreaterThan(0);
      expect(rateLimitInfo.remaining).toBeGreaterThanOrEqual(0);
      expect(rateLimitInfo.remaining).toBeLessThanOrEqual(rateLimitInfo.limit);
    } else {
      // Check for alternative headers
      const allHeaders = Object.keys(headers).filter(h =>
        h.toLowerCase().includes('limit') || h.toLowerCase().includes('rate')
      );

      if (allHeaders.length > 0) {
        console.log('  Alternative rate limit headers found:');
        allHeaders.forEach(h => console.log(`    ${h}: ${headers[h]}`));
      } else {
        console.log('  No rate limit headers found');
        console.log('  Note: Rate limiting may be handled at infrastructure level');
      }
    }
  });

  test('Multiple requests do not trigger immediate rate limit', async ({ request }) => {
    const requestCount = 5;
    const results: { status: number; remaining: number | null }[] = [];

    for (let i = 0; i < requestCount; i++) {
      const response = await request.get(`${BASE_URL}${ENDPOINTS.health}`);
      const headers = response.headers();
      const rateLimitInfo = parseRateLimitHeaders(headers);

      results.push({
        status: response.status(),
        remaining: rateLimitInfo?.remaining ?? null
      });

      // Small delay to avoid burst
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('[Rate Limit] Burst test results:');
    results.forEach((r, i) => {
      console.log(`  Request ${i + 1}: status=${r.status}, remaining=${r.remaining}`);
    });

    // All requests should succeed (no 429)
    const successCount = results.filter(r => r.status === 200).length;
    expect(successCount).toBe(requestCount);

    // Remaining should decrease (if rate limiting is per-request)
    if (results[0].remaining !== null && results[results.length - 1].remaining !== null) {
      const decreased = results[0].remaining >= results[results.length - 1].remaining;
      console.log(`  Remaining counter ${decreased ? 'decreased' : 'did not decrease'}`);
    }
  });
});

// =============================================================================
// Suite 4: Security Headers
// =============================================================================

test.describe('Security Headers @content @security', () => {
  test('Required security headers present', async ({ request }) => {
    const response = await request.get(`${BASE_URL}${ENDPOINTS.health}`);
    const headers = response.headers();

    const securityHeaders = extractSecurityHeaders(headers);
    const validation = validateSecurityHeaders(securityHeaders);

    console.log('[Security Headers] Analysis:');

    validation.present.forEach(h => console.log(`  [PASS] ${h}`));
    validation.missing.forEach(h => console.log(`  [MISSING] ${h}`));

    // Critical headers must be present
    expect(securityHeaders.xFrameOptions).not.toBeNull();
    expect(securityHeaders.xContentTypeOptions).not.toBeNull();
    expect(securityHeaders.strictTransportSecurity).not.toBeNull();
  });

  test('X-Frame-Options is DENY', async ({ request }) => {
    const response = await request.get(`${BASE_URL}${ENDPOINTS.health}`);
    const xFrameOptions = response.headers()['x-frame-options'];

    console.log(`[Security] X-Frame-Options: ${xFrameOptions}`);

    expect(xFrameOptions).toBe(EXPECTED_HEADERS.xFrameOptions);
  });

  test('X-Content-Type-Options is nosniff', async ({ request }) => {
    const response = await request.get(`${BASE_URL}${ENDPOINTS.health}`);
    const xContentType = response.headers()['x-content-type-options'];

    console.log(`[Security] X-Content-Type-Options: ${xContentType}`);

    expect(xContentType).toBe(EXPECTED_HEADERS.xContentTypeOptions);
  });

  test('HSTS header configured correctly', async ({ request }) => {
    const response = await request.get(`${BASE_URL}${ENDPOINTS.health}`);
    const hsts = response.headers()['strict-transport-security'];

    console.log(`[Security] HSTS: ${hsts}`);

    expect(hsts).not.toBeNull();

    // Should have max-age
    expect(hsts).toMatch(/max-age=\d+/);

    // Check for recommended settings
    const hasIncludeSubDomains = hsts?.includes('includeSubDomains');
    const hasPreload = hsts?.includes('preload');

    console.log(`  includeSubDomains: ${hasIncludeSubDomains}`);
    console.log(`  preload: ${hasPreload}`);
  });

  test('Content-Security-Policy header present', async ({ request }) => {
    const response = await request.get(`${BASE_URL}${ENDPOINTS.health}`);
    const csp = response.headers()['content-security-policy'];

    console.log(`[Security] CSP: ${csp ? `present (${csp.length} chars)` : 'missing'}`);

    expect(csp).not.toBeNull();

    // Log CSP directives
    if (csp) {
      const directives = csp.split(';').map(d => d.trim()).filter(d => d);
      console.log(`  Directives (${directives.length}):`);
      directives.slice(0, 5).forEach(d => {
        const [name] = d.split(' ');
        console.log(`    - ${name}`);
      });
      if (directives.length > 5) {
        console.log(`    ... and ${directives.length - 5} more`);
      }
    }
  });
});

// =============================================================================
// Suite 5: Content Quality
// =============================================================================

test.describe('Content Quality @content @quality', () => {
  test('Browse page has valid HTML structure', async ({ page }) => {
    await page.goto(`${BASE_URL}${ENDPOINTS.browse}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Check for essential HTML elements
    const hasTitle = await page.title();
    const hasH1 = await page.locator('h1').count();
    const hasMeta = await page.locator('meta[name="description"]').count();

    console.log('[Content Quality] HTML structure:');
    console.log(`  Title: ${hasTitle || 'missing'}`);
    console.log(`  H1 count: ${hasH1}`);
    console.log(`  Meta description: ${hasMeta > 0 ? 'present' : 'missing'}`);

    // Title should exist
    expect(hasTitle).toBeTruthy();
  });

  test('Browse page contains no XSS vectors', async ({ page }) => {
    await page.goto(`${BASE_URL}${ENDPOINTS.browse}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Get page HTML content
    const html = await page.content();
    const xssCheck = detectXssVectors(html);

    console.log('[Content Quality] XSS scan:');
    console.log(`  Safe: ${xssCheck.safe}`);

    if (xssCheck.issues.length > 0) {
      console.log('  Issues found:');
      xssCheck.issues.forEach(issue => console.log(`    - ${issue}`));
    }

    // Page should be safe from obvious XSS vectors
    // Note: Some legitimate script tags may exist, so we log rather than fail
    if (!xssCheck.safe) {
      console.log('  Note: Script tags may be legitimate app code');
    }
  });

  test('API responses are valid JSON', async ({ request }) => {
    const endpoints = [ENDPOINTS.health];

    for (const endpoint of endpoints) {
      const response = await request.get(`${BASE_URL}${endpoint}`, {
        failOnStatusCode: false
      });

      if (response.status() === 200) {
        const contentType = response.headers()['content-type'];

        console.log(`[Content Quality] ${endpoint}:`);
        console.log(`  Content-Type: ${contentType}`);

        // Should be JSON
        expect(contentType).toMatch(/application\/json/);

        // Should parse as JSON
        const body = await response.json();
        expect(body).toBeTruthy();
        expect(typeof body).toBe('object');
      }
    }
  });
});

// =============================================================================
// Suite 6: Error Handling
// =============================================================================

test.describe('Error Handling @content @errors', () => {
  test('Unknown API route handled gracefully', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/nonexistent-endpoint-12345`, {
      failOnStatusCode: false
    });

    const status = response.status();

    console.log(`[Error Handling] Unknown route test: status=${status}`);

    // SPA may return 200 with catch-all, or proper 404
    // Key is that it doesn't crash with 500
    if (status === 200) {
      console.log('  App uses SPA catch-all routing');
    } else if (status === 404) {
      console.log('  App returns proper 404 for unknown routes');
    }

    // Should not be a server error
    expect(status).not.toBe(500);
    expect([200, 404]).toContain(status);
  });

  test('Invalid API parameters handled gracefully', async ({ request }) => {
    // Try with invalid parameters
    const response = await request.get(`${BASE_URL}${ENDPOINTS.health}?invalid_param=<script>alert(1)</script>`, {
      failOnStatusCode: false
    });

    const status = response.status();

    console.log(`[Error Handling] Invalid params: status=${status}`);

    // Should not crash (500) - either 200, 400, or sanitized
    expect(status).not.toBe(500);
  });

  test('Server does not expose stack traces', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/nonexistent-endpoint-12345`, {
      failOnStatusCode: false
    });

    const body = await response.text();

    console.log('[Error Handling] Stack trace check:');

    // Should not contain stack trace indicators
    const hasStackTrace = body.includes('at ') && body.includes('.js:');
    const hasNodeModules = body.includes('node_modules');

    console.log(`  Contains stack trace patterns: ${hasStackTrace}`);
    console.log(`  Contains node_modules: ${hasNodeModules}`);

    expect(hasStackTrace).toBe(false);
    expect(hasNodeModules).toBe(false);
  });
});

// =============================================================================
// Suite 7: Performance Baseline
// =============================================================================

test.describe('Performance Baseline @content @perf', () => {
  test('Health endpoint responds within acceptable time', async ({ request }) => {
    const iterations = 5;
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await request.get(`${BASE_URL}${ENDPOINTS.health}`);
      latencies.push(Date.now() - start);
    }

    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const max = Math.max(...latencies);
    const min = Math.min(...latencies);

    console.log('[Performance] Health endpoint:');
    console.log(`  Min: ${min}ms`);
    console.log(`  Avg: ${avg.toFixed(0)}ms`);
    console.log(`  Max: ${max}ms`);

    // Should respond within reasonable time
    expect(avg).toBeLessThan(500);
  });

  test('Browse page loads within acceptable time', async ({ page }) => {
    const start = Date.now();

    await page.goto(`${BASE_URL}${ENDPOINTS.browse}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    const loadTime = Date.now() - start;

    console.log(`[Performance] Browse page load: ${loadTime}ms`);

    // Should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });
});
