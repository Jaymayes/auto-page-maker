# auto_com_center Canary Execution Guide

**CEO Directive**: Execute NOW (Nov 14, 2025)  
**Budget Approved**: $1,500 for 72 hours k6 Cloud testing  
**Deadline**: Results needed for tonight's checkpoint  

---

## Prerequisites

### 1. Install k6 Cloud CLI
```bash
# Install k6 (if not already installed)
curl https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz -L | tar xvz --strip-components 1
sudo mv k6 /usr/local/bin/

# Verify installation
k6 version
```

### 2. Authenticate with k6 Cloud
```bash
# Login to k6 Cloud (requires k6 Cloud account)
k6 login cloud

# Or set token directly
export K6_CLOUD_TOKEN="your_k6_cloud_token_here"
```

### 3. Get M2M Auth Token
```bash
# Get service-to-service auth token from scholar_auth
# Required for authenticated requests to auto_com_center

AUTH_URL="https://scholar-auth-jamarrlmayes.replit.app"
CLIENT_ID="auto_com_center_client"
CLIENT_SECRET="<from_replit_secrets>"

SERVICE_TOKEN=$(curl -s -X POST "$AUTH_URL/oauth/token" \
  -d "grant_type=client_credentials" \
  -d "client_id=$CLIENT_ID" \
  -d "client_secret=$CLIENT_SECRET" | jq -r '.access_token')

export SERVICE_AUTH_TOKEN="$SERVICE_TOKEN"
echo "Auth token set: ${SERVICE_TOKEN:0:20}..."
```

---

## Canary Execution

### Option 1: k6 Cloud (RECOMMENDED - CEO Approved Budget)
```bash
# Set environment variables
export AUTO_COM_CENTER_URL="https://auto-com-center-jamarrlmayes.replit.app"
export SERVICE_AUTH_TOKEN="<token_from_above>"

# Run canary on k6 Cloud
k6 cloud load-tests/canary/auto_com_center_250rps_30min.js

# Expected output:
#   execution: cloud
#   script: load-tests/canary/auto_com_center_250rps_30min.js
#   output: https://app.k6.io/runs/12345
#
# Follow the URL to monitor live results
```

**Cost Estimate**: ~$15-25 for 30-minute test (well within $1,500 budget)

---

### Option 2: Local Execution (Fallback if k6 Cloud unavailable)
```bash
# Run locally (requires sufficient local resources)
export AUTO_COM_CENTER_URL="https://auto-com-center-jamarrlmayes.replit.app"
export SERVICE_AUTH_TOKEN="<token_from_above>"

k6 run load-tests/canary/auto_com_center_250rps_30min.js \
  --out json=load-tests/canary/results_$(date +%Y%m%d_%H%M).json

# This will generate local results file
```

**Warning**: Local execution may not achieve true 250 RPS due to resource constraints. k6 Cloud is strongly recommended.

---

## Real-Time Monitoring During Canary

### 1. Monitor k6 Cloud Dashboard
- **URL**: https://app.k6.io/runs/{run_id}
- **Watch**: P95 latency, error rate, VU count, request rate

### 2. Monitor auto_com_center Application Logs
```bash
# In auto_com_center workspace, watch logs
tail -f /tmp/logs/auto_com_center_*.log | grep -E '(ERROR|WARN|delivery_failure)'
```

### 3. Monitor Email Provider (SendGrid)
- **Dashboard**: https://app.sendgrid.com/statistics
- **Watch**: Delivery rate, bounces, drops, blocks

### 4. Check Application Health
```bash
# Poll health endpoint during test
watch -n 5 'curl -s https://auto-com-center-jamarrlmayes.replit.app/health | jq "."'
```

---

## Acceptance Criteria (Gate 1)

| Metric | Target | How to Verify |
|--------|--------|---------------|
| **P95 Latency** | ≤250ms | k6 Cloud dashboard: "http_req_duration" P95 |
| **Error Rate** | ≤0.5% | k6 Cloud dashboard: "errors" rate |
| **Delivery Success** | ≥99% | k6 Cloud dashboard: "delivery_success" rate |
| **HTTP Failures** | <0.5% | k6 Cloud dashboard: "http_req_failed" rate |
| **Duration** | 30 minutes | k6 Cloud dashboard: test duration |
| **Request Rate** | 250 RPS | k6 Cloud dashboard: "http_reqs" rate |

