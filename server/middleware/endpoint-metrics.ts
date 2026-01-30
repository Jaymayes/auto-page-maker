import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';

/**
 * Endpoint-Level SLI Metrics (CEO Directive)
 * Tracks P50/P95/P99/P99.9 latency, saturation (CPU, memory), queue depth, DB latency, cache hit rate per endpoint
 */

const PREWARM_HEADER = 'x-prewarm';

/**
 * Check if this is a pre-warm request (should be excluded from SLO metrics)
 */
function isPrewarmRequest(req: Request): boolean {
  const prewarmHeader = req.headers[PREWARM_HEADER] || req.headers['X-Prewarm'];
  return prewarmHeader === 'true';
}

interface SlowLogEntry {
  route: string;
  duration: number;
  timestamp: number;
  dbWait: number;
  coldStart: boolean;
  gcTime: number;
}

interface EndpointMetrics {
  p50: number;
  p95: number;
  p99: number;
  p999: number;
  count: number;
  errors: number;
  latencies: number[];
  cpuUsage: number[];
  memoryUsage: number[];
  dbLatencies: number[];
  cacheHits: number;
  cacheMisses: number;
  slowLogs: SlowLogEntry[];
  lastRequestTimestamp: number;
}

// In-memory metrics store (in production, send to TimescaleDB or similar)
const endpointMetrics: Map<string, EndpointMetrics> = new Map();

// SLO burn tracking - consecutive violation counters
let p95ViolationCount = 0;
let p99ViolationCount = 0;
const COLD_START_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const SLOW_LOG_MAX_SIZE = 10;
const GC_TIME_THRESHOLD = 1024 * 1024; // 1MB memory delta considered significant

/**
 * Initialize metrics for an endpoint
 */
function getOrCreateMetrics(endpoint: string): EndpointMetrics {
  if (!endpointMetrics.has(endpoint)) {
    endpointMetrics.set(endpoint, {
      p50: 0,
      p95: 0,
      p99: 0,
      p999: 0,
      count: 0,
      errors: 0,
      latencies: [],
      cpuUsage: [],
      memoryUsage: [],
      dbLatencies: [],
      cacheHits: 0,
      cacheMisses: 0,
      slowLogs: [],
      lastRequestTimestamp: 0
    });
  }
  return endpointMetrics.get(endpoint)!;
}

/**
 * Calculate percentiles from sorted array
 */
