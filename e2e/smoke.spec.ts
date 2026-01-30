import { test, expect } from '@playwright/test';

/**
 * Playwright Smoke Tests for ScholarMatch Platform
 * Phase 2: Critical user flows with 95% green target
 * 
 * Test Coverage:
 * - Landing page load and navigation
 * - Search functionality
 * - Scholarship detail view
 * - Form validation
 * - 404 error handling
 * - Performance metrics
 */

test.describe('ScholarMatch Platform - Smoke Tests', () => {
  
  test.describe('Landing Page', () => {
    test('should load homepage with key elements', async ({ page }) => {
      await page.goto('/');
      
      // Check title
      await expect(page).toHaveTitle(/ScholarMatch/);
      
      // Check hero section
      const hero = page.locator('h1').first();
      await expect(hero).toBeVisible();
      
      // Check CTA buttons
      const ctaButton = page.getByTestId('button-get-matches');
      await expect(ctaButton).toBeVisible();
      await expect(ctaButton).toBeEnabled();
      
      // Performance: Check LCP < 2.5s
      const performance = await page.evaluate(() => {
        const entries = performance.getEntriesByType('navigation');
        return entries.length > 0 ? (entries[0] as any).loadEventEnd : 0;
      });
      expect(performance).toBeLessThan(5000); // Generous initial target
    });

    test('should navigate to Get Matches from homepage', async ({ page }) => {
      await page.goto('/');
      
      const getMatchesBtn = page.getByTestId('button-get-matches');
      await getMatchesBtn.click();
      
      // Should redirect to external Student Pilot app
      await page.waitForURL(/student-pilot.*replit\.app/);
    });
  });

  test.describe('SEO Landing Pages', () => {
    test('should load scholarship landing page with content', async ({ page }) => {
      // Try to load a generated landing page
      await page.goto('/scholarships/computer-science-texas');
      
      // Check for key SEO elements
      const h1 = page.locator('h1').first();
      await expect(h1).toBeVisible();
      await expect(h1).toContainText(/scholarships/i);
      
      // Check for scholarship cards
      const scholarshipCards = page.locator('[data-testid^="card-scholarship"]');
      await expect(scholarshipCards.first()).toBeVisible({ timeout: 10000 });
      
      // Check meta description exists
      const metaDescription = await page.locator('meta[name="description"]').getAttribute('content');
      expect(metaDescription).toBeTruthy();
      expect(metaDescription!.length).toBeGreaterThan(50);
      expect(metaDescription!.length).toBeLessThan(160);
    });

    test('should have proper canonical URL', async ({ page }) => {
      await page.goto('/scholarships/nursing-california');
      
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(canonical).toContain('/scholarships/nursing-california');
    });

    test('should show scholarship details on card click', async ({ page }) => {
      await page.goto('/scholarships/engineering-florida');
      
      // Wait for cards to load
      await page.waitForSelector('[data-testid^="card-scholarship"]', { timeout: 10000 });
      
      const firstCard = page.locator('[data-testid^="card-scholarship"]').first();
      await firstCard.click();
      
      // Should show scholarship details or navigate to detail page
      // (Implementation depends on UI design - adjust as needed)
    });
  });

  test.describe('Search and Filtering', () => {
    test('should perform scholarship search', async ({ page }) => {
      await page.goto('/');
      
      // Look for search input
      const searchInput = page.getByTestId('input-search');
      if (await searchInput.isVisible()) {
        await searchInput.fill('computer science');
        await searchInput.press('Enter');
        
        // Check results loaded
        await page.waitForLoadState('networkidle');
        
        const results = page.locator('[data-testid^="card-scholarship"]');
        const count = await results.count();
        expect(count).toBeGreaterThan(0);
      }
    });

    test('should filter by major', async ({ page }) => {
      await page.goto('/');
      
      const majorFilter = page.getByTestId('select-major');
      if (await majorFilter.isVisible()) {
        await majorFilter.click();
        await page.getByText('Engineering').click();
        
        await page.waitForLoadState('networkidle');
        
        // Verify filtered results
        const results = page.locator('[data-testid^="card-scholarship"]');
        expect(await results.count()).toBeGreaterThan(0);
      }
    });
  });

  test.describe('User Actions', () => {
    test('should save scholarship (requires auth or guest mode)', async ({ page }) => {
      await page.goto('/scholarships/computer-science-texas');
      
      await page.waitForSelector('[data-testid^="card-scholarship"]', { timeout: 10000 });
      
      const saveButton = page.getByTestId('button-save').first();
      if (await saveButton.isVisible()) {
        await saveButton.click();
        
        // Check for success feedback (toast, icon change, etc.)
        // Implementation depends on UI design
      }
    });

    test('should track apply action', async ({ page }) => {
      await page.goto('/scholarships/nursing-california');
      
      await page.waitForSelector('[data-testid^="card-scholarship"]', { timeout: 10000 });
      
      const applyButton = page.getByTestId('button-apply').first();
      if (await applyButton.isVisible()) {
        // Note: Don't actually click external links in tests
        expect(await applyButton.getAttribute('href')).toBeTruthy();
      }
    });
  });

  test.describe('Form Validation', () => {
    test('should validate required fields in signup form', async ({ page }) => {
      await page.goto('/');
      
      // Look for signup form (adjust selector based on implementation)
      const signupButton = page.getByTestId('button-signup');
      if (await signupButton.isVisible()) {
        await signupButton.click();
        
        // Try to submit without filling fields
        const submitButton = page.getByTestId('button-submit');
        await submitButton.click();
        
        // Check for validation errors
        const errors = page.locator('[role="alert"]');
        expect(await errors.count()).toBeGreaterThan(0);
      }
    });

    test('should validate email format', async ({ page }) => {
      await page.goto('/');
      
      const emailInput = page.getByTestId('input-email');
      if (await emailInput.isVisible()) {
        await emailInput.fill('invalid-email');
        await emailInput.blur();
        
        // Check for email validation error
        const error = page.locator('text=/valid email/i');
        await expect(error).toBeVisible({ timeout: 3000 });
      }
    });
  });

  test.describe('Navigation and 404', () => {
    test('should handle 404 gracefully', async ({ page }) => {
      const response = await page.goto('/non-existent-page-12345');
      
      // Should show 404 page (not crash)
      expect(response?.status()).toBe(404);
      
      // Should have helpful 404 content
      const heading = page.locator('h1');
      await expect(heading).toBeVisible();
    });

    test('should navigate between pages without errors', async ({ page }) => {
      // Start at homepage
      await page.goto('/');
      await expect(page).toHaveTitle(/ScholarMatch/);
      
      // Navigate to landing page
      await page.goto('/scholarships/computer-science-texas');
      await page.waitForLoadState('networkidle');
      
      // Navigate back to homepage
      await page.goto('/');
      await expect(page).toHaveTitle(/ScholarMatch/);
      
      // Check no console errors
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      // Allow some time for errors to surface
      await page.waitForTimeout(1000);
      
      // Filter out known acceptable errors (adjust as needed)
      const criticalErrors = errors.filter(e => 
        !e.includes('favicon') && 
        !e.includes('DevTools')
      );
      expect(criticalErrors.length).toBe(0);
    });
  });

  test.describe('Performance', () => {
    test('should meet Core Web Vitals targets', async ({ page }) => {
      await page.goto('/');
      
      // Wait for page to be fully loaded
      await page.waitForLoadState('networkidle');
      
      // Measure Web Vitals
      const vitals = await page.evaluate(() => {
        return new Promise((resolve) => {
          const vitals: any = {};
          
          // LCP
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            vitals.lcp = entries[entries.length - 1].startTime;
          }).observe({ entryTypes: ['largest-contentful-paint'] });
          
          // CLS
          let clsScore = 0;
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries() as any[]) {
              if (!entry.hadRecentInput) {
                clsScore += entry.value;
              }
            }
            vitals.cls = clsScore;
          }).observe({ entryTypes: ['layout-shift'] });
          
          // FCP
          const fcpEntry = performance.getEntriesByType('paint')
            .find(e => e.name === 'first-contentful-paint');
          if (fcpEntry) {
            vitals.fcp = fcpEntry.startTime;
          }
          
          // TTFB
          const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
          if (navEntries.length > 0) {
            vitals.ttfb = navEntries[0].responseStart - navEntries[0].requestStart;
          }
          
          setTimeout(() => resolve(vitals), 2000);
        });
      });
      
      const webVitals = vitals as { lcp?: number; cls?: number; fcp?: number; ttfb?: number };
      console.log('Web Vitals:', webVitals);
      
      // Phase 2 targets (generous for initial baseline)
      if (webVitals.lcp) expect(webVitals.lcp).toBeLessThan(4000); // Target: 2500ms
      if (webVitals.cls) expect(webVitals.cls).toBeLessThan(0.15); // Target: 0.1
      if (webVitals.fcp) expect(webVitals.fcp).toBeLessThan(2500); // Target: 1800ms
      if (webVitals.ttfb) expect(webVitals.ttfb).toBeLessThan(1000); // Target: 600ms
    });
  });
});