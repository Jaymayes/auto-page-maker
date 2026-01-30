# B2C Funnel Recovery Runbook

**Version:** 1.0  
**Last Updated:** 2026-01-08  
**Owner:** Platform Team  

---

## Overview

This runbook provides step-by-step instructions for diagnosing and recovering the B2C (Student) funnel when issues are detected.

---

## Funnel Path

```
A7 (Marketing) → A1 (Auth) → A5 (Student) → A3 (Agent) → A2 (Aggregator) → A8 (Command)
```

---

## Common Issues

### Issue: A1-001 OIDC Session Expired Loop

**Symptoms:**
- Users unable to complete login
- Redirect loops between A1 and A5
- "Session expired" errors despite active session

**Root Cause:**
- Cookie SameSite/Secure mismatch
- TTL misalignment between auth and session cookies
- Domain mismatch in cookie settings

**Diagnosis:**
1. Check browser dev tools for cookie warnings
2. Inspect A1 logs for auth trace:
   ```bash
   grep "oidc" /var/log/scholar-auth/access.log | tail -100
   ```
3. Verify cookie settings in A1 config

**Recovery Steps:**
1. **Branch:** Create `fix/oidc-cookies` in A1 repo
2. **Fix:** Update cookie configuration:
   ```typescript
   // Set-Cookie attributes
   SameSite: 'None',
   Secure: true,
   Domain: '.scholaraiadvisor.com',
   MaxAge: 3600 * 24 * 7 // 7 days
   ```
3. **Deploy:** Stage deploy to staging environment
4. **Test:** Run 10 consecutive login flows:
   ```bash
   npx playwright test tests/perf/playwright/a5_signup_oidc_crm.spec.ts
   ```
5. **Verify:** Confirm 10/10 success, no loops
6. **PR:** Open PR with evidence attached
7. **Approval:** Request HUMAN_APPROVAL for production

**Rollback:**
```bash
git revert <commit-sha>
git push origin fix/oidc-cookies
# Redeploy previous version
```

---

### Issue: A5 Routes Not Found (404)

**Symptoms:**
- 404 errors on student dashboard routes
- Missing pages after navigation

**Root Cause:**
- AUTO_PAGE_MAKER_URL env var not loaded
- Route configuration mismatch

**Diagnosis:**
1. Check A5 environment variables:
   ```bash
   echo $AUTO_PAGE_MAKER_URL
   ```
2. Verify route registration in App.tsx

**Recovery Steps:**
1. Confirm env var is set in Replit Secrets
2. Restart A5 workflow
3. Test routes manually

---

### Issue: A3 Attribution Events Missing

**Symptoms:**
- Growth tile not updating in A8
- Lead events not appearing

**Root Cause:**
- Idempotency key validation failing
- Event schema mismatch

**Diagnosis:**
1. Check A3 orchestration logs for event emission
2. Verify A2 ingest endpoint receiving events
3. Check A8 dashboard for pending events

**Recovery Steps:**
1. Validate idempotency key format
2. Align event schema with A2 expectations
3. Re-emit test event with trace_id
4. Verify arrival in A8

---

## Verification Checklist

After recovery, verify:

- [ ] 10/10 login flows complete without loops
- [ ] P95 latency ≤150ms per hop
- [ ] A8 Growth tile updates within 60s
- [ ] No duplicate events (idempotency)
- [ ] Trace correlation end-to-end

---

## Escalation

If issues persist after recovery steps:

1. **Level 1:** Check A8 dashboard for correlated errors
2. **Level 2:** Review A2 ingest logs for dropped events
3. **Level 3:** Contact platform team with trace_id

---

## Related Artifacts

- `tests/perf/reports/b2c_funnel_results.json`
- `tests/perf/playwright/a5_signup_oidc_crm.spec.ts`
- `tests/perf/reports/auth_trace_log.json`

---

*Runbook validated against AGENT3_HANDSHAKE v27 protocol*
