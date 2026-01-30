# Team Handoff: Universal Prompt v1.1 (Agent3 Router)

**CEO Directive:** Adopt Universal Prompt v1.1 across all 8 Scholar AI Advisor apps within 72 hours  
**Status:** ✅ DEPLOYED & VERIFIED  
**Date:** October 28, 2025

---

## What Is This?

Universal Prompt v1.1 is a **single system prompt** that powers all 8 Scholar AI Advisor apps. Agent3 auto-detects which app it's running in, locks to that overlay, and operates only within that app's rules.

**Key Benefits:**
- ✅ Single source of truth for all apps
- ✅ Consistent finance rules across platform
- ✅ Automatic overlay detection and isolation
- ✅ Built-in revenue tracking and SLO monitoring
- ✅ Instant rollback capability

---

## Quick Start (Copy-Paste)

### Step 1: Enable Universal Mode

```bash
export PROMPT_MODE=universal
```

### Step 2: (Optional) Force Specific Overlay for Testing

```bash
export APP_OVERLAY=student_pilot  # or your app name
```

### Step 3: Restart Your Service

```bash
npm run dev
```

### Step 4: Verify Bootstrap Event

Check logs for `overlay_selected` event with:
- `app_key`: Which overlay was selected
- `detection_method`: How it was detected
- `mode`: "universal"
- `prompt_version`: "v1.1"

---

## Per-App Quick Start

### 1. executive_command_center (KPI Briefs)

```bash
export APP_OVERLAY=executive_command_center
export PROMPT_MODE=universal
npm run dev
```

**What it does:** Summarizes platform KPIs and risks  
**Required events:** `kpi_brief_generated`  
**Must NOT:** Trigger revenue actions; modify configs

---

### 2. auto_page_maker (SEO Engine)

```bash
export APP_OVERLAY=auto_page_maker
export PROMPT_MODE=universal
npm run dev
```

**What it does:** Generates SEO-safe scholarship pages  
**Required events:** `overlay_selected`  
**Must NOT:** Collect PII; promise guaranteed awards

---

### 3. student_pilot (B2C Revenue) 💰

```bash
export APP_OVERLAY=student_pilot
export PROMPT_MODE=universal
npm run dev
```

**What it does:** Explains credit packs and guides purchases  
**Required events:** `credit_purchase_succeeded`  
**Must NOT:** Compute fee_usd; offer unauthorized discounts; write essays

**Revenue Event Schema:**
```typescript
{
  event_name: 'credit_purchase_succeeded',
  props: {
    revenue_usd: 20.00,           // Required
    credits_purchased: 10,        // Required
    sku: 'credit_pack_10',        // Required
    user_id_hash: 'sha256(...)'   // Optional (privacy-safe)
  }
}
```

**Finance Rule:** Pricing must be ≥ 4x AI cost

---

### 4. provider_register (B2B Revenue) 💰

```bash
export APP_OVERLAY=provider_register
export PROMPT_MODE=universal
npm run dev
```

**What it does:** Explains provider onboarding and fee policy  
**Required events:** `fee_accrued`  
**Must NOT:** Compute fee_usd in-agent; store PII; change fee rules

**Revenue Event Schema (SERVER-SIDE ONLY):**
```typescript
// Backend computes fee
const feeUsd = awardAmount * 0.03;

await emitBusinessEvent({
  event_name: 'fee_accrued',
  props: {
    scholarship_id: id,
    award_amount: awardAmount,   // Required
    fee_usd: feeUsd              // Server-computed ONLY
  }
});
```

**Critical:** Agent CANNOT compute `fee_usd`. Server computes as `award_amount × 0.03`

---

### 5. scholarship_api (Default/Fallback)

```bash
export APP_OVERLAY=scholarship_api
export PROMPT_MODE=universal
npm run dev
```

**What it does:** Explains API endpoints, auth scopes, rate limits  
**Required events:** `overlay_selected`  
**Must NOT:** Simulate API calls; expose secrets

