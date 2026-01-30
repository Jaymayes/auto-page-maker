# Wednesday Execution Checklist - Phase 3 Week 1 Performance Gate
**Date:** October 1, 2025  
**Status:** ✅ GREENLIT by CTO/VP Engineering  
**Build ID:** v1.0.0  
**Commit:** db61ca1eda16f6c0798d87bdfb34c1e560ba7235

---

## 9:30am ET: WebPageTest Measurement

### Test Configuration (LOCKED - Match Prior Baseline)
- [ ] **Device:** Moto G4
- [ ] **Location:** [Verify exact location from baseline test]
- [ ] **Throttling:** Slow 4G (400 Kbps up, 1.6 Mbps down, 150ms RTT)
- [ ] **Runs:** 9-10 runs for stable P75
- [ ] **URL:** Production homepage
- [ ] **Build Metadata:** Record commit hash, bundle size before test

### Execute Test (Measurement Hygiene)
1. Navigate to https://www.webpagetest.org/
2. Enter production URL
3. **LOCK CONFIG:** Select same test location as baseline (verify exact match)
4. Advanced Settings:
   - Connection: Slow 4G
   - Mobile Device: Moto G4
   - Number of Tests: 10
   - Repeat View: First View Only
5. Click "Start Test"
6. Wait for completion (~15-20 minutes)
7. **Record:** Test ID, timestamp, build commit hash

### 9:45am ET: Extract P75 Metrics & Post Verdict

**From WebPageTest Results:**
- [ ] Calculate P75 FCP from 10 runs
- [ ] Calculate P75 LCP from 10 runs
- [ ] Calculate P75 CLS (context: target ≤0.1)
- [ ] Calculate P75 TTFB (context: trend analysis)
- [ ] Copy test result URL
- [ ] **Bundle Size Diff:** Record current vs baseline (Target: ≤75 KB gz)

**One-Line Verdict Template (REQUIRED FORMAT):**
```
Phase 3 Week 1 WPT Results: FCP P75 [X]ms ([PASS/FAIL] ≤2400ms) | LCP P75 [Y]ms ([PASS/FAIL] ≤2800ms) | TTFB P75: [Z]ms | CLS P75: [W] | Build: db61ca1 | Bundle: [KB]gz | Link: [URL]
```

**Post immediately in #release-channel at 9:45am ET**

---

## 10:00am ET: Go/No-Go Decision

### Decision Logic (Pre-Approved)

```
IF FCP_P75 ≤ 2400ms AND LCP_P75 ≤ 2800ms:
  ✅ GO: Proceed to canary deployment (PASS PATH)
  → Freeze all other deploys for the day to isolate performance change
  → Execute canary ramp: 10% (30min) → 25% (60min) → 50% (hold overnight)
  → No move to 100% until Thursday RUM confirms green
  
IF FCP_P75 > 2400ms OR LCP_P75 > 2800ms:
  ❌ NO-GO: Escalate to Thursday optimization sprint (FAIL PATH)
  → Thursday sprint PRE-APPROVED as scoped
  → Execute documented optimization plan
  → Ship Friday 10am ONLY IF gates pass AND bundle ≤75 KB gz
```

---

## PASS PATH: Canary Deployment (2:00pm-EOD)

### 10:15am ET: Stakeholder Communication

**Post in #stakeholder-channel:**
```
✅ Phase 3 Week 1 performance gates PASSED.
FCP P75: [X]ms (≤2400ms) ✓ | LCP P75: [Y]ms (≤2800ms) ✓ | TTFB P75: [Z]ms | CLS P75: [W]

Proceeding with canary deployment 2-4pm ET (10%→25%→50%). Holding 50% overnight. Move to 100% Thursday only if RUM confirms green.

⚠️ DEPLOY FREEZE: All other deploys blocked today to isolate performance signal.

WPT: [link] | Build: db61ca1 | Bundle: [KB]gz
```

**Notify Marketing:**
- [ ] Ping @marketing-team: "Phase 3 performance improvements deploying 2-4pm. Low-risk release notes approved."

### 12:00pm ET: Canary Plan Confirmation (REQUIRED DELIVERABLES)

