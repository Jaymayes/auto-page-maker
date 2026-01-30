# Alert Validation Requirements (Task 14)
**CEO Directive: Validate alert delivery within 2 minutes for P95, 5xx, 429, memory alerts**

## Current Status
**⚠️ PARTIAL IMPLEMENTATION** - Metrics collection is complete, but alert delivery system is not configured.

### ✅ What's Working
1. **Monitoring Infrastructure** - All metrics are being collected:
   - Endpoint-level P50/P95/P99 latency
   - 5xx error rates
   - 429 rate limit triggers
   - Memory usage percentage
   - CPU saturation

2. **API Endpoints** - Accessible for monitoring dashboards:
   - `GET /api/monitoring/dashboard` - Real-time metrics
   - `GET /api/reports/baseline-snapshot` - Performance snapshot

### ❌ What's Missing
1. **Alerting System** - No PagerDuty/Opsgenie/Slack integration configured
2. **Email Notifications** - No SMTP server configured
3. **SMS Alerts** - No Twilio/SNS integration
4. **Alert Rules** - Thresholds defined but not actively monitored

---

## Required Setup for Alert Delivery Validation

### 1. Choose Alerting Platform
**Options:**
- **PagerDuty** (recommended for 24/7 on-call)
- **Opsgenie** (Atlassian, good for enterprise)
- **Slack + Webhooks** (lightweight, good for beta)
- **Custom Email/SMS** (requires SMTP + Twilio)

### 2. Install Monitoring Agent
**For PagerDuty:**
```bash
npm install node-pagerduty
```

**For Slack:**
```bash
npm install @slack/webhook
```

### 3. Configure Alert Thresholds
Edit `server/monitoring/alert-rules.ts`:
```typescript
export const ALERT_THRESHOLDS = {
  p95Latency: {
    warning: 120, // ms
    critical: 150, // ms
    sustainedMinutes: 5
  },
  error5xxRate: {
    warning: 0.5, // %
    critical: 1.0, // %
    sustainedMinutes: 2
  },
  error429Rate: {
    warning: 1.0, // %
    critical: 2.0, // %
    sustainedMinutes: 5
  },
  memoryUsage: {
    warning: 85, // %
    critical: 90, // %
    sustainedMinutes: 3
  }
};
```

### 4. Implement Alert Loop
Create `server/monitoring/alert-service.ts`:
```typescript
import { getAllEndpointMetrics } from '../middleware/endpoint-metrics.js';
import { sendPagerDutyAlert } from './pagerduty.js'; // or slack, email, etc.

export function startAlertMonitoring() {
  setInterval(async () => {
    const metrics = getAllEndpointMetrics();
    
    // Check P95 latency
    const p95Values = Object.values(metrics).map(m => m.p95);
    const maxP95 = Math.max(...p95Values);
    
    if (maxP95 > ALERT_THRESHOLDS.p95Latency.critical) {
      await sendPagerDutyAlert({
        severity: 'critical',
        summary: `P95 latency exceeded: ${maxP95}ms`,
        source: 'scholarmatch-monitoring',
        custom_details: { metrics }
      });
    }
    
    // Similar checks for 5xx, 429, memory...
    
  }, 60 * 1000); // Check every minute
}
```

### 5. Validate Alert Delivery
**Load Test Script** (`scripts/alert-validation-test.js`):
```javascript
// Trigger P95 latency alert
const triggerP95Alert = async () => {
  console.log('🔥 Triggering P95 latency alert...');
  
  // Send slow requests to saturate P95
  for (let i = 0; i < 100; i++) {
    fetch('https://your-app.replit.app/api/scholarships?delay=200ms');
  }
  
  console.log('⏱️ Waiting 2 minutes for alert delivery...');
  await sleep(120000);
  
  console.log('✅ Check PagerDuty/Slack for alert notification');
};

// Trigger 5xx error alert
const trigger5xxAlert = async () => {
  console.log('🔥 Triggering 5xx error alert...');
  
  // Send requests that cause errors
  for (let i = 0; i < 50; i++) {
    fetch('https://your-app.replit.app/api/trigger-error');
  }
  
  await sleep(120000);
  console.log('✅ Check PagerDuty/Slack for alert notification');
};

// Run validation
(async () => {
  await triggerP95Alert();
  await trigger5xxAlert();
  // ... trigger 429 and memory alerts
})();
```

---

## Acceptance Criteria (CEO Directive)

**For Phase 1 Beta Launch:**
- [ ] Alert rule configured for P95 >150ms sustained 5min
- [ ] Alert rule configured for 5xx rate >1% sustained 2min
- [ ] Alert rule configured for 429 rate >2% sustained 5min
- [ ] Alert rule configured for memory >90% sustained 3min
- [ ] Alert delivery <2 minutes for all P1 alerts
- [ ] On-call rotation configured in PagerDuty
- [ ] Escalation policy: P1 → 5min → escalate to senior engineer
- [ ] Incident response playbook documented

**Validation Test Results:**
- [ ] P95 alert delivered in <2min
- [ ] 5xx alert delivered in <2min
- [ ] 429 alert delivered in <2min
- [ ] Memory alert delivered in <2min
- [ ] All alerts include actionable context
- [ ] Runbooks linked in alert payload

---

## Current Workaround (Manual Monitoring)

Until alerting is configured:

1. **Manual Dashboard Checks** - Visit `/api/monitoring/dashboard` every 15 minutes
2. **Log Monitoring** - Check workflow logs for ERROR/WARN messages
3. **Browser Console** - Monitor RUM errors in browser console
4. **Periodic Reports** - Run baseline snapshot every 3 hours

**Manual Alert Checklist:**
- [ ] P95 latency trending up? → Investigate immediately
- [ ] 5xx errors appearing? → Check error logs
- [ ] 429s spiking? → Review top talkers in abuse monitoring
- [ ] Memory climbing? → Check for memory leaks

---

## Next Steps for Production

**Week 1 (After Beta Launch):**
1. Set up PagerDuty account + integration key
2. Configure alert rules in monitoring system
3. Test alert delivery with synthetic load
4. Document incident response procedures

**Week 2:**
1. Add Slack integration for non-critical alerts
2. Set up email summaries (daily digest)
3. Create Grafana dashboards for visualization
4. Enable auto-remediation for common issues

---

## Cost Estimate

**Alerting Infrastructure:**
- PagerDuty Starter: $19/user/month (2 users = $38/mo)
- Twilio SMS: $0.0079/SMS (backup alerts)
- SendGrid Email: Free tier (12k emails/month)

**Total Alerting Cost:** ~$50/month

---

**Status:** ⚠️ Monitoring is operational, alerts pending PagerDuty setup  
**Blocker:** No alerting platform configured  
**Workaround:** Manual dashboard monitoring every 15 minutes  
**ETA:** 2 hours to configure once platform selected
