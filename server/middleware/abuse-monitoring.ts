import { Request, Response, NextFunction } from 'express';

/**
 * Abuse Monitoring Lens (CEO Directive)
 * Tracks top talkers by IP/user, geo distribution, request bursts
 * Auto-suppress noisy IPs above warning threshold before hard limits trigger
 */

interface IPStats {
  ip: string;
  requests: number;
  lastRequestTime: number;
  userAgent: string;
  endpoints: Map<string, number>;
  errorCount: number;
  burstDetected: boolean;
  suppressed: boolean;
  geo?: {
    country?: string;
    region?: string;
    city?: string;
  };
}

interface BurstWindow {
  count: number;
  windowStart: number;
}

// Thresholds (CEO directive)
const THRESHOLDS = {
  burstWindow: 60000, // 1 minute
  burstLimit: 100, // 100 requests per minute triggers burst detection
  warningLimit: 800, // 800 req/15min (80% of hard limit 1000)
  autoSuppress: true, // Auto-suppress before hitting hard rate limit
  suppressDuration: 300000, // 5 minutes base suppression
  escalatingMultiplier: 2, // Double duration on each repeat offense
  maxSuppressionDuration: 3600000, // Max 1 hour suppression
  permanentBlockThreshold: 10 // After 10 suppressions, permanent block for 24h
};

// Known bad actors - permanent blocklist (can be extended via env var)
const PERMANENT_BLOCKLIST: Set<string> = new Set([
  // Detected via burst monitoring (ZT3G runs)
  '20.207.207.58',   // Microsoft Azure - burst detected 2026-01-19
  '34.96.44.138',    // Google Cloud - burst detected 2026-01-19
  '20.196.90.228',   // Microsoft Azure - 182 req/min burst 2026-01-21
]);

// Load additional blocklist from env if available
if (process.env.IP_BLOCKLIST) {
  process.env.IP_BLOCKLIST.split(',').forEach(ip => PERMANENT_BLOCKLIST.add(ip.trim()));
}

const ipStats: Map<string, IPStats> = new Map();
const burstWindows: Map<string, BurstWindow> = new Map();
const suppressedIPs: Map<string, number> = new Map(); // IP -> suppression expiry time
const suppressionCounts: Map<string, number> = new Map(); // IP -> number of times suppressed

/**
 * Get or create IP stats
 */
function getOrCreateIPStats(ip: string, userAgent: string): IPStats {
  if (!ipStats.has(ip)) {
    ipStats.set(ip, {
      ip,
      requests: 0,
      lastRequestTime: Date.now(),
      userAgent,
      endpoints: new Map(),
      errorCount: 0,
      burstDetected: false,
      suppressed: false
    });
  }
  return ipStats.get(ip)!;
}

/**
 * Detect request burst (CEO directive: auto-suppress noisy IPs)
 */
function detectBurst(ip: string): boolean {
  const now = Date.now();
  const window = burstWindows.get(ip) || { count: 0, windowStart: now };
  
  // Reset window if expired
  if (now - window.windowStart > THRESHOLDS.burstWindow) {
    window.count = 0;
    window.windowStart = now;
  }
  
  window.count++;
  burstWindows.set(ip, window);
  
  // Burst detected if count exceeds limit within window
  return window.count > THRESHOLDS.burstLimit;
}

/**
 * Check if IP is in permanent blocklist
 */
function isBlocklisted(ip: string): boolean {
  return PERMANENT_BLOCKLIST.has(ip);
}

/**
 * Calculate escalating suppression duration based on offense count
 */
function getSuppressionDuration(offenseCount: number): number {
  // Escalate: 5min → 10min → 20min → 40min → 1hr (max)
  const baseDuration = THRESHOLDS.suppressDuration;
  const multiplier = Math.pow(THRESHOLDS.escalatingMultiplier, offenseCount - 1);
  const duration = Math.min(baseDuration * multiplier, THRESHOLDS.maxSuppressionDuration);
  return duration;
}

/**
 * Check if IP should be auto-suppressed
 */
function shouldAutoSuppress(ip: string, stats: IPStats): boolean {
  // Check permanent blocklist first
  if (isBlocklisted(ip)) {
    stats.suppressed = true;
    return true;
  }

  // Check if already suppressed
  const suppressExpiry = suppressedIPs.get(ip);
  if (suppressExpiry && Date.now() < suppressExpiry) {
    return true; // Still suppressed
  } else if (suppressExpiry) {
    // Suppression expired, remove from list
    suppressedIPs.delete(ip);
    stats.suppressed = false;
  }
  
  // Check if approaching warning limit (800 req/15min)
  const windowStart = Date.now() - 15 * 60 * 1000; // 15 minutes ago
  const recentRequests = stats.requests; // Simplified - in production, track windowed count
  
  if (THRESHOLDS.autoSuppress && recentRequests > THRESHOLDS.warningLimit) {
    // Track offense count
    const offenseCount = (suppressionCounts.get(ip) || 0) + 1;
    suppressionCounts.set(ip, offenseCount);
    
    // Check if repeat offender should be permanently blocked (24h)
    if (offenseCount >= THRESHOLDS.permanentBlockThreshold) {
      const suppressUntil = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
      suppressedIPs.set(ip, suppressUntil);
      stats.suppressed = true;
      console.error(`🛑 PERMANENT BLOCK: IP ${ip} exceeded ${THRESHOLDS.permanentBlockThreshold} suppressions (offense #${offenseCount}). Blocked for 24 hours.`);
      return true;
    }
    
    // Calculate escalating suppression duration
    const duration = getSuppressionDuration(offenseCount);
    const suppressUntil = Date.now() + duration;
    suppressedIPs.set(ip, suppressUntil);
    stats.suppressed = true;
    
    console.warn(`🚨 AUTO-SUPPRESS: IP ${ip} exceeded warning limit (${recentRequests} req). Offense #${offenseCount}. Suppressed for ${Math.round(duration / 1000)}s.`);
    return true;
  }
  
  return false;
}

