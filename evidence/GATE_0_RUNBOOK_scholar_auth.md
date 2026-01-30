# Gate 0 Runbook: scholar_auth
**APPLICATION NAME**: scholar_auth  
**APP_BASE_URL**: https://scholar-auth-jamarrlmayes.replit.app  
**DEADLINE**: Nov 15, 12:00 PM MST  
**DRI**: Security Lead (A), Agent3 (C)  
**STATUS**: P0 - CRITICAL PATH BLOCKER

---

## Gate 0 Acceptance Criteria

### 1. OAuth2 Client Credentials Grant (8/8 M2M Clients)
**Target**: All 8 services obtain valid JWTs with correct scopes

**Services to Configure**:
1. scholarship_api
2. scholarship_sage
3. scholarship_agent
4. auto_com_center
5. student_pilot (future S2S)
6. provider_register (future S2S)
7. auto_page_maker (future S2S)
8. admin_dashboard (if exists)

**Test Script** (execute for each service):
```bash
#!/bin/bash
# File: tests/gate0_m2m_token_issuance.sh

CLIENT_ID="scholarship_api_client"
CLIENT_SECRET="<from_replit_secrets>"
AUTH_URL="https://scholar-auth-jamarrlmayes.replit.app"

# Request token
TOKEN_RESPONSE=$(curl -s -X POST "$AUTH_URL/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=$CLIENT_ID" \
  -d "client_secret=$CLIENT_SECRET" \
  -d "scope=scholarships.read scholarships.write")

# Extract access token
ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token')

# Decode JWT (redact sensitive fields for evidence)
echo "=== Client: $CLIENT_ID ==="
echo "$ACCESS_TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | jq '{aud, scope, iss, exp, iat}' || echo "Failed to decode"
echo ""
```

**Expected Output** (per service):
```json
{
  "aud": "https://scholarmatch.com",
  "scope": "scholarships.read scholarships.write",
  "iss": "https://scholar-auth-jamarrlmayes.replit.app",
  "exp": 1731628800,
  "iat": 1731542400
}
```

**Evidence Required**:
- [ ] Script output for all 8 clients (redacted tokens)
- [ ] Screenshot of service client configuration in scholar_auth admin
- [ ] File: `evidence/gate0_m2m_tokens_$(date +%Y%m%d_%H%M).log`

---

### 2. RBAC Scopes in JWT Claims
**Target**: Tokens contain role and permission claims

**Roles to Configure**:
- `student` - Read own profile, apply to scholarships
- `provider_admin` - Create scholarships, view applicants
- `reviewer` - Review applications, update statuses
- `super_admin` - Full system access

**Test Script**:
```bash
#!/bin/bash
# File: tests/gate0_rbac_claims.sh

USER_EMAIL="test_provider@example.com"
PASSWORD="<test_password>"
AUTH_URL="https://scholar-auth-jamarrlmayes.replit.app"

# Login and get token
LOGIN_RESPONSE=$(curl -s -X POST "$AUTH_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$USER_EMAIL\",\"password\":\"$PASSWORD\"}")

ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token')

# Decode and verify RBAC claims
echo "=== RBAC Claims for $USER_EMAIL ==="
echo "$ACCESS_TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | jq '{sub, email, roles, permissions, aud, iss}'
```

**Expected Output**:
```json
{
  "sub": "user_abc123",
  "email": "test_provider@example.com",
  "roles": ["provider_admin"],
  "permissions": ["scholarships.create", "applications.read"],
  "aud": "https://scholarmatch.com",
  "iss": "https://scholar-auth-jamarrlmayes.replit.app"
}
```

**Evidence Required**:
- [ ] Token outputs for each role (student, provider_admin, reviewer, super_admin)
- [ ] File: `evidence/gate0_rbac_claims_$(date +%Y%m%d_%H%M).log`

---

### 3. CORS Allowlist (NO Wildcards)
**Target**: Lock CORS to exact 8 app URLs only

**Configuration** (server/index.ts or middleware/cors.ts):
```typescript
// CORS Configuration - Gate 0 Requirement
const ALLOWED_ORIGINS = [
  'https://student-pilot-jamarrlmayes.replit.app',
  'https://provider-register-jamarrlmayes.replit.app',
  'https://scholarship-api-jamarrlmayes.replit.app',
  'https://scholarship-sage-jamarrlmayes.replit.app',
  'https://scholarship-agent-jamarrlmayes.replit.app',
  'https://auto-com-center-jamarrlmayes.replit.app',
  'https://auto-page-maker-jamarrlmayes.replit.app',
  'https://admin-dashboard-jamarrlmayes.replit.app'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy violation'));
    }
  },
  credentials: true
}));
```

