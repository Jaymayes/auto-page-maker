import type { IStorage } from '../../storage.js';

export interface B2bMetrics {
  activeProviders: number | null;
  revenue: number | null; // cents from 3% fee
  topDecileConcentration: number | null; // basis points
  dataSource: string;
  timestamp: Date;
  missing: string[];
}

export class B2bCollector {
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

  async collect(): Promise<B2bMetrics> {
    const timestamp = new Date();
    const missing: string[] = [];
    const storage = await this.getStorage();

    try {
      // Query business events for B2B metrics (last 90 days for active providers)
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const allEvents = await storage.getBusinessEvents({ startDate: ninetyDaysAgo });

      // Filter by app and event types
      const providerEvents = allEvents.filter(e => e.app === 'provider_register');
      const activeEvents = providerEvents.filter(e => e.eventName === 'provider_active');
      const scholarshipPostEvents = providerEvents.filter(e => e.eventName === 'scholarship_posted');

      // Calculate active providers: unique orgIds with scholarship_posted in last 90 days
      let activeProviders: number | null = null;
      const activeProviderIds = new Set(
        scholarshipPostEvents.map(e => e.orgId || e.actorId).filter(Boolean)
      );
      
      if (activeEvents.length > 0 || scholarshipPostEvents.length > 0) {
        activeProviders = activeProviderIds.size;
      } else {
        missing.push('b2b_active_providers');
      }

      // Calculate 3% platform fee revenue (in cents)
      let revenue: number | null = null;
      if (scholarshipPostEvents.length > 0) {
        const totalFeeUsd = scholarshipPostEvents.reduce((sum, e) => {
          const feeUsd = (e.properties as any)?.fee_usd || 0;
          return sum + feeUsd;
        }, 0);
        revenue = Math.round(totalFeeUsd * 100); // convert to cents
      } else {
        missing.push('b2b_revenue');
      }

      // Calculate top-decile concentration (basis points)
      // What % of total revenue comes from top 10% of providers?
      let topDecileConcentration: number | null = null;
      if (scholarshipPostEvents.length > 0 && activeProviders && activeProviders > 0) {
        // Group revenue by provider
        const revenueByProvider = scholarshipPostEvents.reduce((acc, e) => {
          const providerId = e.orgId || e.actorId || 'unknown';
          const feeUsd = (e.properties as any)?.fee_usd || 0;
          acc[providerId] = (acc[providerId] || 0) + feeUsd;
          return acc;
        }, {} as Record<string, number>);

        // Sort providers by revenue (descending)
        const sortedRevenues = Object.values(revenueByProvider).sort((a, b) => b - a);
        const totalRevenue = sortedRevenues.reduce((sum, r) => sum + r, 0);

        if (totalRevenue > 0) {
          // Calculate top decile (top 10%)
          const topDecileCount = Math.max(1, Math.ceil(sortedRevenues.length * 0.1));
          const topDecileRevenue = sortedRevenues.slice(0, topDecileCount).reduce((sum, r) => sum + r, 0);
          topDecileConcentration = Math.round((topDecileRevenue / totalRevenue) * 10000); // basis points
        } else {
          topDecileConcentration = 0;
        }
      } else {
        missing.push('b2b_top_decile_concentration');
      }

      const hasRealData = activeProviders !== null || revenue !== null;

      return {
        activeProviders,
        revenue,
        topDecileConcentration,
        dataSource: hasRealData ? 'business_events_real' : 'business_events_empty',
        timestamp,
        missing,
      };
    } catch (error) {
      console.error('[B2B Collector] Error collecting metrics:', error);
      
      // Return all nulls on error
      missing.push(
        'b2b_active_providers',
        'b2b_revenue',
        'b2b_top_decile_concentration'
      );

      return {
        activeProviders: null,
        revenue: null,
        topDecileConcentration: null,
        dataSource: 'error',
        timestamp,
        missing,
      };
    }
  }

  // Future implementation example:
  // async collectReal(): Promise<B2bMetrics> {
  //   const now = new Date();
  //   const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  //   
  //   const events = await this.storage.getBusinessEvents({
  //     eventName: 'provider_active',
  //     startDate: thirtyDaysAgo,
  //     endDate: now,
  //   });
  //   
  //   // Calculate active providers and revenue metrics...
  // }
}
