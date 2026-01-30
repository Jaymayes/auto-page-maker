import * as cron from 'node-cron';
import { storage } from '../storage.js';
import { indexNowService } from './indexnow.js';
import { telemetryClient } from '../lib/telemetry-client.js';

interface SchedulerStats {
  lastNightlyRun?: Date;
  lastHourlyRun?: Date;
  nightlyRunCount: number;
  hourlyRunCount: number;
  totalPagesGenerated: number;
  totalIndexNowSubmissions: number;
}

export class SEOScheduler {
  private stats: SchedulerStats = {
    nightlyRunCount: 0,
    hourlyRunCount: 0,
    totalPagesGenerated: 0,
    totalIndexNowSubmissions: 0,
  };

  private nightlyTask?: ReturnType<typeof cron.schedule>;
  private hourlyTask?: ReturnType<typeof cron.schedule>;
  private enabled: boolean;

  constructor() {
    // Enable scheduler in production, disable in development unless explicitly enabled
    this.enabled = process.env.SEO_SCHEDULER_ENABLED === 'true' || 
                   (process.env.NODE_ENV === 'production' && process.env.SEO_SCHEDULER_ENABLED !== 'false');
  }

  /**
   * Start the scheduler with nightly and hourly jobs
   */
  start(): void {
    if (!this.enabled) {
      console.log('[SEO Scheduler] Disabled - set SEO_SCHEDULER_ENABLED=true to enable');
      return;
    }

    console.log('[SEO Scheduler] Starting automated SEO jobs...');

    // Nightly full refresh at 2 AM (low traffic time)
    this.nightlyTask = cron.schedule('0 2 * * *', async () => {
      await this.runNightlyRefresh();
    }, {
      timezone: 'America/New_York', // EST/EDT
    });

    // Hourly delta update (check for new scholarships, update affected pages)
    this.hourlyTask = cron.schedule('0 * * * *', async () => {
      await this.runHourlyDelta();
    }, {
      timezone: 'America/New_York',
    });

    console.log('[SEO Scheduler] ✓ Nightly job: 2:00 AM EST (full refresh)');
    console.log('[SEO Scheduler] ✓ Hourly job: Every hour (delta updates)');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.nightlyTask) {
      this.nightlyTask.stop();
      console.log('[SEO Scheduler] Stopped nightly job');
    }

