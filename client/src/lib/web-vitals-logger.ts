// Enhanced Web Vitals Logging for Local Profiling
// Phase 2: Real-time performance monitoring with console output

import { onCLS, onINP, onLCP, onFCP, onTTFB, type Metric } from 'web-vitals';

interface WebVitalsLog {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
}

// Rating thresholds based on Core Web Vitals (INP replaces FID in web-vitals v3)
const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },
  INP: { good: 200, poor: 500 },  // Interaction to Next Paint
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 }
};

function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[name as keyof typeof THRESHOLDS];
  if (!threshold) return 'good';
  
  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

function getEmojiForRating(rating: string): string {
  switch (rating) {
    case 'good': return '✅';
    case 'needs-improvement': return '⚠️';
    case 'poor': return '❌';
    default: return '📊';
  }
}

function logMetric(metric: Metric) {
  const log: WebVitalsLog = {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType
  };

  const emoji = getEmojiForRating(log.rating);
  const valueFormatted = log.name === 'CLS' 
    ? log.value.toFixed(4) 
    : `${Math.round(log.value)}ms`;

  console.group(`${emoji} Web Vital: ${log.name}`);
  console.log(`Value: ${valueFormatted}`);
  console.log(`Rating: ${log.rating.toUpperCase()}`);
  console.log(`Delta: ${log.delta.toFixed(2)}`);
  console.log(`Navigation: ${log.navigationType}`);
  console.log(`ID: ${log.id}`);
  
  // Show threshold guidance
  const threshold = THRESHOLDS[log.name as keyof typeof THRESHOLDS];
  if (threshold) {
    console.log(`Target: ${log.name === 'CLS' ? threshold.good : threshold.good + 'ms'} (good), ${log.name === 'CLS' ? threshold.poor : threshold.poor + 'ms'} (poor)`);
  }
  
  console.groupEnd();

  // Also send to analytics if available
  if (window.gtag) {
    window.gtag('event', log.name, {
      event_category: 'Web Vitals',
      event_label: log.id,
      value: Math.round(log.value),
      rating: log.rating,
      non_interaction: true
    });
  }
}

// Initialize Web Vitals monitoring with console logging
export function initWebVitalsLogging() {
  if (import.meta.env.DEV) {
    console.log('🎯 Web Vitals Monitoring Active - Performance metrics will be logged to console');
    console.log('Targets: LCP < 2.5s, INP < 200ms, CLS < 0.1, FCP < 1.8s, TTFB < 800ms');
  }

  onCLS(logMetric);
  onINP(logMetric);
  onLCP(logMetric);
  onFCP(logMetric);
  onTTFB(logMetric);
}

// Export performance summary for debugging
export function getPerformanceSummary(): Record<string, any> {
  if (typeof window === 'undefined' || !window.performance) {
    return { error: 'Performance API not available' };
  }

  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  const paint = performance.getEntriesByType('paint');
  
  return {
    navigation: {
      domContentLoaded: nav?.domContentLoadedEventEnd - nav?.domContentLoadedEventStart,
      loadComplete: nav?.loadEventEnd - nav?.loadEventStart,
      domInteractive: nav?.domInteractive - nav?.fetchStart,
      redirectTime: nav?.redirectEnd - nav?.redirectStart,
      dnsTime: nav?.domainLookupEnd - nav?.domainLookupStart,
      connectTime: nav?.connectEnd - nav?.connectStart,
      requestTime: nav?.responseStart - nav?.requestStart,
      responseTime: nav?.responseEnd - nav?.responseStart,
      renderTime: nav?.loadEventEnd - nav?.responseEnd
    },
    paint: {
      firstPaint: paint.find(p => p.name === 'first-paint')?.startTime,
      firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime
    },
    resources: {
      count: performance.getEntriesByType('resource').length,
      totalSize: performance.getEntriesByType('resource').reduce((acc: number, r: any) => acc + (r.transferSize || 0), 0),
      scripts: performance.getEntriesByType('resource').filter((r: any) => r.initiatorType === 'script').length,
      images: performance.getEntriesByType('resource').filter((r: any) => r.initiatorType === 'img').length,
      css: performance.getEntriesByType('resource').filter((r: any) => r.initiatorType === 'link' && r.name.includes('.css')).length
    },
    memory: (performance as any).memory ? {
      usedJSHeapSize: Math.round((performance as any).memory.usedJSHeapSize / 1048576) + 'MB',
      totalJSHeapSize: Math.round((performance as any).memory.totalJSHeapSize / 1048576) + 'MB',
      jsHeapSizeLimit: Math.round((performance as any).memory.jsHeapSizeLimit / 1048576) + 'MB'
    } : null
  };
}

// Export to window for console access
if (typeof window !== 'undefined') {
  (window as any).getPerformanceSummary = getPerformanceSummary;
}