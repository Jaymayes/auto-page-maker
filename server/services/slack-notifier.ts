import { readFile } from 'fs/promises';

export interface SlackMessage {
  text: string;
  blocks?: Array<{
    type: string;
    text?: {
      type: string;
      text: string;
    };
    fields?: Array<{
      type: string;
      text: string;
    }>;
  }>;
}

export interface SlackNotificationResult {
  success: boolean;
  attempts: number;
  error?: string;
}

export class SlackNotifier {
  private readonly webhookUrl: string | undefined;
  private readonly maxRetries: number = 3;
  private readonly retryDelayMs: number = 2000;

  constructor(webhookUrl?: string) {
    this.webhookUrl = webhookUrl || process.env.SLACK_WEBHOOK_URL;
  }

  async sendKpiDailyBrief(markdownPath: string, snapshot: {
    requestId: string;
    date: Date;
    missingMetrics: string[] | null;
    dataIntegrityRisks: string[] | null;
    seoPagesLive: number | null;
    sloUptimePercent: number | null;
  }): Promise<SlackNotificationResult> {
    if (!this.webhookUrl) {
      console.log('[Slack] SLACK_WEBHOOK_URL not configured, skipping notification');
      return { success: false, attempts: 0, error: 'Webhook URL not configured' };
    }

    const message = await this.buildKpiMessage(markdownPath, snapshot);
    return this.sendWithRetry(message);
  }

  private async buildKpiMessage(markdownPath: string, snapshot: {
    requestId: string;
    date: Date;
    missingMetrics: string[] | null;
    dataIntegrityRisks: string[] | null;
    seoPagesLive: number | null;
    sloUptimePercent: number | null;
  }): Promise<SlackMessage> {
    const dateStr = snapshot.date.toISOString().split('T')[0];
    const hasMissingData = (snapshot.missingMetrics || []).length > 0;
    const hasRisks = (snapshot.dataIntegrityRisks || []).length > 0;
    const statusEmoji = hasRisks ? '⚠️' : hasMissingData ? '⏳' : '✅';

    // Build concise executive summary
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${statusEmoji} Executive KPI Daily Brief - ${dateStr}`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Request ID:*\n\`${snapshot.requestId}\``,
          },
          {
            type: 'mrkdwn',
            text: `*Generated:*\n${new Date().toISOString()}`,
          },
        ],
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*SEO Pages Live:*\n${snapshot.seoPagesLive ?? 'No data'}`,
          },
          {
            type: 'mrkdwn',
            text: `*SLO Uptime:*\n${snapshot.sloUptimePercent ? `${(snapshot.sloUptimePercent / 100).toFixed(2)}%` : 'No data'}`,
          },
        ],
      },
    ];

    // Add warnings if present
    if (hasRisks) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🚨 *Data Integrity Risks:*\n${(snapshot.dataIntegrityRisks || []).map((r: string) => `• ${r}`).join('\n')}`,
        },
      });
    }

    if (hasMissingData) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `⏳ *Missing Metrics:* ${(snapshot.missingMetrics || []).length} metrics not yet tracked`,
        },
      });
    }

    // Add link to full report
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `📄 *Full Report:* \`${markdownPath}\``,
      },
    });

    return {
      text: `${statusEmoji} Executive KPI Daily Brief - ${dateStr}`,
      blocks,
    };
  }

  private async sendWithRetry(message: SlackMessage): Promise<SlackNotificationResult> {
    if (!this.webhookUrl) {
      return { success: false, attempts: 0, error: 'Webhook URL not configured' };
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(this.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
        });

        if (response.ok) {
          console.log(`[Slack] Message sent successfully on attempt ${attempt}`);
          return { success: true, attempts: attempt };
        } else {
          const errorText = await response.text();
          console.error(`[Slack] Failed to send message (attempt ${attempt}/${this.maxRetries}): ${response.status} - ${errorText}`);
          
          if (attempt < this.maxRetries) {
            await this.delay(this.retryDelayMs * attempt); // Exponential backoff
          } else {
            return { 
              success: false, 
              attempts: attempt, 
              error: `HTTP ${response.status}: ${errorText}` 
            };
          }
        }
      } catch (error) {
        console.error(`[Slack] Error sending message (attempt ${attempt}/${this.maxRetries}):`, error);
        
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelayMs * attempt);
        } else {
          return { 
            success: false, 
            attempts: attempt, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      }
    }

    return { success: false, attempts: this.maxRetries, error: 'Max retries exceeded' };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  isConfigured(): boolean {
    return !!this.webhookUrl;
  }
}

// Export singleton instance
export const slackNotifier = new SlackNotifier();
