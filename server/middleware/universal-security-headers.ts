import { Request, Response, NextFunction } from 'express';

/**
 * AGENT3 v2.5 Universal Security Headers Middleware
 * 
 * Applies 6 required security headers to 100% of responses across all apps.
 * These headers provide defense-in-depth against common web vulnerabilities.
 */
export const universalSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // 1. HSTS - Force HTTPS for 1 year
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // 2. CSP - Restrict resource loading, prevent XSS
  // Note: Extend as needed for payments/embeds per app requirements
  res.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'");
  
  // 3. X-Frame-Options - Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // 4. X-Content-Type-Options - Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // 5. Referrer-Policy - Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // 6. Permissions-Policy - Restrict browser features
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  
  next();
};
