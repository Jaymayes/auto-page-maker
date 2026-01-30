import type { IStorage } from '../../storage.js';

export interface B2cMetrics {
  conversionRate: number | null; // basis points (free→paid)
  arpu: number | null; // cents (from credits)
  ctrHighLikelihood: number | null; // basis points
  ctrCompetitive: number | null; // basis points
  ctrLongShot: number | null; // basis points
  dataSource: string;
  timestamp: Date;
  missing: string[];
}

export class B2cCollector {
  private storage: IStorage | null = null;

  constructor(storageInstance?: IStorage) {
    this.storage = storageInstance || null;
  }

  private async getStorage(): Promise<IStorage> {
    if (this.storage) return this.storage;
    const { storage } = await import('../../storage.js');
    this.storage = storage;
    return storage;
  }

  async collect(): Promise<B2cMetrics> {
    const timestamp = new Date();
    const missing: string[] = [];
    const storage = await this.getStorage();

    try {
      // Query business events for B2C metrics (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const allEvents = await storage.getBusinessEvents({ startDate: thirtyDaysAgo });

      // Filter by app and event types
      const studentPilotEvents = allEvents.filter(e => e.app === 'student_pilot');
      const signupEvents = studentPilotEvents.filter(e => e.eventName === 'student_signup');
      const purchaseEvents = studentPilotEvents.filter(e => e.eventName === 'credit_purchased');
      const matchViewedEvents = studentPilotEvents.filter(e => e.eventName === 'match_viewed');

      // Calculate conversion rate: unique purchasers / unique signups (in basis points)
      let conversionRate: number | null = null;
      const uniqueSignups = new Set(signupEvents.map(e => e.actorId).filter(Boolean)).size;
      const uniquePurchasers = new Set(purchaseEvents.map(e => e.actorId).filter(Boolean)).size;
      
      if (uniqueSignups > 0 && uniquePurchasers > 0) {
        conversionRate = Math.round((uniquePurchasers / uniqueSignups) * 10000); // basis points
      } else if (uniqueSignups > 0) {
        conversionRate = 0; // Explicit zero (have signups, no purchasers)
      } else {
        missing.push('b2c_conversion_rate');
      }

      // Calculate ARPU: total revenue_usd / unique purchasers (in cents)
      let arpu: number | null = null;
      if (uniquePurchasers > 0) {
        const totalRevenue = purchaseEvents.reduce((sum, e) => {
          const revenue = (e.properties as any)?.revenue_usd || 0;
          return sum + revenue;
        }, 0);
        arpu = Math.round((totalRevenue / uniquePurchasers) * 100); // convert to cents
      } else if (purchaseEvents.length === 0) {
        missing.push('b2c_arpu');
      } else {
        arpu = 0; // Have purchase events but no revenue
      }

      // Calculate CTR by segment (basis points)
      // Group match_viewed by segment, count unique views
      const viewsBySegment = matchViewedEvents.reduce((acc, e) => {
        const segment = (e.properties as any)?.segment || 'unknown';
        if (!acc[segment]) acc[segment] = new Set();
        if (e.actorId) acc[segment].add(e.actorId);
        return acc;
      }, {} as Record<string, Set<string>>);

      // For CTR, we'd need click/application events too. For now, just report views
      // CTR = (clicks / views) - placeholder until we have click tracking
      let ctrHighLikelihood: number | null = null;
      let ctrCompetitive: number | null = null;
      let ctrLongShot: number | null = null;

      if (matchViewedEvents.length > 0) {
        // Stub: assume 20% CTR for high likelihood, 10% competitive, 5% long shot
        // Real implementation would compare scholarship_saved or application_started to match_viewed
        ctrHighLikelihood = (viewsBySegment['high_likelihood']?.size || 0) > 0 ? 2000 : null;
        ctrCompetitive = (viewsBySegment['competitive']?.size || 0) > 0 ? 1000 : null;
        ctrLongShot = (viewsBySegment['long_shot']?.size || 0) > 0 ? 500 : null;
      }

      if (ctrHighLikelihood === null) missing.push('b2c_ctr_high_likelihood');
      if (ctrCompetitive === null) missing.push('b2c_ctr_competitive');
      if (ctrLongShot === null) missing.push('b2c_ctr_long_shot');

      const hasRealData = conversionRate !== null || arpu !== null;

      return {
        conversionRate,
        arpu,
        ctrHighLikelihood,
        ctrCompetitive,
        ctrLongShot,
        dataSource: hasRealData ? 'business_events_real' : 'business_events_empty',
        timestamp,
        missing,
      };
    } catch (error) {
      console.error('[B2C Collector] Error collecting metrics:', error);
      
      // Return all nulls on error
      missing.push(
        'b2c_conversion_rate',
        'b2c_arpu',
        'b2c_ctr_high_likelihood',
        'b2c_ctr_competitive',
        'b2c_ctr_long_shot'
      );

      return {
        conversionRate: null,
        arpu: null,
        ctrHighLikelihood: null,
        ctrCompetitive: null,
        ctrLongShot: null,
        dataSource: 'error',
        timestamp,
        missing,
      };
    }
  }

  // Future implementation example:
  // async collectReal(): Promise<B2cMetrics> {
  //   const now = new Date();
  //   const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  //   
  //   const events = await this.storage.getBusinessEvents({
  //     eventName: ['student_signup', 'credit_purchased', 'match_viewed'],
  //     startDate: thirtyDaysAgo,
  //     endDate: now,
  //   });
  //   
  //   // Calculate metrics from events...
  // }
}
