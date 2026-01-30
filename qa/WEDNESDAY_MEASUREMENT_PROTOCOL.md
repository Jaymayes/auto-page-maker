# Wednesday 9:30am ET - Performance Measurement Protocol

**Date:** October 1, 2025 (Wednesday)  
**Responsible:** QA Team / Performance Engineer  
**Deliverable Time:** 9:30am ET sharp

---

## Objective

Measure Phase 3 Week 1 canary performance against interim gates:
- **FCP P75 ≤ 2.4s** (Slow 4G mobile)
- **LCP P75 ≤ 2.8s** (Slow 4G mobile)
- **CLS ≤ 0.1** (already passing)
- **JS Bundle ≤ 75KB gz** (currently 90.11KB - needs optimization if gates missed)

---

## Test Environment

**Application URL:** https://71bf4fef-9927-4910-996e-af6c8442857d-00-1vbw0f99a1xbj.spock.replit.dev/

**Test Pages:**
1. Homepage (/)
2. Computer Science - Texas (/scholarships/computer-science-texas)
3. Nursing - California (/scholarships/nursing-california)

**Device/Network Configuration:**
- Device: Moto G4 (mid-tier ~$200 phone)
- Network: Slow 4G (150ms RTT, 400Kbps down, 400Kbps up)
- CPU: 4x slowdown

---

## Testing Method

### **Primary: WebPageTest (Preferred)**

**URL:** https://www.webpagetest.org/

**Configuration:**
```
Test Location: Dulles, VA (or closest to target users)
Browser: Chrome (Mobile)
Connection: Mobile 3G Slow (custom: 150ms RTT, 400Kbps down)
Number of Runs: 5
Repeat View: First View Only

Advanced Settings:
- Capture Video: Yes
- Keep Test Private: No (unless sensitive)
```

**Steps:**
1. Go to https://www.webpagetest.org/
2. Enter URL: https://71bf4fef-9927-4910-996e-af6c8442857d-00-1vbw0f99a1xbj.spock.replit.dev/
3. Select "Dulles, VA - Moto G4 - Chrome"
4. Connection: "Mobile 3G Slow" or custom 150ms/400Kbps
5. Number of Tests to Run: 5
6. Click "Start Test"
7. Wait ~5-10 minutes for results

**Extract Metrics from Results:**
- Navigate to "Median Run" tab
- Record:
  - First Contentful Paint (FCP)
  - Largest Contentful Paint (LCP)
  - Cumulative Layout Shift (CLS)
  - Total Blocking Time (TBT)
  - Time to First Byte (TTFB)

**Calculate P75 (75th Percentile):**
- Sort 5 FCP values ascending
- P75 = 4th value (e.g., [1800, 2100, 2300, **2400**, 2600] → P75 = 2400ms)
- Repeat for LCP

---

### **Fallback: Chrome DevTools Throttling**

If WebPageTest unavailable or too slow:

1. **Open Chrome DevTools:**
   - Press F12 or Cmd+Option+I
   - Navigate to "Network" tab

2. **Configure Throttling:**
   - Click "Online" dropdown → "Add custom profile"
   - Name: "Slow 4G Mobile"
   - Download: 400 Kbps
   - Upload: 400 Kbps
   - Latency: 150 ms
   - Click "Add"
   - Select "Slow 4G Mobile"

3. **Configure CPU Throttling:**
   - Go to "Performance" tab
   - Click gear icon (⚙️) → "CPU: No throttling" → "4x slowdown"

4. **Collect Metrics (5 Runs):**
   - Hard refresh page (Cmd+Shift+R or Ctrl+Shift+R)
   - Click "Performance" tab → Record → Reload page
   - Stop recording after page fully loads
   - Expand "Timings" section
   - Record FCP (green marker) and LCP (blue marker with "LCP" label)
   - Repeat 5 times
   - Calculate median and P75

---

## Bundle Size Verification

**Check Production Build Size:**
```bash
cd /home/runner/workspace
npm run build

# Main JS bundle location
ls -lh dist/public/assets/index-*.js

# Expected: ~90KB uncompressed, ~90.11KB gzipped (currently)
# Target: ≤75KB gzipped
```