**1. Monitoring Dashboard:**
- [ ] **Share RUM Dashboard URL** with pre-configured guardrails
- [ ] **Alerts configured** to #perf-warroom channel
- [ ] **Compare panel active:** Canary vs Control, normalized for device class + geo

**2. RUM Watch Metrics (Dashboard Must Include):**
- [ ] LCP P75 (gate: ≤2.8s, pause trigger: >+10%, rollback trigger: >+15%)
- [ ] INP P75 (target: ≤200ms)
- [ ] CLS P75 (target: ≤0.1)
- [ ] TTFB P75 (trend monitoring)
- [ ] JS errors per 1K pageviews
- [ ] Conversion to application start (no regression)

**3. Guardrail Thresholds (PRE-CONFIGURED IN DASHBOARD):**
- **PAUSE:** Degradation >+10% sustained for 5 minutes AND ≥1,500 pageviews
- **ROLLBACK:** Degradation >+15% OR error rate >0.3% sustained 5 minutes AND ≥1,500 pageviews
- **AUTOMATED ALERTS:** Must trigger to #perf-warroom with clear action required

**4. Rollback Owner (ASSIGN SINGLE DECISION AUTHORITY):**
- [ ] **Name:** [Engineering On-Call]
- [ ] **Contact:** [Phone/Slack]
- [ ] **Authority:** Explicit power to pause/rollback WITHOUT further sign-off
- [ ] **Escalation Path:** If rollback executed, notify CTO/VP immediately

**5. Cache/CDN Prep:**
- [ ] Pre-warm critical pages (homepage, top 10 scholarship categories)
- [ ] Verify CDN config parity between control and canary
- [ ] Check error budgets not already in burn-down

**6. Monitoring Parity:**
- [ ] Add synthetic uptime checks (SLO: 99.9% uptime)
- [ ] Add synthetic latency checks (SLO: ~120ms P95 backend latency)
- [ ] Separate backend/regression noise from frontend wins

**7. Canary Ramp Schedule (REFINED):**
```
2:00pm ET: Deploy 10% traffic → Monitor 30 minutes
2:30pm ET: Increase to 25% → Monitor 60 minutes  
3:30pm ET: Increase to 50% → Monitor through EOD
HOLD 50% OVERNIGHT
Thursday: Review RUM → If green, CTO/VP approves move to 100%
```

**Post by 12:00pm ET in #release-channel:**
```
Canary plan confirmed:
• Dashboard: [URL] (guardrails pre-configured, alerts to #perf-warroom)
• Rollback owner: @[name] (authority to pause/rollback immediately)
• Ramp: 10% (30min) → 25% (60min) → 50% (hold overnight)
• Guardrails: Pause >+10% / Rollback >+15% (5min sustained, ≥1.5K views)
• Move to 100%: Thursday only if RUM confirms green (CTO/VP final approval)
```

### 2:00pm ET: Execute Canary Ramp

**CODE FREEZE ACTIVE:** No other deployments today to isolate performance signal

#### 2:00pm: 10% Slice (30 Minute Hold)

- [ ] Deploy canary to 10% traffic
- [ ] **Monitor Dashboard:** LCP P75, INP P75, CLS P75, TTFB P75, error rate
- [ ] **Compare Panel:** Canary vs Control (device/geo normalized)
- [ ] **Minimum Sample:** Wait for ≥1,500 pageviews before evaluation
- [ ] **Wait:** 30 minutes for data stability

**2:30pm Checkpoint:**
- [ ] LCP P75: Within baseline +10%? ✓/✗
- [ ] INP P75: ≤200ms? ✓/✗
- [ ] Error rate: Stable (no >0.3% increase)? ✓/✗
- [ ] Conversion to app start: No regression? ✓/✗
- [ ] **Decision:** PROCEED to 25% OR PAUSE for investigation

#### 2:30pm: 25% Slice (60 Minute Hold)

- [ ] Increase to 25% traffic (if 10% checkpoint passed)
- [ ] **Monitor Dashboard:** Continuous watch on all RUM metrics
- [ ] **Sample Size:** Ensure ≥1,500 pageviews at 25% before next step
- [ ] **Wait:** 60 minutes for larger sample stability

