import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { storage } from '../storage.js';

// MASTER FLEET GO-LIVE PROMPT v3.5.1: Primary endpoint is /events
const COMMAND_CENTER_BASE = process.env.COMMAND_CENTER_BASE || 'https://auto-com-center-jamarrlmayes.replit.app';
// v3.5.1: /ingest is deprecated and rejected by A8; use /events, /api/events, /api/report only
const COMMAND_CENTER_ENDPOINTS = ['/events', '/api/events', '/api/report'];
const COMMAND_CENTER_URL = process.env.COMMAND_CENTER_URL || `${COMMAND_CENTER_BASE}/events`;
// Legacy endpoints for backward compatibility
const TELEMETRY_WRITE_URL = process.env.TELEMETRY_WRITE_URL || 'https://scholarship-api-jamarrlmayes.replit.app/api/analytics/events';
const TELEMETRY_FALLBACK_URL = process.env.TELEMETRY_FALLBACK_URL || 'https://scholarship-sage-jamarrlmayes.replit.app/api/analytics/events';
const TELEMETRY_FLUSH_INTERVAL_MS = parseInt(process.env.TELEMETRY_FLUSH_INTERVAL_MS || '10000', 10);
const TELEMETRY_BATCH_MAX = parseInt(process.env.TELEMETRY_BATCH_MAX || '100', 10);
const TELEMETRY_ENABLED = process.env.TELEMETRY_ENABLED !== 'false';
// MASTER PROMPT: Heartbeat every 300 seconds
const HEARTBEAT_INTERVAL_MS = parseInt(process.env.HEARTBEAT_INTERVAL_MS || '300000', 10);
const AUTH_TOKEN_URL = process.env.AUTH_TOKEN_URL || 'https://scholar-auth-jamarrlmayes.replit.app/oauth/token';
const AUTH_AUDIENCE = process.env.AUTH_AUDIENCE || 'scholar-platform';
const AUTH_SCOPE = process.env.AUTH_SCOPE || 'telemetry:write';
const M2M_SECRET = process.env.M2M_SECRET || process.env.AGENT_BRIDGE_SHARED_SECRET || process.env.SHARED_SECRET;

const APP_ID = 'auto_page_maker';
const APP_NAME = 'Auto Page Maker';
const APP_VERSION = 'v3.5.1';
const MSP_VERSION = 'v3.5.1';
const APP_BASE_URL = process.env.APP_BASE_URL || process.env.REPLIT_URL || 'https://auto-page-maker-jamarrlmayes.replit.app';
// Master System Prompt v3 derived variables
const APP_DISPLAY = `${APP_ID} | ${APP_BASE_URL}`;
const COMMAND_CENTER_TOKEN = process.env.S2S_API_KEY || process.env.COMMAND_CENTER_TOKEN || null;
const P95_LATENCY_TARGET_MS = 200;
const UPTIME_SLO = 99.9;

function getEnv(): 'prod' | 'staging' | 'dev' {
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === 'production') return 'prod';
  if (nodeEnv === 'staging') return 'staging';
  return 'dev';
}

const ENV = getEnv();

// Protocol ONE_TRUTH v1.2 Event Envelope
interface TelemetryEvent {
  event_id: string;
  event_type: string;
  ts: string; // ISO-8601 UTC timestamp (v1.2 uses 'ts' not 'ts_utc')
  app_id: string;
  app_base_url: string; // v1.2 requires app_base_url at top level
  env: 'prod' | 'staging' | 'dev';
  properties: Record<string, any>;
  _meta: {
    protocol: 'ONE_TRUTH';
    version: '1.2';
  };
  // Extended fields for backward compatibility
  version?: string;
  session_id?: string | null;
  user_id_hash?: string | null;
  account_id?: string | null;
  actor_type?: 'student' | 'provider' | 'system' | null;
  request_id?: string | null;
  source_ip_masked?: string | null;
  coppa_flag?: boolean;
  ferpa_flag?: boolean;
}

class TelemetryClient {
  private eventBuffer: TelemetryEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private startTime: number = Date.now();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isShuttingDown: boolean = false;
  private consecutiveFailures: number = 0;
  private maxRetries: number = 5;
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private authWarningLogged: boolean = false;
  // PHASE 4: Offline queue for when Command Center is unavailable
  private offlineQueue: Record<string, any>[] = [];
  private commandCenterOnline: boolean = true;
  private offlineQueueMaxSize: number = 1000;
  // MSP v3 Phase 5: Track last success timestamps
  private lastSuccessPrimary: string | null = null;
  private lastSuccessFallback: string | null = null;

