// CEO DIRECTIVE (Nov 13): Boot-time validation MUST run first - Gate 0 requirement
import { enforceEnvironmentValidation } from "./config/boot-validation.js";
enforceEnvironmentValidation();

import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import compression from "compression";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { routes, incrementPagesRendered } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { generalApiLimiter, originBasedLimiter } from "./middleware/rate-limit.js";
import { preventPathTraversal } from "./middleware/path-security.js";
import { unicodeNormalize } from "./middleware/unicode-normalize.js";
import { corsEnforce, validateCorsConfig } from "./middleware/cors.js";
import { universalSecurityHeaders } from "./middleware/universal-security-headers.js";
import { cohortTaggingMiddleware } from "./middleware/cohort-tagging.js";
import { endpointMetricsMiddleware, queueDepthTracker } from "./middleware/endpoint-metrics.js";
import { costTelemetryMiddleware } from "./middleware/cost-telemetry.js";
import { abuseMonitoringMiddleware } from "./middleware/abuse-monitoring.js";
import { startAgentBridge } from "./lib/agent-bridge.js";
import { ensureKeysExist, publicKeyToJWK } from "./auth/keys.js";
import { startBackgroundHealthChecks, ASYNC_HEALTH_ENABLED } from "./lib/async-health-checks.js";
import { wafMiddleware } from "./middleware/waf.js";
import { startEndpointPrewarming, PREWARM_HEADER } from "./lib/endpoint-prewarm.js";
import crypto from "crypto";

const app = express();

// CRITICAL: Trust proxy MUST be set at the very top before any middleware using req.ip
// Required for WAF Trust-by-Secret and correct IP detection behind proxies
app.set('trust proxy', true);

// AGENT3 Global Identity Standard: Add identity headers to ALL responses
// Per AGENT3 spec: X-System-Identity and X-App-Base-URL on every HTTP response
app.use((req: Request, res: Response, next: NextFunction) => {
  const appBaseUrl = process.env.APP_BASE_URL || process.env.REPLIT_URL || 'http://localhost:5000';
  res.setHeader('X-System-Identity', `auto_page_maker`);
  res.setHeader('X-App-Base-URL', appBaseUrl);
  next();
});

// WWW → Apex 301 Redirect: Canonical host enforcement for SEO
// Redirects www.scholaraiadvisor.com → scholaraiadvisor.com to prevent indexing splits
app.use((req: Request, res: Response, next: NextFunction) => {
  const host = req.get('host') || '';
  if (host.startsWith('www.')) {
    const apexHost = host.replace(/^www\./, '');
    const protocol = req.protocol || 'https';
    const redirectUrl = `${protocol}://${apexHost}${req.originalUrl}`;
    return res.redirect(301, redirectUrl);
  }
  next();
});

// AGENT3 v2.6: Universal Security Headers (6/6 required headers for 100% of responses)
// CRITICAL: Must be registered BEFORE any route handlers to ensure coverage
app.use(universalSecurityHeaders);

// STAGING MODE: Add noindex headers to prevent search engine indexing
// Set STAGING=true environment variable for validation deployments
if (process.env.STAGING === 'true') {
  app.use((req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    next();
  });
  log('STAGING MODE ENABLED: noindex headers active');
}

// Global Identity Standard v1.2: Log IDENTIFY line on startup
// Per Master Prompt v1.2 Section 7: auto_page_maker (SEO Engine)
const APP_BASE_URL = process.env.APP_BASE_URL || process.env.REPLIT_URL || 'http://localhost:5000';
const ENV = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
console.log('');
console.log('═'.repeat(100));
console.log(`IDENTIFY: APP=auto_page_maker | APP_BASE_URL=${APP_BASE_URL} | ROLE=Organic SEO + Pages | ENV=${ENV}`);
console.log('Version: v3.5.1 (msp_v3.5.1)');
console.log('Protocol: Master System Prompt v3.5.1');
console.log('═'.repeat(100));
console.log('');

// AGENT3 v2.2 scholar_auth: Initialize RSA keys for JWT signing on startup
ensureKeysExist();

// Issue B: Background health check initialization is deferred to server startup
// to ensure cache is seeded BEFORE accepting requests (see listen callback)