**Test Script**:
```bash
#!/bin/bash
# File: tests/gate0_cors_validation.sh

AUTH_URL="https://scholar-auth-jamarrlmayes.replit.app"

# Test 1: Allowed origin
echo "=== Test 1: Allowed Origin ==="
curl -s -I -H "Origin: https://student-pilot-jamarrlmayes.replit.app" \
  "$AUTH_URL/health" | grep -i "access-control"

# Test 2: Blocked origin
echo "=== Test 2: Blocked Origin (should fail) ==="
curl -s -I -H "Origin: https://evil-site.com" \
  "$AUTH_URL/health" | grep -i "access-control"

# Test 3: Wildcard check (should NOT exist)
echo "=== Test 3: Check for wildcard ==="
curl -s "$AUTH_URL/health" | grep -i "access-control-allow-origin: \*" && echo "FAIL: Wildcard found" || echo "PASS: No wildcard"
```

**Evidence Required**:
- [ ] Code diff showing CORS configuration
- [ ] Test script output (allowed vs. blocked origins)
- [ ] File: `evidence/gate0_cors_config.diff` and `evidence/gate0_cors_test_$(date +%Y%m%d_%H%M).log`

---

### 4. MFA Enforcement (Provider/Admin Roles)
**Target**: MFA required for provider_admin, reviewer, super_admin

**Configuration**:
```typescript
// MFA Enforcement - Gate 0 Requirement
const MFA_REQUIRED_ROLES = ['provider_admin', 'reviewer', 'super_admin'];

async function checkMFARequired(user: User): Promise<boolean> {
  return user.roles.some(role => MFA_REQUIRED_ROLES.includes(role));
}

// During login flow
if (await checkMFARequired(user)) {
  if (!user.mfaEnabled) {
    return res.status(403).json({ 
      error: 'MFA_REQUIRED',
      message: 'MFA must be enabled for this role',
      enrollmentUrl: '/auth/mfa/enroll'
    });
  }
  
  if (!req.body.mfaCode) {
    return res.status(200).json({
      requiresMFA: true,
      challengeId: generateMFAChallenge(user)
    });
  }
  
  const valid = await verifyMFACode(user, req.body.mfaCode);
  if (!valid) {
    return res.status(401).json({ error: 'INVALID_MFA_CODE' });
  }
}
```

**Test Script**:
```bash
#!/bin/bash
# File: tests/gate0_mfa_enforcement.sh

AUTH_URL="https://scholar-auth-jamarrlmayes.replit.app"

# Test: Provider admin without MFA should be blocked
echo "=== Test: Provider Admin Login (MFA Required) ==="
curl -s -X POST "$AUTH_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"provider@example.com","password":"test123"}' | jq '.'

# Expected response if MFA not enabled:
# {"error":"MFA_REQUIRED","message":"MFA must be enabled for this role","enrollmentUrl":"/auth/mfa/enroll"}

# Expected response if MFA enabled but code not provided:
# {"requiresMFA":true,"challengeId":"ch_abc123"}
```

**Evidence Required**:
- [ ] Screenshots of MFA enrollment flow for provider/admin
- [ ] Test output showing MFA enforcement
- [ ] File: `evidence/gate0_mfa_screenshots/` and `evidence/gate0_mfa_test_$(date +%Y%m%d_%H%M).log`

---

### 5. HA Configuration (Reserved VM/Autoscale)
**Target**: Deploy with HA profile for 99.9% uptime

**Replit Deployment Configuration**:
1. Go to Replit Deployments tab
2. Select deployment type:
   - **Reserved VM** (recommended for auth - consistent latency)
   - OR **Autoscale** (if traffic is variable)
3. Configure settings:
   - Min instances: 2
   - Max instances: 5
   - CPU: 2 vCPUs
   - Memory: 4 GB
   - Health check path: `/health`

**Health Endpoint** (must return 200):
```typescript
// server/routes.ts
app.get('/health', async (req, res) => {
  try {
    // Check DB connectivity
    await db.execute(sql`SELECT 1`);
    
    // Check JWKS availability
    const jwks = getJWKS();
    if (!jwks || Object.keys(jwks).length === 0) {
      throw new Error('JWKS not loaded');
    }
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      dependencies: {
        database: 'healthy',
        jwks: 'healthy'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});
```

**Evidence Required**:
- [ ] Screenshot of Replit deployment configuration (Reserved VM/Autoscale settings)
- [ ] Health endpoint response (200 OK with dependencies)
- [ ] File: `evidence/gate0_ha_config_screenshot.png` and `evidence/gate0_health_check.log`

---

### 6. Load Test: JWT Validation Stability
**Target**: 250 rps for 10 minutes, error rate <0.5%, no signature flaps

