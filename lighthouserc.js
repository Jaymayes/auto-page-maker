// Lighthouse CI Configuration for ScholarMatch Platform
// Performance budgets aligned with Phase 2 acceptance criteria

module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run build && npm run preview',
      startServerReadyPattern: 'Local:',
      startServerReadyTimeout: 60000,
      url: [
        'http://localhost:4173/',
        'http://localhost:4173/scholarships/computer-science-texas',
        'http://localhost:4173/scholarships/nursing-california',
        'http://localhost:4173/scholarships/engineering-florida'
      ],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1
        },
        screenEmulation: {
          mobile: false,
          width: 1350,
          height: 940,
          deviceScaleFactor: 1,
          disabled: false
        }
      }
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.85 }],
        'categories:accessibility': ['warn', { minScore: 0.90 }],
        'categories:best-practices': ['warn', { minScore: 0.85 }],
        'categories:seo': ['error', { minScore: 0.90 }],
        
        // Core Web Vitals - Phase 2 targets
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }], // LCP < 2.5s
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],   // CLS < 0.1
        'total-blocking-time': ['error', { maxNumericValue: 200 }],       // TBT < 200ms
        'first-contentful-paint': ['warn', { maxNumericValue: 1800 }],    // FCP < 1.8s
        'time-to-first-byte': ['warn', { maxNumericValue: 600 }],         // TTFB < 600ms
        'interactive': ['warn', { maxNumericValue: 3800 }],                // TTI < 3.8s
        'speed-index': ['warn', { maxNumericValue: 3400 }],                // SI < 3.4s
        
        // Resource budgets
        'resource-summary:script:size': ['warn', { maxNumericValue: 350000 }], // JS < 350KB
        'resource-summary:stylesheet:size': ['warn', { maxNumericValue: 50000 }], // CSS < 50KB
        'resource-summary:image:size': ['warn', { maxNumericValue: 500000 }], // Images < 500KB
        'resource-summary:font:size': ['warn', { maxNumericValue: 100000 }], // Fonts < 100KB
        'resource-summary:total:size': ['warn', { maxNumericValue: 1000000 }], // Total < 1MB
        
        // Best practices
        'errors-in-console': ['warn', { maxNumericValue: 2 }],
        'uses-responsive-images': 'warn',
        'offscreen-images': 'warn',
        'uses-optimized-images': 'warn',
        'modern-image-formats': 'warn',
        'uses-text-compression': 'error',
        'uses-rel-preconnect': 'warn',
        'font-display': 'warn',
        'unminified-javascript': 'error',
        'unminified-css': 'error'
      }
    },
    upload: {
      target: 'temporary-public-storage',
      reportFilenamePattern: 'lighthouse-%%PATHNAME%%-%%DATETIME%%.html'
    }
  }
};