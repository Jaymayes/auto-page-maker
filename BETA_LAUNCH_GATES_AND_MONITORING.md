# 🚦 BETA LAUNCH GATES & MONITORING PROTOCOL
**ScholarMatch Platform - Private Beta Deployment**

**CEO Authorization**: October 9, 2025  
**Launch Status**: Phase 1 ACTIVE (50 students, D0-D3)

---

## 📋 PHASE RAMP PLAN (AUTHORIZED)

| Phase | Timeline | Cohort Size | Status |
|-------|----------|-------------|--------|
| **Phase 1** | D0-D3 | 50 students | ✅ ACTIVE |
| **Phase 2** | D4-D7 | 250 students | ⏸️ Pending Phase 1 gates |
| **Phase 3** | D8+ | 1,000 students | ⏸️ Pending Phase 2 gates |

**Change Freeze**: D0-D1 (non-critical changes only)  
**On-Call Coverage**: Active

---

## 🎯 GO/HOLD GATES (Required for Phase Advancement)

**Evaluation Window**: Preceding 24-hour period must meet ALL criteria:

### 1. Reliability Gates
- ✅ **Availability**: ≥99.9% uptime
- ✅ **5xx Error Rate**: ≤0.2% of total requests
- ✅ **Critical Endpoints**: /api/scholarships, /api/scholarships/stats, /healthz operational

### 2. Performance Gates
- ✅ **P95 Latency**: ≤120ms
- ✅ **P99 Latency**: ≤200ms
- ✅ **Throughput**: Stable under peak load

### 3. Rate Limiting Gates
- ✅ **429 Rate**: <1% of total requests
- ✅ **Single IP/ASN Abuse**: Any IP driving >2% of 429s investigated
- ✅ **Legitimate Traffic**: No verified users blocked incorrectly

### 4. Abuse Protection Gates
- ✅ **Auth Limiter Triggers**: ≤0.1% of authenticated requests
- ✅ **Token Abuse**: Zero confirmed cases
- ✅ **Suspicious Patterns**: Investigated and mitigated

### 5. Capacity Headroom Gates
- ✅ **CPU Utilization**: <60% sustained per critical service
- ✅ **Queue Depths**: Stable, no backlog accumulation
- ✅ **RPS Headroom**: >10× projected peak capacity available

### 6. Cost Guardrail Gates
- ✅ **Infra/AI Cost per 1k Requests**: Within target margins
- ✅ **AI Service Markup**: 4× maintained
- ✅ **Overall Margin**: On track for profitability targets

---

## 📊 MONITORING DASHBOARDS (ACTIVE)

### Primary Metrics Dashboard

**Real-Time Indicators**:
- Latency: P50 / P95 / P99 (5-minute rolling window)
- Error Rates: 5xx / 429 / 4xx percentages
- Request Volume: RPS total, by endpoint
- Rate Limiter: Hit rates by IP/ASN, top talkers
- Auth Limiter: Trigger count, affected users
- System Resources: CPU/Memory per service, queue depths
- Provider Health: Neon DB, OpenAI API status

**Endpoints to Track**:
1. `/api/scholarships` (primary search)
2. `/api/scholarships/stats` (homepage)
3. `/api/scholarships/:id` (detail view)
4. `/api/landing-pages` (SEO pages)
5. `/healthz` (system health)

### KPI Tracking Dashboard

**Activation Metrics**:
- Profile completion rate
- Time to first scholarship match
- Searches per user
- Saved scholarships per user

**Revenue Metrics**:
- Conversion to paid (credit usage)
- ARPU from premium features
- SEO-driven signups (Auto Page Maker traffic)

**Growth Metrics**:
- Daily active users (DAU)
- User retention (D1, D7, D14)
- Viral coefficient (referrals)

---

## 🚨 ALERT THRESHOLDS (PAGER DUTY)

### Critical Alerts (Immediate Response)

**Performance Degradation**:
- 🔴 **P95 Latency >120ms** for 5 consecutive minutes
  - Action: Check slow query logs, DB connection pool
  - Escalate: If sustained >10 minutes