/**
 * Extract geo info from IP (placeholder - would use GeoIP service in production)
 */
function getGeoInfo(ip: string): { country?: string; region?: string; city?: string } {
  // In production, integrate with MaxMind GeoIP2 or similar
  // For now, return basic info based on IP range heuristics
  if (ip.startsWith('127.') || ip === '::1') {
    return { country: 'localhost', region: 'dev', city: 'local' };
  }
  return { country: 'unknown', region: 'unknown', city: 'unknown' };
}

/**
 * Abuse monitoring middleware
 */
export function abuseMonitoringMiddleware(req: Request, res: Response, next: NextFunction) {
  const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  const userAgent = req.headers['user-agent'] || 'unknown';
  const endpoint = req.path.replace(/\/\d+/g, '/:id').replace(/\/[0-9a-f-]{36}/g, '/:id');
  
  const stats = getOrCreateIPStats(ip, userAgent);
  stats.requests++;
  stats.lastRequestTime = Date.now();
  
  // Track endpoint usage
  stats.endpoints.set(endpoint, (stats.endpoints.get(endpoint) || 0) + 1);
  
  // Detect burst
  if (detectBurst(ip)) {
    stats.burstDetected = true;
    console.warn(`⚠️  BURST DETECTED: IP ${ip} sent ${burstWindows.get(ip)?.count} requests in 1 minute`);
  }
  
  // Get geo info (lazy load)
  if (!stats.geo) {
    stats.geo = getGeoInfo(ip);
  }
  
  // Check for auto-suppression
  if (shouldAutoSuppress(ip, stats)) {
    return res.status(429).json({
      error: 'Too many requests - temporarily suppressed',
      code: 'AUTO_SUPPRESSED',
      retryAfter: Math.ceil((suppressedIPs.get(ip)! - Date.now()) / 1000)
    });
  }
  
  res.on('finish', () => {
    // Track errors
    if (res.statusCode >= 400) {
      stats.errorCount++;
    }
  });
  
  next();
}

/**
 * Get top talkers (CEO directive)
 */
export function getTopTalkers(limit: number = 10): IPStats[] {
  return Array.from(ipStats.values())
    .sort((a, b) => b.requests - a.requests)
    .slice(0, limit);
}

/**
 * Get geo distribution
 */
export function getGeoDistribution(): Record<string, number> {
  const distribution: Record<string, number> = {};
  
  ipStats.forEach(stats => {
    const country = stats.geo?.country || 'unknown';
    distribution[country] = (distribution[country] || 0) + stats.requests;
  });
  
  return distribution;
}

/**
 * Get burst alerts (IPs with burst detection)
 */
export function getBurstAlerts(): IPStats[] {
  return Array.from(ipStats.values()).filter(s => s.burstDetected);
}

/**
 * Get suppressed IPs
 */
export function getSuppressedIPs(): Array<{ ip: string; expiresAt: number; remainingSeconds: number; offenseCount: number }> {
  const now = Date.now();
  const result: Array<{ ip: string; expiresAt: number; remainingSeconds: number; offenseCount: number }> = [];
  
  suppressedIPs.forEach((expiresAt, ip) => {
    if (expiresAt > now) {
      result.push({
        ip,
        expiresAt,
        remainingSeconds: Math.ceil((expiresAt - now) / 1000),
        offenseCount: suppressionCounts.get(ip) || 0
      });
    }
  });
  
  return result;
}

/**
 * Get repeat offenders (IPs with multiple suppressions)
 */
export function getRepeatOffenders(minOffenses: number = 3): Array<{ ip: string; offenseCount: number; lastSeen: number }> {
  const result: Array<{ ip: string; offenseCount: number; lastSeen: number }> = [];
  
  suppressionCounts.forEach((count, ip) => {
    if (count >= minOffenses) {
      const stats = ipStats.get(ip);
      result.push({
        ip,
        offenseCount: count,
        lastSeen: stats?.lastRequestTime || 0
      });
    }
  });
  
  return result.sort((a, b) => b.offenseCount - a.offenseCount);
}

/**
 * Add IP to permanent blocklist at runtime
 */
export function addToBlocklist(ip: string): void {
  PERMANENT_BLOCKLIST.add(ip);
  console.warn(`🛑 BLOCKLIST: IP ${ip} added to permanent blocklist`);
}

/**
 * Remove IP from permanent blocklist
 */
export function removeFromBlocklist(ip: string): boolean {
  const removed = PERMANENT_BLOCKLIST.delete(ip);
  if (removed) {
    console.warn(`✅ BLOCKLIST: IP ${ip} removed from blocklist`);
  }
  return removed;
}

/**
 * Get blocklist
 */
export function getBlocklist(): string[] {
  return Array.from(PERMANENT_BLOCKLIST);
}

/**
 * Get abuse summary
 */
export function getAbuseSummary() {
  return {
    totalIPs: ipStats.size,
    topTalkers: getTopTalkers(10),
    geoDistribution: getGeoDistribution(),
    burstAlerts: getBurstAlerts(),
    suppressedIPs: getSuppressedIPs(),
    repeatOffenders: getRepeatOffenders(3),
    blocklist: getBlocklist(),
    thresholds: THRESHOLDS
  };
}

/**
 * Reset abuse monitoring stats
 */
export function resetAbuseStats() {
  ipStats.clear();
  burstWindows.clear();
  suppressedIPs.clear();
}