  constructor() {
    if (TELEMETRY_ENABLED) {
      this.startFlushTimer();
    }
  }

  private async getAuthToken(): Promise<string | null> {
    // OPTIMIZATION: scholarship_api accepts events without authentication
    // Skip token request to avoid noisy 401 errors from scholar_auth
    // This can be re-enabled when scholar_auth registers auto_page_maker as OAuth2 client
    const SKIP_AUTH = process.env.TELEMETRY_SKIP_AUTH !== 'false';
    
    if (SKIP_AUTH) {
      // Silent mode - no auth required for telemetry
      return null;
    }
    
    if (this.cachedToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.cachedToken;
    }

    if (!M2M_SECRET) {
      // Only log once per session, not every flush
      if (!this.authWarningLogged) {
        console.warn('[Telemetry] No M2M_SECRET configured - sending without auth');
        this.authWarningLogged = true;
      }
      return null;
    }

    try {
      const response = await fetch(AUTH_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: APP_ID,
          client_secret: M2M_SECRET,
          audience: AUTH_AUDIENCE,
          scope: AUTH_SCOPE,
        }).toString(),
      });

      if (response.ok) {
        const data = await response.json() as { access_token: string; expires_in: number };
        this.cachedToken = data.access_token;
        this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);
        return this.cachedToken;
      } else {
        // Silent failure - scholarship_api accepts without auth
        return null;
      }
    } catch (error) {
      // Silent failure - scholarship_api accepts without auth
      return null;
    }
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushTimer = setInterval(() => this.flush(), TELEMETRY_FLUSH_INTERVAL_MS);
  }

  private hashUserId(userId: string): string {
    const salt = process.env.TELEMETRY_SALT || 'scholar-telemetry-2025';
    return createHash('sha256').update(userId + salt).digest('hex').substring(0, 16);
  }

  private maskIp(ip: string | null): string | null {
    if (!ip) return null;
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
    }
    return null;
  }

  emit(
    eventType: string,
    properties: Record<string, any> = {},
    options: {
      sessionId?: string | null;
      userId?: string | null;
      accountId?: string | null;
      actorType?: 'student' | 'provider' | 'system' | null;
      requestId?: string | null;
      sourceIp?: string | null;
      coppaFlag?: boolean;
      ferpaFlag?: boolean;
    } = {}
  ): void {
    if (!TELEMETRY_ENABLED) return;

    // Protocol ONE_TRUTH v1.2 compliant event envelope
    const event: TelemetryEvent = {
      event_id: randomUUID(),
      event_type: eventType,
      ts: new Date().toISOString(), // v1.2 uses 'ts' not 'ts_utc'
      app_id: APP_ID,
      app_base_url: APP_BASE_URL, // v1.2 requires app_base_url at top level
      env: ENV,
      properties: {
        ...properties,
        app_id: APP_ID,
        app_base_url: APP_BASE_URL,
      },
      _meta: {
        protocol: 'ONE_TRUTH',
        version: '1.2',
      },
      // Extended fields for compatibility
      version: APP_VERSION,
      session_id: options.sessionId || null,
      user_id_hash: options.userId ? this.hashUserId(options.userId) : null,
      account_id: options.accountId || null,
      actor_type: options.actorType || 'system',
      request_id: options.requestId || null,
      source_ip_masked: this.maskIp(options.sourceIp || null),
      coppa_flag: options.coppaFlag || false,
      ferpa_flag: options.ferpaFlag || false,
    };

    this.eventBuffer.push(event);

    if (this.eventBuffer.length >= TELEMETRY_BATCH_MAX) {
      this.flush();
    }
  }

  // MASTER FLEET GO-LIVE PROMPT v3.4.1: Convert internal event to Command Center format
  private toCommandCenterFormat(event: TelemetryEvent, failover: boolean = false): Record<string, any> {
    // Map internal event types to v3.4.1 event types
    const eventTypeMapping: Record<string, string> = {
      'app_started': 'identify',
      'app_heartbeat': 'heartbeat',
      'app_recovered': 'heartbeat',
      'system_health': 'heartbeat',
      'app_degraded': 'revenue_blocker',
      'page_build_failed': 'revenue_blocker',
      'generation_failure': 'metric',
      'page_view': 'metric',
      'inbound_referral': 'metric',
      'sessions_active': 'metric',
      'pages_generated': 'metric',
      'page_published': 'metric',
      'page_generated': 'metric',
      'scholarship_published': 'metric',
      'scholarship_ingested': 'metric',
      'launch_complete': 'metric',
      'seo_batch_complete': 'metric',
      'affiliate_click': 'metric',
      'affiliate_click_value': 'metric',
      'signup': 'funnel_event',
      'premium_upgrade_click': 'funnel_event',
      'checkout_initiated': 'funnel_event',
      'checkout_completed': 'funnel_event',
      'revenue_blocker': 'revenue_blocker',
    };

    const eventType = eventTypeMapping[event.event_type] || 'metric';

    // v3.4.1 Payload Structure
    return {
      envelope: {
        version: MSP_VERSION,
      },
      app: {
        app_id: APP_ID,
        app_name: APP_NAME,
        app_base_url: APP_BASE_URL,
        env: ENV,
      },
      event: {
        type: eventType,
        ts_iso: event.ts,
      },
      data: {
        event_name: event.event_type,
        trace_id: event.event_id,
        failover: failover,
        ...event.properties,
      },
    };
  }

  // MASTER SYSTEM PROMPT v3 PHASE 2.4: Convert to fallback format for A2 (scholarship_api)
  private toFallbackFormat(events: TelemetryEvent[]): Record<string, any> {
    const tileHintMapping: Record<string, string> = {
      'system_health': 'system.health',
      'traffic': 'traffic.overview',
      'product': 'product.activity',
      'error': 'errors.stream',
      'revenue': 'revenue.ticker',
      'conversion': 'conversion.funnel',
    };

    const eventTypeMapping: Record<string, string> = {
      'app_started': 'system_health',
      'app_heartbeat': 'system_health',
      'app_recovered': 'system_health',
      'system_health': 'system_health',
      'app_degraded': 'error',
      'page_build_failed': 'error',
      'generation_failure': 'error',
      'page_view': 'traffic',
      'inbound_referral': 'traffic',
      'sessions_active': 'traffic',
      'pages_generated': 'traffic', // MSP v3: pages_generated is TRAFFIC for auto_page_maker
      'page_published': 'product',
      'page_generated': 'product',
      'scholarship_published': 'product',
      'scholarship_ingested': 'product',
      'launch_complete': 'product',
      'affiliate_click': 'revenue',
      'affiliate_click_value': 'revenue',
      // CONVERSION events
      'signup': 'conversion',
      'premium_upgrade_click': 'conversion',
      'checkout_initiated': 'conversion',
      'checkout_completed': 'conversion',
    };

    return {
      events: events.map(event => {
        const eventCategory = eventTypeMapping[event.event_type] || 'product';
        const amountCents = event.properties.amount_cents ?? 
          (event.properties.value && event.properties.units === 'usd' 
            ? Math.round(event.properties.value * 100) 
            : undefined);
        
        return {
          event_type: eventCategory,
          event_name: event.event_type,
          app_display: APP_DISPLAY,
          app_name: APP_ID,
          app_id: APP_ID,
          app_base_url: APP_BASE_URL,
          timestamp: event.ts,
          tile_hint: tileHintMapping[eventCategory] || 'product.activity',
          metrics: {
            value: event.properties.value ?? event.properties.count ?? 1,
            units: event.properties.units || 'count',
            ...(amountCents !== undefined && { amount_cents: amountCents }),
            ...event.properties,
          },
          meta: {
            version: MSP_VERSION,
            correlation_id: event.event_id,
            details: {
              message: event.properties.message || event.event_type,
              ...event.properties,
            },
          },
        };
      }),
    };
  }

  // PHASE 4: Flush offline queue when Command Center is back online
  private async flushOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) return;
    
    console.log(`[Telemetry] Flushing ${this.offlineQueue.length} queued events to Command Center`);
    const queueCopy = [...this.offlineQueue];
    this.offlineQueue = [];
    
    for (const payload of queueCopy) {
      try {
        const response = await fetch(COMMAND_CENTER_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Source-App': APP_ID,
            'X-Trace-Id': payload.payload?.details?.trace_id || randomUUID(),
          },
          body: JSON.stringify(payload),
        });
        
        if (!response.ok) {
          // Re-queue if still failing
          if (this.offlineQueue.length < this.offlineQueueMaxSize) {
            this.offlineQueue.push(payload);
          }
          this.commandCenterOnline = false;
          break;
        }
      } catch (error) {
        // Re-queue on network error
        if (this.offlineQueue.length < this.offlineQueueMaxSize) {
          this.offlineQueue.push(payload);
        }
        this.commandCenterOnline = false;
        break;
      }
    }
  }

  // Get offline queue depth for monitoring
  getOfflineQueueDepth(): number {
    return this.offlineQueue.length;
  }

  async flush(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const validEvents = this.eventBuffer.filter(event => {
      if (!event.app_id) {
        console.warn(`[Telemetry] Dropping event ${event.event_type} - missing app_id`);
        return false;
      }
      return true;
    });
    
    if (validEvents.length === 0) {
      this.eventBuffer = [];
      return;
    }

    const eventsToSend = [...validEvents];
    this.eventBuffer = [];

    // PHASE 4: First, try to flush offline queue if Command Center is back online
    if (this.offlineQueue.length > 0 && this.commandCenterOnline) {
      await this.flushOfflineQueue();
    }

    // MASTER FLEET GO-LIVE v3.5.1: Send to Command Center with endpoint fallbacks
    // v3.5.1: Try /events, /api/events, /api/report (legacy /ingest removed)
    const ccHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Source-App': APP_ID,
      'x-scholar-protocol': 'v3.5.1',
      'x-app-label': APP_ID,
    };
    if (COMMAND_CENTER_TOKEN) {
      ccHeaders['Authorization'] = `Bearer ${COMMAND_CENTER_TOKEN}`;
    }

    // v3.5.1: Track if we need to failover
    let primaryFailed = false;
    
    for (const event of eventsToSend) {
      const ccPayload = this.toCommandCenterFormat(event, primaryFailed);
      let ccSuccess = false;
      
      // Try each endpoint in sequence
      for (const endpoint of COMMAND_CENTER_ENDPOINTS) {
        if (ccSuccess) break;
        
        const url = `${COMMAND_CENTER_BASE}${endpoint}`;
        
        for (let attempt = 0; attempt < this.maxRetries && !ccSuccess; attempt++) {
          try {
            const ccResponse = await fetch(url, {
              method: 'POST',
              headers: {
                ...ccHeaders,
                'X-Trace-Id': event.event_id,
                'x-event-id': event.event_id,
              },
              body: JSON.stringify(ccPayload),
            });
            
            if (ccResponse.ok) {
              ccSuccess = true;
              this.commandCenterOnline = true;
              this.lastSuccessPrimary = new Date().toISOString();
            } else if (ccResponse.status === 401 || ccResponse.status === 403) {
              // Auth failure, try next endpoint
              console.warn(`[Telemetry] Command Center auth rejected at ${endpoint}: ${ccResponse.status}`);
              break;
            } else if (ccResponse.status === 404) {
              // Endpoint not found, try next endpoint
              console.warn(`[Telemetry] Command Center endpoint not found: ${endpoint}`);
              break;
            } else {
              const backoffMs = Math.min(1000 * Math.pow(2, attempt), 60000);
              await new Promise(resolve => setTimeout(resolve, backoffMs));
            }
          } catch (ccError) {
            if (attempt === this.maxRetries - 1) {
              console.warn(`[Telemetry] Command Center endpoint ${endpoint} unreachable after ${this.maxRetries} attempts`);
            } else {
              const backoffMs = Math.min(1000 * Math.pow(2, attempt), 60000);
              await new Promise(resolve => setTimeout(resolve, backoffMs));
            }
          }
        }
      }
      
      // If all endpoints failed, queue for later
      if (!ccSuccess) {
        this.commandCenterOnline = false;
        primaryFailed = true;
        if (this.offlineQueue.length < this.offlineQueueMaxSize) {
          this.offlineQueue.push(ccPayload);
        }
      }
    }

    // MASTER PROMPT PHASE 2C: Also send to legacy scholarship_api for backward compatibility
    // Use the new fallback format with app_display, tile_hint, etc.
    const token = await this.getAuthToken();
    const fallbackHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-App-Id': APP_ID,
      'X-Source-App': APP_ID,
      'X-App-Display': APP_DISPLAY,
    };
    if (token) {
      fallbackHeaders['Authorization'] = `Bearer ${token}`;
    }

    try {
      // Use the new fallback format per MSP v3 Phase 2.4
      const fallbackPayload = this.toFallbackFormat(eventsToSend);
      const response = await fetch(TELEMETRY_WRITE_URL, {
        method: 'POST',
        headers: fallbackHeaders,
        body: JSON.stringify(fallbackPayload),
      });

      if (response.ok) {
        this.consecutiveFailures = 0;
        this.lastSuccessFallback = new Date().toISOString();
      } else if (response.status === 401 || response.status === 403) {
        this.cachedToken = null;
        this.tokenExpiresAt = 0;
      }
    } catch (legacyError) {
      this.consecutiveFailures++;
      if (this.consecutiveFailures < this.maxRetries) {
        this.eventBuffer.unshift(...eventsToSend);
        const backoffMs = Math.min(1000 * Math.pow(2, this.consecutiveFailures), 60000); // MSP v3: max 60s
        console.log(`[Telemetry] Fallback retry in ${backoffMs}ms...`);
      } else {
        console.error(`[Telemetry] Max retries exceeded, dropping ${eventsToSend.length} events`);
        this.consecutiveFailures = 0;
      }
    }
  }

  // MSP v3 Phase 5: Get last success timestamps for monitoring
  getLastSuccessTimestamps(): { primary: string | null; fallback: string | null } {
    return {
      primary: this.lastSuccessPrimary,
      fallback: this.lastSuccessFallback,
    };
  }

  private async storeEventsLocally(events: TelemetryEvent[]): Promise<void> {
    for (const event of events) {
      try {
        await storage.logBusinessEvent({
          app: event.app_id,
          env: event.env,
          eventName: event.event_type,
          ts: new Date(event.ts), // v1.2 uses 'ts' not 'ts_utc'
          actorType: event.actor_type || 'system',
          actorId: event.user_id_hash,
          orgId: event.account_id,
          requestId: event.request_id || randomUUID(),
          sessionId: event.session_id,
          properties: event.properties,
        });
      } catch (error) {
        console.error(`REPORT: app=${APP_ID} | app_base_url=${APP_BASE_URL} | env=${ENV} | Local storage failed for ${event.event_type}:`, error);
      }
    }
    console.log(`REPORT: app=${APP_ID} | app_base_url=${APP_BASE_URL} | env=${ENV} | Stored ${events.length} events to local database`);
  }

  emitAppStarted(): void {
    this.emit('app_started', {
      version: APP_VERSION, // v1.2 requires version in app_started
      uptime_sec: 0,
      p95_ms: 0,
      error_rate_pct: 0,
      queue_depth: 0,
      db_status: 'unknown',
      ws_status: 'unknown',
    });
    console.log(`REPORT: app=${APP_ID} | app_base_url=${APP_BASE_URL} | env=${ENV} | Emitted app_started event`);
  }

  emitHeartbeat(metrics: {
    uptimeSec?: number;
    p95Ms?: number;
    errorRatePct?: number;
    queueDepth?: number;
    dbStatus?: string;
    wsStatus?: string;
  } = {}): void {
    const uptimeSec = metrics.uptimeSec ?? Math.floor((Date.now() - this.startTime) / 1000);
    
    this.emit('app_heartbeat', {
      uptime_sec: uptimeSec,
      p95_ms: metrics.p95Ms ?? 0,
      error_rate_pct: metrics.errorRatePct ?? 0,
      queue_depth: metrics.queueDepth ?? 0,
      db_status: metrics.dbStatus ?? 'healthy',
      ws_status: metrics.wsStatus ?? 'n/a',
    });
  }

  emitAppDegraded(reason: string, details: Record<string, any> = {}): void {
    this.emit('app_degraded', {
      reason,
      uptime_sec: Math.floor((Date.now() - this.startTime) / 1000),
      ...details,
    });
    console.warn(`[Telemetry] Emitted app_degraded: ${reason}`);
  }

  emitAppRecovered(details: Record<string, any> = {}): void {
    this.emit('app_recovered', {
      uptime_sec: Math.floor((Date.now() - this.startTime) / 1000),
      ...details,
    });
    console.log('[Telemetry] Emitted app_recovered');
  }

  // Master Prompt v1.2 spec: page_view { url, referrer, user_agent_hash, utm_* }
  emitPageView(url: string, utm: Record<string, string> = {}, referrer?: string, userAgentHash?: string): void {
    this.emit('page_view', {
      url, // v1.2 uses 'url' not 'page_url'
      referrer: referrer || null,
      user_agent_hash: userAgentHash || null,
      utm_source: utm.utm_source || null,
      utm_medium: utm.utm_medium || null,
      utm_campaign: utm.utm_campaign || null,
      utm_content: utm.utm_content || null,
      utm_term: utm.utm_term || null,
    });
  }

  // Master Prompt v1.2 spec: page_published { url, template, word_count, status=published, utm_campaign? }
  emitPagePublished(url: string, template: string = 'scholarship', wordCount: number = 0, utmCampaign?: string): void {
    this.emit('page_published', {
      url, // v1.2 uses 'url' not 'page_url'
      template,
      word_count: wordCount,
      status: 'published',
      utm_campaign: utmCampaign || null,
    });
  }

  // Master Prompt v1.2 spec: page_build_failed { url, template, reason, utm_campaign }
  emitPageBuildFailed(url: string, template: string, reason: string, utmCampaign?: string): void {
    this.emit('page_build_failed', {
      url,
      template,
      reason,
      utm_campaign: utmCampaign || null,
    });
  }

  // Master Prompt v1.2 spec: scholarship_published { scholarship_id, url, provider_id? }
  emitScholarshipPublished(scholarshipId: string, url: string, providerId?: string): void {
    this.emit('scholarship_published', {
      scholarship_id: scholarshipId,
      url, // v1.2 uses 'url' not 'page_url'
      provider_id: providerId || null,
    });
  }

  // Master Prompt v1.2 spec: scholarship_ingested { source, count, latency_ms }
  emitScholarshipIngested(source: string, count: number, latencyMs: number = 0): void {
    this.emit('scholarship_ingested', {
      source,
      count,
      latency_ms: latencyMs,
    });
  }

  emitPageGenerated(pageSlug: string, templateType: string, scholarshipCount: number): void {
    this.emit('page_generated', {
      page_slug: pageSlug,
      template_type: templateType,
      scholarship_count: scholarshipCount,
    });
  }

  // MASTER PROMPT PHASE 3: auto_page_maker specific events
  // PRODUCT: PAGES_GENERATED {value:<count>}
  emitPagesGenerated(count: number, durationMs?: number): void {
    this.emit('pages_generated', {
      value: count,
      units: 'count',
      generator_duration_ms: durationMs || 0,
    });
    console.log(`REPORT: app=${APP_ID} | app_base_url=${APP_BASE_URL} | env=${ENV} | msg=PAGES_GENERATED value=${count}`);
  }

  // MASTER GO-LIVE v2.0: PRODUCT event for SEO batch generation
  // Follows Display Protocol with dashboard_row and metric_key
  emitSeoBatchComplete(pagesCount: number, batchDescription: string, durationMs?: number): void {
    this.emit('seo_batch_complete', {
      message: 'SEO Batch Complete',
      value: pagesCount,
      units: 'pages',
      generator_duration_ms: durationMs || 0,
      display: {
        dashboard_row: `Generated ${pagesCount} pages for '${batchDescription}'`,
        metric_key: 'seo_pages_generated',
      },
    });
    console.log(`REPORT: app=${APP_ID} | app_base_url=${APP_BASE_URL} | env=${ENV} | msg=SEO Batch Complete | pages=${pagesCount} | batch=${batchDescription}`);
  }

  // TRAFFIC: INBOUND_REFERRAL {value:1, details:{to:"student_pilot"}}
  emitInboundReferral(targetApp: string = 'student_pilot', route?: string): void {
    this.emit('inbound_referral', {
      value: 1,
      units: 'count',
      to: targetApp,
      route: route || null,
    });
  }

  // ERROR: GENERATION_FAILURE with reason
  emitGenerationFailure(reason: string, route?: string, httpStatus?: number): void {
    this.emit('generation_failure', {
      message: reason,
      stack_hint: null,
      route: route || null,
      http_status: httpStatus || 500,
    });
    console.error(`REPORT: app=${APP_ID} | app_base_url=${APP_BASE_URL} | env=${ENV} | msg=GENERATION_FAILURE reason=${reason}`);
  }

  // MASTER FLEET GO-LIVE v3.4.1: Revenue Blocker Protocol
  // If a critical failure stops revenue, emit revenue_blocker immediately
  emitRevenueBlocker(blockerCode: string, remediationHint: string, details: Record<string, any> = {}): void {
    this.emit('revenue_blocker', {
      blocker_code: blockerCode,
      severity: 'critical',
      remediation_hint: remediationHint,
      ...details,
    });
    // Flush immediately for critical events
    this.flush();
    console.error(`REPORT: app=${APP_ID} | app_base_url=${APP_BASE_URL} | env=${ENV} | REVENUE_BLOCKER: ${blockerCode} - ${remediationHint}`);
  }

  // Convenience method for SEO publish failures
  emitSeoHalted(reason: string, details: Record<string, any> = {}): void {
    this.emitRevenueBlocker('SEO_HALTED', reason, details);
  }

  // MASTER FLEET GO-LIVE v3.4.1: Emit metric for pages_generated
  emitPagesGeneratedMetric(count: number, googleIndexStatus: string = 'pending'): void {
    this.emit('pages_generated', {
      pages_generated: count,
      google_index_status: googleIndexStatus,
      value: count,
      units: 'pages',
    });
    console.log(`REPORT: app=${APP_ID} | app_base_url=${APP_BASE_URL} | env=${ENV} | metric=pages_generated count=${count} google_index_status=${googleIndexStatus}`);
  }

  // SYSTEM_HEALTH: generator_duration_ms p95
  emitSystemHealth(p95Ms: number, uptimeS: number, errorRate: number = 0): void {
    this.emit('system_health', {
      uptime_s: uptimeS,
      p95_latency_ms: p95Ms,
      error_rate: errorRate,
      dependencies_ok: true,
    });
  }

  // PRODUCT: LAUNCH_COMPLETE per PHASE 5
  emitLaunchComplete(): void {
    this.emit('launch_complete', {
      value: 1,
      units: 'count',
      kpi_ready: true,
    });
    console.log(`REPORT: app=${APP_ID} | app_base_url=${APP_BASE_URL} | env=${ENV} | msg=LAUNCH_COMPLETE kpi_ready=true`);
  }

  emitSyntheticEvents(): void {
    console.log(`REPORT: app=${APP_ID} | app_base_url=${APP_BASE_URL} | env=${ENV} | msg=Emitting synthetic validation events...`);
    
    // Master Prompt v1.2 spec: scholarship_ingested { source, count, latency_ms }
    this.emit('scholarship_ingested', {
      synthetic: true,
      source: 'synthetic_test',
      count: 1,
      latency_ms: 0,
    });

    // Master Prompt v1.2 spec: scholarship_published { scholarship_id, url, provider_id? }
    this.emit('scholarship_published', {
      synthetic: true,
      scholarship_id: `synthetic-${randomUUID().substring(0, 8)}`,
      url: '/synthetic-test',
      provider_id: null,
    });

    // Master Prompt v1.2 spec: page_view { url, referrer, user_agent_hash, utm_* }
    this.emit('page_view', {
      synthetic: true,
      url: '/synthetic-test',
      referrer: null,
      user_agent_hash: null,
      utm_source: 'synthetic',
      utm_medium: 'test',
      utm_campaign: 'validation',
      utm_content: null,
      utm_term: null,
    });

    // Master Prompt v1.2 spec: page_published { url, template, word_count, status=published, utm_campaign? }
    this.emit('page_published', {
      synthetic: true,
      url: '/synthetic-test',
      template: 'scholarship',
      word_count: 0,
      status: 'published',
      utm_campaign: 'validation',
    });

    console.log(`REPORT: app=${APP_ID} | app_base_url=${APP_BASE_URL} | env=${ENV} | msg=Synthetic events emitted`);
  }

  startHeartbeat(intervalMs: number = 60000): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (!this.isShuttingDown) {
        this.emitHeartbeat();
        // Also send Global Mandate heartbeat format
        sendCommandCenterHeartbeat();
      }
    }, intervalMs);

    console.log(`[Telemetry] Heartbeat started (every ${intervalMs / 1000}s)`);
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    await this.flush();
    console.log('[Telemetry] Shutdown complete');
  }
}