    if (this.hourlyTask) {
      this.hourlyTask.stop();
      console.log('[SEO Scheduler] Stopped hourly job');
    }
  }

  /**
   * Nightly full refresh: Regenerate stale pages, expire scholarships, submit to IndexNow
   */
  private async runNightlyRefresh(): Promise<void> {
    console.log('\n🌙 [SEO Scheduler] Starting nightly full refresh...');
    const startTime = Date.now();

    try {
      // Step 1: Generate fresh landing pages using AutoPageMaker
      console.log('   → Generating landing pages...');
      const { AutoPageMaker } = await import('../../scripts/content-generation/auto-page-maker.js');
      const autoPageMaker = new AutoPageMaker();
      await autoPageMaker.generate();
      
      console.log('   → Landing page generation complete');
      this.stats.totalPagesGenerated += autoPageMaker.templates.length;

      // MASTER GO-LIVE v2.0: Emit PRODUCT event for batch generation
      const durationMs = Date.now() - startTime;
      telemetryClient.emitSeoBatchComplete(
        autoPageMaker.templates.length,
        'Nightly Full Refresh',
        durationMs
      );

      // Step 2: Check for expired scholarships and perform cleanup
      const { ExpiryManager } = await import('./expiry-manager.js');
      const expiryManager = new ExpiryManager();
      const cleanupResult = await expiryManager.performExpiryCleanup();
      
      console.log(`   → Expired ${cleanupResult.scholarshipsExpired} scholarships`);
      console.log(`   → Updated ${cleanupResult.landingPagesUpdated} landing pages`);

      // Step 3: Regenerate sitemap
      const { SitemapGenerator } = await import('./sitemapGenerator.js');
      const sitemapGen = new SitemapGenerator();
      const publishedPages = await storage.getLandingPages({ isPublished: true });
      await sitemapGen.generateSitemap(publishedPages);
      
      console.log(`   → Regenerated sitemap with ${publishedPages.length} pages`);

      // Step 4: Submit sitemap to IndexNow
      const sitemapResult = await indexNowService.submitSitemap();
      if (sitemapResult.success) {
        console.log('   → Submitted sitemap to IndexNow');
      }

      // Step 5: Submit all published pages to IndexNow (bulk)
      const indexResult = await indexNowService.submitLandingPages(publishedPages);
      if (indexResult.success) {
        console.log(`   → Submitted ${indexResult.urlsSubmitted} pages to IndexNow`);
        this.stats.totalIndexNowSubmissions += indexResult.urlsSubmitted || 0;
      }

      // Update stats
      this.stats.lastNightlyRun = new Date();
      this.stats.nightlyRunCount++;

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ [SEO Scheduler] Nightly refresh completed in ${duration}s\n`);
      
      // v3.4.1: Emit metric with pages_generated and google_index_status
      telemetryClient.emitPagesGeneratedMetric(publishedPages.length, 'submitted');
    } catch (error) {
      console.error('[SEO Scheduler] Nightly refresh error:', error);
      // v3.4.1: Emit revenue_blocker with SEO_HALTED code
      telemetryClient.emitSeoHalted(
        error instanceof Error ? error.message : 'Nightly refresh failed',
        { phase: 'nightly_refresh' }
      );
    }
  }

  /**
   * Hourly delta update: Check for new scholarships, update affected pages
   */
  private async runHourlyDelta(): Promise<void> {
    console.log('\n⏰ [SEO Scheduler] Starting hourly delta update...');
    const startTime = Date.now();

    try {
      // Step 1: Get recently updated scholarships (last 2 hours for overlap)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const allScholarships = await storage.getScholarships({ isActive: true });
      
      const recentScholarships = allScholarships.filter(s => 
        s.updatedAt && new Date(s.updatedAt) > twoHoursAgo
      );

      if (recentScholarships.length === 0) {
        console.log('   → No new scholarships found - skipping delta update');
        this.stats.lastHourlyRun = new Date();
        this.stats.hourlyRunCount++;
        return;
      }

      console.log(`   → Found ${recentScholarships.length} recently updated scholarships`);

      // Step 2: Regenerate landing pages to include new scholarships
      console.log('   → Regenerating landing pages with new data...');
      const { AutoPageMaker } = await import('../../scripts/content-generation/auto-page-maker.js');
      const autoPageMaker = new AutoPageMaker();
      await autoPageMaker.generate();
      
      console.log('   → Landing page regeneration complete');
      this.stats.totalPagesGenerated += autoPageMaker.templates.length;

      // MASTER GO-LIVE v2.0: Emit PRODUCT event for delta batch
      const durationMs = Date.now() - startTime;
      telemetryClient.emitSeoBatchComplete(
        autoPageMaker.templates.length,
        `Hourly Delta (${recentScholarships.length} scholarships)`,
        durationMs
      );

      // Step 3: Identify affected landing pages that need updates
      const allPages = await storage.getLandingPages({ isPublished: true });
      const affectedPages: string[] = [];

      for (const scholarship of recentScholarships) {
        // Check which landing pages would include this scholarship
        const relevantPages = allPages.filter(page => {
          // Major match
          if (scholarship.major && page.slug.includes(scholarship.major.toLowerCase())) {
            return true;
          }
          // State match
          if (scholarship.state && page.slug.includes(scholarship.state.toLowerCase())) {
            return true;
          }
          return false;
        });

        affectedPages.push(...relevantPages.map(p => `/${p.slug}`));
      }

      if (affectedPages.length === 0) {
        console.log('   → No affected pages - skipping IndexNow submission');
        this.stats.lastHourlyRun = new Date();
        this.stats.hourlyRunCount++;
        return;
      }

      // Step 4: Submit affected pages to IndexNow for re-indexing
      const uniquePages = [...new Set(affectedPages)];
      console.log(`   → Submitting ${uniquePages.length} affected pages to IndexNow`);

      const indexResult = await indexNowService.submitBulk(uniquePages);
      if (indexResult.success) {
        console.log(`   → Successfully submitted ${indexResult.urlsSubmitted} pages`);
        this.stats.totalIndexNowSubmissions += indexResult.urlsSubmitted || 0;
      }

      // Update stats
      this.stats.lastHourlyRun = new Date();
      this.stats.hourlyRunCount++;

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ [SEO Scheduler] Hourly delta update completed in ${duration}s\n`);
      
      // v3.4.1: Emit metric with pages_generated and google_index_status
      const updatedPages = await storage.getLandingPages({ isPublished: true });
      telemetryClient.emitPagesGeneratedMetric(updatedPages.length, 'submitted');
    } catch (error) {
      console.error('[SEO Scheduler] Hourly delta error:', error);
      // v3.4.1: Emit revenue_blocker with SEO_HALTED code
      telemetryClient.emitSeoHalted(
        error instanceof Error ? error.message : 'Hourly delta failed',
        { phase: 'hourly_delta' }
      );
    }
  }

  /**
   * Get scheduler statistics
   */
  getStats(): SchedulerStats {
    return { ...this.stats };
  }

  /**
   * Manually trigger nightly refresh (for testing)
   */
  async triggerNightlyRefresh(): Promise<void> {
    await this.runNightlyRefresh();
  }

  /**
   * Manually trigger hourly delta (for testing)
   */
  async triggerHourlyDelta(): Promise<void> {
    await this.runHourlyDelta();
  }
}

// Singleton instance
export const seoScheduler = new SEOScheduler();
