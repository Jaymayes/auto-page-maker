# Automated Paging Specification — auto_page_maker

**APPLICATION NAME:** auto_page_maker  
**APP_BASE_URL:** https://auto-page-maker-jamarrlmayes.replit.app  
**Owner:** auto_page_maker DRI  
**Due Date:** Nov 12, 18:00 UTC  
**Status:** Specification (Implementation Post-Freeze)

---

## CEO Order

> "Convert manual monitoring to automated paging for CWV p75 regression and indexation <92%"

**Current State:** Manual monitoring via daily 06:00 UTC KPI rollups  
**Required State:** Automated real-time alerting with paging

---

## Alert Thresholds

### 1. CWV p75 Regression
**Current:** GREEN  
**Alert Trigger:** Any regression from GREEN status  
**Severity:** P1 (Critical)  
**Action:** Immediate hold on page generation + CEO alert

### 2. Indexation <92%
**Current:** ≥95%  
**Alert Trigger:** Falls below 92%  
**Severity:** P1 (Critical)  
**Action:** Immediate hold on page generation + CEO alert

---

## Implementation Specification

### Phase 1: Monitoring Infrastructure (Post-Freeze)

**Required Components:**
1. **Real-time CWV Monitoring**
   - Integration with Google PageSpeed Insights API or web-vitals library
   - Automated checks every 6 hours
   - Track: LCP, FID, CLS (p75 thresholds)

2. **Indexation Monitoring**
   - IndexNow API success rate tracking
   - Google Search Console API integration (index status)
   - Automated checks every 6 hours

3. **Alert Manager**
   - Threshold detection logic
   - De-duplication (prevent alert spam)
   - Escalation rules (immediate → 15min → 30min)

### Phase 2: Paging Integration

**Options:**
1. **PagerDuty** (Recommended)
   - 24/7 on-call rotation support
   - SMS + phone call escalation
   - Incident tracking and postmortems

2. **Opsgenie** (Alternative)
   - Similar feature set to PagerDuty
   - Slack integration for team visibility

3. **Custom Webhook** (Fallback)
   - Slack webhook for immediate team notification
   - Email to auto_page_maker DRI + CEO
   - SMS via Twilio (optional)

### Phase 3: Automated Response

**On Alert Trigger:**
1. **Immediate Actions:**
   - Set `ENABLE_PAGE_GENERATION=false` environment variable
   - Log incident to audit trail with timestamp
   - Create incident ticket in tracking system

2. **Notifications:**
   - Page auto_page_maker DRI (SMS + phone)
   - Alert CEO via configured channel
   - Slack notification to #seo-alerts channel

3. **Status Dashboard:**
   - Update scholarship_sage SLO dashboard (RED status)
   - Display banner on internal monitoring page
   - Log to daily KPI rollup

### Phase 4: Recovery Workflow

**After Threshold Restored:**
1. **Validation:**
   - Confirm CWV GREEN for 2 consecutive checks (12h minimum)
   - Confirm indexation ≥95% for 2 consecutive checks (12h minimum)

2. **Manual Approval:**
   - auto_page_maker DRI reviews incident
   - Confirms root cause remediated
   - CEO approval for re-enabling page generation

3. **Re-enable:**
   - Set `ENABLE_PAGE_GENERATION=true`
   - Resume normal operations
   - Postmortem documentation

---

## Technical Architecture

### Monitoring Service (New Component)

```typescript
// server/services/seo-monitoring.ts
export class SEOMonitoringService {
  async checkCWV(): Promise<CWVStatus> {
    // Query web-vitals data or PageSpeed Insights API
    // Return: GREEN | YELLOW | RED
  }

  async checkIndexation(): Promise<number> {
    // Query IndexNow success rate + Google Search Console
    // Return: percentage (0-100)
  }

  async evaluateThresholds(): Promise<Alert[]> {
    const cwv = await this.checkCWV();
    const indexation = await this.checkIndexation();

    const alerts: Alert[] = [];

    if (cwv !== 'GREEN') {
      alerts.push({
        severity: 'P1',
        type: 'CWV_REGRESSION',
        message: 'CWV p75 regressed from GREEN',
        action: 'HOLD_PAGE_GENERATION'
      });
    }

    if (indexation < 92) {
      alerts.push({
        severity: 'P1',
        type: 'INDEXATION_LOW',
        message: `Indexation at ${indexation}% (threshold: 92%)`,
        action: 'HOLD_PAGE_GENERATION'
      });
    }

    return alerts;
  }

  async sendAlert(alert: Alert): Promise<void> {
    // Send to PagerDuty/Opsgenie/Webhook
    // Log to audit trail
    // Update SLO dashboard
  }
}
```

