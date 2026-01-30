# Workspace Mirroring Procedure & DNS Cutover Plan

**Prepared**: 2025-11-14 01:35:00 MST  
**CEO Directive**: Path B execution  
**Target**: 5 mirrored workspaces under CEO org  

---

## Executive Summary

Complete procedure for creating 5 mirrored workspaces, deploying code, collecting evidence, and cutting over DNS.

---

## Phase 1: Create Mirrored Workspaces (15-30 minutes)

### Workspaces to Create

| Legacy Workspace | Mirrored Workspace | Purpose |
|------------------|-------------------|---------|
| scholar_auth | scholar_auth_ceo | Authentication service |
| scholarship_api | scholarship_api_ceo | Scholarship API |
| auto_com_center | auto_com_center_ceo | Communications center |
| student_pilot | student_pilot_ceo | Student frontend |
| provider_register | provider_register_ceo | Provider frontend |

### Steps for Each Workspace

1. **Create New Replit**
   - Go to Replit dashboard
   - Click "Create Repl"
   - Choose "Import from GitHub" or "Node.js" template
   - Name: `{service}_ceo`
   - Set to CEO org

2. **Clone Repository**
   ```bash
   # If importing from GitHub
   git clone https://github.com/your-org/{service}.git .
   
   # OR copy files from legacy workspace
   # (Use Replit's file explorer to download/upload)
   ```

3. **Install Dependencies**
   ```bash
   npm install
   ```

4. **Configure Environment Variables**
   - Copy from legacy workspace
   - Update URLs to point to new services:
     - `AUTH_API_BASE_URL` → scholar_auth_ceo URL
     - `SCHOLARSHIP_API_BASE_URL` → scholarship_api_ceo URL
     - etc.

5. **Verify Deployment**
   - Run `npm run dev`
   - Access health endpoint
   - Check logs for errors

---

## Phase 2: Apply Deployment Packages (6-8 hours)

### scholar_auth (Hours 0-2)

**Apply**: `evidence/deployments/SCHOLAR_AUTH_GATE0_DEPLOYMENT.md`

1. Copy all code from deployment package
2. Set environment variables
3. Install dependencies:
   ```bash
   npm install jsonwebtoken jwks-rsa speakeasy qrcode bcryptjs
   ```
4. Run database migration:
   ```bash
   npm run db:push
   ```
5. Seed OAuth2 clients:
   ```bash
   tsx scripts/seedClients.ts
   ```
6. Test:
   ```bash
   bash tests/gate0_validation.sh
   ```
7. Collect evidence:
   - JWKS screenshot
   - Sample JWT tokens
   - /readyz passing
   - CORS test logs
   - MFA flow screenshot

### scholarship_api (Hours 2-4)

**Apply**: `evidence/deployments/SCHOLARSHIP_API_GATE0_DEPLOYMENT.md`

1. Copy all code from deployment package
2. Set environment variables (include scholar_auth_ceo URLs)
3. Install dependencies:
   ```bash
   npm install jwks-rsa redis swagger-ui-express
   ```
4. Provision Redis (Upstash or Replit Redis)
5. Run database migration:
   ```bash
   npm run db:push
   ```
6. Test:
   ```bash
   # Test /readyz
   curl https://scholarship-api-ceo.replit.app/readyz
   ```
7. Run k6 load test:
   ```bash
   k6 cloud load-tests/scholarship_api_300rps.js \
     --env API_URL=https://scholarship-api-ceo.replit.app \
     --env ACCESS_TOKEN=<jwt_from_scholar_auth_ceo>
   ```
8. Collect evidence:
   - /readyz screenshot
   - k6 run ID and report
   - P95 latency chart
   - Error rate chart

### auto_com_center (Hours 4-6)

**Apply**: `evidence/deployments/AUTO_COM_CENTER_GATE1_DEPLOYMENT.md`