---

### 6. scholarship_agent (Marketing)

```bash
export APP_OVERLAY=scholarship_agent
export PROMPT_MODE=universal
npm run dev
```

**What it does:** Drafts marketing briefs and campaign calendars  
**Required events:** `overlay_selected`  
**Must NOT:** Overstate outcomes; collect PII

---

### 7. scholar_auth (Authentication)

```bash
export APP_OVERLAY=scholar_auth
export PROMPT_MODE=universal
npm run dev
```

**What it does:** Explains login flows and OAuth best practices  
**Required events:** `overlay_selected`  
**Must NOT:** Expose tokens; store credentials

---

### 8. scholarship_sage (Policy Q&A)

```bash
export APP_OVERLAY=scholarship_sage
export PROMPT_MODE=universal
npm run dev
```

**What it does:** Policy/compliance Q&A and guidance  
**Required events:** `overlay_selected`  
**Must NOT:** Author disallowed content; override policies

---

## Finance Rules (CEO Directive)

### B2C (student_pilot)
- **Rule:** 4x AI services markup
- **Pricing:** Must be ≥ 4x actual AI cost
- **Event:** `credit_purchase_succeeded {revenue_usd, credits_purchased, sku}`

### B2B (provider_register)
- **Rule:** 3% provider fee
- **Calculation:** `fee_usd = award_amount × 0.03` (SERVER-SIDE ONLY)
- **Event:** `fee_accrued {scholarship_id, award_amount, fee_usd}`

**Critical:** Agent NEVER computes `fee_usd`. Backend computes it and emits the event.

---

## Global Guardrails (All Apps)

1. ❌ **No academic dishonesty** - No essay ghostwriting; coaching only
2. ❌ **No PII collection** - Use `user_id_hash` (privacy-safe)
3. ❌ **No client-side revenue math** - Server computes `fee_usd`
4. ✅ **FERPA/COPPA compliance** - Data minimization
5. ✅ **Responsible AI** - Bias mitigation, transparency
6. ❌ **No secrets exposure** - Never expose tokens/keys

---

## SLO Targets & Escalation

### Targets
- **Uptime:** ≥ 99.9%
- **P95 Latency:** ≤ 120ms

### Escalation
Emit `slo_at_risk` event if:
- P95 > 150ms for 5+ minutes
- Uptime risk detected
- Event drop > 10%

**Event Schema:**
```typescript
{
  event_name: 'slo_at_risk',
  props: {
    p95_ms: 175,
    uptime: 99.5,
    risk_reason: 'P95 breach for 6 minutes'
  }
}
```

---

## 72-Hour Rollout Plan

### T+24h: Non-Revenue Apps (Pilot)
**Apps:** `scholarship_api`, `scholarship_agent`

**Verification:**
- ✅ `overlay_selected` events flowing
- ✅ P95 ≤ 120ms
- ✅ Event completeness ≥ 99%
- ✅ No SLO violations

---

### T+48h: Revenue Apps (Critical)
**Apps:** `student_pilot`, `provider_register`

**Verification:**
```sql
-- B2C Revenue Check
SELECT 
  COUNT(*) as purchases,
  SUM((props->>'revenue_usd')::numeric) as total_usd
FROM business_events
WHERE event_name = 'credit_purchase_succeeded'
AND created_at > NOW() - INTERVAL '24 hours';

-- B2B Fee Accuracy Check
SELECT 
  scholarship_id,
  (props->>'fee_usd')::numeric as fee_usd,
  (props->>'award_amount')::numeric as award_amount,
  ABS((props->>'fee_usd')::numeric - (props->>'award_amount')::numeric * 0.03) as variance
FROM business_events
WHERE event_name = 'fee_accrued'
AND created_at > NOW() - INTERVAL '24 hours';
-- Expect: all variance < 0.01
```