**3:30pm Checkpoint:**
- [ ] LCP P75: Within baseline +10%? ✓/✗
- [ ] INP P75: ≤200ms? ✓/✗
- [ ] CLS P75: ≤0.1? ✓/✗
- [ ] TTFB P75: No regression? ✓/✗
- [ ] Error rate: Stable? ✓/✗
- [ ] Conversion: No regression? ✓/✗
- [ ] **Decision:** PROCEED to 50% OR PAUSE/ROLLBACK

#### 3:30pm: 50% Slice (Hold Through EOD + Overnight)

- [ ] Increase to 50% traffic (if 25% checkpoint passed)
- [ ] **Monitor Dashboard:** Active monitoring through 4:00pm
- [ ] **Compare Panel:** Review canary vs control deltas
- [ ] **Document:** Any anomalies, edge cases, regional variations

**4:00pm ET: EOD Status Report (REQUIRED)**

**Post in #release-channel:**
```
✅ Phase 3 Week 1 canary EOD status - Holding 50% overnight

METRICS (Canary vs Control, P75):
• LCP: [X]ms (control: [Y]ms, Δ: [+/-Z]ms, [%]%)
• INP: [X]ms (control: [Y]ms, target: ≤200ms)
• CLS: [X] (control: [Y], target: ≤0.1)
• TTFB: [X]ms (control: [Y]ms, Δ: [+/-Z]ms)
• Error rate: [X]% (control: [Y]%, threshold: <+0.3%)
• Conversion to app start: [X]% (control: [Y]%, no regression)

SAMPLE SIZE: [N] pageviews (≥1.5K minimum met)
DEVICE/GEO: Normalized across control and canary
ANOMALIES: [None OR describe]

OVERNIGHT HOLD: 50% traffic continues. RUM monitoring active. Dashboard: [URL]

THURSDAY REVIEW: 9am ET - CTO/VP reviews RUM data for final approval to 100%.
```

**Rollback owner remains on standby overnight with authority to rollback if sustained degradation occurs.**

---

## FAIL PATH: Thursday Optimization Sprint

### 10:15am ET: Stakeholder Communication

**Post in #stakeholder-channel:**
```
⚠️ Phase 3 Week 1 performance gates NOT MET.
FCP P75: [X]ms (gate: ≤2400ms) | LCP P75: [Y]ms (gate: ≤2800ms) | TTFB P75: [Z]ms | CLS P75: [W]

No deploy Wednesday. Escalating to Thursday optimization sprint (PRE-APPROVED).

TARGET: -23-33 KB gz bundle reduction + 150-300ms LCP recovery
SHIP: Friday 10am ONLY IF gates pass AND bundle ≤75 KB gz

Scope document: qa/THURSDAY_SPRINT_SCOPE_DETAILED.md
WPT: [link] | Build: db61ca1 | Bundle: [KB]gz
```

**Notify Optimization Squad:**
- [ ] Ping @optimization-squad: "Phase 3 gates failed. Thursday sprint PRE-APPROVED. Block calendar for full-day optimization. Scope: lazy-loading + Radix pruning + icon proxy + script defer."

### 11:00am ET: Confirm Thursday Sprint Scope

**Post in #release-channel (reference detailed scope doc):**
```
Thursday Optimization Sprint AUTHORIZED - Phase 3 Week 1 Recovery Plan

SCOPE (Code-only, no vite.config.ts changes):
1. Lazy-Loading: scholarship-category route + below-fold components (-10-15 KB gz)
2. Radix Pruning: Remove 15 unused packages (-8-10 KB gz)
3. Icon Proxy: Local re-export pattern client/src/icons/index.ts (-5-8 KB gz)
4. Script Defer: Analytics to requestIdleCallback (-0-2 KB gz)

COMBINED TARGET: -23-35 KB gz | LCP: -200-320ms

TIMELINE:
• 9am-12pm: Lazy-loading + Radix pruning (checkpoint: ≤80 KB gz)
• 12pm-2pm: Icon proxy + script defer (checkpoint: ≤75 KB gz)
• 2pm-3pm: QA testing (functional + visual + performance)
• 3pm-4pm: Re-run WebPageTest (10 runs, same config)
• 5pm: Results analysis + Friday ship decision

SHIP CRITERIA: Both gates pass AND bundle ≤75 KB gz
OTHERWISE: Hold and escalate to CTO/VP for next steps

Full scope: qa/THURSDAY_SPRINT_SCOPE_DETAILED.md
```

