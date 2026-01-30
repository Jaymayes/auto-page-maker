/**
 * Web Performance Metrics Collection
 * Tracks LCP, TTFB, and other Core Web Vitals for SEO performance monitoring
 * Enhanced with web-vitals library for Phase 2 baseline
 */

import { onCLS, onINP, onLCP, onFCP, onTTFB, type Metric } from 'web-vitals';

// Type definitions for Web Vitals
interface PerformanceMetric {
  name: string;
  value: number;
  delta: number;
  id: string;
  entries: PerformanceEntry[];
}

interface WebVitalsData {
  lcp?: number;
  fid?: number;
  cls?: number;
  ttfb?: number;
  fcp?: number;
  inp?: number;
  domContentLoaded?: number; // CEO directive: Track DOMContentLoaded
  pathname: string;
  userAgent: string;
  timestamp: number;
  pageType?: string;
  landingPageSlug?: string;
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  connectionType?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  screenResolution?: string;
  customMetrics?: {
    timeToContent?: number;
    scholarshipCardsCount?: number;
    hasH1?: boolean;
  };
  errors?: Array<{ // CEO directive: Error capture
    type: 'js' | 'network' | 'resource';
    message: string;
    timestamp: number;
    stack?: string;
    resource?: string;
  }>;
  cohort?: string; // CEO directive: Cohort tagging
  trafficSource?: string; // CEO directive: Traffic source tagging
}

// Performance metrics collection class
export class PerformanceTracker {
  private metrics: WebVitalsData = {
    pathname: window.location.pathname,
    userAgent: navigator.userAgent,
    timestamp: Date.now(),
    errors: []
  };

  private isLandingPage = false;
  private landingPageSlug?: string;
  private samplingRate = 0.15; // CEO directive: 10-20% sampling (using 15%)
  private shouldSample = Math.random() < this.samplingRate;

  constructor() {
    // Only track if sampled (CEO directive: 10-20% sampling)
    if (!this.shouldSample) {
      return;
    }

    this.detectDeviceType();
    this.detectConnectionType();
    this.detectCohortTags(); // CEO directive: Extract cohort tags
    this.initializeTracking();
    this.detectPageType();
    this.setupErrorTracking(); // CEO directive: Error capture
  }

