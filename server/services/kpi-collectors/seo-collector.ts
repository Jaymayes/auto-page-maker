import type { IStorage } from '../../storage.js';

export interface SeoMetrics {
  pagesLive: number;
  indexationRate: number | null; // basis points
  organicSessions: number | null;
  dataSource: string;
  timestamp: Date;
  missing: string[];
}

export class SeoCollector {
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

  async collect(): Promise<SeoMetrics> {
    const missing: string[] = [];
    const timestamp = new Date();
    
    // Get total published landing pages
    const storage = await this.getStorage();
    const pages = await storage.getLandingPages({ isPublished: true });
    const pagesLive = pages.length;

    // Indexation rate - currently not tracked, will be from GSC
    const indexationRate = null;
    missing.push('seo_indexation_rate');

    // Organic sessions - currently not tracked, will be from GA4
    const organicSessions = null;
    missing.push('seo_organic_sessions');

    return {
      pagesLive,
      indexationRate,
      organicSessions,
      dataSource: 'landing_pages_db',
      timestamp,
      missing,
    };
  }
}