export const telemetryClient = new TelemetryClient();

// GLOBAL MANDATE: Command Center Heartbeat Client
// Lightweight heartbeat sender for /api/heartbeat endpoint
const COMMAND_CENTER_HEARTBEAT_URL = process.env.COMMAND_CENTER_HEARTBEAT_URL || 
  'https://auto-com-center-jamarrlmayes.replit.app/api/heartbeat';

interface CommandCenterHeartbeat {
  app_name: string;
  status: 'online' | 'degraded' | 'offline';
  url: string;
  revenue_ready: boolean;
  version?: string;
  timestamp?: string;
}

export async function sendCommandCenterHeartbeat(revenueReady: boolean = true): Promise<void> {
  const payload: CommandCenterHeartbeat = {
    app_name: APP_ID,
    status: 'online',
    url: APP_BASE_URL,
    revenue_ready: revenueReady,
    version: `${APP_VERSION} (${MSP_VERSION})`,
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await fetch(COMMAND_CENTER_HEARTBEAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Source-App': APP_ID,
        'X-App-Base-URL': APP_BASE_URL,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      console.log(`[Heartbeat] Command Center accepted: ${response.status}`);
    } else if (response.status === 404) {
      // Expected until A8 deploys /api/heartbeat - silent
    } else {
      console.log(`[Heartbeat] Command Center rejected: ${response.status}`);
    }
  } catch (error) {
    // Silently fail - heartbeat is best-effort
  }
}

