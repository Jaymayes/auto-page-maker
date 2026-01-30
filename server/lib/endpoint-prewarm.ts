import { log } from '../vite.js';

const PREWARM_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const PREWARM_ENDPOINTS = ['/', '/pricing'];
const PREWARM_HEADER = 'X-Prewarm';

let prewarmIntervalId: NodeJS.Timeout | null = null;

interface PrewarmResult {
  endpoint: string;
  status: number;
  latencyMs: number;
  success: boolean;
  timestamp: string;
}

async function prewarmEndpoint(baseUrl: string, endpoint: string): Promise<PrewarmResult> {
  const start = Date.now();
  const url = `${baseUrl}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        [PREWARM_HEADER]: 'true',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'br, gzip, deflate',
        'User-Agent': 'ScholarAI-Prewarm/1.0'
      }
    });
    
    const latencyMs = Date.now() - start;
    
    return {
      endpoint,
      status: response.status,
      latencyMs,
      success: response.ok,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    const latencyMs = Date.now() - start;
    return {
      endpoint,
      status: 0,
      latencyMs,
      success: false,
      timestamp: new Date().toISOString()
    };
  }
}

async function runPrewarmCycle(baseUrl: string): Promise<void> {
  const results: PrewarmResult[] = [];
  
  for (const endpoint of PREWARM_ENDPOINTS) {
    const result = await prewarmEndpoint(baseUrl, endpoint);
    results.push(result);
  }
  
  const successCount = results.filter(r => r.success).length;
  const avgLatency = results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length;
  
  log(`[PREWARM] Cycle complete: ${successCount}/${results.length} endpoints warm, avg latency ${Math.round(avgLatency)}ms`);
  
  results.forEach(r => {
    if (!r.success) {
      log(`[PREWARM] WARN: ${r.endpoint} failed (status=${r.status}, latency=${r.latencyMs}ms)`);
    }
  });
}

export function startEndpointPrewarming(): void {
  const baseUrl = process.env.APP_BASE_URL || process.env.REPLIT_URL || 'http://localhost:5000';
  
  log(`[PREWARM] Starting endpoint pre-warming for ${baseUrl}`);
  log(`[PREWARM] Endpoints: ${PREWARM_ENDPOINTS.join(', ')}`);
  log(`[PREWARM] Interval: ${PREWARM_INTERVAL_MS / 1000}s`);
  
  runPrewarmCycle(baseUrl);
  
  prewarmIntervalId = setInterval(() => {
    runPrewarmCycle(baseUrl);
  }, PREWARM_INTERVAL_MS);
  
  if (prewarmIntervalId.unref) {
    prewarmIntervalId.unref();
  }
}

export function stopEndpointPrewarming(): void {
  if (prewarmIntervalId) {
    clearInterval(prewarmIntervalId);
    prewarmIntervalId = null;
    log('[PREWARM] Stopped endpoint pre-warming');
  }
}

export function isPrewarmRequest(headers: Record<string, string | string[] | undefined>): boolean {
  const prewarmHeader = headers[PREWARM_HEADER.toLowerCase()] || headers[PREWARM_HEADER];
  return prewarmHeader === 'true';
}

export { PREWARM_HEADER };