**Success Criteria:**
- ✅ Revenue events with complete schemas
- ✅ Server-side fee calculation: variance < $0.01
- ✅ No client-side fee computation
- ✅ P95 latency maintained
- ✅ Bootstrap telemetry 100%

---

### T+72h: Full Deployment + First Revenue Report 🎯
**Apps:** `executive_command_center`, `auto_page_maker`, `scholar_auth`, `scholarship_sage`

**Goal:** Generate `kpi_brief_generated` event with:
- ✅ Non-zero `arr_usd` (from credit purchases)
- ✅ Non-zero `fee_revenue_usd` (from provider fees)
- ✅ P95 ≤ 120ms
- ✅ Uptime ≥ 99.9%

**Query:**
```sql
SELECT 
  (props->>'arr_usd')::numeric as arr_usd,
  (props->>'fee_revenue_usd')::numeric as fee_revenue_usd,
  (props->>'p95_ms')::numeric as p95_ms,
  (props->>'uptime')::numeric as uptime,
  props->>'notes' as notes
FROM business_events
WHERE event_name = 'kpi_brief_generated'
ORDER BY created_at DESC
LIMIT 1;
```

---

## Instant Rollback (No Code Changes)

If issues arise:

```bash
export PROMPT_MODE=separate
npm run dev
```

**What happens:**
- Falls back to individual `.prompt` files
- Zero code changes required
- Instant rollback
- Can re-enable universal mode anytime

---

## Verification Checklist

### Before Deploying (All Apps)

- [ ] `PROMPT_MODE=universal` set
- [ ] App starts without errors
- [ ] `overlay_selected` event appears on session start
- [ ] Bootstrap event has all required fields:
  - `app_key`
  - `detection_method`
  - `mode: "universal"`
  - `prompt_version: "v1.1"`

### For Revenue Apps (student_pilot, provider_register)

**student_pilot:**
- [ ] `credit_purchase_succeeded` event emitted on purchase
- [ ] Event has `revenue_usd`, `credits_purchased`, `sku`
- [ ] No PII in events
- [ ] Pricing ≥ 4x AI cost

**provider_register:**
- [ ] `fee_accrued` event emitted on scholarship listing
- [ ] Event has `scholarship_id`, `award_amount`, `fee_usd`
- [ ] `fee_usd` computed SERVER-SIDE ONLY
- [ ] Variance: `|fee_usd - (award_amount × 0.03)| < $0.01`
- [ ] No client-side fee computation

### For All Apps

- [ ] P95 latency ≤ 120ms
- [ ] Uptime ≥ 99.9%
- [ ] No sustained `slo_at_risk` events
- [ ] No PII in any events
- [ ] No secrets/tokens exposed
- [ ] Overlay isolation maintained

---

## SQL Validation Pack

### 1. Bootstrap Telemetry Check
```sql
SELECT 
  (props->>'app_key') as app,
  (props->>'detection_method') as method,
  (props->>'mode') as mode,
  (props->>'prompt_version') as version,
  COUNT(*) as sessions
FROM business_events
WHERE event_name = 'overlay_selected'
AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY app, method, mode, version
ORDER BY sessions DESC;
```

### 2. B2C Revenue Verification
```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as purchases,
  SUM((props->>'revenue_usd')::numeric) as total_usd,
  AVG((props->>'revenue_usd')::numeric) as avg_usd,
  SUM((props->>'credits_purchased')::numeric) as total_credits
FROM business_events
WHERE event_name = 'credit_purchase_succeeded'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### 3. B2B Fee Accuracy Validation
```sql
SELECT 
  (props->>'scholarship_id') as scholarship_id,
  (props->>'award_amount')::numeric as award,
  (props->>'fee_usd')::numeric as fee,
  ((props->>'fee_usd')::numeric / (props->>'award_amount')::numeric * 100) as fee_pct,
  ABS((props->>'fee_usd')::numeric - (props->>'award_amount')::numeric * 0.03) as variance
