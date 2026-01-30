import { Request, Response, NextFunction } from 'express';

interface PrivacyContext {
  isMinor: boolean;
  doNotSell: boolean;
  trackingDisabled: boolean;
}

declare global {
  namespace Express {
    interface Request {
      privacy?: PrivacyContext;
    }
  }
}

export function ageGateMiddleware(req: Request, res: Response, next: NextFunction) {
  const age = req.body?.age || req.query?.age;
  const declaredAge = age ? parseInt(age as string, 10) : null;
  
  const isMinor = declaredAge !== null && declaredAge < 18;
  
  req.privacy = {
    isMinor,
    doNotSell: isMinor,
    trackingDisabled: isMinor
  };
  
  if (isMinor) {
    res.setHeader('X-Privacy-Mode', 'minor');
    res.setHeader('X-Do-Not-Sell', 'true');
    
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'"
    ].join('; ');
    res.setHeader('Content-Security-Policy', csp);
    
    console.log(`[privacy] Minor detected (age ${declaredAge}), DoNotSell=true, tracking disabled`);
    
    logPrivacyEvent({
      event: 'privacy_enforced',
      user_agent: req.headers['user-agent'],
      age: declaredAge,
      do_not_sell: true,
      tracking_disabled: true,
      timestamp: new Date().toISOString()
    });
  }
  
  next();
}

export function getRestrictedCSP(): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
}

export function getStandardCSP(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://js.stripe.com https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.stripe.com https://www.google-analytics.com",
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' https://hooks.stripe.com"
  ].join('; ');
}

interface PrivacyEvent {
  event: string;
  user_agent?: string;
  age?: number | null;
  do_not_sell: boolean;
  tracking_disabled: boolean;
  timestamp: string;
}

function logPrivacyEvent(event: PrivacyEvent): void {
  console.log('[privacy-event]', JSON.stringify(event));
}

export function suppressTrackingPixels(html: string, isMinor: boolean): string {
  if (!isMinor) return html;
  
  const trackingPatterns = [
    /<script[^>]*facebook[^>]*>[\s\S]*?<\/script>/gi,
    /<script[^>]*tiktok[^>]*>[\s\S]*?<\/script>/gi,
    /<script[^>]*meta[^>]*pixel[^>]*>[\s\S]*?<\/script>/gi,
    /<img[^>]*facebook[^>]*>/gi,
    /<img[^>]*pixel[^>]*>/gi
  ];
  
  let sanitized = html;
  for (const pattern of trackingPatterns) {
    sanitized = sanitized.replace(pattern, '<!-- tracking suppressed for minor -->');
  }
  
  return sanitized;
}

export default {
  ageGateMiddleware,
  getRestrictedCSP,
  getStandardCSP,
  suppressTrackingPixels
};