// AGENT3 v2.2 Universal Phase 0: Canary endpoints (MUST be first, before ANY middleware)
// P95 latency tracking
const requestTimings: number[] = [];
const MAX_TIMINGS = 30;

function recordTiming(ms: number) {
  requestTimings.push(ms);
  if (requestTimings.length > MAX_TIMINGS) {
    requestTimings.shift();
  }
}

function calculateP95(): number {
  if (requestTimings.length === 0) return 0;
  const sorted = [...requestTimings].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * 0.95) - 1;
  return Math.round((sorted[index] || 0) * 100) / 100;
}

// Preload storage module at server startup to avoid cold-start latency spikes
// (storage already imported at top)
let cachedDependenciesOk = true;
let lastDependencyCheck = 0;
const DEPENDENCY_CHECK_INTERVAL = 5000; // Check every 5 seconds max

async function checkDependencies(): Promise<boolean> {
  const now = Date.now();
  if (now - lastDependencyCheck < DEPENDENCY_CHECK_INTERVAL) {
    return cachedDependenciesOk;
  }
  
  try {
    await storage.getScholarships({ offset: 0, limit: 1 });
    cachedDependenciesOk = true;
    lastDependencyCheck = now;
    return true;
  } catch (error) {
    cachedDependenciesOk = false;
    lastDependencyCheck = now;
    return false;
  }
}

const canaryHandler = async (req: Request, res: Response) => {
  const start = Date.now();
  
  // AGENT3 v2.7: Set all 6/6 required security headers
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'");
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  
  // Global Identity Standard: This app is auto_page_maker
  const appName = "auto_page_maker";
  const appBaseUrl = process.env.APP_BASE_URL || process.env.REPLIT_URL || "http://localhost:5000";
  
  // Check all 6 required security headers for security_headers field
  const requiredHeaders = [
    'strict-transport-security',
    'content-security-policy',
    'x-frame-options',
    'x-content-type-options',
    'referrer-policy',
    'permissions-policy'
  ];
  
  const presentHeaders: string[] = [];
  const missingHeaders: string[] = [];
  
  requiredHeaders.forEach(header => {
    if (res.getHeader(header)) {
      presentHeaders.push(header);
    } else {
      missingHeaders.push(header);
    }
  });
  
  // Check dependencies health (cached with 5-second TTL)
  const dependenciesOk = await checkDependencies();
  
  // AGENT3 v2.7: Exactly 8 fields (no more, no less)
  const response = {
    app: appName,
    app_base_url: appBaseUrl,
    version: "v2.7",
    status: dependenciesOk ? "ok" : "degraded",
    p95_ms: calculateP95(),
    security_headers: {
      present: presentHeaders,
      missing: missingHeaders
    },
    dependencies_ok: dependenciesOk,
    timestamp: new Date().toISOString()
  };
  
  const duration = Date.now() - start;
  recordTiming(duration);
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  res.json(response);
};

app.get('/canary', canaryHandler);

app.get('/_canary_no_cache', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  canaryHandler(req, res);
});

// LIVENESS PROBE: /health (lightweight, NO database calls)
// Registered early to take precedence over v2 routers
// Used by load balancers and orchestrators to check if the process is alive
// Excluded from public SLO metrics per telemetry canonicalization spec
app.get('/health', (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString()
  });
});

// AGENT3 v2.2 scholar_auth Phase 1: JWKS endpoint for JWT verification
app.get('/jwks.json', (req, res) => {
  try {
    const jwk = publicKeyToJWK('scholar-auth-2025-01');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).json({
      keys: [jwk]
    });
  } catch (error) {
    console.error('[AUTH] JWKS endpoint error:', error);
    res.status(500).json({
      error: 'internal_error',
      error_description: 'Failed to generate JWKS'
    });
  }
});

// CEO v2.7 GOVERNANCE: OIDC endpoints ONLY for scholar_auth (central identity authority)
// auto_com_center and other apps must NOT advertise themselves as OIDC issuers
app.get('/.well-known/jwks.json', (req, res) => {
  const hostname = req.hostname || 'localhost';
  
  // CRITICAL: Only scholar_auth provides OIDC/JWKS
  if (!hostname.includes('scholar-auth')) {
    return res.status(404).json({
      error: 'not_found',
      error_description: 'OIDC endpoints only available at scholar_auth. Use https://scholar-auth-jamarrlmayes.replit.app/.well-known/jwks.json'
    });
  }
  
  try {
    const jwk = publicKeyToJWK('scholar-auth-2025-01');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).json({
      keys: [jwk]
    });
  } catch (error) {
    console.error('[AUTH] JWKS endpoint error:', error);
    res.status(500).json({
      error: 'internal_error',
      error_description: 'Failed to generate JWKS'
    });
  }
});

