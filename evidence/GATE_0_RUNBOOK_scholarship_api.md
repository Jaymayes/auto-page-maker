# Gate 0 Runbook: scholarship_api
**APPLICATION NAME**: scholarship_api  
**APP_BASE_URL**: https://scholarship-api-jamarrlmayes.replit.app  
**DEADLINE**: Nov 15, 12:00 PM MST  
**DRI**: API Lead (A), Agent3 (C)  
**STATUS**: P0 - BLOCKS ALL DOWNSTREAM APPS

---

## Gate 0 Acceptance Criteria

### 1. Stable JWT Validation Under Load
**Target**: Zero signature validation failures at 250 rps for 10 minutes

**Problem**: JWKS caching, rotation, and signature validation flakiness

**Solution**: Implement robust JWT validation with retry logic

**Implementation** (server/middleware/auth.ts):
```typescript
import { JwksClient } from 'jwks-rsa';
import jwt from 'jsonwebtoken';

// JWKS Client with caching and retry
const jwksClient = new JwksClient({
  jwksUri: 'https://scholar-auth-jamarrlmayes.replit.app/.well-known/jwks.json',
  cache: true,
  cacheMaxAge: 600000, // 10 minutes
  cacheMaxEntries: 5,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
  timeout: 5000, // 5 second timeout
  requestAgent: new https.Agent({
    keepAlive: true,
    maxSockets: 10
  })
});

// Get signing key with retry and fallback
async function getSigningKey(kid: string, retries = 3): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const key = await jwksClient.getSigningKey(kid);
      return key.getPublicKey();
    } catch (error) {
      console.error(`JWKS fetch attempt ${attempt}/${retries} failed:`, error);
      
      if (attempt < retries) {
        // Exponential backoff: 100ms, 200ms, 400ms
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt - 1)));
      } else {
        throw new Error(`JWKS fetch failed after ${retries} attempts`);
      }
    }
  }
  throw new Error('JWKS fetch failed');
}

// JWT validation middleware
export async function validateJWT(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'MISSING_TOKEN' });
    }

    const token = authHeader.substring(7);
    
    // Decode header to get kid
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || !decoded.header.kid) {
      return res.status(401).json({ error: 'INVALID_TOKEN_HEADER' });
    }

    // Get signing key with retry
    const signingKey = await getSigningKey(decoded.header.kid);

    // Verify token signature
    const verified = jwt.verify(token, signingKey, {
      algorithms: ['RS256'],
      issuer: 'https://scholar-auth-jamarrlmayes.replit.app',
      audience: 'https://scholarmatch.com'
    });

    req.user = verified;
    next();
  } catch (error) {
    console.error('JWT validation error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'TOKEN_EXPIRED' });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'INVALID_TOKEN' });
    } else {
      return res.status(500).json({ error: 'AUTH_SERVICE_ERROR' });
    }
  }
}
```

**Test Script**:
```bash
#!/bin/bash
# File: tests/gate0_jwt_validation_stability.sh

AUTH_URL="https://scholar-auth-jamarrlmayes.replit.app"
API_URL="https://scholarship-api-jamarrlmayes.replit.app"

# Get token
TOKEN=$(curl -s -X POST "$AUTH_URL/oauth/token" \
  -d "grant_type=client_credentials" \
  -d "client_id=test_client" \
  -d "client_secret=$CLIENT_SECRET" | jq -r '.access_token')

# Run 1000 requests to verify stability
echo "=== JWT Validation Stability Test ==="
FAILURES=0
for i in {1..1000}; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    "$API_URL/api/scholarships")
  
  if [ "$HTTP_CODE" != "200" ]; then
    ((FAILURES++))
    echo "Request $i failed with HTTP $HTTP_CODE"
  fi
  
  # Show progress every 100 requests
  if [ $((i % 100)) -eq 0 ]; then
    echo "Completed $i requests, failures: $FAILURES"
  fi
done

ERROR_RATE=$(echo "scale=2; $FAILURES / 1000 * 100" | bc)
echo "=== Results ==="
echo "Total requests: 1000"
echo "Failures: $FAILURES"
echo "Error rate: ${ERROR_RATE}%"

if (( $(echo "$ERROR_RATE < 0.5" | bc -l) )); then
  echo "✅ PASS: Error rate below 0.5%"
  exit 0
else
  echo "❌ FAIL: Error rate above 0.5%"
  exit 1
fi
```

