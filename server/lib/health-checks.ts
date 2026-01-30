/**
 * CEO DIRECTIVE (Nov 13): Gate 0 Health Checks
 * Comprehensive dependency health checks for /health and /api/health endpoints
 * 
 * Required checks:
 * - Database connectivity
 * - Email provider (SendGrid or Postmark)
 * - JWKS availability
 */

import { storage } from '../storage.js';
import { publicKeyToJWK } from '../auth/keys.js';

export interface DependencyStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency_ms?: number;
  error?: string;
  details?: Record<string, any>;
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
}

/**
 * Check database connectivity and responsiveness
 */
async function checkDatabase(): Promise<DependencyStatus> {
  const start = Date.now();
  
  try {
    // Simple query to verify database is responsive
    await storage.getScholarships({ offset: 0, limit: 1 });
    
    const latency = Date.now() - start;
    
    return {
      name: 'database',
      status: latency < 100 ? 'healthy' : 'degraded',
      latency_ms: latency,
      details: {
        type: 'postgresql',
        provider: 'neon'
      }
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
 * Check email provider availability (SendGrid or Postmark)
 * CEO DIRECTIVE (Gate 0): Real dependency check, not just env var validation
 */
async function checkEmailProvider(): Promise<DependencyStatus> {
  const start = Date.now();
  
  const hasSendGrid = !!process.env.SENDGRID_API_KEY;
  const hasPostmark = !!process.env.POSTMARK_API_KEY;
  
  if (!hasSendGrid && !hasPostmark) {
    return {
      name: 'email_provider',
      status: 'unhealthy',
      latency_ms: Date.now() - start,
      error: 'No email provider configured (missing SENDGRID_API_KEY or POSTMARK_API_KEY)'
    };
  }
  
  // Perform real API health check based on configured provider
  try {
    if (hasSendGrid) {
      // SendGrid API health check: Verify API key by calling stats endpoint
      const response = await fetch('https://api.sendgrid.com/v3/scopes', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`
        }
      });
      
      if (!response.ok) {
        return {
          name: 'email_provider',
          status: 'unhealthy',
          latency_ms: Date.now() - start,
          error: `SendGrid API returned ${response.status}: ${response.statusText}`,
          details: {
            provider: 'sendgrid',
            http_status: response.status
          }
        };
      }
      
      return {
        name: 'email_provider',
        status: 'healthy',
        latency_ms: Date.now() - start,
        details: {
          provider: 'sendgrid',
          api_accessible: true,
          http_status: 200
        }
      };
    } else if (hasPostmark) {
      // Postmark API health check: Verify API key by calling server endpoint
      const response = await fetch('https://api.postmarkapp.com/server', {
        method: 'GET',
        headers: {
          'X-Postmark-Server-Token': process.env.POSTMARK_API_KEY!,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        return {
          name: 'email_provider',
          status: 'unhealthy',
          latency_ms: Date.now() - start,
          error: `Postmark API returned ${response.status}: ${response.statusText}`,
          details: {
            provider: 'postmark',
            http_status: response.status
          }
        };
      }
      
      return {
        name: 'email_provider',
        status: 'healthy',
        latency_ms: Date.now() - start,
        details: {
          provider: 'postmark',
          api_accessible: true,
          http_status: 200
        }
      };
    }
  } catch (error) {
    return {
      name: 'email_provider',
      status: 'unhealthy',
      latency_ms: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error during API health check',
      details: {
        provider: hasSendGrid ? 'sendgrid' : 'postmark',
        network_error: true
      }
    };
  }
  
  // Should never reach here
  return {
    name: 'email_provider',
    status: 'unhealthy',
    latency_ms: Date.now() - start,
    error: 'Unexpected code path'
  };
}

/**
 * Check JWKS availability (JWT public key set)
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
      details: {
        algorithm: 'RS256',
        kid: jwk.kid,
        use: jwk.use
      }
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

// Track app start time for uptime calculation (MASTER PROMPT PHASE 4)
const APP_START_TIME = Date.now();

/**
 * Run all health checks in parallel
 */
export async function runHealthChecks(): Promise<HealthCheckResult> {
  const appName = process.env.SERVICE_NAME || 'auto_page_maker';
  const version = 'v2.9';
  const uptimeS = Math.floor((Date.now() - APP_START_TIME) / 1000);
  
  // Run all checks in parallel for speed
  const [database, emailProvider, jwks] = await Promise.all([
    checkDatabase(),
    checkEmailProvider(),
    checkJWKS()
  ]);
  
  const dependencies = [database, emailProvider, jwks];
  
  // Calculate summary
  const summary = {
    total: dependencies.length,
    healthy: dependencies.filter(d => d.status === 'healthy').length,
    degraded: dependencies.filter(d => d.status === 'degraded').length,
    unhealthy: dependencies.filter(d => d.status === 'unhealthy').length
  };
  
  // Overall status logic:
  // - healthy: all dependencies healthy
  // - degraded: at least one degraded, but none unhealthy
  // - unhealthy: at least one unhealthy
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  if (summary.unhealthy > 0) {
    overallStatus = 'unhealthy';
  } else if (summary.degraded > 0) {
    overallStatus = 'degraded';
  }
  
  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version,
    app: appName,
    uptime_s: uptimeS,
    dependencies,
    summary
  };
}
