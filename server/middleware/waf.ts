import { Request, Response, NextFunction } from 'express';

const TRUSTED_CIDRS = [
  '35.184.0.0/13',
  '35.192.0.0/12',
  '10.0.0.0/8',
  '127.0.0.0/8'
];

const ALLOWED_TELEMETRY_PATHS = [
  '/api/telemetry/ingest',
  '/telemetry/ingest',
  '/api/report'
];

const SQLI_PATTERNS = [
  /UNION\s+(ALL\s+)?SELECT/i,
  /\bOR\s+1\s*=\s*1\b/i,
  /\bAND\s+1\s*=\s*1\b/i,
  /--\s*$/,
  /\/\*.*\*\//,
  /;\s*(DROP|DELETE|UPDATE|INSERT|CREATE|ALTER|EXEC|EXECUTE)\b/i,
  /\b(sp_|xp_)\w+/i,
  /LOAD_FILE\s*\(/i,
  /INTO\s+(OUT|DUMP)FILE/i,
  /\bSLEEP\s*\(/i,
  /\bBENCHMARK\s*\(/i,
  /\bWAITFOR\s+DELAY\b/i
];

function ipMatchesCidr(ip: string, cidr: string): boolean {
  try {
    const [range, bits] = cidr.split('/');
    const mask = parseInt(bits, 10);
    
    const ipParts = ip.split('.').map(Number);
    const rangeParts = range.split('.').map(Number);
    
    if (ipParts.length !== 4 || rangeParts.length !== 4) return false;
    
    const ipNum = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
    const rangeNum = (rangeParts[0] << 24) | (rangeParts[1] << 16) | (rangeParts[2] << 8) | rangeParts[3];
    const maskNum = ~((1 << (32 - mask)) - 1);
    
    return (ipNum & maskNum) === (rangeNum & maskNum);
  } catch {
    return false;
  }
}

function isIpTrusted(ip: string | undefined): boolean {
  if (!ip) return false;
  const cleanIp = ip.replace(/^::ffff:/, '');
  return TRUSTED_CIDRS.some(cidr => ipMatchesCidr(cleanIp, cidr));
}

function isTelemetryPath(path: string): boolean {
  return ALLOWED_TELEMETRY_PATHS.some(allowed => path.startsWith(allowed));
}

function containsSqli(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  return SQLI_PATTERNS.some(pattern => pattern.test(value));
}

function checkObjectForSqli(obj: any, depth = 0): string | null {
  if (depth > 10) return null;
  if (!obj || typeof obj !== 'object') return null;
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      if (containsSqli(value)) {
        return `SQLi pattern in field: ${key}`;
      }
    } else if (typeof value === 'object' && value !== null) {
      const nested = checkObjectForSqli(value, depth + 1);
      if (nested) return nested;
    }
  }
  return null;
}

export const wafMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const sharedSecret = req.headers['x-scholar-shared-secret'] as string | undefined;
  const expectedSecret = process.env.SHARED_SECRET;
  const clientIp = req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0].trim();
  const path = req.path;

  if (
    expectedSecret &&
    sharedSecret === expectedSecret &&
    isIpTrusted(clientIp) &&
    isTelemetryPath(path)
  ) {
    console.log(`[WAF] BYPASS S2S for allowed telemetry: ${path} from IP: ${clientIp}`);
    return next();
  }

  const sqliCheck = checkObjectForSqli(req.body);
  if (sqliCheck) {
    console.warn(`[WAF] BLOCK SQLi attempt: ${sqliCheck} from IP: ${clientIp} path: ${path}`);
    return res.status(403).json({
      error: 'Forbidden',
      code: 'WAF_SQLI_BLOCKED',
      message: 'Request blocked by security filter'
    });
  }

  const queryCheck = checkObjectForSqli(req.query);
  if (queryCheck) {
    console.warn(`[WAF] BLOCK SQLi in query: ${queryCheck} from IP: ${clientIp} path: ${path}`);
    return res.status(403).json({
      error: 'Forbidden',
      code: 'WAF_SQLI_BLOCKED',
      message: 'Request blocked by security filter'
    });
  }

  next();
};

export const WAF_CONFIG = {
  trustedCidrs: TRUSTED_CIDRS,
  allowedTelemetryPaths: ALLOWED_TELEMETRY_PATHS,
  sqliPatterns: SQLI_PATTERNS.map(p => p.source)
};