1. Copy all code from package
2. Set environment variables
3. Install dependencies:
   ```bash
   npm install @sendgrid/mail twilio jwks-rsa
   ```
4. Run database migration:
   ```bash
   npm run db:push
   ```
5. Set up SendGrid:
   - Create account
   - Get API key
   - Add to Secrets
   - Start domain verification
6. Set up Twilio:
   - Create account
   - Get credentials
   - Add to Secrets
7. Test:
   ```bash
   # Test email
   curl -X POST https://auto-com-center-ceo.replit.app/api/notifications/send \
     -H "Authorization: Bearer $SERVICE_TOKEN" \
     -d '{"type":"email","to":"test@example.com",...}'
   ```
8. Run k6 canary:
   ```bash
   k6 cloud load-tests/canary/auto_com_center_250rps_30min.js \
     --env API_URL=https://auto-com-center-ceo.replit.app \
     --env SERVICE_TOKEN=<token>
   ```
9. Collect evidence:
   - SendGrid verification screenshots
   - Twilio dashboard screenshot
   - k6 canary run ID
   - P95 latency chart
   - Webhook event logs

### student_pilot (Parallel, Hours 0-2)

**Apply**: `evidence/deployments/STUDENT_PILOT_GA4_DEPLOYMENT.md`

1. Create `client/src/lib/analytics.ts`
2. Update DocumentUpload component
3. Add activation fields to users table
4. Run `npm run db:push`
5. Update document upload endpoint
6. Set `VITE_GA_MEASUREMENT_ID` in Secrets
7. Test in browser console
8. Verify in GA4 DebugView
9. Collect evidence:
   - GA4 DebugView screenshot showing `first_document_upload` event

### provider_register (Parallel, Hours 0-2)

**Apply**: `evidence/deployments/PROVIDER_REGISTER_GA4_DEPLOYMENT.md`

1. Create `client/src/lib/analytics.ts`
2. Update CreateScholarship component
3. Add activation fields to providers table
4. Run `npm run db:push`
5. Update scholarship creation endpoint
6. Set `VITE_GA_MEASUREMENT_ID` in Secrets
7. Test in browser console
8. Verify in GA4 DebugView
9. Collect evidence:
   - GA4 DebugView screenshot showing `first_scholarship_created` event

---

## Phase 3: Evidence Collection (Hours 6-8)

### Aggregate All Evidence

**Create master evidence bundle**:

```
evidence/gate0_mirrored/
├── scholar_auth/
│   ├── jwks_screenshot.png
│   ├── sample_tokens.txt
│   ├── readyz_passing.png
│   ├── cors_test_logs.txt
│   └── mfa_flow.png
├── scholarship_api/
│   ├── readyz_screenshot.png
│   ├── k6_run_id.txt
│   ├── p95_latency_chart.png
│   └── error_rate_chart.png
├── auto_com_center/
│   ├── sendgrid_verification.png
│   ├── twilio_dashboard.png
│   ├── k6_canary_run_id.txt
│   ├── p95_latency_chart.png
│   └── webhook_logs.txt
├── student_pilot/
│   └── ga4_first_document_upload.png
└── provider_register/
    └── ga4_first_scholarship_created.png
```

### Performance Retest

Run final validation on scholarship_api:

```bash
k6 cloud load-tests/scholarship_api_300rps.js \
  --env API_URL=https://scholarship-api-ceo.replit.app \
  --env ACCESS_TOKEN=<jwt>
```

**Verify**:
- P95 ≤ 120ms ✅
- Error rate < 0.5% ✅
- Sustained 300 RPS for 10 minutes ✅

---

## Phase 4: DNS Cutover (After Gate 0 Pass)

### Prerequisites

- All evidence packages complete
- All Gate 0 acceptance criteria met
- CEO go-live approval received

### Cutover Procedure

