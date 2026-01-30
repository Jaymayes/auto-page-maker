# Documentation Update Plan

**Audit Date:** 2026-01-06
**Status:** HUMAN_APPROVAL_REQUIRED before merge

---

## Overview

This document outlines the documentation changes required based on the Phase 1 ecosystem audit findings. All changes are docs-first and require human approval before merging.

---

## Proposed Changes

### 1. ECOSYSTEM_README.md Updates

**File:** `docs/ECOSYSTEM_README.md` (create if not exists)

**Changes:**

```markdown
## Service Registry

| ID | Service | URL | Health Endpoint | Status |
|----|---------|-----|-----------------|--------|
| A1 | scholar-auth | scholar-auth-jamarrlmayes.replit.app | /health | Active |
| A2 | scholarship-api | scholarship-api-jamarrlmayes.replit.app | /health | Active |
| A3 | scholarship-agent | scholarship-agent-jamarrlmayes.replit.app | /health | Active |
| A4 | scholarship-sage | scholarship-sage-jamarrlmayes.replit.app | /health | Active |
| A5 | student-pilot | student-pilot-jamarrlmayes.replit.app | /health | Active |
| A6 | provider-register | provider-register-jamarrlmayes.replit.app | /health | Needs Attention |
| A7 | auto-page-maker | scholaraiadvisor.com | /health | Active |
| A8 | auto-com-center | auto-com-center-jamarrlmayes.replit.app | /health | Active |

## Required Secrets (Names Only)

| Service | Required Secrets |
|---------|------------------|
| A1 | DATABASE_URL, OIDC_CLIENT_SECRET |
| A2 | DATABASE_URL |
| A3 | DATABASE_URL, OPENAI_API_KEY |
| A4 | DATABASE_URL, OPENAI_API_KEY |
| A5 | DATABASE_URL |
| A6 | DATABASE_URL, STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY |
| A7 | DATABASE_URL, SENDGRID_API_KEY or POSTMARK_API_KEY |
| A8 | DATABASE_URL |

## SLO Targets

| Metric | Target | Current |
|--------|--------|---------|
| P95 Latency | ≤150ms | 67-247ms |
| Error Rate | <0.1% | 12.5% (A6 down) |
| Uptime | 99.9% | 87.5% |
```

---

### 2. Runbook: A6 Service Recovery

**File:** `docs/runbooks/a6-recovery.md`

**Content:**

```markdown
# A6 Provider Service Recovery Runbook

## Symptoms
- HTTP 500 on all A6 endpoints
- Provider registration blocked
- B2B revenue funnel stopped

## Diagnosis Steps

1. Access A6 Replit project console
2. Check workflow logs for startup errors
3. Verify environment variables:
   - DATABASE_URL (required)
   - STRIPE_SECRET_KEY (required)
   - STRIPE_PUBLISHABLE_KEY (required)
4. Test database connectivity:
   ```bash
   psql $DATABASE_URL -c "SELECT 1"
   ```
5. Check for schema drift:
   ```bash
   npm run db:push
   ```

## Recovery Steps

1. Fix identified issue (env var, database, schema)
2. Restart workflow
3. Verify /health returns 200
4. Test provider registration flow
5. Confirm A8 receives events

## Escalation

If issue persists after 30 minutes:
1. Check Neon database status
2. Verify Stripe API status
3. Contact platform support
```

---

### 3. Runbook: Ecosystem Health Check

**File:** `docs/runbooks/ecosystem-health-check.md`

**Content:**

```markdown
# Ecosystem Health Check Runbook

## Quick Check Script

```bash
#!/bin/bash
SERVICES=(
  "scholar-auth-jamarrlmayes.replit.app"
  "scholarship-api-jamarrlmayes.replit.app"
  "scholarship-agent-jamarrlmayes.replit.app"
  "scholarship-sage-jamarrlmayes.replit.app"
  "student-pilot-jamarrlmayes.replit.app"
  "provider-register-jamarrlmayes.replit.app"
  "scholaraiadvisor.com"
  "auto-com-center-jamarrlmayes.replit.app"
)

for service in "${SERVICES[@]}"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "https://$service/health")
  echo "$service: $status"
done
```

## Expected Results

All services should return HTTP 200.

## Troubleshooting

| HTTP Code | Meaning | Action |
|-----------|---------|--------|
| 200 | Healthy | None |
| 500 | App error | Check logs |
| 502 | Gateway error | Check deployment |
| 503 | Overloaded | Check resources |
| 504 | Timeout | Check dependencies |
```

---

### 4. ASYNC_HEALTH_CHECKS Documentation

**File:** `docs/features/async-health-checks.md`

**Content:**

```markdown
# Async Health Checks (A7)

## Feature Flag

`ASYNC_HEALTH_CHECKS=true`

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| ASYNC_HEALTH_CHECKS | false | Enable background health caching |
| EMAIL_HEALTH_CACHE_TTL_MS | 60000 | Cache TTL in milliseconds |
| HEALTH_CHECK_INTERVAL_MS | 30000 | Background check interval |

## Performance

- Before: P95 365ms
- After: P95 67ms
- Improvement: 81.7%

## Architecture

1. Background worker checks email providers every 30s
2. Results cached for 60s
3. /health reads from cache
4. Cold-start protection: cache seeded before accepting requests
```

---

## PR Plan

### PR #1: Add ECOSYSTEM_README

**Branch:** `docs/ecosystem-readme`
**Files:** `docs/ECOSYSTEM_README.md`
**Reviewers:** Platform team
**Status:** HUMAN_APPROVAL_REQUIRED

### PR #2: Add Recovery Runbooks

**Branch:** `docs/runbooks`
**Files:** 
- `docs/runbooks/a6-recovery.md`
- `docs/runbooks/ecosystem-health-check.md`
**Reviewers:** SRE team
**Status:** HUMAN_APPROVAL_REQUIRED

### PR #3: Document Async Health Checks

**Branch:** `docs/async-health-checks`
**Files:** `docs/features/async-health-checks.md`
**Reviewers:** A7 team
**Status:** HUMAN_APPROVAL_REQUIRED

---

## Approval Checklist

- [ ] Technical accuracy reviewed
- [ ] Security review (no secrets in docs)
- [ ] Links verified
- [ ] Formatting consistent
- [ ] Human approval granted