function calculatePercentile(sortedArray: number[], percentile: number): number {
  if (sortedArray.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
  return sortedArray[index] || 0;
}

/**
 * Update percentiles for endpoint
 */
function updatePercentiles(metrics: EndpointMetrics) {
  const sorted = [...metrics.latencies].sort((a, b) => a - b);
  metrics.p50 = calculatePercentile(sorted, 50);
  metrics.p95 = calculatePercentile(sorted, 95);
  metrics.p99 = calculatePercentile(sorted, 99);
  metrics.p999 = calculatePercentile(sorted, 99.9);
  
  // Keep only last 1000 latencies to prevent memory issues
  if (metrics.latencies.length > 1000) {
    metrics.latencies = metrics.latencies.slice(-1000);
  }
}

/**
 * Add slow log entry, maintaining top 10 slowest
 */
function addSlowLogEntry(metrics: EndpointMetrics, entry: SlowLogEntry) {
  metrics.slowLogs.push(entry);
  metrics.slowLogs.sort((a, b) => b.duration - a.duration);
  if (metrics.slowLogs.length > SLOW_LOG_MAX_SIZE) {
    metrics.slowLogs = metrics.slowLogs.slice(0, SLOW_LOG_MAX_SIZE);
  }
}

/**
 * Get current system saturation metrics
 */
function getSystemSaturation() {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  return {
    memory: {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      heapUsedPercent: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      rss: memUsage.rss
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system
    }
  };
}

/**
 * Check for SLO burn rate violations
 * Returns true if P95 > 120ms for 15+ consecutive samples OR P99 > 200ms for 5+ consecutive samples
 */
export function checkSloBurn(): boolean {
  let anyP95Violation = false;
  let anyP99Violation = false;

  endpointMetrics.forEach((metrics) => {
    if (metrics.p95 > 120) {
      anyP95Violation = true;
    }
    if (metrics.p99 > 200) {
      anyP99Violation = true;
    }
  });

  if (anyP95Violation) {
    p95ViolationCount++;
  } else {
    p95ViolationCount = 0;
  }

  if (anyP99Violation) {
    p99ViolationCount++;
  } else {
    p99ViolationCount = 0;
  }

  const burnDetected = p95ViolationCount >= 15 || p99ViolationCount >= 5;

  if (burnDetected) {
    console.warn(`🔥 SLO BURN ALERT: P95 violations=${p95ViolationCount}/15, P99 violations=${p99ViolationCount}/5`);
  }

  return burnDetected;
}

/**
 * Get latency heatmap for all endpoints
 * Returns per-endpoint p50/p75/p95/p99/p999 as structured JSON
 */
export function getLatencyHeatmap(): Record<string, { p50: number; p75: number; p95: number; p99: number; p999: number }> {
  const heatmap: Record<string, { p50: number; p75: number; p95: number; p99: number; p999: number }> = {};
  
  endpointMetrics.forEach((metrics, endpoint) => {
    const sorted = [...metrics.latencies].sort((a, b) => a - b);
    heatmap[endpoint] = {
      p50: calculatePercentile(sorted, 50),
      p75: calculatePercentile(sorted, 75),
      p95: calculatePercentile(sorted, 95),
      p99: calculatePercentile(sorted, 99),
      p999: calculatePercentile(sorted, 99.9)
    };
  });
  
  return heatmap;
}

// Internal endpoints excluded from public SLO metrics
// These are infrastructure probes, not public-facing API endpoints
const EXCLUDED_ENDPOINTS = new Set([
  '/health',
  '/api/health',
  '/readiness',
  '/api/readiness',
  '/healthz',
  '/canary',
  '/_canary_no_cache'
]);

/**
 * Check if endpoint should be excluded from SLO tracking
 */
function shouldExcludeFromMetrics(path: string): boolean {
  return EXCLUDED_ENDPOINTS.has(path);
}

/**
 * Middleware to track endpoint-level SLIs
 */
export function endpointMetricsMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip tracking for internal readiness/health endpoints
  // These are excluded from public SLOs per telemetry canonicalization spec
  if (shouldExcludeFromMetrics(req.path)) {
    return next();
  }
  
  // Skip pre-warm requests from metrics (X-Prewarm: true header)
  // Pre-warming is internal infrastructure traffic, not user-facing
  if (isPrewarmRequest(req)) {
    return next();
  }
  
  const startTime = performance.now();
  const startCpu = process.cpuUsage();
  const startMem = process.memoryUsage();
  const requestTimestamp = Date.now();
  
  // Normalize endpoint path (replace IDs with :id)
  const endpoint = req.path.replace(/\/\d+/g, '/:id').replace(/\/[0-9a-f-]{36}/g, '/:id');
  const metrics = getOrCreateMetrics(endpoint);
  
  // Detect cold start (>5 min since last request)
  const isColdStart = metrics.lastRequestTimestamp === 0 || 
    (requestTimestamp - metrics.lastRequestTimestamp) > COLD_START_THRESHOLD_MS;
  
  // Track DB latencies for this request
  const requestDbLatencies: number[] = [];
  
  // Attach metrics tracking to request for downstream use
  (req as any).metrics = {
    startTime,
    endpoint,
    trackDbQuery: (latency: number) => {
      metrics.dbLatencies.push(latency);
      requestDbLatencies.push(latency);
    },
    trackCacheHit: () => {
      metrics.cacheHits++;
    },
    trackCacheMiss: () => {
      metrics.cacheMisses++;
    }
  };
  
  res.on('finish', () => {
    const duration = performance.now() - startTime;
    const endCpu = process.cpuUsage(startCpu);
    const endMem = process.memoryUsage();
    
    // Update metrics
    metrics.count++;
    metrics.latencies.push(duration);
    metrics.lastRequestTimestamp = requestTimestamp;
    
    // Track CPU usage delta (microseconds)
    metrics.cpuUsage.push(endCpu.user + endCpu.system);
    
    // Track memory delta
    const memDelta = endMem.heapUsed - startMem.heapUsed;
    metrics.memoryUsage.push(memDelta);
    
    // Track errors
    if (res.statusCode >= 400) {
      metrics.errors++;
    }
    
    // Calculate DB wait time for this request
    const dbWait = requestDbLatencies.reduce((sum, lat) => sum + lat, 0);
    
    // Calculate GC time (significant memory delta as proxy)
    const gcTime = Math.abs(memDelta) > GC_TIME_THRESHOLD ? Math.abs(memDelta) : 0;
    
    // Add to slow logs if this is a slow request (check against current slowest)
    const shouldAddToSlowLog = metrics.slowLogs.length < SLOW_LOG_MAX_SIZE || 
      duration > (metrics.slowLogs[metrics.slowLogs.length - 1]?.duration || 0);
    
    if (shouldAddToSlowLog) {
      addSlowLogEntry(metrics, {
        route: endpoint,
        duration: Math.round(duration * 100) / 100,
        timestamp: requestTimestamp,
        dbWait: Math.round(dbWait * 100) / 100,
        coldStart: isColdStart,
        gcTime
      });
    }
    
    // Update percentiles
    updatePercentiles(metrics);
    
    // Log SLI violations (P95 > 120ms as per CEO gates)
    if (metrics.p95 > 120 && metrics.count % 100 === 0) {
      console.warn(`⚠️  SLI VIOLATION: ${endpoint} P95=${Math.round(metrics.p95)}ms (target: <120ms)`);
    }
  });
  
  next();
}

/**
 * Get metrics for a specific endpoint
 */
export function getEndpointMetrics(endpoint: string): EndpointMetrics | null {
  return endpointMetrics.get(endpoint) || null;
}

/**
 * Get all endpoint metrics
 */
export function getAllEndpointMetrics(): Record<string, EndpointMetrics> {
  const result: Record<string, EndpointMetrics> = {};
  endpointMetrics.forEach((metrics, endpoint) => {
    result[endpoint] = { ...metrics };
  });
  return result;
}

/**
 * Get queue depth (approximation based on active requests)
 */
let activeRequests = 0;

export function getQueueDepth(): number {
  return activeRequests;
}

export function queueDepthTracker(req: Request, res: Response, next: NextFunction) {
  activeRequests++;
  res.on('finish', () => {
    activeRequests--;
  });
  next();
}

/**
 * Reset metrics (useful for testing or periodic reset)
 */
export function resetEndpointMetrics() {
  endpointMetrics.clear();
  p95ViolationCount = 0;
  p99ViolationCount = 0;
}

/**
 * Get cache hit rate for an endpoint
 */
export function getCacheHitRate(endpoint: string): number {
  const metrics = endpointMetrics.get(endpoint);
  if (!metrics) return 0;
  
  const total = metrics.cacheHits + metrics.cacheMisses;
  return total === 0 ? 0 : (metrics.cacheHits / total) * 100;
}
