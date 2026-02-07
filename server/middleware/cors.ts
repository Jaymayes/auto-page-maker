import { Request, Response, NextFunction } from 'express';

// Parse comma-separated list from environment
const parseList = (s?: string) => new Set((s || '').split(',').map(x => x.trim()).filter(Boolean));

// CEO DIRECTIVE (Nov 13): Zero hardcoded URLs - all from environment variables
// Gate 0 requirement: CORS allowlist must use FRONTEND_ORIGINS environment variable
const buildAllowlist = () => {
  const allowlist = new Set<string>();
  
  // Required: Frontend origins from environment
  const frontendOrigins = process.env.FRONTEND_ORIGINS || process.env.CORS_ALLOWLIST || '';
  frontendOrigins.split(',').map(x => x.trim()).filter(Boolean).forEach(origin => {
    allowlist.add(origin);
  });
  
  // Development mode: add localhost origins
  if (process.env.NODE_ENV === 'development') {
    allowlist.add('http://localhost:5000');
    allowlist.add('http://127.0.0.1:5000');
    
    // Add Replit dev domain if available
    if (process.env.REPLIT_DEV_DOMAIN) {
      allowlist.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
  }
  
  return allowlist;
};

// Configuration from environment variables with secure defaults
const ALLOWLIST = () => {
  return buildAllowlist();
};
const ALLOW_CREDENTIALS = (process.env.CORS_ALLOW_CREDENTIALS || 'false').toLowerCase() === 'true';
const MAX_AGE = Number(process.env.CORS_MAX_AGE || 600);
const LOG_ONLY = (process.env.CORS_LOG_ONLY || 'false').toLowerCase() === 'true';

// Common headers for CORS responses  
const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin, User-Agent',
  'Access-Control-Max-Age': MAX_AGE.toString(),
  'Vary': 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers'
};

/**
 * Strict CORS enforcement middleware with allowlist-based origin control
 * 
 * Features:
 * - Exact origin matching against allowlist
 * - No wildcard Access-Control-Allow-Origin when credentials enabled
 * - Efficient OPTIONS preflight handling
 * - Server-to-server requests (no Origin header) allowed
 * - Comprehensive logging for security monitoring
 */
export const corsEnforce = (req: Request, res: Response, next: NextFunction) => {
  try {
    const origin = req.headers.origin;
    const allowlist = ALLOWLIST();

    // Skip CORS checking for static assets - these are same-origin requests
    // that don't need CORS validation (JS, CSS, images, fonts)
    if (req.path.startsWith('/assets/') || req.path.startsWith('/images/') || req.path.endsWith('.ico')) {
      return next();
    }

    // Server-to-server requests (no Origin header) are allowed
    if (!origin) {
      console.log(`[CORS] Server-to-server request allowed: ${req.method} ${req.path} from IP: ${req.ip}`);
      return next();
    }

    // Check if origin is in allowlist
    const isAllowed = allowlist.has(origin);
    
    
    // Log CORS decisions for monitoring
    if (isAllowed) {
      console.log(`[CORS] Origin allowed: ${origin} for ${req.method} ${req.path} from IP: ${req.ip}`);
    } else {
      console.warn(`[CORS] Origin blocked: ${origin} for ${req.method} ${req.path} from IP: ${req.ip}`);
    }

    // In log-only mode, don't block but still set appropriate headers
    if (LOG_ONLY && !isAllowed) {
      console.log(`[CORS] LOG_ONLY mode: would block origin ${origin}`);
      // Don't set CORS headers for disallowed origins in log-only mode
      return next();
    }

    // Block disallowed origins
    if (!isAllowed) {
      return res.status(403).json({
        error: 'Forbidden: Origin not allowed',
        code: 'CORS_ORIGIN_NOT_ALLOWED'
      });
    }

    // Set CORS headers for allowed origins
    // SECURITY: Never use wildcard (*) when credentials are enabled
    res.setHeader('Access-Control-Allow-Origin', origin);
    
    if (ALLOW_CREDENTIALS) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // Set enhanced Vary header to prevent cache poisoning
    res.setHeader('Vary', 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers');

    // Handle preflight OPTIONS requests with optimized performance
    if (req.method === 'OPTIONS') {
      // Set preflight-specific headers efficiently
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, User-Agent');
      res.setHeader('Access-Control-Max-Age', '600');
      res.setHeader('Vary', 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers');

      console.log(`[CORS] Preflight handled for origin: ${origin}`);
      return res.status(204).end();
    }

    // For non-preflight requests, set basic CORS headers
    res.setHeader('Access-Control-Allow-Methods', CORS_HEADERS['Access-Control-Allow-Methods']);
    res.setHeader('Access-Control-Allow-Headers', CORS_HEADERS['Access-Control-Allow-Headers']);

    next();
  } catch (error) {
    console.error('[CORS] Error in CORS middleware:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      code: 'CORS_MIDDLEWARE_ERROR'
    });
  }
};

/**
 * Utility function to validate CORS configuration
 */
export const validateCorsConfig = () => {
  const allowlist = ALLOWLIST();
  const warnings: string[] = [];

  if (allowlist.size === 0) {
    warnings.push('CORS_ALLOWLIST is empty - all origins will be blocked');
  }

  if (ALLOW_CREDENTIALS && allowlist.has('*')) {
    warnings.push('SECURITY WARNING: Wildcard origin with credentials is not allowed');
  }

  // Validate origin format
  allowlist.forEach(origin => {
    try {
      new URL(origin);
    } catch (e) {
      warnings.push(`Invalid origin format in allowlist: ${origin}`);
    }
  });

  if (warnings.length > 0) {
    console.warn('[CORS] Configuration warnings:');
    warnings.forEach(warning => console.warn(`  - ${warning}`));
  }

  return {
    isValid: warnings.length === 0,
    warnings,
    config: {
      allowlist: Array.from(allowlist),
      allowCredentials: ALLOW_CREDENTIALS,
      maxAge: MAX_AGE,
      logOnly: LOG_ONLY
    }
  };
};

/**
 * Get current CORS configuration for debugging
 */
export const getCorsConfig = () => {
  return {
    allowlist: Array.from(ALLOWLIST()),
    allowCredentials: ALLOW_CREDENTIALS,
    maxAge: MAX_AGE,
    logOnly: LOG_ONLY
  };
};