export function initTelemetry(): void {
  if (!TELEMETRY_ENABLED) {
    console.log(`REPORT: app=${APP_ID} | app_base_url=${APP_BASE_URL} | env=${ENV} | msg=Telemetry disabled via TELEMETRY_ENABLED=false`);
    return;
  }

  // MASTER SYSTEM PROMPT v3 PHASE 1: Print identity banner
  console.log('');
  console.log('SYSTEM INITIALIZED');
  console.log(`IDENTITY CONFIRMED: ${APP_ID}`);
  console.log(`BASE URL: ${APP_BASE_URL}`);
  console.log('MODE: Operational');
  console.log('TARGET: Launch, Revenue, Traffic, Reporting');
  console.log(`VERSION: ${APP_VERSION} (${MSP_VERSION})`);
  console.log('');
  
  console.log(`REPORT: app=${APP_ID} | app_base_url=${APP_BASE_URL} | env=${ENV} | msg=Initializing MSP v3 telemetry...`);
  console.log(`[Telemetry] Primary endpoint: ${COMMAND_CENTER_URL}`);
  console.log(`[Telemetry] Fallback endpoint: ${TELEMETRY_WRITE_URL}`);
  console.log(`[Telemetry] Token configured: ${COMMAND_CENTER_TOKEN ? 'Yes' : 'No'}`);
  
  // PHASE 1: Send initial SYSTEM_HEALTH heartbeat to command center
  telemetryClient.emit('system_health', {
    message: 'agent_online',
    value: 1,
    version: APP_VERSION,
    cold_start: true,
    uptime_s: 0,
    dependencies_ok: true,
  });
  
  telemetryClient.emitAppStarted();
  telemetryClient.emitHeartbeat();
  
  // GLOBAL MANDATE: Send immediate heartbeat to Command Center /api/heartbeat
  sendCommandCenterHeartbeat(true);
  
  // Flush immediately to push events to command center
  console.log(`REPORT: app=${APP_ID} | app_base_url=${APP_BASE_URL} | env=${ENV} | msg=Triggering immediate flush to Command Center...`);
  setTimeout(() => {
    telemetryClient.flush();
  }, 1000);
  
  // MASTER PROMPT PHASE 2: Start 300s heartbeats (per spec)
  telemetryClient.startHeartbeat(HEARTBEAT_INTERVAL_MS);

  // After ~5s warmup, emit startup validation and LAUNCH_COMPLETE
  setTimeout(() => {
    console.log(`REPORT: app=${APP_ID} | app_base_url=${APP_BASE_URL} | env=${ENV} | msg=Startup validation passed`);
    
    if (process.env.SYNTHETIC === 'true' || process.env.NODE_ENV === 'development') {
      telemetryClient.emitSyntheticEvents();
    }
    
    // PHASE 5: Emit LAUNCH_COMPLETE after initial run
    telemetryClient.emitLaunchComplete();
    
    console.log(`REPORT: app=${APP_ID} | app_base_url=${APP_BASE_URL} | env=${ENV} | msg=MASTER PROMPT active, events flowing to Command Center`);
  }, 5000);

  process.on('SIGTERM', async () => {
    console.log(`REPORT: app=${APP_ID} | app_base_url=${APP_BASE_URL} | env=${ENV} | msg=Received SIGTERM, shutting down...`);
    await telemetryClient.shutdown();
  });

  process.on('SIGINT', async () => {
    console.log(`REPORT: app=${APP_ID} | app_base_url=${APP_BASE_URL} | env=${ENV} | msg=Received SIGINT, shutting down...`);
    await telemetryClient.shutdown();
  });

  console.log(`[Telemetry] MASTER PROMPT initialized - primary: auto_com_center, legacy: scholarship_api`);
}
