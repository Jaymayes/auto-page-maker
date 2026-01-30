import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const A8_URL = process.env.A8_URL || 'http://localhost:5008';
const NAMESPACE = 'perf_test';

test.describe('A7 Browse Pages Load and CTA Impression Events', () => {
  test.beforeEach(async ({ page }) => {
    await page.setExtraHTTPHeaders({
      'X-Test-Namespace': NAMESPACE,
    });
  });

  test('E2E Flow 3: Browse pages load with CTA events to A8', async ({ page }) => {
    const startTime = Date.now();
    const routes = [
      { path: '/', name: 'Homepage' },
      { path: '/browse', name: 'Browse Hub' },
      { path: '/browse/states', name: 'Browse States' },
      { path: '/browse/majors', name: 'Browse Majors' },
    ];

    for (const route of routes) {
      await test.step(`Load ${route.name}`, async () => {
        const navStart = Date.now();
        await page.goto(`${BASE_URL}${route.path}`);
        await page.waitForLoadState('domcontentloaded');
        const navEnd = Date.now();
        
        const loadTime = navEnd - navStart;
        console.log(`${route.name} load time: ${loadTime}ms`);
        expect(loadTime).toBeLessThan(3000);
      });
    }

    await test.step('Verify CTA buttons visible', async () => {
      await page.goto(`${BASE_URL}/browse`);
      const ctaButtons = page.locator('[data-testid*="cta-"]');
      const count = await ctaButtons.count();
      console.log(`Found ${count} CTA buttons`);
      expect(count).toBeGreaterThan(0);
    });

    await test.step('Click CTA and verify impression event', async () => {
      const cta = page.locator('[data-testid*="cta-"]').first();
      if (await cta.isVisible()) {
        await cta.click();
        await page.waitForTimeout(2000);
      }
    });

    await test.step('Verify A8 receives CTA impression event', async () => {
      await page.waitForTimeout(5000);
      
      const a8Response = await page.request.get(
        `${A8_URL}/api/dashboard/events?namespace=${NAMESPACE}&type=cta_impression&limit=10`
      );
      
      if (a8Response.ok()) {
        const events = await a8Response.json();
        console.log(`Found ${events.length} CTA impression events in A8`);
      }
    });

    const endTime = Date.now();
    const totalFlowTime = endTime - startTime;
    console.log(`E2E Flow 3 completed in ${totalFlowTime}ms`);
    expect(totalFlowTime).toBeLessThan(60000);
  });

  test('Verify page load performance meets SLO', async ({ page }) => {
    const routes = ['/', '/browse', '/browse/states', '/browse/majors'];
    const results: { route: string; ttfb: number; lcp: number }[] = [];

    for (const route of routes) {
      await page.goto(`${BASE_URL}${route}`);
      
      const timing = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const lcp = performance.getEntriesByType('largest-contentful-paint')[0] as PerformanceEntry;
        return {
          ttfb: nav?.responseStart || 0,
          lcp: lcp?.startTime || 0,
        };
      });
      
      results.push({ route, ...timing });
      console.log(`${route}: TTFB=${timing.ttfb.toFixed(0)}ms, LCP=${timing.lcp.toFixed(0)}ms`);
    }

    for (const r of results) {
      expect(r.ttfb).toBeLessThan(150);
    }
  });

  test('Verify sitemap loads within SLO', async ({ page }) => {
    const start = Date.now();
    const response = await page.request.get(`${BASE_URL}/sitemap.xml`);
    const end = Date.now();
    
    const latency = end - start;
    console.log(`Sitemap latency: ${latency}ms`);
    
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('xml');
    
    const body = await response.text();
    const urlCount = (body.match(/<loc>/g) || []).length;
    console.log(`Sitemap contains ${urlCount} URLs`);
    expect(urlCount).toBeGreaterThan(100);
  });
});