**Load Test Script** (using autocannon):
```bash
#!/bin/bash
# File: load-tests/gate0_jwt_validation.sh

# First, get a valid token
TOKEN=$(curl -s -X POST "https://scholar-auth-jamarrlmayes.replit.app/oauth/token" \
  -d "grant_type=client_credentials" \
  -d "client_id=scholarship_api_client" \
  -d "client_secret=$CLIENT_SECRET" | jq -r '.access_token')

# Run load test
autocannon -c 250 -d 600 \
  -H "Authorization: Bearer $TOKEN" \
  -m GET \
  "https://scholarship-api-jamarrlmayes.replit.app/api/scholarships" \
  --json > evidence/gate0_jwt_load_test_$(date +%Y%m%d_%H%M).json

# Parse results
cat evidence/gate0_jwt_load_test_*.json | jq '{
  rps: .requests.average,
  latency_p95: .latency.p95,
  latency_p99: .latency.p99,
  errors: .errors,
  error_rate: (.errors / .requests.total * 100)
}'
```

**Acceptance Criteria**:
- RPS: 250+ sustained
- P95 Latency: ≤120ms
- Error Rate: <0.5%
- Zero signature validation failures (check logs)

**Evidence Required**:
- [ ] Autocannon JSON output
- [ ] Parsed summary showing P95, error rate
- [ ] Server logs showing zero JWT validation errors
- [ ] File: `load-tests/gate0_jwt_validation/` folder

---

## Monitoring & Alerting Setup

**Dashboard Metrics** (create in monitoring tool):
- Auth success rate (target: >99.5%)
- Auth failure rate by reason (invalid_credentials, mfa_failed, jwt_expired)
- 5xx error rate (target: <0.5%)
- P95 latency (target: ≤120ms)
- Token issuance rate (per service)

**Alerts to Configure**:
```yaml
# Alert: High auth error rate
- name: auth_error_rate_high
  condition: error_rate > 1% for 5 minutes
  severity: critical
  notify: security_team, agent3

# Alert: JWKS endpoint down
- name: jwks_endpoint_down
  condition: /health check fails
  severity: critical
  notify: security_team, ops

# Alert: MFA bypass attempt
- name: mfa_bypass_attempt
  condition: provider/admin login without MFA
  severity: high
  notify: security_team
```

**Evidence Required**:
- [ ] Screenshots of dashboard showing metrics
- [ ] Alert configuration file or screenshots
- [ ] File: `evidence/gate0_monitoring_dashboard.png` and `config/alerts.yaml`

---

## Secrets Rotation (Post-Verification)

**After Gate 0 passes, rotate all client secrets:**
```bash
#!/bin/bash
# File: scripts/rotate_client_secrets.sh

# For each M2M client
for CLIENT in scholarship_api scholarship_sage scholarship_agent auto_com_center; do
  echo "Rotating secret for $CLIENT..."
  
  # Generate new secret
  NEW_SECRET=$(openssl rand -base64 32)
  
  # Update in scholar_auth database
  # Update in client's Replit Secrets
  
  # Test token issuance with new secret
  curl -s -X POST "https://scholar-auth-jamarrlmayes.replit.app/oauth/token" \
    -d "grant_type=client_credentials" \
    -d "client_id=${CLIENT}_client" \
    -d "client_secret=$NEW_SECRET" | jq '.access_token' || echo "FAILED: $CLIENT"
done
```

**Evidence Required**:
- [ ] Rotation log showing all 8 clients updated
- [ ] File: `evidence/gate0_secrets_rotation_$(date +%Y%m%d_%H%M).log`

---

## Checkpoint Deliverables

**Nov 15, 12:15 PM MST** - Gate 0 Canary Results:
- [ ] 8/8 M2M token issuance proof
- [ ] RBAC claims verification (4 roles)
- [ ] CORS config diff + test output
- [ ] MFA enforcement screenshots
- [ ] HA configuration screenshot
- [ ] JWT load test results (250 rps, <0.5% error)

**Nov 15, 5:00 PM MST** - Final Gate 0 Sign-Off:
- [ ] All evidence artifacts in `evidence/gate0_scholar_auth/` folder
- [ ] Monitoring dashboard live
- [ ] Alerts configured and tested
- [ ] Secrets rotated
- [ ] Sign-off document: `evidence/GATE_0_SIGN_OFF_scholar_auth.md`

---

## Rollback Plan

**Trigger**: Gate 0 fails any acceptance criteria

**Steps**:
1. Revert to previous Replit deployment (RTO: 5 minutes)
2. Notify all downstream services (scholarship_api, etc.)
3. Re-run acceptance tests
4. Document failure reason
5. Escalate to CEO if blocker >2 hours

---

**Runbook Prepared By**: Agent3 (Program Integrator)  
**Timestamp**: 2025-11-13 23:45:00 MST  
**DRI**: Security Lead must execute by Nov 15, 12:00 PM MST  
**Escalation**: Agent3 takes direct control if blocked >2 hours per CEO authority