**Error Spikes**:
- 🔴 **5xx Error Rate >0.5%** for 5 minutes
  - Action: Check application logs, DB health
  - Escalate: Immediate if >1%

**Rate Limiting Issues**:
- 🟡 **429 Rate >2%** for 10 minutes (exclude load tests)
  - Action: Identify source IPs, check for abuse
  - Escalate: If single IP driving >50% of errors

**Abuse Detection**:
- 🔴 **Single IP/ASN >1,500 req/15min** repeatedly across 30 minutes
  - Action: Investigate traffic pattern, consider temporary block
  - Escalate: If confirmed DDoS attack

**Resource Exhaustion**:
- 🟡 **CPU >60% sustained** for 15 minutes
  - Action: Check for runaway processes, scale if needed
  - Escalate: If approaching 80%

- 🔴 **Memory >85%** for 5 minutes
  - Action: Check for memory leaks, restart if needed
  - Escalate: Immediate if >90%

### Warning Alerts (Monitor & Investigate)

- ⚠️ **P99 Latency >200ms** for 10 minutes
- ⚠️ **429 Rate >1%** for 15 minutes
- ⚠️ **Auth Limiter >0.1%** trigger rate
- ⚠️ **Queue depth** increasing trend

---

## 📈 DAILY EXECUTIVE SUMMARY (Automated)

**Delivery**: Email to CEO, daily at 9:00 AM

**Contents**:
1. **Key Metrics (24h)**:
   - Total requests, active users, new signups
   - P95/P99 latency, 5xx/429 rates
   - Top endpoints by volume
   
2. **Incidents & Issues**:
   - Summary of alerts fired
   - Resolution status and root cause
   - Impact on users (if any)

3. **Rate Limiter Analysis**:
   - Top IP/ASN talkers (request volume)
   - 429 breakdown by IP, pattern analysis
   - Any legitimate traffic blocked (false positives)

4. **Cost Metrics**:
   - Infra cost per 1k requests
   - AI API spend (OpenAI)
   - Margin vs. target

5. **User Engagement**:
   - Activation funnel metrics
   - Revenue signals (credit usage)
   - SEO traffic from landing pages

---

## 🧪 UPDATED TESTING POLICY

### Staging Environment Testing

**Load Testing Allowlist**:
- Use dedicated `loadtest` API key that bypasses IP limiter **in STAGING ONLY**
- OR allowlist specific load-testing IPs (Replit CI, local dev)
- **NEVER bypass rate limits in production**

**Implementation**:
```typescript
// server/middleware/rate-limit.ts
const isLoadTest = process.env.NODE_ENV !== 'production' && 
                   (req.headers['x-loadtest-key'] === process.env.LOADTEST_API_KEY);

if (isLoadTest) {
  return next(); // Skip rate limiting
}
```

### Production Testing Protocol

**Capacity Checks**:
- Use distributed load testing across ≥25 IPs (realistic traffic pattern)
- Run off-peak hours only (minimize user impact)
- Cap at 50% of rate limit per IP (avoid DDoS triggers)
- Coordinate with on-call engineer

**Forbidden in Production**:
- ❌ Single-IP sustained load tests >1,000 req/15min
- ❌ Bypassing rate limiters via special headers
- ❌ Disabling security middleware

**Approved Methods**:
- ✅ Multi-region distributed testing (k6, Gatling with cloud agents)
- ✅ Synthetic monitoring (Pingdom, Datadog with <100 req/15min)
- ✅ Manual exploratory testing (normal user patterns)

---

## 🚧 CONTINGENCIES & EXCEPTIONS

### School/Corporate NAT Hot Spots

**Problem**: Verified partner network hitting IP limits due to shared NAT

**Solution**:
1. Verify legitimacy (contact institution, confirm email domains)
2. Temporarily allowlist their CIDR OR raise per-origin limit to 2,500/15min
3. Set 7-day automatic expiry
4. Add monitoring for abuse from allowlisted range
5. Document in exceptions log

