# Gate A - Webhook Scale Test Post-Mortem
**Incident Date**: 2025-11-12  
**Post-Mortem Submitted**: 2025-11-12 20:47 UTC  
**DRI**: Agent3  
**Severity**: P1 - Blocks production traffic for auto_com_center  

---

## Executive Summary

**30K webhook replay test achieved PERFECT delivery and data integrity but FAILED latency SLO by 7.5x margin.**

**Pass Criteria**:
- ✅ Delivery: 30,000/30,000 (100%) - Exceeds ≥99.9% target
- ✅ Idempotency: 0 violations - Perfect deduplication
- ✅ Ordering: 0 violations - Timestamps monotonic
- ❌ **P95 Latency: 895ms (target ≤120ms) - CRITICAL BLOCKER**

**Impact**: auto_com_center remains in **observer mode** (NO-GO for production customer sends) pending latency optimization.

---

## Timeline (All Times UTC)

### Initial Test Execution (20:00-20:15)
- **20:00**: Gate A 500-send test PASS (P95 79ms, 0% errors, 100% inbox)
- **20:10**: 30K webhook replay initiated
- **20:12**: Test aborted after 699/1000 delivery (69.9%) due to 429 errors
- **20:15**: CEO decision memo: NO-GO for production until 30K PASS

### Diagnostic Phase (20:15-20:37)
- **20:16**: Root-cause sprint initiated per CEO directive
- **20:17**: Identified **multi-layer rate limiting** as bottleneck:
  1. Global API limiter: 1000 req/15min = 66 req/min (IP-based)
  2. Origin limiter: 2000 req/15min = 133 req/min (origin-based)
  3. Route-specific limiter: **MISCONFIGURED** as 1 req/10s (should be 30K/min)
  4. Abuse monitoring: 800 req/15min auto-suppress threshold

