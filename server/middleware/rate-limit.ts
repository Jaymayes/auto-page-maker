import rateLimit from 'express-rate-limit';
import { Request } from 'express';

// IP-based rate limiting with enhanced configuration
export const createRateLimiter = (windowMs: number, max: number, message: string = 'Too many requests from this IP, please try again later') => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message, code: 'RATE_LIMIT_EXCEEDED' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      console.warn(`[RATE LIMIT] Blocked ${req.ip} on ${req.method} ${req.path}`);
      res.status(429).json({
        error: message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// General API rate limiter - 1000 requests per 15 minutes (production-ready)
// Tuned for beta load: 1000/15min = 1.1 req/sec per IP (66 req/min)
export const generalApiLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  1000, // Increased from 100 for production traffic
  'Too many API requests from this IP, please try again later'
);

// Strict rate limiter for sensitive endpoints - 5 requests per minute
export const strictApiLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  5,
  'Too many requests to sensitive endpoint, please try again later'
);

// Content generation rate limiter - 10 requests per hour
export const contentGenerationLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  10,
  'Content generation rate limit exceeded, please try again later'
);

// Per-origin rate limiting for CORS enforcement  
export const createOriginLimiter = (windowMs: number, max: number) => {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: (req: Request) => {
      // Use origin only for rate limiting to avoid IPv6 issues
      return req.headers.origin || 'no-origin';
    },
    handler: (req, res) => {
      console.warn(`[ORIGIN RATE LIMIT] Blocked origin ${req.headers.origin} from IP ${req.ip}`);
      res.status(429).json({
        error: 'Origin rate limit exceeded',
        code: 'ORIGIN_RATE_LIMIT_EXCEEDED'
      });
    }
  });
};

export const originBasedLimiter = createOriginLimiter(
  15 * 60 * 1000, // 15 minutes
  2000 // Increased from 200 for production traffic (2.2 req/sec per origin)
);

// Authenticated user rate limiter - 3000 requests per 15 minutes
// Higher limit for authenticated users to prevent token abuse without penalizing shared networks
export const authenticatedUserLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3000, // 3.3 req/sec per authenticated user
  keyGenerator: (req: Request) => {
    // Use user ID from session/JWT if authenticated, skip for anonymous
    const user = (req as any).user;
    if (user?.id) {
      return `user:${user.id}`;
    }
    // For anonymous users, let default IP limiter handle it (return undefined)
    return undefined as any; // Skip this limiter for non-auth users
  },
  skip: (req: Request) => {
    // Skip rate limiting for non-authenticated requests (they use IP limiter)
    return !(req as any).user;
  },
  skipFailedRequests: true, // Don't count failed requests against limit
  handler: (req, res) => {
    console.warn(`[AUTH RATE LIMIT] Blocked user ${(req as any).user?.id}`);
    res.status(429).json({
      error: 'Authenticated user rate limit exceeded',
      code: 'USER_RATE_LIMIT_EXCEEDED',
      retryAfter: 900 // 15 minutes in seconds
    });
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Landing page generation rate limiter - 20 requests per hour
export const landingPageLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  20,
  'Landing page generation rate limit exceeded, please try again later'
);

// Quality check rate limiter - 30 requests per hour
export const qualityCheckLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  30,
  'Quality check rate limit exceeded, please try again later'
);