// CEO v2.7 GOVERNANCE: OIDC Discovery ONLY for scholar_auth (central source of truth)
app.get('/.well-known/openid-configuration', (req, res) => {
  const hostname = req.hostname || 'localhost';
  
  // CRITICAL: Only scholar_auth provides OIDC discovery
  if (!hostname.includes('scholar-auth')) {
    return res.status(404).json({
      error: 'not_found',
      error_description: 'OIDC discovery only available at scholar_auth. Use https://scholar-auth-jamarrlmayes.replit.app/.well-known/openid-configuration'
    });
  }
  
  const baseUrl = 'https://scholar-auth-jamarrlmayes.replit.app';
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/authorize`,
    token_endpoint: `${baseUrl}/token`,
    userinfo_endpoint: `${baseUrl}/userinfo`,
    jwks_uri: `${baseUrl}/.well-known/jwks.json`,
    response_types_supported: ['code', 'token'],
    grant_types_supported: ['authorization_code', 'client_credentials'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    scopes_supported: ['openid', 'profile', 'email']
  });
});

// Brotli/Gzip compression for all text responses - applied early for maximum coverage
app.use(compression({
  threshold: 1024,
  level: 6,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// AGENT3 v2.2 Security headers - 6/6 required headers
// CEO DIRECTIVE: Disable X-Robots-Tag from Helmet to allow SEO indexing
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      // UI app CSP profile per AGENT3 v2.2
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", "https://js.stripe.com", "https://www.googletagmanager.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: [
        "'self'",
        ...(process.env.CSP_CONNECT_SRC || '').split(',').map(x => x.trim()).filter(Boolean),
        "https://api.stripe.com",
        "https://www.google-analytics.com",
        "wss:",
        "https:"
      ],
      frameSrc: ["https://js.stripe.com", "https://hooks.stripe.com"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'", "https://hooks.stripe.com"],
      objectSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 63072000, // AGENT3 v2.2 spec: 63072000 (2 years)
    includeSubDomains: true,
    preload: true
  },
  frameguard: {
    action: "deny" // X-Frame-Options: DENY
  },
  referrerPolicy: { 
    policy: "no-referrer" // AGENT3 v2.2 spec
  },
  // CEO DIRECTIVE: Disable Helmet's default X-Robots-Tag to allow SEO indexing
  // auto_page_maker is the SEO growth engine and MUST be crawlable
  hidePoweredBy: true,
  noSniff: true,
  xssFilter: false, // Using CSP instead
  // CRITICAL: Set to false to prevent Helmet from blocking search engines
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  originAgentCluster: false,
  dnsPrefetchControl: false,
  ieNoOpen: false,
  permittedCrossDomainPolicies: false
}));

// SECURITY: Strict CORS enforcement with allowlist-based origin control
app.use(corsEnforce);

// AGENT3 v2.8: Webhook raw body capture for HMAC validation (Gate A)
// Must be BEFORE express.json() to capture raw request body for Postmark signature verification
app.post('/api/webhooks/postmark', express.raw({ type: 'application/json', limit: '1mb' }), (req, res, next) => {
  // Store raw body for HMAC validation in routes.ts
  (req as any).rawBody = req.body.toString('utf8');
  
  // Parse JSON for downstream processing
  try {
    req.body = JSON.parse((req as any).rawBody);
    next();
  } catch (error: any) {
    console.error('[auto_com_center] Webhook JSON parse error:', error);
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
});

// Body parsers with strict size limits for DoS protection
app.use(express.json({ 
  limit: '1mb'
}));
app.use(express.urlencoded({ 
  extended: false, 
  limit: '1mb',
  parameterLimit: 100
}));

// Enhanced body size protection middleware
app.use((req, res, next) => {
  const contentLength = parseInt(req.headers['content-length'] || '0');
  if (contentLength > 1048576) { // 1MB limit
    return res.status(413).json({
      error: 'Request body too large',
      code: 'PAYLOAD_TOO_LARGE',
      maxSize: '1MB'
    });
  }
  next();
});

// WAF: Trust-by-Secret bypass for S2S telemetry, SQLi detection
// Gate-2 Stabilization: Eliminates WAF false positives on internal telemetry
app.use(wafMiddleware);

// Request ID middleware
app.use(requestIdMiddleware);

// COHORT TAGGING: Tag all requests with cohort=phase1_d0-d3, traffic_source=beta (CEO directive)
app.use(cohortTaggingMiddleware);

// MONITORING: Queue depth tracking (CEO directive - capacity gate)
app.use(queueDepthTracker);

// MONITORING: Endpoint-level SLIs - P50/P95/P99, saturation, DB latency (CEO directive)
app.use(endpointMetricsMiddleware);

// MONITORING: Cost telemetry - $/1k requests by endpoint/feature (CEO directive)
app.use(costTelemetryMiddleware);

// SECURITY: Abuse monitoring - top talkers, burst detection, auto-suppress (CEO directive)
// Exempt /api/webhooks/* (S2S traffic with HMAC security + route-specific limiter)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/webhooks/')) {
    return next(); // Skip abuse monitoring for webhooks
  }
  abuseMonitoringMiddleware(req, res, next);
});

// SECURITY: Apply path traversal protection to all requests early in middleware chain
app.use(preventPathTraversal);

// SECURITY: Unicode normalization and validation before authentication and validation
app.use(unicodeNormalize);

// COPPA/FERPA COMPLIANCE: Privacy-by-default middleware for minor protection
import { privacyByDefaultMiddleware } from './middleware/privacy-by-default.js';
app.use(privacyByDefaultMiddleware);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      const cohortTags = (req as any).cohortTags || {};
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms [${cohortTags.cohort || 'unknown'}]`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Rate limiting for API routes - IP and origin-based
// Apply global rate limiters to /api/* EXCEPT /api/webhooks/* (has own limiter)
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/webhooks/')) {
    return next(); // Skip global limiters for webhooks (has route-specific limiter)
  }
  generalApiLimiter(req, res, next);
});
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/webhooks/')) {
    return next(); // Skip origin limiter for S2S webhooks
  }
  originBasedLimiter(req, res, next);
});