**Approval**: Requires VP Engineering or CEO approval

### Incident Response - Error Budget Burn

**Trigger**: Error budget burn >10% in 24h window OR 429s >3% for 30 minutes

**Actions**:
1. **HOLD the ramp** - Do not advance to next phase
2. **Investigate** - Root cause analysis, log review
3. **Remediate** - Fix issue, validate resolution
4. **Validate** - Run soak test in staging
5. **Resume** - Only after 24h stability window

**Rollback Criteria**:
- 5xx rate >1% sustained
- P95 latency >150ms sustained
- User-reported blocking issues >5 cases
- Data integrity issues detected

**Rollback Procedure**:
1. Set `USE_DB_STORAGE=false` (instant MemStorage fallback)
2. OR deploy previous git commit
3. Notify users of temporary issues (if visible impact)
4. Post-mortem within 48h

---

## 📚 DOCUMENTATION & KNOWLEDGE BASE

**Filed Documents**:
- ✅ `CEO_BETA_LAUNCH_VALIDATION.md` - Validation summary and go-decision
- ✅ `BETA_LAUNCH_GATES_AND_MONITORING.md` - This document (gates, alerts, contingencies)
- ✅ `T6-12H_TEST_READOUT_REPORT.md` - Comprehensive load testing results
- ✅ `replit.md` - Updated with T+6-12h findings and rate limit config

**Testing Policy**:
- Updated in QA SOP (linked from validation report)
- Load testing in staging with bypass keys
- Production testing with distributed IPs only
- No single-IP sustained tests in production

---

## ✅ PHASE 1 LAUNCH CHECKLIST

### Pre-Launch (COMPLETED)
- [x] Rate limits configured (1000/15min IP, 2000/15min Origin, 3000/15min Auth)
- [x] Trust proxy enabled (X-Forwarded-For)
- [x] Auth limiter implemented (token abuse protection)
- [x] Critical endpoints validated (/stats, /scholarships, /healthz)
- [x] Data persistence confirmed (133 landing pages)
- [x] Performance validated (P50=26ms, capacity 433 RPS)
- [x] CEO approval received (Option A)

### Launch (IN PROGRESS)
- [ ] **Enable monitoring dashboards** (latency, errors, rate limits, resources)
- [ ] **Configure pager alerts** (P95, 5xx, 429, abuse thresholds)
- [ ] **Activate daily executive summary** (email automation)
- [ ] **Open 50-student beta cohort** (Phase 1 access)
- [ ] **Notify on-call engineer** (change freeze D0-D1)

### Post-Launch (T+60min)
- [ ] **First executive dashboard snapshot** (email to CEO)
- [ ] **Validate all alerts working** (test notifications)
- [ ] **Confirm user onboarding flow** (first 5 students)
- [ ] **Monitor for initial issues** (first hour critical)

### 24-Hour Review (D1)
- [ ] **Evaluate Phase 1 gates** (all 6 criteria)
- [ ] **Review incident log** (any alerts, resolutions)
- [ ] **Analyze user feedback** (early beta cohort)
- [ ] **Go/No-Go decision for Phase 2** (CEO approval)

---

## 🎯 SUCCESS CRITERIA (Phase 1)

**Must Achieve (D0-D3)**:
- ✅ 99.9% availability
- ✅ <0.2% 5xx error rate
- ✅ P95 latency <120ms
- ✅ <1% 429 rate (legitimate traffic)
- ✅ Zero token abuse incidents
- ✅ >10× RPS headroom maintained

**Nice to Have**:
- 📈 >80% profile completion rate
- 📈 <5min time to first match
- 📈 >3 searches per user
- 📈 >15% save rate (scholarships saved/viewed)

---

**Last Updated**: October 9, 2025 @ 18:00 UTC  
**Next Review**: 24-hour post-launch (October 10, 2025 @ 18:00 UTC)  
**On-Call Engineer**: TBD  
**Escalation Path**: VP Eng → CEO
