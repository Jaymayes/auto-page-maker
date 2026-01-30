/**
 * Client-side SEO event tracking
 * Tracks user interactions for conversion attribution and performance analysis
 */

export interface ConversionEvent {
  eventType: 'signup' | 'scholarship_save' | 'scholarship_apply' | 'contact_submit';
  landingPageSlug?: string;
  referrer?: string;
  utmSource?: string;
  performanceMetrics?: {
    lcp?: number;
    ttfb?: number;
    cls?: number;
  };
}

export class SEOTracker {
  private sessionId: string;
  private landingPageSlug?: string;
  private entryPerformance?: any;
  private utmParams: Record<string, string> = {};

  constructor() {
    this.sessionId = this.generateSessionId();
    this.detectLandingPage();
    this.trackEntryPerformance();
    this.captureAndPersistUtm();
  }

  private captureAndPersistUtm() {
    const urlParams = new URLSearchParams(window.location.search);
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    
    utmKeys.forEach(key => {
      const value = urlParams.get(key);
      if (value) {
        this.utmParams[key] = value;
      }
    });

    if (Object.keys(this.utmParams).length > 0) {
      try {
        const isSecure = window.location.protocol === 'https:';
        const secureFlag = isSecure ? '; Secure' : '';
        document.cookie = `_sm_utm=${encodeURIComponent(JSON.stringify(this.utmParams))}; path=/; max-age=2592000; SameSite=Lax${secureFlag}`;
        console.log('[SEO] UTM params captured and persisted:', this.utmParams);
      } catch (e) {
        console.error('[SEO] Failed to persist UTM:', e);
      }
    } else {
      const existingUtm = this.getUtmFromCookie();
      if (existingUtm) {
        this.utmParams = existingUtm;
        console.log('[SEO] UTM params restored from cookie:', this.utmParams);
      }
    }
  }

  private getUtmFromCookie(): Record<string, string> | null {
    try {
      const match = document.cookie.match(/(?:^|;\s*)_sm_utm=([^;]*)/);
      if (match && match[1]) {
        return JSON.parse(decodeURIComponent(match[1]));
      }
    } catch (e) {
      console.error('[SEO] Failed to parse UTM cookie:', e);
    }
    return null;
  }

  getUtmParams(): Record<string, string> {
    return { ...this.utmParams };
  }