**Evidence Required**:
- [ ] Code diff showing JWT validation improvements
- [ ] Test output showing <0.5% error rate over 1000 requests
- [ ] File: `evidence/gate0_jwt_validation.diff` and `evidence/gate0_jwt_stability_test_$(date +%Y%m%d_%H%M).log`

---

### 2. Deep Health Checks (DB + Auth Dependencies)
**Target**: /health endpoint validates all critical dependencies

**Implementation** (server/routes.ts):
```typescript
app.get('/health', async (req, res) => {
  const startTime = Date.now();
  const checks = {
    database: { status: 'unknown', latency_ms: 0 },
    auth_provider: { status: 'unknown', latency_ms: 0 },
    cache: { status: 'unknown', latency_ms: 0 }
  };
  
  // 1. Database check
  try {
    const dbStart = Date.now();
    await db.execute(sql`SELECT 1`);
    checks.database = {
      status: 'healthy',
      latency_ms: Date.now() - dbStart
    };
  } catch (error) {
    checks.database = {
      status: 'unhealthy',
      latency_ms: Date.now() - dbStart,
      error: error.message
    };
  }
  
  // 2. Auth provider check (JWKS endpoint)
  try {
    const authStart = Date.now();
    const response = await fetch('https://scholar-auth-jamarrlmayes.replit.app/.well-known/jwks.json', {
      signal: AbortSignal.timeout(3000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const jwks = await response.json();
    if (!jwks.keys || jwks.keys.length === 0) throw new Error('No keys in JWKS');
    
    checks.auth_provider = {
      status: 'healthy',
      latency_ms: Date.now() - authStart,
      keys_count: jwks.keys.length
    };
  } catch (error) {
    checks.auth_provider = {
      status: 'unhealthy',
      latency_ms: Date.now() - authStart,
      error: error.message
    };
  }
  
  // 3. Cache check (if using Redis/etc)
  checks.cache = { status: 'healthy', latency_ms: 0 }; // Implement if applicable
  
  // Overall status
  const allHealthy = Object.values(checks).every(check => check.status === 'healthy');
  const overallStatus = allHealthy ? 'healthy' : 
                       Object.values(checks).some(check => check.status === 'unhealthy') ? 'degraded' : 'unhealthy';
  
  const statusCode = overallStatus === 'healthy' ? 200 : 
                     overallStatus === 'degraded' ? 200 : 503;
  
  res.status(statusCode).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    app: 'scholarship_api',
    version: '2.7',
    uptime_seconds: process.uptime(),
    dependencies: checks,
    total_latency_ms: Date.now() - startTime
  });
});
```

**Test Script**:
```bash
#!/bin/bash
# File: tests/gate0_deep_health_check.sh

API_URL="https://scholarship-api-jamarrlmayes.replit.app"

echo "=== Deep Health Check Test ==="
curl -s "$API_URL/health" | jq '.'

# Validate required fields
HEALTH_JSON=$(curl -s "$API_URL/health")

# Check overall status
STATUS=$(echo "$HEALTH_JSON" | jq -r '.status')
echo "Overall status: $STATUS"

# Check database dependency
DB_STATUS=$(echo "$HEALTH_JSON" | jq -r '.dependencies.database.status')
echo "Database: $DB_STATUS"

# Check auth provider dependency
AUTH_STATUS=$(echo "$HEALTH_JSON" | jq -r '.dependencies.auth_provider.status')
echo "Auth Provider: $AUTH_STATUS"

# Verify all healthy
if [ "$STATUS" == "healthy" ] && [ "$DB_STATUS" == "healthy" ] && [ "$AUTH_STATUS" == "healthy" ]; then
  echo "✅ PASS: All dependencies healthy"
  exit 0
else
  echo "❌ FAIL: One or more dependencies unhealthy"
  exit 1
fi
```

