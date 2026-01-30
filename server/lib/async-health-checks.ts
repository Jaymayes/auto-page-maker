/**
 * Issue B: Async Health Checks with Background Caching
 * Feature Flag: ASYNC_HEALTH_CHECKS=true
 * 
 * Moves expensive third-party checks (SendGrid/Postmark) off the hot path
 * by running them in the background and caching results.
 * 
 * Expected P95 improvement: ~150-200ms reduction on /health endpoint
 */

import { storage } from '../storage.js';
import { publicKeyToJWK } from '../auth/keys.js';

// Feature flag for async health checks
export const ASYNC_HEALTH_ENABLED = process.env.ASYNC_HEALTH_CHECKS === 'true';

// Cache configuration
const EMAIL_CACHE_TTL_MS = parseInt(process.env.EMAIL_HEALTH_CACHE_TTL_MS || '60000', 10); // 1 minute default
const BACKGROUND_CHECK_INTERVAL_MS = parseInt(process.env.HEALTH_CHECK_INTERVAL_MS || '30000', 10); // 30s default

export interface DependencyStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency_ms?: number;
  error?: string;
  details?: Record<string, any>;
  cached?: boolean;
  cached_at?: string;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  app: string;
  uptime_s: number;
  dependencies: DependencyStatus[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
  async_mode?: boolean;
}

// Cached email provider status
let emailProviderCache: DependencyStatus | null = null;
let emailCacheTimestamp: number = 0;
let backgroundCheckTimer: NodeJS.Timeout | null = null;

/**
 * Check database connectivity - fast, always run synchronously
 */