FROM business_events
WHERE event_name = 'fee_accrued'
AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY variance DESC;
-- Expect: all variance < 0.01, all fee_pct ≈ 3.00%
```

### 4. PII Safety Scan
```sql
SELECT 
  event_name,
  props::text
FROM business_events
WHERE 
  props::text ~* 'email|ssn|phone|password|secret'
  OR props::text ~ '[0-9]{3}-[0-9]{2}-[0-9]{4}' -- SSN
  OR props::text ~ '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' -- Email
LIMIT 10;
-- Expect: 0 rows
```

### 5. SLO Monitoring
```sql
SELECT 
  app,
  percentile_cont(0.95) WITHIN GROUP (
    ORDER BY (props->>'latency_ms')::numeric
  ) as p95_ms
FROM business_events
WHERE event_name = 'request_completed'
AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY app
HAVING percentile_cont(0.95) WITHIN GROUP (
  ORDER BY (props->>'latency_ms')::numeric
) > 120
ORDER BY p95_ms DESC;
-- Expect: 0 rows (all apps under 120ms)
```

---

## Troubleshooting

### Issue: overlay_selected not appearing

**Check:**
```bash
# Verify PROMPT_MODE
echo $PROMPT_MODE  # Should be "universal"

# Check logs
tail -f logs/app.log | grep overlay_selected
```

**Fix:**
```bash
export PROMPT_MODE=universal
npm run dev
```

---

### Issue: Revenue events missing fields

**Check:**
```sql
SELECT 
  event_name,
  props
FROM business_events
WHERE event_name IN ('credit_purchase_succeeded', 'fee_accrued')
ORDER BY created_at DESC
LIMIT 10;
```

**Fix (student_pilot):**
```typescript
await emitBusinessEvent({
  event_name: 'credit_purchase_succeeded',
  props: {
    revenue_usd: 20.00,        // ✅ Required
    credits_purchased: 10,     // ✅ Required
    sku: 'credit_pack_10',     // ✅ Required
    user_id_hash: sha256(userId) // Optional
  }
});
```

**Fix (provider_register - SERVER SIDE):**
```typescript
const feeUsd = awardAmount * 0.03;  // ✅ Server computes

await emitBusinessEvent({
  event_name: 'fee_accrued',
  props: {
    scholarship_id: id,
    award_amount: awardAmount,
    fee_usd: feeUsd  // ✅ Server-computed
  }
});
```

---

### Issue: Fee calculation variance too high

**Check:**
```sql
SELECT 
  ABS((props->>'fee_usd')::numeric - (props->>'award_amount')::numeric * 0.03) as variance
FROM business_events
WHERE event_name = 'fee_accrued'
ORDER BY variance DESC
LIMIT 1;
```

**Expected:** variance < $0.01

**Fix:** Ensure server computes fee with proper precision:
```typescript
const feeUsd = Math.round(awardAmount * 0.03 * 100) / 100;
```

---

### Issue: P95 latency exceeding 120ms

**Check:**
```sql
SELECT 
  percentile_cont(0.95) WITHIN GROUP (ORDER BY (props->>'latency_ms')::numeric) as p95_ms
FROM business_events
WHERE event_name = 'request_completed'
AND created_at > NOW() - INTERVAL '1 hour';
```

**Fix:**
1. Emit `slo_at_risk` event
2. Reduce non-critical operations
3. Investigate performance bottlenecks
4. Escalate to operations team

---

## Contact & Support

**Documentation:**
- `docs/CEO_DIRECTIVE_DEPLOYMENT.md` - Complete deployment report
- `docs/system-prompts/universal.prompt` - Source prompt file

**Quick Reference:**
- File size: 5,300 bytes
- Hash: `6f54084202577c92`
- Version: v1.1
- Apps: 8 overlays

**Deployment Status:** ✅ PRODUCTION READY

---

**Last Updated:** October 28, 2025  
**CEO Directive:** EXECUTED  
**72-Hour Countdown:** STARTED
