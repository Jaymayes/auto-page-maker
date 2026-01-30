# B2B Funnel Recovery Runbook

**Version:** 1.0  
**Last Updated:** 2026-01-08  
**Owner:** Platform Team  

---

## Overview

This runbook provides step-by-step instructions for diagnosing and recovering the B2B (Provider) funnel when issues are detected.

---

## Funnel Path

```
A7 (Marketing) → A6 (Provider Register) → A8 (Finance Tile)
```

---

## Common Issues

### Issue: A6-001 External Deployment Stale (500)

**Symptoms:**
- 500 error on external /register endpoint
- Local/staging passes but production fails
- Provider signup blocked

**Root Cause:**
- Database migrations not run on external deployment
- Missing secrets in production environment
- Stale deployment with old code

**Diagnosis:**
1. Compare staging vs production env vars:
   ```bash
   # Check staging
   curl -s https://provider-register-staging.replit.app/health
   
   # Check production
   curl -s https://provider-register-jamarrlmayes.replit.app/health
   ```
2. Verify migration status:
   ```bash
   npx drizzle-kit push:pg --dry-run
   ```
3. Check secrets presence (never print values):
   ```bash
   echo "DATABASE_URL set: ${DATABASE_URL:+yes}"
   echo "STRIPE_SECRET_KEY set: ${STRIPE_SECRET_KEY:+yes}"
   ```

**Recovery Steps:**
1. **Branch:** Create `fix/ext-deployment` in A6 repo
2. **Migrations:** Run pending migrations:
   ```bash
   npx drizzle-kit push:pg
   ```
3. **Secrets:** Verify all required secrets are present:
   - DATABASE_URL
   - STRIPE_SECRET_KEY
   - STRIPE_CONNECT_CLIENT_ID
   - A8_INGEST_KEY
4. **Cold-start Mitigation:**
   - Implement connection pooling
   - Add warmup endpoint
5. **Deploy:** Redeploy with verified configuration
6. **Test:** Run provider registration flow:
   ```bash
   k6 run tests/perf/k6/a6_register_billing.js --env ENV=staging
   ```
7. **Verify:** Confirm /register returns 200
8. **PR:** Open PR with evidence
9. **Approval:** Request HUMAN_APPROVAL for production publish

**Rollback:**
```bash
git revert <commit-sha>
# Redeploy previous stable version
```

---

### Issue: Finance Lineage Mismatch

**Symptoms:**
- A8 Finance tile not showing 3% fee
- AI markup not displaying 4x
- Revenue events missing

**Root Cause:**
- Billing payload keys misaligned
- A8 tile wiring incorrect (A8-001)

**Diagnosis:**
1. Check A6 billing event payload:
   ```bash
   grep "billing_event" /var/log/provider-register/events.log
   ```
2. Verify payload structure:
   ```json
   {
     "provider_fee_pct": 3,
     "ai_markup_factor": 4.0,
     "revenue_event_id": "uuid"
   }
   ```
3. Check A8 tile configuration for correct key mapping

**Recovery Steps:**
1. Align A6 billing payload with A8 schema
2. Fix A8 tile wiring (A8-001)
3. Emit test transaction with known values
4. Verify 3% and 4x display in Finance tile

---

### Issue: Provider Signup Timeout

**Symptoms:**
- Signup requests timing out
- P95 >150ms on /register

**Root Cause:**
- Database connection pool exhausted
- Cold start latency

**Diagnosis:**
1. Check database connection count:
   ```sql
   SELECT count(*) FROM pg_stat_activity WHERE datname = 'provider_db';
   ```
2. Monitor cold start frequency

**Recovery Steps:**
1. Increase connection pool size
2. Implement connection warmup
3. Add timeout handling with retry

---

## Finance Lineage Verification

After recovery, verify finance lineage:

1. **A6 Logs:** Confirm `provider_fee_pct=3` and `ai_markup_factor=4.0`
2. **A8 Ingest:** Verify event received with correct values
3. **A8 Tile:** Confirm Finance tile displays 3% and 4x
4. **Transaction Log:** Correlate via `revenue_event_id`

---

## Verification Checklist

After recovery, verify:

- [ ] /register returns 200 on external URL
- [ ] Provider signup completes successfully
- [ ] P95 latency ≤150ms
- [ ] Finance tile updates within 60s
- [ ] 3% fee displayed correctly
- [ ] 4x markup displayed correctly
- [ ] Revenue lineage end-to-end

---

## Escalation

If issues persist after recovery steps:

1. **Level 1:** Check A8 dashboard for ingestion errors
2. **Level 2:** Review Stripe Connect configuration
3. **Level 3:** Contact platform team with revenue_event_id

---

## Related Artifacts

- `tests/perf/reports/b2b_funnel_results.json`
- `tests/perf/reports/billing_logic_verification.md`
- `tests/perf/k6/a6_register_billing.js`
- `tests/perf/reports/provider_funnel_tests.json`

---

*Runbook validated against AGENT3_HANDSHAKE v27 protocol*
