import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      trackingAllowed?: boolean;
      userAge?: number | 'unknown';
    }
  }
}

export interface PrivacyAuditEntry {
  timestamp: string;
  age_range: '0-12' | '13-17' | '18+' | 'unknown';
  tracking_suppressed: boolean;
  pixels_blocked: string[];
  coppa_protected: boolean;
  request_path: string;
}

const AUDIT_BUFFER_MAX_SIZE = 1000;
const privacyAuditBuffer: PrivacyAuditEntry[] = [];

function getAgeRange(age: number | 'unknown'): '0-12' | '13-17' | '18+' | 'unknown' {
  if (age === 'unknown') return 'unknown';
  if (age < 13) return '0-12';
  if (age < 18) return '13-17';
  return '18+';
}

function logPrivacyAuditEntry(entry: PrivacyAuditEntry): void {
  if (privacyAuditBuffer.length >= AUDIT_BUFFER_MAX_SIZE) {
    privacyAuditBuffer.shift();
  }
  privacyAuditBuffer.push(entry);
  
  console.log(`[PRIVACY_AUDIT] [${entry.timestamp}] age_range=${entry.age_range} tracking_suppressed=${entry.tracking_suppressed} pixels_blocked=${entry.pixels_blocked.join(',')} coppa=${entry.coppa_protected}`);
}

export function getPrivacyAuditLog(limit: number = 100): PrivacyAuditEntry[] {
  const startIndex = Math.max(0, privacyAuditBuffer.length - limit);
  return privacyAuditBuffer.slice(startIndex);
}

export function getPrivacyAuditStats(): {
  total_entries: number;
  minors_suppressed: number;
  coppa_protected: number;
  last_entry: PrivacyAuditEntry | null;
} {
  const minorsSuppressed = privacyAuditBuffer.filter(e => e.tracking_suppressed).length;
  const coppaProtected = privacyAuditBuffer.filter(e => e.coppa_protected).length;
  
  return {
    total_entries: privacyAuditBuffer.length,
    minors_suppressed: minorsSuppressed,
    coppa_protected: coppaProtected,
    last_entry: privacyAuditBuffer.length > 0 ? privacyAuditBuffer[privacyAuditBuffer.length - 1] : null
  };
}

function calculateAge(birthDate: Date): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function detectUserAge(req: Request): number | 'unknown' {
  const ageHeader = req.headers['x-user-age'];
  if (ageHeader) {
    const parsedAge = parseInt(ageHeader as string, 10);
    if (!isNaN(parsedAge) && parsedAge >= 0 && parsedAge < 150) {
      return parsedAge;
    }
  }

  const session = (req as any).session;
  if (session?.userAge !== undefined) {
    const sessionAge = parseInt(session.userAge, 10);
    if (!isNaN(sessionAge) && sessionAge >= 0 && sessionAge < 150) {
      return sessionAge;
    }
  }

  const user = (req as any).user;
  if (user?.birthDate) {
    try {
      const birthDate = new Date(user.birthDate);
      if (!isNaN(birthDate.getTime())) {
        return calculateAge(birthDate);
      }
    } catch (e) {
    }
  }

  return 'unknown';
}

export function privacyByDefaultMiddleware(req: Request, res: Response, next: NextFunction) {
  const age = detectUserAge(req);
  req.userAge = age;

  const isMinor = typeof age === 'number' && age < 18;
  const isCoppaProtected = typeof age === 'number' && age < 13;

  if (isMinor) {
    req.trackingAllowed = false;
    res.cookie('_ga_suppress', '1', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });
    res.locals.showPrivacyDisclaimer = true;
    res.locals.isMinor = true;

    const auditEntry: PrivacyAuditEntry = {
      timestamp: new Date().toISOString(),
      age_range: getAgeRange(age),
      tracking_suppressed: true,
      pixels_blocked: ['google_analytics', 'facebook_pixel', 'linkedin_insight'],
      coppa_protected: isCoppaProtected,
      request_path: req.path
    };
    logPrivacyAuditEntry(auditEntry);
  } else {
    req.trackingAllowed = true;
    res.locals.showPrivacyDisclaimer = false;
    res.locals.isMinor = false;
  }

  if (isCoppaProtected) {
    res.locals.requiresParentalConsent = true;
    console.warn(`[COPPA] Protected user (age ${age}) accessing site: ${req.method} ${req.path}`);
  } else {
    res.locals.requiresParentalConsent = false;
  }

  next();
}
