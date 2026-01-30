/**
 * Internal Service Authentication Middleware
 * 
 * Validates X-Internal-Key header for server-to-server API calls.
 * Used by scholarship_agent, auto_com_center, and other internal services
 * to securely call auto_page_maker endpoints like POST /rebuild.
 * 
 * Environment Variables:
 * - X_INTERNAL_KEY: Shared secret for S2S authentication
 */

import type { Request, Response, NextFunction } from 'express';

export interface InternalAuthenticatedRequest extends Request {
  internal: {
    authenticated: true;
    source?: string; // Optional: service name from header
  };
}

/**
 * Middleware to validate X-Internal-Key header
 */
export function validateInternalKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const internalKey = process.env.X_INTERNAL_KEY;

  // If X_INTERNAL_KEY not configured, fail closed (deny access)
  if (!internalKey) {
    console.error('[InternalAuth] X_INTERNAL_KEY not configured - denying access');
    res.status(503).json({
      error: 'Service Unavailable',
      message: 'Internal service authentication not configured',
      code: 'INTERNAL_AUTH_NOT_CONFIGURED',
    });
    return;
  }

  const providedKey = req.headers['x-internal-key'] as string;

  if (!providedKey) {
    console.warn('[InternalAuth] Missing X-Internal-Key header');
    res.status(401).json({
      error: 'Unauthorized',
      message: 'X-Internal-Key header required for internal API access',
      code: 'MISSING_INTERNAL_KEY',
    });
    return;
  }

  // Constant-time comparison to prevent timing attacks
  if (!constantTimeCompare(providedKey, internalKey)) {
    console.warn('[InternalAuth] Invalid X-Internal-Key provided');
    res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid X-Internal-Key',
      code: 'INVALID_INTERNAL_KEY',
    });
    return;
  }

  // Authentication successful
  const internalReq = req as InternalAuthenticatedRequest;
  internalReq.internal = {
    authenticated: true,
    source: (req.headers['x-service-name'] as string) || 'unknown',
  };

  console.log(`[InternalAuth] Authenticated internal request from: ${internalReq.internal.source}`);
  next();
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Optional: Middleware to log internal API calls for audit trail
 */
export function logInternalCall(
  req: InternalAuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log('[InternalAuth] Internal API call', {
      source: req.internal?.source || 'unknown',
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
  });

  next();
}