**Current Bundle Size (from previous build):**
- **Main JS:** 90.11KB gz
- **CSS:** ~5KB gz (includes critical CSS)
- **Total JS:** 90.11KB gz (15KB over target)

---

## Decision Tree (10:00am ET)

```
START → Run WebPageTest (5 runs, Slow 4G)
  ↓
Extract P50 and P75 for FCP/LCP
  ↓
┌──────────────────────────────────────┐
│ FCP P75 ≤ 2.4s AND LCP P75 ≤ 2.8s?  │
└──────────────────────────────────────┘
  ↓ YES                              ↓ NO
  │                                  │
  ├─→ GATES PASSED                  ├─→ EXECUTE BUNDLE OPTIMIZATION
  │   • Proceed to canary deploy     │   • Lucide tree-shaking (-12KB)
  │   • No bundle changes needed     │   • Radix pruning (-8KB)
  │   • Monitor RUM for 2 hours      │   • Rebuild and re-test
  │   • 10%→25%→50% rollout          │   • Re-run measurement
  │                                  │   • Validate gates by 12:45pm ET
  │                                  │
  ↓                                  ↓
CODE FREEZE 3pm ET               HARD STOP 3pm ET
```

---

## Reporting Template

**Wednesday 9:30am ET - Performance Metrics Report**

```markdown
## WebPageTest Results (5 runs, Moto G4, Slow 4G)

**Homepage (/):**
- FCP: [1800, 2100, 2300, 2400, 2600]ms → P50: 2300ms, P75: 2400ms
- LCP: [2200, 2500, 2700, 2900, 3100]ms → P50: 2700ms, P75: 2900ms
- CLS: 0.003 (GOOD ✅)
- TTFB: 620ms

**Category Page (CS-TX):**
- FCP: [1900, 2200, 2400, 2500, 2700]ms → P50: 2400ms, P75: 2500ms
- LCP: [2300, 2600, 2800, 3000, 3200]ms → P50: 2800ms, P75: 3000ms
- CLS: 0.002 (GOOD ✅)

**Bundle Size:**
- Main JS: 90.11KB gz (15KB over 75KB target)

**Gates Assessment:**
- FCP P75 ≤ 2.4s: ❌ FAIL (2400ms - right at threshold)
- LCP P75 ≤ 2.8s: ❌ FAIL (2900ms - 100ms over)
- JS ≤ 75KB gz: ❌ FAIL (90.11KB - 15KB over)

**Decision:** PROCEED WITH BUNDLE OPTIMIZATION (execute Lucide tree-shaking + Radix pruning)

**ETA:** Optimization complete by 12:45pm ET, re-measurement by 1:30pm ET, canary by 2pm ET
```

---

## Escalation Contacts

**Performance Issues:**
- Lead Engineer: (check team roster)
- QA Manager: (check team roster)

**Deployment Blockers:**
- DevOps Lead: (check team roster)

**Executive Approval (if gates missed after optimization):**
- CTO/VP Engineering
- Product Lead

---

## Success Criteria Checklist

- [ ] 5 WebPageTest runs completed
- [ ] P50 and P75 calculated for FCP/LCP
- [ ] Results logged to shared spreadsheet
- [ ] Decision documented (PASS gates or EXECUTE optimization)
- [ ] If FAIL: Bundle optimization initiated by 10:15am ET
- [ ] If PASS: Canary deployment initiated by 2pm ET
- [ ] All stakeholders notified of decision

---

## Archive & Documentation

**Save Results:**
- WebPageTest URLs: (paste links)
- Screenshots: /qa/evidence/wed-oct1-webpagetest/
- Raw metrics CSV: /qa/metrics/phase3-week1-wednesday.csv
- Decision log: /qa/PHASE3_WEEK1_DECISION.md

**Update Progress Doc:**
- /qa/PHASE2_PROGRESS.md (add Wednesday results section)
- /qa/PHASE3_WEEK1_REPORT.md (final report for stakeholders)