1. **Update DNS Records**

   For each service:
   ```
   Old: scholar-auth-jamarrlmayes.replit.app → legacy workspace
   New: scholar-auth-jamarrlmayes.replit.app → scholar_auth_ceo workspace
   ```

   (Replit handles this via the "Publish" button in each workspace)

2. **Publish Mirrored Workspaces**

   In each mirrored workspace:
   - Click "Publish" button
   - Use existing custom domain (e.g., `scholar-auth-jamarrlmayes.replit.app`)
   - Wait for DNS propagation (2-5 minutes)

3. **Verify Cutover**

   ```bash
   # Check DNS resolution
   nslookup scholar-auth-jamarrlmayes.replit.app
   
   # Test health endpoint
   curl https://scholar-auth-jamarrlmayes.replit.app/healthz
   
   # Verify it's hitting new workspace (check logs)
   ```

4. **Smoke Test All Services**

   - scholar_auth: Login flow, JWKS, MFA
   - scholarship_api: List scholarships, JWT validation
   - auto_com_center: Send test email/SMS
   - student_pilot: Upload document, GA4 event fires
   - provider_register: Create scholarship, GA4 event fires

5. **Freeze Legacy Workspaces**

   In each legacy workspace:
   - Stop all workflows
   - Make read-only (if possible)
   - Add banner: "DEPRECATED - Use {service}_ceo workspace"

---

## Phase 5: Post-Cutover Monitoring (First 24 hours)

### Metrics to Watch

1. **Error Rates**
   - Target: < 0.5%
   - Alert if > 1%

2. **Response Times**
   - P95 target: ≤ 120ms
   - Alert if > 200ms

3. **Availability**
   - Target: 99.9%
   - Alert if < 99%

4. **GA4 Events**
   - Verify `first_document_upload` firing
   - Verify `first_scholarship_created` firing

### Rollback Procedure

**If critical issues occur**:

1. Revert DNS to legacy workspaces:
   - Unpublish mirrored workspaces
   - Re-publish legacy workspaces
   - Wait 2-5 minutes for DNS propagation

2. Investigate issues in mirrored workspaces

3. Fix and re-test

4. Re-attempt cutover when ready

---

## Timeline Summary

| Time | Phase | Actions |
|------|-------|---------|
| T+0 to T+30 | Setup | Create 5 mirrored workspaces |
| T+30 to T+150 | scholar_auth | Apply deployment package, collect evidence |
| T+30 to T+150 | student_pilot | Apply GA4 package (parallel) |
| T+30 to T+150 | provider_register | Apply GA4 package (parallel) |
| T+150 to T+270 | scholarship_api | Apply deployment package, run k6 test |
| T+270 to T+390 | auto_com_center | Apply deployment package, run canary |
| T+390 to T+510 | Retest & Package | Final validation, aggregate evidence |
| T+510+ | DNS Cutover | Publish mirrored workspaces, freeze legacy |

**Total Elapsed**: ~8.5 hours (including setup overhead)

---

## Workspace URLs (After Mirroring)

| Service | Legacy URL | Mirrored URL (Post-Cutover) |
|---------|-----------|----------------------------|
| scholar_auth | scholar-auth-jamarrlmayes.replit.app | scholar-auth-jamarrlmayes.replit.app (cutover) |
| scholarship_api | scholarship-api-jamarrlmayes.replit.app | scholarship-api-jamarrlmayes.replit.app (cutover) |
| auto_com_center | auto-com-center-jamarrlmayes.replit.app | auto-com-center-jamarrlmayes.replit.app (cutover) |
| student_pilot | student-pilot-jamarrlmayes.replit.app | student-pilot-jamarrlmayes.replit.app (cutover) |
| provider_register | provider-register-jamarrlmayes.replit.app | provider-register-jamarrlmayes.replit.app (cutover) |

---

**Procedure Complete**  
**Ready for Path B Execution**  
**Estimated Total Time**: 8-10 hours (setup to cutover)
