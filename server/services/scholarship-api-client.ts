/**
 * Scholarship API Client
 * 
 * Client for fetching data from scholarship_api (Database-as-a-Service)
 * instead of local PostgreSQL database.
 * 
 * Environment Variables:
 * - DATA_SOURCE: 'local' (default) or 'api'
 * - SCHOLARSHIP_API_BASE_URL: Base URL for scholarship_api
 * - X_INTERNAL_KEY: Shared secret for S2S authentication
 */

import type { Scholarship, LandingPage } from '@shared/schema';

interface ScholarshipAPIConfig {
  baseUrl: string;
  internalKey: string;
  timeout?: number;
}

interface ScholarshipListResponse {
  scholarships: Scholarship[];
  total: number;
  page: number;
  limit: number;
}

interface LandingPageListResponse {
  pages: LandingPage[];
  total: number;
}

export class ScholarshipAPIClient {
  private baseUrl: string;
  private internalKey: string;
  private timeout: number;
  private cache: Map<string, { data: any; expiry: number }>;

  constructor(config: ScholarshipAPIConfig) {
    this.baseUrl = config.baseUrl;
    this.internalKey = config.internalKey;
    this.timeout = config.timeout || 5000;
    this.cache = new Map();
  }

  /**
   * Fetch scholarships from scholarship_api
   */
  async getScholarships(params?: {
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Scholarship[]> {
    const cacheKey = `scholarships:${JSON.stringify(params)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log(`[ScholarshipAPIClient] Cache HIT for ${cacheKey}`);
      return cached;
    }

    const queryParams = new URLSearchParams();
    if (params?.isActive !== undefined) queryParams.append('is_active', String(params.isActive));
    if (params?.limit) queryParams.append('limit', String(params.limit));
    if (params?.offset) queryParams.append('offset', String(params.offset));

    const url = `${this.baseUrl}/scholarships?${queryParams.toString()}`;
    
    try {
      const response = await this.fetchWithRetry(url);
      const data: ScholarshipListResponse = await response.json();
      
      // Cache for 5 minutes
      this.setCache(cacheKey, data.scholarships, 300000);
      
      return data.scholarships;
    } catch (error) {
      console.error('[ScholarshipAPIClient] Failed to fetch scholarships:', error);
      throw new Error(`Failed to fetch scholarships from API: ${error}`);
    }
  }

  /**
   * Fetch single scholarship by ID or slug
   */
  async getScholarship(idOrSlug: string): Promise<Scholarship | null> {
    const cacheKey = `scholarship:${idOrSlug}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log(`[ScholarshipAPIClient] Cache HIT for ${cacheKey}`);
      return cached;
    }

    const url = `${this.baseUrl}/scholarships/${idOrSlug}`;
    
    try {
      const response = await this.fetchWithRetry(url);
      
      if (response.status === 404) {
        return null;
      }
      
      const scholarship: Scholarship = await response.json();
      
      // Cache for 10 minutes
      this.setCache(cacheKey, scholarship, 600000);
      
      return scholarship;
    } catch (error) {
      console.error(`[ScholarshipAPIClient] Failed to fetch scholarship ${idOrSlug}:`, error);
      throw new Error(`Failed to fetch scholarship from API: ${error}`);
    }
  }

  /**
   * Fetch landing pages from scholarship_api
   */
  async getLandingPages(params?: {
    isPublished?: boolean;
  }): Promise<LandingPage[]> {
    const cacheKey = `pages:${JSON.stringify(params)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log(`[ScholarshipAPIClient] Cache HIT for ${cacheKey}`);
      return cached;
    }

    const queryParams = new URLSearchParams();
    if (params?.isPublished !== undefined) queryParams.append('is_published', String(params.isPublished));

    const url = `${this.baseUrl}/pages?${queryParams.toString()}`;
    
    try {
      const response = await this.fetchWithRetry(url);
      const data: LandingPageListResponse = await response.json();
      
      // Cache for 5 minutes
      this.setCache(cacheKey, data.pages, 300000);
      
      return data.pages;
    } catch (error) {
      console.error('[ScholarshipAPIClient] Failed to fetch landing pages:', error);
      throw new Error(`Failed to fetch landing pages from API: ${error}`);
    }
  }

  /**
   * Health check for scholarship_api
   */
  async healthCheck(): Promise<{ healthy: boolean; latency: number }> {
    const url = `${this.baseUrl}/healthz`;
    const startTime = Date.now();
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Internal-Key': this.internalKey,
        },
        signal: AbortSignal.timeout(this.timeout),
      });
      
      const latency = Date.now() - startTime;
      const healthy = response.ok;
      
      return { healthy, latency };
    } catch (error) {
      const latency = Date.now() - startTime;
      console.error('[ScholarshipAPIClient] Health check failed:', error);
      return { healthy: false, latency };
    }
  }

  /**
   * Fetch with retry and exponential backoff
   */
  private async fetchWithRetry(
    url: string,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-Internal-Key': this.internalKey,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(this.timeout),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `[ScholarshipAPIClient] Attempt ${attempt + 1}/${maxRetries} failed for ${url}:`,
          error
        );

        if (attempt < maxRetries - 1) {
          const delay = retryDelay * Math.pow(2, attempt); // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Simple in-memory cache helpers
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.expiry) {
      this.cache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  private setCache<T>(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlMs,
    });
  }

  /**
   * Clear cache (useful for testing or manual rebuilds)
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[ScholarshipAPIClient] Cache cleared');
  }
}

/**
 * Factory to create client instance from environment
 */
export function createScholarshipAPIClient(): ScholarshipAPIClient | null {
  const dataSource = process.env.DATA_SOURCE || 'local';
  
  if (dataSource !== 'api') {
    return null; // Use local storage
  }

  const baseUrl = process.env.SCHOLARSHIP_API_BASE_URL;
  const internalKey = process.env.X_INTERNAL_KEY;

  if (!baseUrl || !internalKey) {
    console.warn('[ScholarshipAPIClient] Missing SCHOLARSHIP_API_BASE_URL or X_INTERNAL_KEY, falling back to local storage');
    return null;
  }

  console.log(`[ScholarshipAPIClient] Initialized with baseUrl: ${baseUrl}`);
  
  return new ScholarshipAPIClient({
    baseUrl,
    internalKey,
    timeout: 5000,
  });
}
