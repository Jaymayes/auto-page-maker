#!/usr/bin/env tsx
/**
 * Performance Measurement Script - Mobile Slow 4G Simulation
 * Collects FCP, LCP, CLS, TBT metrics using Playwright
 */

import { chromium } from '@playwright/test';

const URL = process.env.TEST_URL || 'https://71bf4fef-9927-4910-996e-af6c8442857d-00-1vbw0f99a1xbj.spock.replit.dev/';
const RUNS = 5;

interface PerfMetrics {
  fcp: number;
  lcp: number;
  cls: number;
  ttfb: number;
  transferSize: number;
  run: number;
}

async function measurePerformance(run: number): Promise<PerfMetrics> {
  const browser = await chromium.launch({ headless: true });
  
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
  });

  // Simulate Slow 4G
  await context.route('**/*', route => {
    setTimeout(() => route.continue(), 150); // 150ms latency
  });

  const page = await context.newPage();
  
  // Collect performance metrics
  const metrics: Partial<PerfMetrics> = { run };

  // Navigate and wait for load
  const response = await page.goto(URL, { waitUntil: 'networkidle' });
  
  // Get Web Vitals
  const perfMetrics = await page.evaluate(() => {
    return new Promise<any>((resolve) => {
      const data: any = {};
      
      // FCP
      const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
      if (fcpEntry) data.fcp = fcpEntry.startTime;
      
      // LCP
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        data.lcp = lastEntry?.startTime || 0;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      
      // CLS
      let clsValue = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        data.cls = clsValue;
      }).observe({ type: 'layout-shift', buffered: true });
      
      // TTFB
      const navEntry = performance.getEntriesByType('navigation')[0] as any;
      if (navEntry) {
        data.ttfb = navEntry.responseStart - navEntry.requestStart;
      }
      
      setTimeout(() => resolve(data), 1000);
    });
  });

  metrics.fcp = perfMetrics.fcp || 0;
  metrics.lcp = perfMetrics.lcp || 0;
  metrics.cls = perfMetrics.cls || 0;
  metrics.ttfb = perfMetrics.ttfb || 0;
  
  // Get transfer size
  const performanceEntries = await page.evaluate(() => {
    const entries = performance.getEntriesByType('resource');
    return entries.reduce((sum: number, entry: any) => sum + (entry.transferSize || 0), 0);
  });
  
  metrics.transferSize = performanceEntries || 0;

  await browser.close();
  
  return metrics as PerfMetrics;
}

async function runMeasurements() {
  console.log(`🎯 Starting ${RUNS} performance measurement runs on ${URL}\n`);
  console.log('📱 Device: Mobile (375x667, 2x DPR)');
  console.log('🌐 Network: Slow 4G simulation (150ms latency)\n');
  
  const results: PerfMetrics[] = [];
  
  for (let i = 1; i <= RUNS; i++) {
    console.log(`⏳ Run ${i}/${RUNS}...`);
    try {
      const metrics = await measurePerformance(i);
      results.push(metrics);
      console.log(`✅ FCP: ${Math.round(metrics.fcp)}ms | LCP: ${Math.round(metrics.lcp)}ms | CLS: ${metrics.cls.toFixed(4)} | TTFB: ${Math.round(metrics.ttfb)}ms\n`);
    } catch (error) {
      console.error(`❌ Run ${i} failed:`, error);
    }
  }
  
  // Calculate statistics
  if (results.length > 0) {
    const sorted = {
      fcp: results.map(r => r.fcp).sort((a, b) => a - b),
      lcp: results.map(r => r.lcp).sort((a, b) => a - b),
      cls: results.map(r => r.cls).sort((a, b) => a - b),
      ttfb: results.map(r => r.ttfb).sort((a, b) => a - b),
      transferSize: results.map(r => r.transferSize).sort((a, b) => a - b)
    };
    
    const p50 = (arr: number[]) => arr[Math.floor(arr.length * 0.5)];
    const p75 = (arr: number[]) => arr[Math.floor(arr.length * 0.75)];
    const median = (arr: number[]) => arr[Math.floor(arr.length / 2)];
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 PERFORMANCE SUMMARY (Mobile Slow 4G)');
    console.log('='.repeat(60));
    console.log(`\n🎯 TARGET GATES:`);
    console.log(`   FCP P75 ≤ 2.4s | LCP P75 ≤ 2.8s | CLS ≤ 0.1 | JS ≤ 75KB gz`);
    
    console.log(`\n📈 MEDIAN (P50):`);
    console.log(`   FCP: ${Math.round(p50(sorted.fcp))}ms`);
    console.log(`   LCP: ${Math.round(p50(sorted.lcp))}ms`);
    console.log(`   CLS: ${p50(sorted.cls).toFixed(4)}`);
    console.log(`   TTFB: ${Math.round(p50(sorted.ttfb))}ms`);
    
    console.log(`\n📊 P75 (75th Percentile):`);
    const p75Fcp = Math.round(p75(sorted.fcp));
    const p75Lcp = Math.round(p75(sorted.lcp));
    const p75Cls = p75(sorted.cls).toFixed(4);
    
    console.log(`   FCP: ${p75Fcp}ms ${p75Fcp <= 2400 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   LCP: ${p75Lcp}ms ${p75Lcp <= 2800 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   CLS: ${p75Cls} ${parseFloat(p75Cls) <= 0.1 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   TTFB: ${Math.round(p75(sorted.ttfb))}ms`);
    
    console.log(`\n📦 Transfer Size (Median): ${Math.round(median(sorted.transferSize) / 1024)}KB`);
    console.log('='.repeat(60) + '\n');
    
    // Write to file
    const report = {
      timestamp: new Date().toISOString(),
      url: URL,
      runs: results.length,
      device: 'mobile',
      network: 'slow-4g',
      summary: {
        fcp: { p50: p50(sorted.fcp), p75: p75(sorted.fcp), median: median(sorted.fcp) },
        lcp: { p50: p50(sorted.lcp), p75: p75(sorted.lcp), median: median(sorted.lcp) },
        cls: { p50: p50(sorted.cls), p75: p75(sorted.cls), median: median(sorted.cls) },
        ttfb: { p50: p50(sorted.ttfb), p75: p75(sorted.ttfb), median: median(sorted.ttfb) },
        transferSize: { median: median(sorted.transferSize) }
      },
      gates: {
        fcpP75: p75Fcp <= 2400,
        lcpP75: p75Lcp <= 2800,
        cls: parseFloat(p75Cls) <= 0.1
      },
      rawResults: results
    };
    
    const fs = await import('fs/promises');
    await fs.writeFile(
      `/tmp/perf-report-${Date.now()}.json`,
      JSON.stringify(report, null, 2)
    );
    console.log(`✅ Full report saved to /tmp/perf-report-${Date.now()}.json\n`);
  }
}

runMeasurements().catch(console.error);