### Thursday Execution (If Needed)

**See detailed implementation plan in:** `qa/THURSDAY_SPRINT_SCOPE_DETAILED.md`

**Key Checkpoints:**
- [ ] 12:00pm: Bundle size ≤80 KB gz (midpoint target)
- [ ] 2:00pm: Bundle size ≤75 KB gz (final target)
- [ ] 3:00pm: WebPageTest initiated
- [ ] 5:00pm: Results vs gates + ship decision

**Friday Ship (ONLY IF):**
- [ ] FCP P75 ≤2.4s
- [ ] LCP P75 ≤2.8s
- [ ] Bundle ≤75 KB gz
- [ ] No functional regressions
- [ ] No visual regressions

**If gates still fail:** Escalate to CTO/VP for decision (additional optimization or defer to next sprint)

---

## Business KPIs & Alignment

### Primary Business KPI: Protect & Lift Organic Acquisition

**Track Week-Over-Week in Google Search Console (Auto Page Maker Pages):**
- [ ] Impressions (trend: up)
- [ ] CTR (trend: stable or up)
- [ ] CWV Passing Rates (FCP, LCP, CLS - trend: up)

**Rationale:** Performance protects CAC via SEO. This is highest-ROI lever for organic growth engine.

### Product KPI: Bundle Budget & Conversion

- [ ] **Bundle Size:** ≤75 KB gz (enforced in CI post-optimization)
- [ ] **Application Start Conversion:** No regression during canary
- [ ] **User Experience:** Perceived speed improvement (qualitative feedback)

### Financial KPI: Infrastructure Costs

- [ ] **Infra Costs:** Flat or down during canary (no CPU/memory regressions)
- [ ] **Cost vs SEO Gains:** Performance wins must not be offset by infra increases

**Alert:** Flag any CPU/memory regressions that offset SEO/CAC gains during canary monitoring.

---

## Ownership & Authority

### Execution Owner
- **Performance Engineering Team** owns checklist execution
- **Primary Contact:** [Name/Slack]
- **Backup:** [Name/Slack]

### Rollback Authority
- **Canary Rollback Owner:** [Engineering On-Call] (assigned by 12:00pm ET)
- **Authority:** Immediate pause/rollback WITHOUT further sign-off
- **Trigger Criteria:** >+10% pause, >+15% or error >0.3% rollback (5min sustained, ≥1.5K views)
- **Escalation:** If rollback executed, notify CTO/VP immediately with RUM data

### Final Approval Authority
- **100% Rollout:** CTO/VP Engineering (Thursday review of overnight RUM data)
- **Unreachable:** Rollback owner has authority to pause/rollback immediately for safety

---

## Communications Cadence (REQUIRED)

**9:45am ET:**
- [ ] Post one-line WPT verdict in #release-channel
- [ ] Include: FCP P75, LCP P75, TTFB P75, CLS P75, build info, bundle size, test URL

**12:00pm ET (if PASS):**
- [ ] Post canary plan confirmation in #release-channel
- [ ] Include: Dashboard URL, rollback owner, guardrails, ramp schedule

**4:00pm ET (if PASS):**
- [ ] Post EOD canary status in #release-channel
- [ ] Include: Delta vs control on LCP/INP/CLS, errors, conversion
- [ ] Recommendation for overnight hold and Thursday 100% decision

**11:00am ET (if FAIL):**
- [ ] Post Thursday sprint scope confirmation in #release-channel
- [ ] Reference detailed implementation plan document

---

## Risk Matrix & Rollback Triggers

### Canary Rollback Triggers (Pre-Configured in Dashboard)

