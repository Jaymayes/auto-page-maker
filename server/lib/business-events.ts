import { storage } from '../storage';
import { randomUUID } from 'crypto';

/**
 * Business Event Schema
 * Fire-and-forget telemetry for KPI calculation
 */
export interface BusinessEvent {
  app: string;
  env: string;
  eventName: string;
  ts: Date;
  actorType: 'student' | 'provider' | 'system' | 'anonymous';
  actorId: string | null;
  orgId?: string | null;
  requestId: string;
  sessionId: string | null;
  properties: Record<string, any>;
}

/**
 * Emit business event with fire-and-forget pattern
 * Never blocks request path; logs errors but continues
 */
export async function emitBusinessEvent(
  eventName: string,
  properties: Record<string, any>,
  options: {
    actorType?: BusinessEvent['actorType'];
    actorId?: string | null;
    orgId?: string | null;
    requestId?: string;
    sessionId?: string | null;
  } = {}
): Promise<void> {
  try {
    const event: BusinessEvent = {
      app: process.env.APP_NAME || 'executive_command_center',
      env: process.env.NODE_ENV || 'development',
      eventName,
      ts: new Date(),
      actorType: options.actorType || 'system',
      actorId: options.actorId || null,
      orgId: options.orgId || null,
      requestId: options.requestId || randomUUID(),
      sessionId: options.sessionId || null,
      properties: properties || {},
    };

    // Fire-and-forget: don't await
    storage.logBusinessEvent(event).catch((error) => {
      console.error('[Business Events] Emission failed (non-blocking):', {
        eventName,
        error: error.message,
        requestId: event.requestId,
      });
    });
  } catch (error) {
    // Catch synchronous errors, log but never throw
    console.error('[Business Events] Emission error (caught):', {
      eventName,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Revenue normalization helpers
 */
export function normalizeRevenue(
  amountCents: number,
  context: { paymentId?: string; creditAmount?: number }
): { revenue_usd: number; payment_id?: string; credit_amount?: number } {
  return {
    revenue_usd: amountCents / 100,
    ...(context.paymentId && { payment_id: context.paymentId }),
    ...(context.creditAmount && { credit_amount: context.creditAmount }),
  };
}

/**
 * Fee calculation for B2B (3% platform fee)
 */
export function calculateProviderFee(
  baseAmountUsd: number,
  feePct: number = 0.03
): { fee_base_usd: number; fee_pct: number; fee_usd: number } {
  return {
    fee_base_usd: baseAmountUsd,
    fee_pct: feePct,
    fee_usd: baseAmountUsd * feePct,
  };
}

/**
 * Session ID generator for tracking user journeys
 */
export function generateSessionId(): string {
  return `sess_${randomUUID()}`;
}

/**
 * Request ID generator for distributed tracing
 */
export function generateRequestId(): string {
  return `req_${randomUUID()}`;
}