  buildUtmQueryString(): string {
    const params = new URLSearchParams();
    Object.entries(this.utmParams).forEach(([key, value]) => {
      params.set(key, value);
    });
    return params.toString();
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private detectLandingPage() {
    const path = window.location.pathname;
    if (path !== '/' && path !== '/get-started' && path !== '/get-matches' && !path.startsWith('/api/')) {
      this.landingPageSlug = path.slice(1); // Remove leading slash
    }
  }

  private trackEntryPerformance() {
    setTimeout(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        this.entryPerformance = {
          ttfb: navigation.responseStart - navigation.requestStart,
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.startTime,
          loadComplete: navigation.loadEventEnd - navigation.startTime
        };
      }
    }, 1000);
  }

  /**
   * Track conversion events
   */
  async trackConversion(eventType: ConversionEvent['eventType'], additionalData?: any) {
    const event: ConversionEvent = {
      eventType,
      landingPageSlug: this.landingPageSlug,
      referrer: document.referrer,
      utmSource: this.getUtmSource(),
      performanceMetrics: this.entryPerformance
    };

    try {
      await fetch('/api/analytics/conversions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...event,
          sessionId: this.sessionId,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          additionalData
        })
      });

      console.log(`SEO Conversion tracked: ${eventType}`);
    } catch (error) {
      console.error('Failed to track conversion:', error);
    }
  }

  /**
   * Track scholarship-specific events
   */
  async trackScholarshipSave(scholarshipId: string) {
    await this.trackConversion('scholarship_save', { scholarshipId });
    
    // Also track with Google Analytics if available
    if (typeof (window as any).gtag !== 'undefined') {
      (window as any).gtag('event', 'scholarship_save', {
        event_category: 'engagement',
        event_label: this.landingPageSlug || 'direct',
        scholarship_id: scholarshipId
      });
    }
  }

  async trackScholarshipApplication(scholarshipId: string) {
    await this.trackConversion('scholarship_apply', { scholarshipId });
    
    if (typeof (window as any).gtag !== 'undefined') {
      (window as any).gtag('event', 'scholarship_apply', {
        event_category: 'conversion',
        event_label: this.landingPageSlug || 'direct',
        scholarship_id: scholarshipId,
        value: 100 // Estimated value of an application
      });
    }
  }

  async trackSignup(email?: string) {
    await this.trackConversion('signup', { email: email ? 'provided' : 'not_provided' });
    
    if (typeof (window as any).gtag !== 'undefined') {
      (window as any).gtag('event', 'sign_up', {
        event_category: 'conversion',
        event_label: this.landingPageSlug || 'direct',
        value: 50 // Estimated value of a signup
      });
    }
  }

  async trackContactSubmit(formType?: string) {
    await this.trackConversion('contact_submit', { formType });
    
    if (typeof (window as any).gtag !== 'undefined') {
      (window as any).gtag('event', 'form_submit', {
        event_category: 'engagement',
        event_label: this.landingPageSlug || 'direct',
        form_type: formType
      });
    }
  }

  /**
   * Track page engagement metrics
   */
  trackPageEngagement() {
    let startTime = Date.now();
    let maxScroll = 0;
    let interactionCount = 0;

    // Track scroll depth
    const handleScroll = () => {
      const scrollPercent = Math.round(
        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
      );
      maxScroll = Math.max(maxScroll, scrollPercent);
    };

    // Track interactions
    const handleInteraction = () => {
      interactionCount++;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('click', handleInteraction, { passive: true });
    window.addEventListener('touchstart', handleInteraction, { passive: true });

    // Send engagement data when leaving page
    window.addEventListener('beforeunload', () => {
      const timeOnPage = Date.now() - startTime;
      
      fetch('/api/analytics/engagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          landingPageSlug: this.landingPageSlug,
          timeOnPage,
          maxScrollPercent: maxScroll,
          interactionCount,
          timestamp: Date.now()
        }),
        keepalive: true
      }).catch(console.error);
    });
  }

  /**
   * Get UTM source from persisted params (cookie) or URL parameters
   */
  private getUtmSource(): string | undefined {
    return this.utmParams.utm_source || undefined;
  }

  /**
   * Track CTR from search engines
   */
  trackOrganicClick() {
    const referrer = document.referrer;
    const isFromSearch = referrer && (
      referrer.includes('google.com') ||
      referrer.includes('bing.com') ||
      referrer.includes('yahoo.com') ||
      referrer.includes('duckduckgo.com')
    );

    if (isFromSearch && this.landingPageSlug) {
      fetch('/api/analytics/organic-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          landingPageSlug: this.landingPageSlug,
          referrer,
          timestamp: Date.now(),
          sessionId: this.sessionId
        })
      }).catch(console.error);
    }
  }

  /**
   * Initialize all tracking
   */
  initialize() {
    this.trackPageEngagement();
    this.trackOrganicClick();
    
    // Track initial page view
    if (typeof (window as any).gtag !== 'undefined') {
      (window as any).gtag('event', 'page_view', {
        page_location: window.location.href,
        page_title: document.title,
        landing_page_slug: this.landingPageSlug,
        is_landing_page: !!this.landingPageSlug
      });
    }
  }
}

// Auto-initialize SEO tracking
let seoTracker: SEOTracker | null = null;

export function initializeSEOTracking(): SEOTracker {
  if (typeof window !== 'undefined' && !seoTracker) {
    seoTracker = new SEOTracker();
    seoTracker.initialize();
  }
  return seoTracker!;
}

export function getSEOTracker(): SEOTracker | null {
  return seoTracker;
}