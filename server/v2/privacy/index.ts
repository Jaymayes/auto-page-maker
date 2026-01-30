import { Request, Response, NextFunction } from 'express';
import { User } from '@shared/schema';

export interface PrivacyFlags {
  doNotSell: boolean;
  privacyMode: 'standard' | 'enhanced' | 'minor';
  gpcHonored: boolean;
  isMinor: boolean;
  trackingDisabled: boolean;
}

export interface PrivacyAwareRequest extends Request {
  privacyFlags?: PrivacyFlags;
  user?: User;
}

export function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  
  if (isNaN(birthDate.getTime())) {
    throw new Error('Invalid date of birth');
  }
  
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  const dayDiff = today.getDate() - birthDate.getDate();
  
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age--;
  }
  
  return age;
}

export function shouldDisableTracking(user: User | undefined, headers: Record<string, string | string[] | undefined>): boolean {
  const gpcHeader = headers['sec-gpc'];
  const dntHeader = headers['dnt'];
  
  if (gpcHeader === '1' || dntHeader === '1') {
    return true;
  }
  
  if (!user) {
    return false;
  }
  
  if (user.isMinor || user.privacyMode === 'minor') {
    return true;
  }
  
  if (user.doNotSell) {
    return true;
  }
  
  return false;
}

export function getPrivacyFlags(
  user: User | undefined,
  headers: Record<string, string | string[] | undefined>
): PrivacyFlags {
  const gpcHeader = headers['sec-gpc'];
  const dntHeader = headers['dnt'];
  const gpcPresent = gpcHeader === '1' || dntHeader === '1';
  
  if (!user) {
    return {
      doNotSell: gpcPresent,
      privacyMode: gpcPresent ? 'enhanced' : 'standard',
      gpcHonored: gpcPresent,
      isMinor: false,
      trackingDisabled: gpcPresent,
    };
  }
  
  const isMinor = user.isMinor ?? false;
  const doNotSell = user.doNotSell ?? isMinor ?? gpcPresent;
  const privacyMode = isMinor ? 'minor' : (user.privacyMode as 'standard' | 'enhanced' | 'minor') ?? 'standard';
  const gpcHonored = gpcPresent || (user.gpcHonored ?? false);
  const trackingDisabled = shouldDisableTracking(user, headers);
  
  return {
    doNotSell,
    privacyMode,
    gpcHonored,
    isMinor,
    trackingDisabled,
  };
}

export function ageDetectionMiddleware(
  req: PrivacyAwareRequest,
  res: Response,
  next: NextFunction
): void {
  const user = req.user;
  
  if (!user || !user.dateOfBirth) {
    return next();
  }
  
  try {
    const age = calculateAge(new Date(user.dateOfBirth));
    const isMinor = age < 18;
    
    if (isMinor) {
      (req.user as any).isMinor = true;
      (req.user as any).doNotSell = true;
      (req.user as any).privacyMode = 'minor';
    }
    
    next();
  } catch (error) {
    console.error('Age detection error:', error);
    next();
  }
}

export function gpcMiddleware(
  req: PrivacyAwareRequest,
  res: Response,
  next: NextFunction
): void {
  const gpcHeader = req.headers['sec-gpc'];
  const dntHeader = req.headers['dnt'];
  const gpcEnabled = gpcHeader === '1' || dntHeader === '1';
  
  if (gpcEnabled) {
    res.setHeader('X-GPC-Honored', '1');
    
    if (req.user) {
      (req.user as any).gpcHonored = true;
    }
    
    req.privacyFlags = req.privacyFlags ?? {
      doNotSell: true,
      privacyMode: 'enhanced',
      gpcHonored: true,
      isMinor: false,
      trackingDisabled: true,
    };
    
    if (req.privacyFlags) {
      req.privacyFlags.gpcHonored = true;
      req.privacyFlags.trackingDisabled = true;
    }
  }
  
  next();
}

const TRACKING_PIXEL_PATTERNS = [
  'facebook.com/tr',
  'google-analytics.com',
  'googletagmanager.com',
  'doubleclick.net',
  'ads.google.com',
  'connect.facebook.net',
  'pixel.facebook.com',
  'analytics.tiktok.com',
  'snap.licdn.com',
  'bat.bing.com',
  'px.ads.linkedin.com',
];

export function filterTrackingPixels(html: string): string {
  let filtered = html;
  
  for (const pattern of TRACKING_PIXEL_PATTERNS) {
    const scriptRegex = new RegExp(
      `<script[^>]*src=["'][^"']*${pattern.replace(/\./g, '\\.')}[^"']*["'][^>]*>.*?</script>`,
      'gi'
    );
    filtered = filtered.replace(scriptRegex, '<!-- tracking pixel removed for privacy -->');
    
    const imgRegex = new RegExp(
      `<img[^>]*src=["'][^"']*${pattern.replace(/\./g, '\\.')}[^"']*["'][^>]*>`,
      'gi'
    );
    filtered = filtered.replace(imgRegex, '<!-- tracking pixel removed for privacy -->');
  }
  
  return filtered;
}

export function privacyPolicyMiddleware(
  req: PrivacyAwareRequest,
  res: Response,
  next: NextFunction
): void {
  const user = req.user;
  const flags = getPrivacyFlags(user, req.headers);
  
  req.privacyFlags = flags;
  
  if (flags.privacyMode === 'minor' || flags.doNotSell || flags.trackingDisabled) {
    res.setHeader('X-Privacy-Mode', flags.privacyMode);
    res.setHeader('X-Do-Not-Sell', flags.doNotSell ? '1' : '0');
    res.setHeader('X-Tracking-Disabled', flags.trackingDisabled ? '1' : '0');
    
    if (flags.gpcHonored) {
      res.setHeader('X-GPC-Honored', '1');
    }
    
    const originalSend = res.send.bind(res);
    res.send = function (body: any): Response {
      if (typeof body === 'string' && flags.trackingDisabled) {
        const contentType = res.getHeader('content-type');
        if (contentType && String(contentType).includes('text/html')) {
          body = filterTrackingPixels(body);
        }
      }
      return originalSend(body);
    };
  }
  
  next();
}

export function createPrivacyMiddlewareStack(): Array<(req: PrivacyAwareRequest, res: Response, next: NextFunction) => void> {
  return [
    ageDetectionMiddleware,
    gpcMiddleware,
    privacyPolicyMiddleware,
  ];
}

export default {
  calculateAge,
  shouldDisableTracking,
  getPrivacyFlags,
  filterTrackingPixels,
  ageDetectionMiddleware,
  gpcMiddleware,
  privacyPolicyMiddleware,
  createPrivacyMiddlewareStack,
};