### Cron Job Configuration

```typescript
// server/index.ts
import cron from 'node-cron';

// Run every 6 hours
cron.schedule('0 */6 * * *', async () => {
  const seoMonitoring = new SEOMonitoringService();
  const alerts = await seoMonitoring.evaluateThresholds();

  for (const alert of alerts) {
    await seoMonitoring.sendAlert(alert);
    
    if (alert.action === 'HOLD_PAGE_GENERATION') {
      process.env.ENABLE_PAGE_GENERATION = 'false';
      console.error('[CRITICAL] Page generation halted:', alert.message);
    }
  }
});
```

---

## Environment Variables

```bash
# Monitoring Configuration
ENABLE_PAGE_GENERATION=true  # Set to false on alert
PAGERDUTY_API_KEY=<secret>   # For paging integration
SEO_ALERT_WEBHOOK=<url>       # Slack/custom webhook
CEO_ALERT_EMAIL=<email>       # CEO notification

# Thresholds
CWV_ALERT_THRESHOLD=GREEN     # Alert on any regression
INDEXATION_ALERT_THRESHOLD=92 # Alert if below 92%

# Check Intervals
SEO_CHECK_INTERVAL_HOURS=6    # How often to check
```

---

## Testing Plan

### Pre-Deployment (Nov 12-13)

1. **Unit Tests:**
   - Test threshold detection logic
   - Mock CWV/indexation data
   - Verify alert generation

2. **Integration Tests:**
   - Test PagerDuty integration (test mode)
   - Verify webhook delivery
   - Test hold mechanism (ENABLE_PAGE_GENERATION=false)

3. **Dry Run:**
   - Run monitoring service in read-only mode
   - Log would-be alerts (no actual paging)
   - Verify threshold accuracy over 24h period

### Post-Deployment (Nov 13-14)

1. **Canary Alert:**
   - Manually trigger test alert
   - Verify DRI receives page
   - Verify CEO notification
   - Test recovery workflow

2. **Monitoring:**
   - Track false positive rate
   - Adjust thresholds if needed
   - Document any issues

---

## Rollback Plan

**If Automated Paging Fails:**
1. Revert to manual daily KPI rollup monitoring
2. Disable automated paging integration
3. Investigate root cause
4. Fix issues in development
5. Re-deploy after validation

**Rollback Time:** <5 minutes (environment variable change)

---

## Implementation Timeline

**Nov 12, 20:00 UTC:** Freeze lifts  
**Nov 12-13:** Implementation + testing  
**Nov 13, 12:00 UTC:** Deploy to production  
**Nov 13-14:** Monitoring and validation  
**Nov 14, 18:00 UTC:** Evidence package due

---

## Evidence Deliverable (Nov 14, 18:00 UTC)

**Required Documentation:**
1. ✅ This specification document
2. Test results (unit + integration)
3. Dry-run logs (24h monitoring data)
4. PagerDuty/paging integration proof
5. Manual test alert screenshots
6. Rollback procedure validation

---

## Compliance

**CEO Order:** Convert manual monitoring to automated paging ✅  
**Threshold 1:** CWV p75 regression → auto-alert + hold ✅  
**Threshold 2:** Indexation <92% → auto-alert + hold ✅  
**Due Date:** Nov 12, 18:00 UTC (specification complete; implementation post-freeze) ✅

---

**Status:** Specification complete, ready for post-freeze implementation  
**Next Action:** Deploy Nov 12-13 after freeze lifts  
**Owner:** auto_page_maker DRI
