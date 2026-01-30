import cron, { type ScheduledTask } from 'node-cron';
import { ExecutiveKpiBriefService } from './executive-kpi-brief.js';

export class ExecutiveKpiScheduler {
  private dailyJob: ScheduledTask | null = null;
  private kpiBriefService: ExecutiveKpiBriefService;
  private readonly enabled: boolean;

  constructor() {
    this.enabled = process.env.SEO_SCHEDULER_ENABLED === 'true';
    this.kpiBriefService = new ExecutiveKpiBriefService();
  }

  start(): void {
    if (!this.enabled) {
      console.log('[Executive KPI Scheduler] Disabled - SEO_SCHEDULER_ENABLED not set to true');
      return;
    }

    console.log('[Executive KPI Scheduler] Starting automated KPI jobs...');

    // Daily KPI brief at 09:00 UTC
    this.dailyJob = cron.schedule(
      '0 9 * * *', // 09:00 UTC every day
      async () => {
        console.log('[Executive KPI Scheduler] Running daily KPI brief generation...');
        try {
          const result = await this.kpiBriefService.generateDailyBrief();
          
          console.log('[Executive KPI Scheduler] Daily brief generated successfully:', {
            requestId: result.snapshot.requestId,
            date: result.snapshot.date,
            jsonPath: result.jsonPath,
            markdownPath: result.markdownPath,
            slackNotified: result.slackNotified,
            hasMissingMetrics: result.hasMissingMetrics,
            hasDataIntegrityRisks: result.hasDataIntegrityRisks,
          });

          if (result.slackError) {
            console.error('[Executive KPI Scheduler] Slack notification failed:', result.slackError);
          }
        } catch (error) {
          console.error('[Executive KPI Scheduler] Error generating daily brief:', error);
        }
      },
      {
        timezone: 'UTC',
      }
    );

    console.log('[Executive KPI Scheduler] ✓ Daily job: 09:00 UTC (KPI brief + Slack)');
  }

  stop(): void {
    if (this.dailyJob) {
      this.dailyJob.stop();
      this.dailyJob = null;
      console.log('[Executive KPI Scheduler] Stopped');
    }
  }

  // Manual trigger for testing
  async triggerManual(): Promise<void> {
    console.log('[Executive KPI Scheduler] Manual trigger initiated...');
    const result = await this.kpiBriefService.generateDailyBrief();
    console.log('[Executive KPI Scheduler] Manual trigger completed:', {
      requestId: result.snapshot.requestId,
      slackNotified: result.slackNotified,
    });
  }
}
