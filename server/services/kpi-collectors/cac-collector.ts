import type { IStorage } from '../../storage.js';

export interface CacMetrics {
  seoLed: number | null; // cents (customer acquisition cost)
  paybackPeriodDays: number | null;
  dataSource: string;
  timestamp: Date;
  missing: string[];
}

export class CacCollector {
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

  async collect(): Promise<CacMetrics> {
    const timestamp = new Date();
    const missing: string[] = [];

    // STUB: CAC and payback tracking not yet implemented
    // When implemented, combine:
    // - SEO organic acquisition events (page_published, indexnow_submitted)
    // - Student conversion events (student_signup → credit_purchased)
    // - Revenue per cohort to calculate payback period

    missing.push(
      'cac_seo_led',
      'payback_period_days'
    );

    return {
      seoLed: null,
      paybackPeriodDays: null,
      dataSource: 'stub_placeholder',
      timestamp,
      missing,
    };
  }

  // Future implementation example:
  // async collectReal(): Promise<CacMetrics> {
  //   // Track cost per organic visitor from SEO
  //   // Divide by conversion rate to get CAC
  //   // Calculate revenue per user to determine payback period
  // }
}