---

## Post-Canary Evidence Collection

### 1. Export k6 Cloud Results
```bash
# Download full JSON results from k6 Cloud
# (Available in k6 Cloud dashboard under "Export")

# Save to evidence folder
mkdir -p evidence/gate1_auto_com_center
cp ~/Downloads/k6_results_*.json evidence/gate1_auto_com_center/canary_250rps_30min_$(date +%Y%m%d_%H%M).json
```

### 2. Capture Screenshots
- [ ] k6 Cloud dashboard showing final results
- [ ] P95 latency graph (must show ≤250ms)
- [ ] Error rate graph (must show <0.5%)
- [ ] Delivery success rate (must show ≥99%)
- [ ] SendGrid delivery statistics

**Save to**: `evidence/gate1_auto_com_center/screenshots/`

### 3. Generate Summary Report
```bash
# Create summary from k6 results
cat evidence/gate1_auto_com_center/canary_*.json | jq '{
  test_duration_min: (.state.testRunDurationMs / 1000 / 60),
  total_requests: .metrics.http_reqs.values.count,
  requests_per_second: .metrics.http_reqs.values.rate,
  p95_latency_ms: .metrics.http_req_duration.values."p(95)",
  error_rate_pct: (.metrics.errors.values.rate * 100),
  delivery_success_pct: (.metrics.delivery_success.values.rate * 100),
  http_failures_pct: (.metrics.http_req_failed.values.rate * 100)
}' > evidence/gate1_auto_com_center/canary_summary.json

cat evidence/gate1_auto_com_center/canary_summary.json
```

### 4. Application Logs
```bash
# Extract error logs during canary window
# (Capture from auto_com_center workspace)

# Get canary start/end times from k6 results
START_TIME="2025-11-14T01:00:00"  # Replace with actual
END_TIME="2025-11-14T01:30:00"    # Replace with actual

# Filter logs (if using structured logging)
cat /tmp/logs/auto_com_center_*.log | \
  grep -E "($START_TIME|$END_TIME)" | \
  grep -E "(ERROR|delivery_failure|bounce|drop)" \
  > evidence/gate1_auto_com_center/error_logs_$(date +%Y%m%d_%H%M).log
```

---

## Failure Scenarios and Remediation

### Scenario 1: P95 > 250ms
**Likely Causes**:
- Database connection pool exhaustion
- Email provider rate limiting
- Insufficient compute resources

**Remediation**:
1. Scale to Reserved VM/Autoscale (CEO approved)
2. Increase database connection pool size
3. Implement queue backpressure
4. Re-run canary after scaling

### Scenario 2: Error Rate > 0.5%
**Likely Causes**:
- Auth token validation failures
- Email provider rejections
- Template rendering errors

**Remediation**:
1. Check error logs for specific failure patterns
2. Fix identified issues
3. Add retry logic with exponential backoff
4. Re-run canary

### Scenario 3: Delivery Success < 99%
**Likely Causes**:
- Invalid email addresses in test data
- SendGrid domain not verified
- Bounce/block by email providers

**Remediation**:
1. Verify SendGrid domain authentication
2. Use valid email addresses in test payload
3. Check SendGrid bounce/block lists
4. Configure suppression list handling

---

## CEO Checkpoint Deliverable

**Tonight's Slack Update Must Include**:
1. ✅ k6 Cloud run URL (public shareable link)
2. ✅ Canary summary JSON (P95, error rate, delivery success)
3. ✅ Screenshots of key metrics
4. ✅ Pass/Fail determination against acceptance criteria
5. ✅ Next steps (if failed) or green light for Gate 1

**Evidence Package Location**: `evidence/gate1_auto_com_center/`

---

## Follow-Up Test (Nov 17, 6:00 PM MST)

**Per CEO Directive**: "Follow-up SLO test at 120ms P95 by Nov 17"

After hardening (env-based URLs, delivery monitoring, secrets audit), re-run canary with stricter SLO:
- **P95 Target**: ≤120ms (reduced from 250ms)
- **Same load**: 250 RPS for 30 minutes
- **Same acceptance**: Error rate ≤0.5%, Delivery ≥99%

---

**Prepared By**: Agent3 (Program Integrator)  
**Timestamp**: 2025-11-14 00:05:00 MST  
**CEO Directive**: Execute canary NOW, deliver results tonight
