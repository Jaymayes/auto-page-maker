import { randomBytes } from 'crypto';
import type { LandingPage } from '@shared/schema';

interface IndexNowResponse {
  success: boolean;
  statusCode?: number;
  message?: string;
  urlsSubmitted?: number;
  retriesUsed?: number;
}

const BASE_DELAY_MS = 5000;
const MAX_DELAY_MS = 300000;
const JITTER_FACTOR = 0.3;
const MAX_RETRIES = 5;

export class IndexNowService {
  private apiKey: string;
  private baseUrl: string;
  private keyFileUrl: string;
  private enabled: boolean;

  constructor() {
    this.apiKey = process.env.INDEXNOW_API_KEY || this.generateApiKey();
    this.baseUrl = process.env.BASE_URL || process.env.PUBLIC_ORIGIN || process.env.APP_BASE_URL || 'https://scholaraiadvisor.com';
    this.keyFileUrl = `${this.baseUrl}/${this.apiKey}.txt`;
    
    this.enabled = process.env.INDEXNOW_ENABLED !== 'false';

    if (this.enabled) {
      console.log('[IndexNow] Service initialized');
      console.log(`[IndexNow] Key file URL: ${this.keyFileUrl}`);
    }
  }

  private generateApiKey(): string {
    return randomBytes(16).toString('hex');
  }

  private calculateBackoffDelay(attempt: number): number {
    const exponentialDelay = BASE_DELAY_MS * Math.pow(2, attempt);
    const cappedDelay = Math.min(exponentialDelay, MAX_DELAY_MS);
    
    const jitterRange = cappedDelay * JITTER_FACTOR;
    const jitter = (Math.random() * 2 - 1) * jitterRange;
    
    return Math.max(BASE_DELAY_MS, cappedDelay + jitter);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getApiKey(): string {
    return this.apiKey;
  }

  getKeyFileUrl(): string {
    return this.keyFileUrl;
  }

  async submitUrl(url: string): Promise<IndexNowResponse> {
    if (!this.enabled) {
      return { success: false, message: 'IndexNow disabled' };
    }

    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    const endpoint = `https://api.indexnow.org/indexnow?url=${encodeURIComponent(fullUrl)}&key=${this.apiKey}`;

    let lastError: Error | null = null;
    let retriesUsed = 0;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });

        if (response.status === 429) {
          retriesUsed = attempt + 1;
          if (attempt < MAX_RETRIES) {
            const delay = this.calculateBackoffDelay(attempt);
            console.log(`[IndexNow] Rate limited (429), retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
            await this.sleep(delay);
            continue;
          }
          console.warn(`[IndexNow] ✗ Rate limit exceeded after ${MAX_RETRIES} retries: ${fullUrl}`);
          return {
            success: false,
            statusCode: 429,
            message: 'Rate limit exceeded after max retries',
            urlsSubmitted: 0,
            retriesUsed,
          };
        }

        const success = response.status === 200 || response.status === 202;

        if (success) {
          console.log(`[IndexNow] ✓ Submitted: ${fullUrl}${retriesUsed > 0 ? ` (after ${retriesUsed} retries)` : ''}`);
        } else {
          console.warn(`[IndexNow] ✗ Failed (${response.status}): ${fullUrl}`);
        }

        return {
          success,
          statusCode: response.status,
          message: success ? 'URL submitted successfully' : `HTTP ${response.status}`,
          urlsSubmitted: success ? 1 : 0,
          retriesUsed,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        if (attempt < MAX_RETRIES) {
          const delay = this.calculateBackoffDelay(attempt);
          console.log(`[IndexNow] Request error, retrying in ${Math.round(delay / 1000)}s: ${lastError.message}`);
          await this.sleep(delay);
          retriesUsed = attempt + 1;
        }
      }
    }

    console.error('[IndexNow] Submission error after retries:', lastError);
    return {
      success: false,
      message: lastError?.message || 'Unknown error',
      urlsSubmitted: 0,
      retriesUsed,
    };
  }

  async submitBulk(urls: string[]): Promise<IndexNowResponse> {
    if (!this.enabled) {
      return { success: false, message: 'IndexNow disabled' };
    }

    if (urls.length === 0) {
      return { success: false, message: 'No URLs to submit' };
    }

    const urlBatch = urls.slice(0, 10000);
    const fullUrls = urlBatch.map(url => 
      url.startsWith('http') ? url : `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`
    );

    const payload = {
      host: new URL(this.baseUrl).hostname,
      key: this.apiKey,
      keyLocation: this.keyFileUrl,
      urlList: fullUrls,
    };

    let lastError: Error | null = null;
    let retriesUsed = 0;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch('https://api.indexnow.org/IndexNow', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        });

        if (response.status === 429) {
          retriesUsed = attempt + 1;
          if (attempt < MAX_RETRIES) {
            const delay = this.calculateBackoffDelay(attempt);
            console.log(`[IndexNow] Bulk rate limited (429), retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
            await this.sleep(delay);
            continue;
          }
          console.warn(`[IndexNow] ✗ Bulk rate limit exceeded after ${MAX_RETRIES} retries`);
          return {
            success: false,
            statusCode: 429,
            message: 'Rate limit exceeded after max retries',
            urlsSubmitted: 0,
            retriesUsed,
          };
        }

        const success = response.status === 200 || response.status === 202;

        if (success) {
          console.log(`[IndexNow] ✓ Bulk submission: ${fullUrls.length} URLs${retriesUsed > 0 ? ` (after ${retriesUsed} retries)` : ''}`);
        } else {
          console.warn(`[IndexNow] ✗ Bulk submission failed (${response.status})`);
        }

        return {
          success,
          statusCode: response.status,
          message: success ? 'Bulk URLs submitted successfully' : `HTTP ${response.status}`,
          urlsSubmitted: success ? fullUrls.length : 0,
          retriesUsed,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        if (attempt < MAX_RETRIES) {
          const delay = this.calculateBackoffDelay(attempt);
          console.log(`[IndexNow] Bulk request error, retrying in ${Math.round(delay / 1000)}s: ${lastError.message}`);
          await this.sleep(delay);
          retriesUsed = attempt + 1;
        }
      }
    }

    console.error('[IndexNow] Bulk submission error after retries:', lastError);
    return {
      success: false,
      message: lastError?.message || 'Unknown error',
      urlsSubmitted: 0,
      retriesUsed,
    };
  }

  async submitLandingPages(pages: LandingPage[]): Promise<IndexNowResponse> {
    const urls = pages
      .filter(page => page.isPublished)
      .map(page => `/${page.slug}`);

    if (urls.length === 0) {
      return { success: false, message: 'No published pages to submit' };
    }

    console.log(`[IndexNow] Submitting ${urls.length} landing pages...`);
    return await this.submitBulk(urls);
  }

  async submitSitemap(): Promise<IndexNowResponse> {
    return await this.submitUrl('/sitemap.xml');
  }
}

export const indexNowService = new IndexNowService();