### Fix Implementation (20:17-20:36)
- **20:17**: Exempted /api/webhooks/* from global API + origin limiters
- **20:18**: Fixed route-specific limiter: 30,000 req/min capacity
- **20:18**: Re-ran 1K diagnostic: **STILL 699/1000** (30.1% failure)
- **20:25**: Discovered **abuse-monitoring middleware** (800 req threshold)
- **20:36**: Exempted /api/webhooks/* from abuse monitoring

### Validation & 30K Execution (20:36-20:47)
- **20:36**: Server restart with all three rate limiter exemptions
- **20:37**: 1K diagnostic: **PERFECT PASS** (1000/1000, 100%)
- **20:40**: 30K webhook replay initiated
- **20:47**: 30K replay complete: **100% delivery, 895ms P95 latency**

---

## Root Cause Analysis

### Rate Limiting (RESOLVED)
**Problem**: Three overlapping rate limiters throttling webhook endpoint:

1. **Global API Rate Limiter** (`generalApiLimiter`)
   - Configured: 1000 req/15min = 66 req/min per IP
   - Applied to: ALL `/api/*` routes
   - Impact: Blocked localhost (127.0.0.1) after ~66 requests
   - **Fix**: Exempted `/api/webhooks/*` via conditional middleware

2. **Origin Rate Limiter** (`originBasedLimiter`)
   - Configured: 2000 req/15min = 133 req/min per origin
   - Applied to: ALL `/api/*` routes
   - Impact: Blocked origin-less S2S webhooks after ~133 requests
   - **Fix**: Exempted `/api/webhooks/*` via conditional middleware

3. **Route-Specific Rate Limiter** (Webhook Endpoint)
   - **MISCONFIGURATION**: `createRateLimiter(10000, 1)` = 1 req/10s (6 req/min)
   - Should have been: `createRateLimiter(60000, 30000)` = 30K req/min
   - Impact: Hard limit at 1 request per 10 seconds
   - **Fix**: Corrected to 30,000 req/min capacity

4. **Abuse Monitoring Middleware** (`abuseMonitoringMiddleware`)
   - Configured: 800 req/15min warning threshold → 5 min auto-suppress
   - Applied to: ALL routes (including webhooks)
   - Impact: Auto-suppressed localhost after ~700-800 requests
   - **Fix**: Exempted `/api/webhooks/*` via conditional middleware

**Verification**: 1K diagnostic achieved 100% delivery after all fixes applied.

---

### P95 Latency Degradation (UNRESOLVED - CRITICAL BLOCKER)
**Problem**: Webhook handler P95 latency degrades 7.5x under sustained load (895ms vs 120ms target)

**Observed Latency Profile**:
| Test Scale | P50 | P95 | P99 | Throughput |
|------------|-----|-----|-----|------------|
| 500-send   | 68ms | 79ms | 105ms | Low (staged) |
| 1K diagnostic | 266ms | 487ms | 696ms | 107.47 req/s |
| **30K replay** | **631ms** | **895ms** | **1083ms** | **~500 req/s peak** |

**Latency Breakdown Hypothesis** (requires profiling):
1. **Database Write Latency**: `INSERT INTO email_webhook_events` with composite unique constraint (messageId + eventType)
2. **Business Event Emission**: Fire-and-forget business event telemetry (non-blocking but adds overhead)
3. **HMAC Validation**: crypto.createHmac() synchronous operation per request
4. **Idle Connection Overhead**: Neon PostgreSQL serverless cold start or connection pooling saturation

**Evidence**:
- 500-send test (staged, low throughput): P95 79ms ← Within SLO
- 30K replay (burst, high throughput): P95 895ms ← 11x degradation

**Working Theory**: Database connection pool saturation or query lock contention under concurrent INSERTs.

---

## Mitigation Plan

### Short-Term (For 02:00 UTC Re-Test)
**Goal**: Reduce P95 latency from 895ms to ≤120ms under 30K load

**Mitigation Options** (prioritized by impact):

1. **Database Write Optimization** (High Impact)
   - [ ] Add database connection pooling with higher max connections (currently default)
   - [ ] Batch INSERT operations (10-20 events per transaction) instead of single-row INSERTs
   - [ ] Add database index on `(messageId, eventType)` if not already present
   - [ ] Profile Drizzle ORM query latency to identify bottleneck

2. **Async Business Event Emission** (Medium Impact)
   - [ ] Move business event emission to background queue (Redis/BullMQ)
   - [ ] Remove synchronous overhead from webhook handler critical path

3. **HMAC Validation Optimization** (Low Impact)
   - [ ] Profile crypto.createHmac() latency (unlikely bottleneck)
   - [ ] Consider caching HMAC verification for replay protection window

4. **Horizontal Scaling** (Future)
   - [ ] Add load balancer + multiple worker instances
   - [ ] Shard database writes by messageId hash

**Recommended Action**: Batch database writes (Option 1) - highest ROI for latency reduction.

---

### Long-Term (Post-Launch)
1. **APM Integration**: Add Datadog/NewRelic for distributed tracing and latency profiling
2. **Read Replica**: Offload webhook event queries to read replica
3. **Queue-Based Architecture**: Webhook ingestion → queue → async processing
4. **Caching Layer**: Redis for duplicate detection (replace DB unique constraint)

---

## Lessons Learned

### What Went Well
1. **Methodical debugging**: Identified all three rate limiter layers systematically
2. **CEO alignment**: Early NO-GO decision prevented production incident
3. **Perfect delivery**: 100% delivery with 0 idempotency/ordering violations
4. **Evidence-driven**: Comprehensive diagnostic logging and metrics collection

### What Went Wrong
1. **Rate limiter misconfiguration**: `createRateLimiter(10000, 1)` parameter inversion
2. **Overlapping middleware**: Three rate limiters applied to same endpoint
3. **Latency oversight**: Focused on delivery rate, missed P95 latency degradation
4. **Incomplete testing**: 500-send test (low throughput) didn't surface latency issues

### Action Items
1. **Latency SLO enforcement**: Add P95 latency assertions to all scale tests
2. **Middleware audit**: Document all middleware layers and their scope
3. **Configuration validation**: Add schema validation for rate limiter parameters
4. **Load testing**: Include sustained high-throughput tests (≥1K req/s) in Gate criteria

---

## Evidence Artifacts

### Test Results
1. ✅ `results.json` - 500-send PASS (P95 79ms, 0% errors, 100% inbox)
2. ✅ `diagnostic_1k_FINAL.log` - 1K diagnostic PASS (100% delivery)
3. ⚠️ `webhook_replay_30k_results.json` - 30K replay: 100% delivery, **895ms P95 FAIL**

### Configuration Changes
1. `server/index.ts` - Global API + origin limiters exemption for /api/webhooks/*
2. `server/index.ts` - Abuse monitoring exemption for /api/webhooks/*
3. `server/routes.ts` - Route-specific limiter: 30,000 req/min capacity

### Metrics Manifest
- SHA-256: `8c8b8de09268d8c032aa4460cc9770d9468f3aba9b980779139385ccf8b2431d` (500-send only)
- New artifacts pending: 30K replay logs, latency histograms, error budget ledger

---

## Gate A Decision

**Status**: ⚠️ **CONDITIONAL NO-GO**

**Rationale**:
- Delivery & data integrity: **EXCEEDS** all targets (100% delivery, perfect idempotency/ordering)
- Latency SLO: **CRITICAL MISS** (895ms vs 120ms target)

**Approved Operations**:
- ✅ Observer mode (internal monitoring)
- ✅ Internal canary sends (≤500 emails, low throughput)
- ❌ External customer sends (BLOCKED pending latency fix)

**Recovery Path**:
1. Implement database write batching (2-4 hours)
2. Re-run 30K replay with latency profiling
3. If P95 ≤120ms: **UPGRADE TO GO**
4. If P95 >120ms: Escalate to architecture review

**Next Checkpoint**: 02:00 UTC (Nov 13) - Latency fix validation

---

## DRI Signature

**Agent**: Agent3  
**Timestamp**: 2025-11-12 20:47:00 UTC  
**Status**: POST-MORTEM COMPLETE - Latency mitigation in progress  
**Next Action**: Implement database write batching for 02:00 UTC re-test