async function checkDatabase(): Promise<DependencyStatus> {
  const start = Date.now();
  
  try {
    await storage.getScholarships({ offset: 0, limit: 1 });
    const latency = Date.now() - start;
    
    return {
      name: 'database',
      status: latency < 100 ? 'healthy' : 'degraded',
      latency_ms: latency,
      details: { type: 'postgresql', provider: 'neon' }
    };
  } catch (error) {
    return {
      name: 'database',
      status: 'unhealthy',
      latency_ms: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check JWKS - fast, always run synchronously
 */
async function checkJWKS(): Promise<DependencyStatus> {
  const start = Date.now();
  
  try {
    const jwk = publicKeyToJWK();
    
    if (!jwk || !jwk.kty || !jwk.n || !jwk.e) {
      return {
        name: 'jwks',
        status: 'unhealthy',
        latency_ms: Date.now() - start,
        error: 'Invalid JWKS format'
      };
    }
    
    return {
      name: 'jwks',
      status: 'healthy',
      latency_ms: Date.now() - start,
      details: { algorithm: 'RS256', kid: jwk.kid, use: jwk.use }
    };
  } catch (error) {
    return {
      name: 'jwks',
      status: 'unhealthy',
      latency_ms: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check email provider - SLOW, runs in background when async mode enabled
 */
async function checkEmailProviderFresh(): Promise<DependencyStatus> {
  const start = Date.now();
  
  const hasSendGrid = !!process.env.SENDGRID_API_KEY;
  const hasPostmark = !!process.env.POSTMARK_API_KEY;
  
  if (!hasSendGrid && !hasPostmark) {
    return {
      name: 'email_provider',
      status: 'unhealthy',
      latency_ms: Date.now() - start,
      error: 'No email provider configured'
    };
  }
  
  try {
    if (hasSendGrid) {
      const response = await fetch('https://api.sendgrid.com/v3/scopes', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}` }
      });
      
      return {
        name: 'email_provider',
        status: response.ok ? 'healthy' : 'unhealthy',
        latency_ms: Date.now() - start,
        error: response.ok ? undefined : `SendGrid API returned ${response.status}`,
        details: { provider: 'sendgrid', http_status: response.status }
      };
    } else if (hasPostmark) {
      const response = await fetch('https://api.postmarkapp.com/server', {
        method: 'GET',
        headers: {
          'X-Postmark-Server-Token': process.env.POSTMARK_API_KEY!,
          'Accept': 'application/json'
        }
      });
      
      return {
        name: 'email_provider',
        status: response.ok ? 'healthy' : 'unhealthy',
        latency_ms: Date.now() - start,
        error: response.ok ? undefined : `Postmark API returned ${response.status}`,
        details: { provider: 'postmark', http_status: response.status }
      };
    }
  } catch (error) {
    return {
      name: 'email_provider',
      status: 'unhealthy',
      latency_ms: Date.now() - start,
      error: error instanceof Error ? error.message : 'Network error',
      details: { provider: hasSendGrid ? 'sendgrid' : 'postmark', network_error: true }
    };
  }
  
  return {
    name: 'email_provider',
    status: 'unhealthy',
    latency_ms: Date.now() - start,
    error: 'Unexpected code path'
  };
}

/**
 * Get email provider status - returns cached or fresh based on mode
 */
function getEmailProviderCached(): DependencyStatus {
  const now = Date.now();
  
  if (emailProviderCache && (now - emailCacheTimestamp) < EMAIL_CACHE_TTL_MS) {
    return {
      ...emailProviderCache,
      cached: true,
      cached_at: new Date(emailCacheTimestamp).toISOString()
    };
  }
  
  // Return stale cache with degraded status if available
  if (emailProviderCache) {
    return {
      ...emailProviderCache,
      status: 'degraded',
      cached: true,
      cached_at: new Date(emailCacheTimestamp).toISOString(),
      details: { ...emailProviderCache.details, stale: true }
    };
  }
  
  // No cache, return unknown state
  return {
    name: 'email_provider',
    status: 'degraded',
    latency_ms: 0,
    details: { provider: 'unknown', initializing: true },
    cached: false
  };
}

/**
 * Background refresh of email provider status
 */
async function refreshEmailProviderCache(): Promise<void> {
  try {
    const result = await checkEmailProviderFresh();
    emailProviderCache = result;
    emailCacheTimestamp = Date.now();
  } catch (error) {
    console.error('[AsyncHealth] Background email check failed:', error);
  }
}

/**
 * Start background health check timer
 * Runs initial synchronous check to seed cache before returning
 */
export async function startBackgroundHealthChecks(): Promise<void> {
  if (!ASYNC_HEALTH_ENABLED) return;
  
  if (backgroundCheckTimer) {
    clearInterval(backgroundCheckTimer);
  }
  
  // Run initial check SYNCHRONOUSLY to seed cache before any requests
  // This prevents cold-start degraded responses
  console.log(`[AsyncHealth] Running initial health check to seed cache...`);
  await refreshEmailProviderCache();
  console.log(`[AsyncHealth] Cache seeded - email_provider status: ${emailProviderCache?.status}`);
  
  // Schedule periodic background checks
  backgroundCheckTimer = setInterval(refreshEmailProviderCache, BACKGROUND_CHECK_INTERVAL_MS);
  
  console.log(`[AsyncHealth] Background health checks started (interval: ${BACKGROUND_CHECK_INTERVAL_MS}ms)`);
}

/**
 * Stop background health check timer
 */
export function stopBackgroundHealthChecks(): void {
  if (backgroundCheckTimer) {
    clearInterval(backgroundCheckTimer);
    backgroundCheckTimer = null;
  }
}

// Track app start time for uptime calculation
const APP_START_TIME = Date.now();

/**
 * Run health checks - async mode uses cached email provider status
 */
export async function runAsyncHealthChecks(): Promise<HealthCheckResult> {
  const appName = process.env.SERVICE_NAME || 'auto_page_maker';
  // Match legacy version to preserve monitoring compatibility
  const version = 'v2.9';
  const uptimeS = Math.floor((Date.now() - APP_START_TIME) / 1000);
  
  let dependencies: DependencyStatus[];
  
  if (ASYNC_HEALTH_ENABLED) {
    // Async mode: fast checks only, email from cache
    const [database, jwks] = await Promise.all([
      checkDatabase(),
      checkJWKS()
    ]);
    
    const emailProvider = getEmailProviderCached();
    dependencies = [database, emailProvider, jwks];
  } else {
    // Sync mode: all checks including slow email provider
    const [database, emailProvider, jwks] = await Promise.all([
      checkDatabase(),
      checkEmailProviderFresh(),
      checkJWKS()
    ]);
    dependencies = [database, emailProvider, jwks];
  }
  
  const summary = {
    total: dependencies.length,
    healthy: dependencies.filter(d => d.status === 'healthy').length,
    degraded: dependencies.filter(d => d.status === 'degraded').length,
    unhealthy: dependencies.filter(d => d.status === 'unhealthy').length
  };
  
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (summary.unhealthy > 0) {
    overallStatus = 'unhealthy';
  } else if (summary.degraded > 0) {
    overallStatus = 'degraded';
  }
  
  const result: HealthCheckResult = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version,
    app: appName,
    uptime_s: uptimeS,
    dependencies,
    summary
  };
  
  // Only include async_mode field when flag is enabled to preserve exact output format
  if (ASYNC_HEALTH_ENABLED) {
    result.async_mode = true;
  }
  
  return result;
}

/**
 * Force refresh email provider cache (for admin/debug)
 */
export async function forceRefreshEmailCache(): Promise<DependencyStatus> {
  await refreshEmailProviderCache();
  return emailProviderCache || getEmailProviderCached();
}

/**
 * Get cache stats for monitoring
 */
export function getHealthCacheStats(): {
  email_cached: boolean;
  email_cache_age_ms: number;
  email_cache_ttl_ms: number;
  background_enabled: boolean;
} {
  return {
    email_cached: !!emailProviderCache,
    email_cache_age_ms: emailProviderCache ? Date.now() - emailCacheTimestamp : -1,
    email_cache_ttl_ms: EMAIL_CACHE_TTL_MS,
    background_enabled: !!backgroundCheckTimer
  };
}