  private detectDeviceType() {
    const ua = navigator.userAgent;
    const screenWidth = window.screen.width;
    
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      this.metrics.deviceType = 'tablet';
    } else if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
      this.metrics.deviceType = 'mobile';
    } else {
      this.metrics.deviceType = 'desktop';
    }
    
    this.metrics.screenResolution = `${window.screen.width}x${window.screen.height}`;
  }

  private detectConnectionType() {
    const nav = navigator as any;
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
    
    if (connection) {
      this.metrics.connectionType = connection.type || 'unknown';
      this.metrics.effectiveType = connection.effectiveType || 'unknown';
      this.metrics.downlink = connection.downlink;
      this.metrics.rtt = connection.rtt;
      this.metrics.saveData = connection.saveData || false;
    }
  }

  private detectCohortTags() {
    // CEO directive: Extract cohort tags from response headers
    // These are set by server middleware (cohort=phase1_d0-d3, traffic_source=beta)
    fetch('/api/health', { method: 'HEAD' })
      .then(response => {
        this.metrics.cohort = response.headers.get('X-Cohort-ID') || 'unknown';
        this.metrics.trafficSource = response.headers.get('X-Traffic-Source') || 'unknown';
      })
      .catch(() => {
        // Fallback if header fetch fails
        this.metrics.cohort = 'unknown';
        this.metrics.trafficSource = 'unknown';
      });
  }

  private setupErrorTracking() {
    // CEO directive: JavaScript error capture
    window.addEventListener('error', (event) => {
      this.metrics.errors?.push({
        type: 'js',
        message: event.message,
        timestamp: Date.now(),
        stack: event.error?.stack,
        resource: event.filename
      });
    });

    // CEO directive: Unhandled promise rejection capture
    window.addEventListener('unhandledrejection', (event) => {
      this.metrics.errors?.push({
        type: 'js',
        message: event.reason?.message || String(event.reason),
        timestamp: Date.now(),
        stack: event.reason?.stack
      });
    });

    // CEO directive: Network failure tracking
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        if (!response.ok) {
          this.metrics.errors?.push({
            type: 'network',
            message: `HTTP ${response.status} ${response.statusText}`,
            timestamp: Date.now(),
            resource: args[0] instanceof Request ? args[0].url : String(args[0])
          });
        }
        return response;
      } catch (error: any) {
        this.metrics.errors?.push({
          type: 'network',
          message: error.message || 'Network request failed',
          timestamp: Date.now(),
          resource: args[0] instanceof Request ? args[0].url : String(args[0])
        });
        throw error;
      }
    };

    // CEO directive: Resource loading errors (images, scripts, stylesheets)
    window.addEventListener('error', (event) => {
      if (event.target && event.target !== window) {
        const target = event.target as HTMLElement;
        this.metrics.errors?.push({
          type: 'resource',
          message: 'Failed to load resource',
          timestamp: Date.now(),
          resource: (target as any).src || (target as any).href || 'unknown'
        });
      }
    }, true);
  }

  private detectPageType() {
    const path = window.location.pathname;
    
    // Detect if this is a landing page
    if (path !== '/' && path !== '/get-started' && path !== '/get-matches' && !path.startsWith('/api/')) {
      this.isLandingPage = true;
      this.landingPageSlug = path.slice(1); // Remove leading slash
      this.metrics.pageType = 'landing-page';
      this.metrics.landingPageSlug = this.landingPageSlug;
    } else if (path === '/') {
      this.metrics.pageType = 'homepage';
    } else {
      this.metrics.pageType = 'static-page';
    }
  }

  private initializeTracking() {
    // Track TTFB (Time to First Byte)
    this.measureTTFB();
    
    // Track other Web Vitals when available
    this.measureWebVitals();
    
    // Enhanced web-vitals library tracking with console logging
    this.initializeWebVitalsLibrary();
    
    // Track custom landing page metrics
    if (this.isLandingPage) {
      this.trackLandingPageMetrics();
    }

    // Send metrics when page is about to unload
    window.addEventListener('beforeunload', () => {
      this.sendMetrics();
    });

    // Send metrics after a delay to ensure all measurements are captured
    setTimeout(() => {
      this.sendMetrics();
    }, 3000);
  }

  private initializeWebVitalsLibrary() {
    // Console logging for development
    const logMetric = (metric: Metric) => {
      const emoji = metric.rating === 'good' ? '✅' : metric.rating === 'needs-improvement' ? '⚠️' : '❌';
      const valueFormatted = metric.name === 'CLS' 
        ? metric.value.toFixed(4) 
        : `${Math.round(metric.value)}ms`;

      console.log(`${emoji} ${metric.name}: ${valueFormatted} (${metric.rating.toUpperCase()})`);
      
      // Update metrics object
      const key = metric.name.toLowerCase() as keyof WebVitalsData;
      (this.metrics as any)[key] = metric.value;
    };

    onCLS(logMetric);
    onINP(logMetric);
    onLCP(logMetric);
    onFCP(logMetric);
    onTTFB(logMetric);

    if (import.meta.env.DEV) {
      console.log('🎯 Web Vitals Monitoring Active - Targets: LCP < 2.5s, INP < 200ms, CLS < 0.1');
    }
  }

  private measureTTFB() {
    // Use Navigation Timing API to measure TTFB and DOMContentLoaded
    const perfEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (perfEntries.length > 0) {
      const navEntry = perfEntries[0];
      this.metrics.ttfb = navEntry.responseStart - navEntry.requestStart;
      // CEO directive: Track DOMContentLoaded timing
      this.metrics.domContentLoaded = navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart;
    }
  }

  private measureWebVitals() {
    // LCP (Largest Contentful Paint)
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.metrics.lcp = lastEntry.startTime;
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {
        console.warn('LCP measurement not supported');
      }

      // FCP (First Contentful Paint)
      try {
        const fcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length > 0) {
            this.metrics.fcp = entries[0].startTime;
          }
        });
        fcpObserver.observe({ entryTypes: ['paint'] });
      } catch (e) {
        console.warn('FCP measurement not supported');
      }

      // CLS (Cumulative Layout Shift)
      try {
        let clsScore = 0;
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            if (!entry.hadRecentInput) {
              clsScore += entry.value;
            }
          }
          this.metrics.cls = clsScore;
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (e) {
        console.warn('CLS measurement not supported');
      }
    }
  }

  private trackLandingPageMetrics() {
    // Track time to first meaningful content for landing pages
    const contentLoadTime = performance.now();
    
    // Wait for content to load then measure
    const checkContentLoaded = () => {
      const scholarshipCards = document.querySelectorAll('[data-testid*="card-scholarship"]');
      const headingElement = document.querySelector('h1');
      
      if (scholarshipCards.length > 0 && headingElement) {
        const timeToContent = performance.now() - contentLoadTime;
        this.metrics = {
          ...this.metrics,
          customMetrics: {
            timeToContent,
            scholarshipCardsCount: scholarshipCards.length,
            hasH1: !!headingElement
          }
        };
      } else {
        // Retry after a short delay
        setTimeout(checkContentLoaded, 100);
      }
    };
    
    setTimeout(checkContentLoaded, 100);
  }

  private async sendMetrics() {
    // Only send if sampled (CEO directive: 10-20% sampling)
    if (!this.shouldSample) {
      return;
    }

    try {
      // Send to our analytics endpoint
      await fetch('/api/analytics/performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(this.metrics),
        keepalive: true // Ensures request completes even if page unloads
      });
    } catch (error) {
      console.error('Failed to send performance metrics:', error);
    }
  }

  // Public method to get current metrics
  getMetrics(): WebVitalsData {
    return { ...this.metrics };
  }

  // Public method to manually trigger metrics sending
  flush() {
    this.sendMetrics();
  }
}

// Auto-initialize performance tracking
let performanceTracker: PerformanceTracker | null = null;

export function initializePerformanceTracking(): PerformanceTracker {
  if (typeof window !== 'undefined' && !performanceTracker) {
    performanceTracker = new PerformanceTracker();
  }
  return performanceTracker!;
}

export function getPerformanceTracker(): PerformanceTracker | null {
  return performanceTracker;
}