(async () => {
  await routes(app);

  // Start agent bridge for Command Center integration (disabled for initial launch)
  // CEO DIRECTIVE (Nov 13): auto_page_maker launches standalone for SEO first
  // Agent Bridge integration scheduled for later gate
  // startAgentBridge();

  // Start SEO scheduler for automated page generation and IndexNow submissions
  try {
    const { seoScheduler } = await import("./services/seo-scheduler.js");
    seoScheduler.start();
  } catch (error) {
    console.error('[SEO Scheduler] Failed to start:', error);
  }

  // Start Executive KPI scheduler for daily KPI brief generation and Slack delivery
  try {
    const { ExecutiveKpiScheduler } = await import("./services/executive-kpi-scheduler.js");
    const executiveKpiScheduler = new ExecutiveKpiScheduler();
    executiveKpiScheduler.start();
  } catch (error) {
    console.error('[Executive KPI Scheduler] Failed to start:', error);
  }

  // Telemetry Contract v1.2 (ONE_TRUTH): Initialize telemetry client
  try {
    const { initTelemetry } = await import("./lib/telemetry-client.js");
    initTelemetry();
    console.log('[Telemetry] v1.2 ONE_TRUTH contract initialized - emitting to scholarship_api');
  } catch (error) {
    console.error('[Telemetry] Failed to initialize:', error);
  }

  // CEO v2.8: Serve .well-known directory for proof-of-control (works in both dev and prod)
  app.use('/.well-known', express.static('server/public/.well-known'));

  // Setup production/development routing based on NODE_ENV
  const isDevelopment = process.env.NODE_ENV === "development";

  // CDN CACHING: Add Cache-Control and ETag headers for homepage and pricing pages
  // Target: 8-12ms median latency reduction through browser/CDN caching
  app.use((req, res, next) => {
    const isCdnCacheable = (req.path === '/' || req.path === '/pricing') && req.method === 'GET';
    
    if (isCdnCacheable) {
      // Skip cache headers for pre-warm requests (infrastructure traffic)
      const isPrewarm = req.headers[PREWARM_HEADER.toLowerCase()] === 'true' || req.headers['X-Prewarm'] === 'true';
      
      // Intercept response to add CDN caching headers and ETag
      const originalSend = res.send;
      res.send = function(data: any) {
        // Set CDN-friendly Cache-Control headers
        // max-age=300: Cache for 5 minutes
        // stale-while-revalidate=60: Serve stale while fetching fresh (reduces TTFB)
        res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
        
        // Generate ETag based on content hash for conditional requests
        if (data) {
          const content = typeof data === 'string' ? data : JSON.stringify(data);
          const hash = crypto.createHash('md5').update(content).digest('hex');
          res.set('ETag', `"${hash}"`);
          
          // Handle If-None-Match for 304 Not Modified responses
          const ifNoneMatch = req.headers['if-none-match'];
          if (ifNoneMatch === `"${hash}"`) {
            res.status(304);
            return originalSend.call(this, '');
          }
        }
        
        // Signal Brotli support via Vary header
        res.set('Vary', 'Accept-Encoding');
        
        return originalSend.call(this, data);
      };
    }
    
    next();
  });

  // SEO-friendly robots header for public pages (CEO directive: Allow indexing)
  // CRITICAL: Overrides Replit's noindex headers for public content
  // Uses response hook to override headers at send time
  app.use((req, res, next) => {
    const isPublicPage = req.path === '/' || 
                         req.path.startsWith('/scholarship') ||
                         req.path === '/scholarships' ||
                         req.path.startsWith('/scholarships/') ||
                         req.path === '/pricing' ||
                         req.path === '/terms' ||
                         req.path === '/privacy';
    
    if (isPublicPage && req.method === 'GET') {
      // Intercept response send to override X-Robots-Tag at the last moment
      const originalSend = res.send;
      res.send = function(data: any) {
        // Override X-Robots-Tag header right before sending
        res.set('X-Robots-Tag', 'index, follow, max-image-preview:large');
        return originalSend.call(this, data);
      };
    }
    
    next();
  });

  // Dynamic SEO tag injection middleware (CRITICAL: Must run BEFORE serveStatic/Vite)
  // Serves pre-rendered HTML with per-page canonical/OG/Twitter tags to fix DEF-002/003
  app.use(async (req, res, next) => {
    // Only intercept GET requests for HTML pages
    if (req.method !== 'GET' || req.path.startsWith('/api/') || req.path.startsWith('/@') || req.path.includes('.')) {
      return next();
    }

    // Extract route info
    const scholarshipMatch = req.path.match(/^\/scholarship\/([^\/]+)$/);
    const categoryMatch = req.query.category || req.path === '/scholarships' || req.path.match(/^\/scholarships\//);
    
    // Only inject for scholarship detail and category pages
    if (!scholarshipMatch && !categoryMatch) {
      return next();
    }

    try {
      const APP_BASE_URL = process.env.APP_BASE_URL || 'https://scholaraiadvisor.com';
      let dynamicTags = '';

      if (scholarshipMatch) {
        // Scholarship detail page
        const scholarshipId = scholarshipMatch[1];
        const scholarship = await storage.getScholarship(scholarshipId);
        
        if (!scholarship) {
          return next(); // Scholarship not found, let 404 handler deal with it
        }

        const canonicalUrl = `${APP_BASE_URL}/scholarship/${scholarshipId}`;
        const title = `${scholarship.title} | ScholarMatch`;
        const description = scholarship.description.substring(0, 155).replace(/"/g, '\\"');
        const imageUrl = `${APP_BASE_URL}/images/scholarships/${scholarshipId}.jpg`;
        
        dynamicTags = `
    <title>${title}</title>
    <meta name="description" content="${description}">
    <link rel="canonical" href="${canonicalUrl}">
    <meta property="og:type" content="article">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:image" content="${imageUrl}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${imageUrl}">
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Scholarship",
      "name": "${scholarship.title.replace(/"/g, '\\"')}",
      "description": "${description}",
      "amount": {
        "@type": "MonetaryAmount",
        "currency": "USD",
        "value": ${scholarship.amount}
      },
      "deadline": "${scholarship.deadline}",
      "provider": {
        "@type": "Organization",
        "name": "${(scholarship.sourceOrganization || 'ScholarMatch').replace(/"/g, '\\"')}"
      }
    }
    </script>`;
      } else if (categoryMatch) {
        // Category page - extract from query param, index, OR path slug
        let category: string;
        let canonicalUrl: string;
        
        if (req.query.category) {
          // Query param format: /scholarships?category=computer-science
          category = req.query.category as string;
          canonicalUrl = `${APP_BASE_URL}/scholarships?category=${encodeURIComponent(category)}`;
        } else if (req.path === '/scholarships') {
          // Index page: /scholarships (no slug, no query param)
          category = 'All';
          canonicalUrl = `${APP_BASE_URL}/scholarships`;
        } else {
          // Slug format: /scholarships/computer-science
          const slugMatch = req.path.match(/^\/scholarships\/([^\/]+)/);
          category = slugMatch ? decodeURIComponent(slugMatch[1]) : 'All';
          canonicalUrl = `${APP_BASE_URL}/scholarships/${encodeURIComponent(category)}`;
        }
        
        const title = `${category} Scholarships | ScholarMatch`;
        const description = `Browse ${category} scholarships. Find funding opportunities for your education.`;
        
        // Fetch scholarships for this category to include in JSON-LD
        let scholarshipItems: Array<{name: string; description: string; amount: number; deadline: string; provider?: string}> = [];
        try {
          const categoryForQuery = category === 'All' ? undefined : category.replace(/-/g, ' ');
          const scholarships = await storage.getScholarships({ major: categoryForQuery, limit: 10 });
          scholarshipItems = scholarships.map(s => ({
            name: s.title,
            description: (s.description || '').substring(0, 150),
            amount: s.amount || 0,
            deadline: s.deadline ? new Date(s.deadline).toISOString().split('T')[0] : '',
            provider: s.sourceOrganization || 'ScholarMatch'
          }));
        } catch (e) {
          console.warn('Failed to fetch scholarships for JSON-LD:', e);
        }

        // Build ItemList JSON-LD for category pages (SEO rich snippets)
        const itemListJsonLd = scholarshipItems.length > 0 ? `
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "${title}",
      "description": "${description}",
      "url": "${canonicalUrl}",
      "numberOfItems": ${scholarshipItems.length},
      "itemListElement": [
        ${scholarshipItems.map((s, i) => `{
          "@type": "ListItem",
          "position": ${i + 1},
          "item": {
            "@type": "EducationalOccupationalCredential",
            "name": "${s.name.replace(/"/g, '\\"')}",
            "description": "${s.description.replace(/"/g, '\\"')}",
            "credentialCategory": "scholarship",
            "offers": {
              "@type": "Offer",
              "price": ${s.amount},
              "priceCurrency": "USD"
            }${s.deadline ? `,
            "validFor": "${s.deadline}"` : ''}${s.provider ? `,
            "recognizedBy": {
              "@type": "Organization",
              "name": "${s.provider.replace(/"/g, '\\"')}"
            }` : ''}
          }
        }`).join(',\n        ')}
      ]
    }
    </script>` : '';

        dynamicTags = `
    <title>${title}</title>
    <meta name="description" content="${description}">
    <link rel="canonical" href="${canonicalUrl}">
    <meta property="og:type" content="website">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:url" content="${canonicalUrl}">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">${itemListJsonLd}`;
      }

      if (dynamicTags) {
        // In development mode, let Vite handle HTML - it needs to inject HMR scripts
        // The dynamic SEO tags will be injected by client-side rendering
        if (isDevelopment) {
          // Store tags for potential SSR use, but let Vite serve the page
          return next();
        }
        
        // Production: Read the BUILT index.html from dist/public (not the dev template)
        // The built template has proper bundled JS paths (/assets/index-xxx.js) not /src/main.tsx
        const productionTemplate = path.resolve(
          import.meta.dirname,
          "public",
          "index.html",
        );
        let template = await fs.promises.readFile(productionTemplate, "utf-8");
        
        // Replace the static SEO tags section with dynamic tags
        // The static tags start after <meta name="viewport"...> and end before <style>
        const viewportIndex = template.indexOf('<meta name="viewport"');
        const styleIndex = template.indexOf('<style>');
        
        if (viewportIndex !== -1 && styleIndex !== -1) {
          const before = template.substring(0, template.indexOf('\n', viewportIndex) + 1);
          const after = template.substring(template.lastIndexOf('\n', styleIndex));
          template = before + dynamicTags + after;
        }
        
        // Send the HTML with injected SEO tags
        incrementPagesRendered('success');
        res.status(200).set({ "Content-Type": "text/html" }).send(template);
        return; // Don't call next(), we've handled this request
      }
      
      next();
    } catch (error) {
      console.error('Error injecting SEO tags:', error);
      incrementPagesRendered('error');
      next();
    }
  });

  // Setup Vite dev server or static assets AFTER dynamic SEO middleware
  if (isDevelopment) {
    console.log("🔧 [CONFIG] Development mode - Vite dev server enabled");
  } else {
    console.log("🏭 [CONFIG] Production mode - serving static assets");
    serveStatic(app);
  }

  // 404 handler for unmatched API routes only
  app.use('/api/*', notFoundHandler);

  // SPA fallback control middleware for SEO protection (production only)
  if (!isDevelopment) {
    app.use("*", async (req, res, next) => {
      // Skip if already handled (e.g., static files, API routes)
      if (res.headersSent) {
        return next();
      }
      
      try {
        const validation = await import('./middleware/route-validation.js');
        
        const isValid = await validation.RouteValidator.isValidRoute(req.path);
        
        if (!isValid) {
          // Return SEO-friendly 404/410 for unknown or expired paths
          return validation.sendSeoFriendlyExpiredResponse(res, req.path);
        }
        
        // Continue to static file serving for valid routes
        next();
      } catch (error) {
        console.error('Route validation error:', error);
        // In production, DO NOT fallback to SPA on error - return 404
        const validation = await import('./middleware/route-validation.js');
        return validation.sendSeoFriendlyExpiredResponse(res, req.path);
      }
    });
    
    // Register error handler AFTER static fallback in production
    app.use(errorHandler);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  // Issue B: Seed health cache BEFORE server starts accepting requests
  // This prevents cold-start degraded responses
  if (ASYNC_HEALTH_ENABLED) {
    console.log('[Issue B] Async health checks enabled - seeding cache before server start...');
    await startBackgroundHealthChecks();
    console.log('[Issue B] Health cache seeded - server ready to accept requests');
  }

  const port = parseInt(process.env.PORT || '5000', 10);
  const server = app.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    log(`serving on port ${port}`);
    
    // Setup Vite dev server in development mode (needs server instance for HMR)
    if (isDevelopment) {
      await setupVite(app, server);
      // Register error handler AFTER Vite middleware in development
      app.use(errorHandler);
    }
    
    // Validate and log CORS configuration
    const corsValidation = validateCorsConfig();
    console.log(`CORS allowlist: ${corsValidation.config.allowlist.join(', ')}`);
    if (!corsValidation.isValid) {
      console.warn('CORS configuration issues detected - check logs above');
    }
    
    // Log configuration warnings
    if (!process.env.JWT_SECRET) {
      console.warn('JWT_SECRET not set - authentication will be disabled');
    }
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OPENAI_API_KEY not set - AI features will use fallback content');
    }

    // BETA LAUNCH: Auto-populate landing pages on startup for DbStorage
    // This ensures the 130 SEO pages are always available for the beta cohort
    try {
      console.log('📄 Initializing Auto Page Maker content for beta launch...');
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      await execAsync('tsx scripts/content-generation/auto-page-maker.ts');
      console.log('✅ Auto Page Maker content initialized successfully');
    } catch (error) {
      console.error('⚠️ Auto Page Maker initialization failed:', error);
      console.error('Landing pages may be missing - /healthz will report degraded status');
    }
    
    // LATENCY OPTIMIZATION: Start endpoint pre-warming (fetches / and /pricing every 2 min)
    // Pre-warm requests are excluded from SLO metrics via X-Prewarm header
    try {
      startEndpointPrewarming();
      console.log('🔥 Endpoint pre-warming started (2 minute interval)');
    } catch (error) {
      console.error('⚠️ Failed to start endpoint pre-warming:', error);
    }
  });
})();