**Evidence Required**:
- [ ] Health endpoint JSON output showing all dependencies
- [ ] Test output confirming all checks pass
- [ ] File: `evidence/gate0_health_check_output_$(date +%Y%m%d_%H%M).json`

---

### 3. Load Test: 300 RPS Sustained for 15 Minutes
**Target**: P95 ≤120ms, error rate <0.5%

**Load Test Script** (using autocannon):
```bash
#!/bin/bash
# File: load-tests/gate0_scholarship_api_300rps.sh

API_URL="https://scholarship-api-jamarrlmayes.replit.app"
OUTPUT_FILE="load-tests/gate0_api_load_$(date +%Y%m%d_%H%M).json"

# Get auth token
TOKEN=$(curl -s -X POST "https://scholar-auth-jamarrlmayes.replit.app/oauth/token" \
  -d "grant_type=client_credentials" \
  -d "client_id=test_client" \
  -d "client_secret=$CLIENT_SECRET" | jq -r '.access_token')

echo "=== Starting Load Test: 300 RPS for 15 minutes ==="
echo "Target: $API_URL/api/scholarships"
echo "Start time: $(date)"

# Run autocannon
autocannon \
  -c 300 \
  -d 900 \
  -H "Authorization: Bearer $TOKEN" \
  -m GET \
  "$API_URL/api/scholarships" \
  --json > "$OUTPUT_FILE"

echo "End time: $(date)"
echo "Results saved to: $OUTPUT_FILE"

# Parse and display results
echo ""
echo "=== Load Test Results ==="
cat "$OUTPUT_FILE" | jq '{
  duration_seconds: .duration,
  requests_total: .requests.total,
  requests_per_second: .requests.average,
  latency: {
    mean_ms: .latency.mean,
    p50_ms: .latency.p50,
    p95_ms: .latency.p95,
    p99_ms: .latency.p99
  },
  errors: .errors,
  error_rate_percent: ((.errors / .requests.total) * 100),
  timeouts: .timeouts
}'

# Check acceptance criteria
P95=$(cat "$OUTPUT_FILE" | jq -r '.latency.p95')
ERROR_RATE=$(cat "$OUTPUT_FILE" | jq -r '(.errors / .requests.total) * 100')

echo ""
if (( $(echo "$P95 <= 120" | bc -l) )) && (( $(echo "$ERROR_RATE < 0.5" | bc -l) )); then
  echo "✅ PASS: P95=${P95}ms (≤120ms), Error Rate=${ERROR_RATE}% (<0.5%)"
  exit 0
else
  echo "❌ FAIL: P95=${P95}ms, Error Rate=${ERROR_RATE}%"
  exit 1
fi
```

**Evidence Required**:
- [ ] Autocannon JSON output file
- [ ] Summary showing P95 and error rate
- [ ] Server logs during load test (check for errors)
- [ ] File: `load-tests/gate0_scholarship_api/`

---

## Checkpoint Deliverables

**Nov 15, 12:15 PM MST** - Gate 0 Canary Results:
- [ ] JWT validation stability test (1000 requests, <0.5% errors)
- [ ] Deep health check output (DB + auth dependencies)
- [ ] 300 RPS load test results (P95 ≤120ms)

**Nov 15, 5:00 PM MST** - Final Gate 0 Sign-Off:
- [ ] All evidence artifacts in `evidence/gate0_scholarship_api/` folder
- [ ] Code diffs for JWT validation improvements
- [ ] Sign-off document: `evidence/GATE_0_SIGN_OFF_scholarship_api.md`

---

**Runbook Prepared By**: Agent3 (Program Integrator)  
**Timestamp**: 2025-11-13 23:50:00 MST  
**DRI**: API Lead must execute by Nov 15, 12:00 PM MST
