# Gate 0 Alert Configuration - auto_com_center
**Configuration Date**: November 13, 2025  
**DRI**: Agent3 (Senior Integration Engineer)  
**Scope**: Email delivery monitoring, DLQ thresholds, performance alerts  
**Target**: Production deployment readiness

---

## EXECUTIVE SUMMARY

**Purpose**: Proactive monitoring and alerting for critical auto_com_center functions  
**Alert Channels**: Slack (#eng-oncall), Email (ops.oncall@scholaraiadvisor.com)  
**On-Call Rotation**: 24/7 coverage required for P0 alerts  
**Escalation Path**: Engineer → Senior Engineer → Engineering Manager → CTO

---

## ALERT CATEGORIES

### Priority Levels
- **P0 (Critical)**: Immediate action required, page on-call engineer
- **P1 (High)**: Action required within 1 hour, Slack notification
- **P2 (Medium)**: Action required within 4 hours, Slack notification
- **P3 (Low)**: Action required within 24 hours, email only

---

## 1. EMAIL DELIVERY MONITORING

### 1.1 Bounce Rate Alert
**Priority**: P1 (High)  
**Metric**: `email_bounces / email_sent_total`  
**Threshold**:
- **Warning**: Bounce rate > 2% over 15-minute window
- **Critical**: Bounce rate > 5% over 15-minute window

**Alert Message**:
```
[P1] Email Bounce Rate Elevated
Current: {bounce_rate}%
Threshold: 2% (warning), 5% (critical)
Time Window: Last 15 minutes
Action Required: Investigate email provider status, check recipient list quality
Runbook: https://docs.scholaraiadvisor.com/runbooks/email-bounce-rate
```

**Remediation Steps**:
1. Check SendGrid/Postmark dashboard for provider issues
2. Review recent recipient list changes
3. Verify email content not triggering spam filters
4. Check DKIM/SPF/DMARC authentication status
5. Escalate to Email DRI if bounce rate continues >5% for >30 minutes

**Implementation**:
```javascript
// Pseudocode for monitoring
setInterval(async () => {
  const stats = await getEmailStats(15 * 60 * 1000); // 15 min
  const bounceRate = (stats.bounces / stats.sent) * 100;
  
  if (bounceRate > 5) {
    await sendAlert('P1', 'Email Bounce Rate Critical', {
      bounce_rate: bounceRate,
      sent: stats.sent,
      bounces: stats.bounces
    });
  } else if (bounceRate > 2) {
    await sendAlert('P2', 'Email Bounce Rate Warning', {
      bounce_rate: bounceRate,
      sent: stats.sent,
      bounces: stats.bounces
    });
  }
}, 5 * 60 * 1000); // Check every 5 minutes
```

---

### 1.2 Drop Rate Alert  
**Priority**: P0 (Critical)  
**Metric**: `email_drops / email_attempted`  
**Threshold**:
- **Warning**: Drop rate > 1% over 10-minute window
- **Critical**: Drop rate > 3% over 10-minute window

**Alert Message**:
```
[P0] Email Drop Rate Critical - Service Degradation
Current: {drop_rate}%
Threshold: 1% (warning), 3% (critical)
Time Window: Last 10 minutes
Action Required: IMMEDIATE - Check email provider API health
Runbook: https://docs.scholaraiadvisor.com/runbooks/email-drop-rate
```

**Root Causes to Check**:
1. SendGrid/Postmark API outage
2. API key revoked or expired
3. Account suspended (billing, abuse)
4. Rate limit exceeded
5. Invalid recipient email addresses (malformed)

**Auto-remediation**:
```javascript
// Automatic fallback to secondary provider
if (dropRate > 3 && primaryProvider === 'sendgrid') {
  await switchToProvider('postmark');
  await sendAlert('P0', 'Switched to backup email provider', {
    reason: 'High drop rate',
    drop_rate: dropRate,
    primary_provider: 'sendgrid',
    fallback_provider: 'postmark'
  });
}
```

---

### 1.3 Delivery Failure Alert
**Priority**: P1 (High)  
**Metric**: `email_delivery_failures / email_sent`  
**Threshold**:
- **Warning**: Failure rate > 0.5% over 30-minute window
- **Critical**: Failure rate > 2% over 30-minute window

**Alert Message**:
```
[P1] Email Delivery Failures Elevated
Current: {failure_rate}%
Failed Emails: {failed_count}
Threshold: 0.5% (warning), 2% (critical)
Action Required: Investigate delivery logs, check DNS configuration
```

---

## 2. DEAD LETTER QUEUE (DLQ) MONITORING

### 2.1 DLQ Depth Alert
**Priority**: P1 (High)  
**Metric**: `dlq_message_count`  
**Threshold**:
- **Warning**: DLQ depth > 10 messages
- **Critical**: DLQ depth > 50 messages

**Alert Message**:
```
[P1] Dead Letter Queue Depth Elevated
Current Depth: {dlq_depth}
Threshold: 10 (warning), 50 (critical)
Action Required: Review and process failed messages, investigate root cause
Runbook: https://docs.scholaraiadvisor.com/runbooks/dlq-processing
```

**DLQ Processing SOP**:
1. Export failed messages to `/tmp/dlq-export-{timestamp}.json`
2. Analyze failure patterns (common errors, timestamps, message types)
3. Fix root cause (e.g., API endpoint bug, schema validation error)
4. Replay messages after fix deployed
5. Monitor for re-failures
6. Document incident in post-mortem

**Implementation**:
```javascript
// DLQ monitoring
const DLQ_WARNING_THRESHOLD = 10;
const DLQ_CRITICAL_THRESHOLD = 50;

async function monitorDLQ() {
  const dlqDepth = await getDLQDepth();
  
  if (dlqDepth > DLQ_CRITICAL_THRESHOLD) {
    await sendAlert('P1', 'DLQ Depth Critical', {
      dlq_depth: dlqDepth,
      oldest_message_age_hours: await getOldestMessageAge()
    });
  } else if (dlqDepth > DLQ_WARNING_THRESHOLD) {
    await sendAlert('P2', 'DLQ Depth Warning', {
      dlq_depth: dlqDepth
    });
  }
}
```

---

### 2.2 DLQ Message Age Alert
**Priority**: P2 (Medium)  
**Metric**: `oldest_dlq_message_age`  
**Threshold**:
- **Warning**: Message older than 6 hours in DLQ
- **Critical**: Message older than 24 hours in DLQ

**Alert Message**:
```
[P2] DLQ Messages Aging
Oldest Message Age: {age_hours} hours
Threshold: 6 hours (warning), 24 hours (critical)
Action Required: Process DLQ backlog before customer impact
```

---

## 3. PERFORMANCE ALERTS

### 3.1 P95 Latency Degradation
**Priority**: P1 (High)  
**Metric**: `p95_latency_ms`  
**Endpoints**: `/health`, `/api/*`, `/orchestrator/*`  
**Threshold**:
- **Warning**: P95 > 100ms sustained for 5 minutes
- **Critical**: P95 > 150ms sustained for 5 minutes

**Alert Message**:
```
[P1] P95 Latency Degraded
Endpoint: {endpoint}
Current P95: {p95_ms}ms
Threshold: 100ms (warning), 150ms (critical)
Action Required: Investigate slow queries, check database connection pool
Runbook: https://docs.scholaraiadvisor.com/runbooks/latency-degradation
```

**Root Causes to Check**:
1. Database query slow down (check `pg_stat_statements`)
2. Database connection pool exhaustion
3. External API latency (SendGrid, Postmark, OpenAI)
4. Memory pressure / garbage collection pauses
5. CPU saturation

---

### 3.2 Error Rate Spike
**Priority**: P0 (Critical)  
**Metric**: `http_5xx_errors / total_requests`  
**Threshold**:
- **Warning**: Error rate > 0.1% over 5-minute window
- **Critical**: Error rate > 1% over 5-minute window

**Alert Message**:
```
[P0] Error Rate Spike Detected
Current Error Rate: {error_rate}%
5XX Errors: {error_count}
Threshold: 0.1% (warning), 1% (critical)
Action Required: IMMEDIATE - Check logs for stack traces, rollback if needed
```

**Auto-remediation**:
```javascript
// Automatic circuit breaker
if (errorRate > 1 && duration > 5 * 60 * 1000) {
  await enableMaintenanceMode();
  await sendAlert('P0', 'Circuit breaker triggered', {
    error_rate: errorRate,
    action: 'Maintenance mode enabled'
  });
}
```

---

### 3.3 Throughput Drop
**Priority**: P1 (High)  
**Metric**: `requests_per_second`  
**Threshold**:
- **Warning**: RPS drops below 50% of baseline for >5 minutes
- **Critical**: RPS drops below 25% of baseline for >5 minutes

**Alert Message**:
```
[P1] Throughput Drop Detected
Current RPS: {current_rps}
Baseline RPS: {baseline_rps}
Drop: {percent_drop}%
Action Required: Check for upstream issues, verify load balancer health
```

---

## 4. DEPENDENCY HEALTH ALERTS

### 4.1 Database Connectivity
**Priority**: P0 (Critical)  
**Metric**: `database_connection_success_rate`  
**Threshold**:
- **Warning**: Connection success rate < 99% over 2 minutes
- **Critical**: Connection success rate < 95% over 2 minutes

**Alert Message**:
```
[P0] Database Connection Failures
Success Rate: {success_rate}%
Failed Connections: {failed_count}
Action Required: IMMEDIATE - Check Neon status, verify connection pool
```

---

### 4.2 Email Provider API Health
**Priority**: P1 (High)  
**Metric**: `email_provider_api_success_rate`  
**Threshold**:
- **Warning**: API success rate < 99% over 5 minutes
- **Critical**: API success rate < 95% over 5 minutes

**Alert Message**:
```
[P1] Email Provider API Degraded
Provider: {provider} (SendGrid/Postmark)
Success Rate: {success_rate}%
Action Required: Check provider status page, consider fallback
```

---

## 5. ORCHESTRATOR HEALTH ALERTS

### 5.1 Agent Heartbeat Failures
**Priority**: P2 (Medium)  
**Metric**: `missed_heartbeats / expected_heartbeats`  
**Threshold**:
- **Warning**: >10% of agents missing heartbeats
- **Critical**: >25% of agents missing heartbeats

**Alert Message**:
```
[P2] Agent Heartbeat Failures
Agents Missing Heartbeats: {failed_agents}
Total Agents: {total_agents}
Failure Rate: {failure_rate}%
Action Required: Check agent health, investigate network issues
```

---

### 5.2 Agent Registration Failures
**Priority**: P1 (High)  
**Metric**: `agent_registration_failures`  
**Threshold**:
- **Warning**: >3 registration failures in 10 minutes
- **Critical**: >10 registration failures in 10 minutes

**Alert Message**:
```
[P1] Agent Registration Failures
Failed Registrations: {failure_count}
Time Window: Last 10 minutes
Action Required: Check SHARED_SECRET configuration, verify network connectivity
```

---

## IMPLEMENTATION CHECKLIST

### Required Environment Variables
```bash
# Alert Configuration
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
ALERT_EMAIL=ops.oncall@scholaraiadvisor.com
ALERT_PHONE=+15551234567  # For P0 pages

# Thresholds (override defaults)
ALERT_BOUNCE_RATE_WARNING=2
ALERT_BOUNCE_RATE_CRITICAL=5
ALERT_DROP_RATE_WARNING=1
ALERT_DROP_RATE_CRITICAL=3
ALERT_P95_LATENCY_WARNING=100
ALERT_P95_LATENCY_CRITICAL=150
ALERT_DLQ_DEPTH_WARNING=10
ALERT_DLQ_DEPTH_CRITICAL=50
```

### Slack Integration
1. Create #eng-oncall channel
2. Add incoming webhook integration
3. Test alert delivery
4. Configure on-call rotation in PagerDuty/OpsGenie

### Email Integration
1. Configure SendGrid for alerting emails (separate from transactional)
2. Add ops.oncall@scholaraiadvisor.com to distribution list
3. Set up email-to-SMS forwarding for P0 alerts

---

## TESTING & VALIDATION

### Manual Alert Testing
```bash
# Test Slack alert
curl -X POST $SLACK_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '{"text": "[TEST] Alert system verification"}'

# Trigger test alert
curl -X POST http://localhost:5000/api/admin/test-alert \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"alert_type": "email_bounce_rate", "severity": "warning"}'
```

### Alert Validation Checklist
- [ ] Slack webhook delivers messages to #eng-oncall
- [ ] Email alerts arrive at ops.oncall@scholaraiadvisor.com
- [ ] P0 alerts trigger SMS/phone notifications
- [ ] Alert runbooks accessible and accurate
- [ ] On-call rotation configured and tested
- [ ] Escalation path documented and communicated

---

## RUNBOOKS

### Email Bounce Rate Runbook
**URL**: https://docs.scholaraiadvisor.com/runbooks/email-bounce-rate

**Steps**:
1. Check SendGrid/Postmark dashboard for bounce details
2. Categorize bounces: hard bounce vs soft bounce
3. Hard bounces: Remove from recipient list immediately
4. Soft bounces: Retry with exponential backoff
5. Check authentication (DKIM, SPF, DMARC)
6. Review email content for spam trigger words
7. Escalate to Email DRI if bounce rate >5% for >30 minutes

### DLQ Processing Runbook
**URL**: https://docs.scholaraiadvisor.com/runbooks/dlq-processing

**Steps**:
1. Export DLQ messages: `npm run dlq:export`
2. Analyze failure patterns
3. Identify and fix root cause
4. Deploy fix to production
5. Replay failed messages: `npm run dlq:replay`
6. Monitor for re-failures
7. Document in post-mortem

---

## POST-INCIDENT PROCESS

### Required for All P0/P1 Alerts
1. **Incident Log**: Create ticket in JIRA with timeline
2. **Root Cause Analysis**: Document RCA within 48 hours
3. **Post-Mortem**: Share learnings in #eng-all channel
4. **Action Items**: Track remediation tasks to completion
5. **Alert Tuning**: Adjust thresholds if false positive

---

## METRICS DASHBOARD

### Grafana Dashboard (Recommended)
- Email delivery metrics (sent, bounced, dropped, delivered)
- DLQ depth and message age
- P95/P99 latency by endpoint
- Error rate by HTTP status code
- Agent heartbeat status
- Database connection pool usage

### Key Metrics to Track
1. Email bounce rate (%)
2. Email drop rate (%)
3. DLQ depth (count)
4. P95 latency (ms)
5. Error rate (%)
6. RPS (requests/second)
7. Database connection success rate (%)

---

## GO/NO-GO CRITERIA

### Gate 0 Alert Requirements
- ✅ Slack integration configured and tested
- ✅ Email alerts configured and tested
- ✅ All thresholds documented and approved by SRE team
- ✅ Runbooks created and accessible
- ✅ On-call rotation established (if P0 alerts required)

---

**Configuration Owner**: Agent3, auto_com_center DRI  
**Review Cadence**: Monthly (adjust thresholds based on production data)  
**Last Updated**: 2025-11-13T19:45:00Z  
**Status**: READY FOR GATE 0 DEPLOYMENT
