import { storage } from '../storage.js';

interface KPIEvent {
  eventType: 'organic_session' | 'match_click_through' | 'application_start' | 'credit_spend';
  userId?: string;
  sessionId?: string;
  scholarshipId?: string;
  metadata?: Record<string, any>;
  creditAmount?: number;
  timestamp: Date;
}

interface KPIMetrics {
  organicSessions: number;
  matchClickThroughs: number;
  applicationStarts: number;
  totalCreditSpend: number;
  arpu: number; // Average Revenue Per User (credit spend / unique users)
}

export class KPITracker {
  private events: KPIEvent[] = [];
  private readonly MAX_EVENTS_IN_MEMORY = 1000;

  /**
   * Track an organic session (user arrives via search engine)
   */
  async trackOrganicSession(sessionId: string, userId?: string, metadata?: Record<string, any>): Promise<void> {
    const event: KPIEvent = {
      eventType: 'organic_session',
      sessionId,
      userId,
      metadata: {
        ...metadata,
        source: metadata?.utm_source || 'organic',
        campaign: metadata?.utm_campaign,
        landingPage: metadata?.landing_page,
      },
      timestamp: new Date(),
    };

    this.recordEvent(event);
    console.log('[KPI] Organic session tracked:', { sessionId, userId });
  }

  /**
   * Track match click-through (user clicks on a scholarship match)
   */
  async trackMatchClickThrough(scholarshipId: string, userId?: string, sessionId?: string): Promise<void> {
    const event: KPIEvent = {
      eventType: 'match_click_through',
      scholarshipId,
      userId,
      sessionId,
      timestamp: new Date(),
    };

    this.recordEvent(event);
    console.log('[KPI] Match click-through tracked:', { scholarshipId, userId });
  }

  /**
   * Track application start (user begins scholarship application)
   */
  async trackApplicationStart(scholarshipId: string, userId?: string, sessionId?: string): Promise<void> {
    const event: KPIEvent = {
      eventType: 'application_start',
      scholarshipId,
      userId,
      sessionId,
      timestamp: new Date(),
    };

    this.recordEvent(event);
    console.log('[KPI] Application start tracked:', { scholarshipId, userId });
  }

  /**
   * Track credit spend (user consumes AI credits for essay analysis, etc.)
   */
  async trackCreditSpend(userId: string, creditAmount: number, sessionId?: string, metadata?: Record<string, any>): Promise<void> {
    const event: KPIEvent = {
      eventType: 'credit_spend',
      userId,
      sessionId,
      creditAmount,
      metadata: {
        ...metadata,
        feature: metadata?.feature || 'unknown',
        model: metadata?.model,
      },
      timestamp: new Date(),
    };

    this.recordEvent(event);
    console.log('[KPI] Credit spend tracked:', { userId, creditAmount, feature: metadata?.feature });
  }

  /**
   * Record event to in-memory buffer (could be persisted to DB in production)
   */
  private recordEvent(event: KPIEvent): void {
    this.events.push(event);

    // Keep only recent events in memory to prevent memory leaks
    if (this.events.length > this.MAX_EVENTS_IN_MEMORY) {
      this.events.shift();
    }
  }

  /**
   * Get KPI metrics for a given time period
   */
  async getMetrics(startDate?: Date, endDate?: Date): Promise<KPIMetrics> {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
    const end = endDate || new Date();

    const filteredEvents = this.events.filter(e => 
      e.timestamp >= start && e.timestamp <= end
    );

    const organicSessions = filteredEvents.filter(e => e.eventType === 'organic_session').length;
    const matchClickThroughs = filteredEvents.filter(e => e.eventType === 'match_click_through').length;
    const applicationStarts = filteredEvents.filter(e => e.eventType === 'application_start').length;
    const totalCreditSpend = filteredEvents
      .filter(e => e.eventType === 'credit_spend')
      .reduce((sum, e) => sum + (e.creditAmount || 0), 0);

    // Calculate ARPU (Average Revenue Per User)
    const uniqueUsers = new Set(
      filteredEvents
        .filter(e => e.userId)
        .map(e => e.userId!)
    ).size;

    const arpu = uniqueUsers > 0 ? totalCreditSpend / uniqueUsers : 0;

    return {
      organicSessions,
      matchClickThroughs,
      applicationStarts,
      totalCreditSpend,
      arpu: Math.round(arpu * 100) / 100, // Round to 2 decimal places
    };
  }

  /**
   * Get conversion funnel metrics
   */
  async getFunnelMetrics(startDate?: Date, endDate?: Date): Promise<{
    sessions: number;
    clickThroughs: number;
    applications: number;
    clickThroughRate: number;
    applicationRate: number;
  }> {
    const metrics = await this.getMetrics(startDate, endDate);

    const clickThroughRate = metrics.organicSessions > 0 
      ? (metrics.matchClickThroughs / metrics.organicSessions) * 100 
      : 0;

    const applicationRate = metrics.matchClickThroughs > 0 
      ? (metrics.applicationStarts / metrics.matchClickThroughs) * 100 
      : 0;

    return {
      sessions: metrics.organicSessions,
      clickThroughs: metrics.matchClickThroughs,
      applications: metrics.applicationStarts,
      clickThroughRate: Math.round(clickThroughRate * 100) / 100,
      applicationRate: Math.round(applicationRate * 100) / 100,
    };
  }

  /**
   * Get real-time event count
   */
  getEventCount(): number {
    return this.events.length;
  }

  /**
   * Clear all events (for testing)
   */
  clearEvents(): void {
    this.events = [];
    console.log('[KPI] Events cleared');
  }
}

// Singleton instance
export const kpiTracker = new KPITracker();