| Metric | Threshold | Duration | Sample Size | Action |
|--------|-----------|----------|-------------|--------|
| LCP P75 | >+10% above baseline | 5 minutes | ≥1,500 views | **PAUSE** at current slice |
| LCP P75 | >+15% above baseline | 5 minutes | ≥1,500 views | **ROLLBACK** immediately |
| Error Rate | >0.3% absolute increase | 5 minutes | ≥1,500 views | **ROLLBACK** immediately |
| INP P75 | >200ms sustained | 10 minutes | ≥1,500 views | **INVESTIGATE** (informational) |
| Conversion | >-5% decrease | 10 minutes | ≥1,500 views | **PAUSE** for investigation |

**Alerts:** Must trigger to #perf-warroom with clear action required (pause/rollback/investigate)

### Thursday Sprint Abort Criteria

- Bundle reduction <15 KB gz achieved → Escalate to CTO/VP for decision
- QA finds breaking UI regressions → Revert changes, re-evaluate Friday
- WebPageTest results still fail gates → Escalate to CTO/VP for next steps
- Timeline slips past 5pm Thursday → Hold Friday ship, continue optimization

---

## Measurement Hygiene Checklist

**Before 9:30am WebPageTest:**
- [ ] Record current build ID: v1.0.0
- [ ] Record current commit hash: db61ca1eda16f6c0798d87bdfb34c1e560ba7235
- [ ] Record current bundle size: 87.98 KB gz (baseline)
- [ ] Lock WPT config to match baseline exactly (device, location, throttling)

**During 9:45am Verdict:**
- [ ] Include all metadata in verdict post (build, bundle, test URL)
- [ ] Archive test results for historical comparison
- [ ] Note any deviations from baseline config

**During Canary (if PASS):**
- [ ] Minimum sample size ≥1,500 pageviews before checkpoint decisions
- [ ] Device/geo normalization active in compare panel
- [ ] Record all anomalies for post-mortem

---

## Communication Templates

### 9:45am WPT Results (Use Exact Format)

**PASS Template:**
```
Phase 3 Week 1 WPT Results: FCP P75 [X]ms (PASS ≤2400ms) | LCP P75 [Y]ms (PASS ≤2800ms) | TTFB P75: [Z]ms | CLS P75: [W] | Build: db61ca1 | Bundle: [KB]gz | Link: [URL]
→ Gates PASSED. Proceeding to canary deployment per pre-approved plan. Deploy freeze active.
```

**FAIL Template:**
```
Phase 3 Week 1 WPT Results: FCP P75 [X]ms (FAIL ≤2400ms) | LCP P75 [Y]ms (FAIL ≤2800ms) | TTFB P75: [Z]ms | CLS P75: [W] | Build: db61ca1 | Bundle: [KB]gz | Link: [URL]
→ Gates FAILED. No deploy Wednesday. Escalating to Thursday optimization sprint (PRE-APPROVED).
```

### 4:00pm Canary Complete (If PASS - Use This Format)

```
✅ Phase 3 Week 1 canary EOD status - Holding 50% overnight

METRICS (Canary vs Control, P75):
• LCP: [X]ms (control: [Y]ms, Δ: [+/-Z]ms, [%]%)
• INP: [X]ms (control: [Y]ms, target: ≤200ms)
• CLS: [X] (control: [Y], target: ≤0.1)
• TTFB: [X]ms (control: [Y]ms, Δ: [+/-Z]ms)
• Error rate: [X]% (control: [Y]%, threshold: <+0.3%)
• Conversion to app start: [X]% (control: [Y]%, no regression)

SAMPLE SIZE: [N] pageviews (≥1.5K minimum met)
DEVICE/GEO: Normalized across control and canary
ANOMALIES: [None OR describe]

OVERNIGHT HOLD: 50% traffic continues. RUM monitoring active. Dashboard: [URL]

THURSDAY REVIEW: 9am ET - CTO/VP reviews RUM data for final approval to 100%.
```

---

**Status:** ✅ GREENLIT - READY FOR EXECUTION  
**Next Action:** Wednesday 9:30am ET - Run WebPageTest exactly per checklist  
**Authority:** CTO/VP Engineering (final 100% approval Thursday)  
**Rollback Authority:** On-call rollback owner (immediate pause/rollback power)

**Execute at 9:30am ET. Report verdict at 9:45am ET.**
