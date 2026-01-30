import type { Request, Response, NextFunction } from 'express';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface RevenueGuardrails {
  per_user_daily_cap_usd: number;
  global_daily_cap_usd: number;
  max_single_charge_usd: number;
  currency: string;
}

interface GuardrailConfig {
  version: string;
  phase: string;
  guardrails: RevenueGuardrails;
  auto_refund: { enabled: boolean };
  provider_payouts: { mode: string; transfers_enabled: boolean };
}

const dailyUserSpend: Map<string, { date: string; total_cents: number }> = new Map();
let globalDailySpend = { date: '', total_cents: 0 };

function loadGuardrails(): GuardrailConfig | null {
  const configPath = join(process.cwd(), 'server/config/revenue-guardrails.json');
  if (!existsSync(configPath)) return null;
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch {
    return null;
  }
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function enforceRevenueGuardrails(req: Request, res: Response, next: NextFunction) {
  const config = loadGuardrails();
  if (!config) return next();

  const { guardrails } = config;
  const amountCents = req.body?.priceInCents;
  const userId = (req as any).user?.id || req.headers['x-user-id'] || 'anonymous';
  const today = getTodayDate();

  if (!amountCents || typeof amountCents !== 'number') return next();

  const amountUsd = amountCents / 100;

  if (amountUsd > guardrails.max_single_charge_usd) {
    console.warn(`[GUARDRAIL] Single charge $${amountUsd} exceeds max $${guardrails.max_single_charge_usd}`);
    return res.status(400).json({ 
      error: 'CHARGE_LIMIT_EXCEEDED',
      message: `Maximum single charge is $${guardrails.max_single_charge_usd}`,
      limit: guardrails.max_single_charge_usd
    });
  }

  const userRecord = dailyUserSpend.get(String(userId));
  if (userRecord && userRecord.date === today) {
    const projectedTotal = (userRecord.total_cents + amountCents) / 100;
    if (projectedTotal > guardrails.per_user_daily_cap_usd) {
      console.warn(`[GUARDRAIL] User ${userId} daily cap exceeded: $${projectedTotal}`);
      return res.status(400).json({
        error: 'DAILY_USER_LIMIT_EXCEEDED',
        message: `Daily spending limit of $${guardrails.per_user_daily_cap_usd} reached`,
        limit: guardrails.per_user_daily_cap_usd
      });
    }
  }

  if (globalDailySpend.date === today) {
    const projectedGlobal = (globalDailySpend.total_cents + amountCents) / 100;
    if (projectedGlobal > guardrails.global_daily_cap_usd) {
      console.warn(`[GUARDRAIL] Global daily cap exceeded: $${projectedGlobal}`);
      return res.status(503).json({
        error: 'PLATFORM_DAILY_LIMIT_EXCEEDED',
        message: 'Platform has reached daily transaction limit. Please try again tomorrow.',
        retry_after: 'midnight UTC'
      });
    }
  }

  next();
}

export function recordCharge(userId: string, amountCents: number) {
  const today = getTodayDate();
  
  const userRecord = dailyUserSpend.get(userId);
  if (userRecord && userRecord.date === today) {
    userRecord.total_cents += amountCents;
  } else {
    dailyUserSpend.set(userId, { date: today, total_cents: amountCents });
  }

  if (globalDailySpend.date === today) {
    globalDailySpend.total_cents += amountCents;
  } else {
    globalDailySpend = { date: today, total_cents: amountCents };
  }

  console.log(`[GUARDRAIL] Recorded charge: user=${userId}, amount=$${amountCents/100}, userTotal=$${dailyUserSpend.get(userId)!.total_cents/100}, globalTotal=$${globalDailySpend.total_cents/100}`);
}

export function getSpendStats() {
  const today = getTodayDate();
  return {
    date: today,
    global_total_usd: globalDailySpend.date === today ? globalDailySpend.total_cents / 100 : 0,
    active_users: Array.from(dailyUserSpend.entries())
      .filter(([_, v]) => v.date === today)
      .length
  };
}
