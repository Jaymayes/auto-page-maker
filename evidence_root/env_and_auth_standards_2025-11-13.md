# Environment Variable and Authentication Standards
## Scholar AI Advisor Platform - 8 Microservices Integration

**Version**: 1.0  
**Effective Date**: 2025-11-13  
**Authority**: CEO Directive via Agent3 (Integration Lead)  
**Scope**: All 8 Replit-hosted microservices

---

## I. Core Principles

### 1.1 Zero Hardcoded URLs
**MANDATE**: No service shall contain hardcoded URLs to other services in source code.

**Enforcement**:
- All inter-service communication MUST use environment variables
- Boot-time validation: fail fast if required variables missing
- Code review blocks merges containing hardcoded URLs

### 1.2 Environment Variable Naming Convention
**Standard Format**: `{SERVICE}_{RESOURCE}_URL`

**Examples**:
```bash
AUTH_API_BASE_URL=https://scholar-auth-jamarrlmayes.replit.app
SCHOLARSHIP_API_BASE_URL=https://scholarship-api-jamarrlmayes.replit.app
STUDENT_PILOT_BASE_URL=https://student-pilot-jamarrlmayes.replit.app
```

### 1.3 Security First
- All secrets via Replit Secrets (never in code or logs)
- Least-privilege access
- Audit all authentication events

---

## II. Required Environment Variables

### 2.1 Universal Variables (ALL Services)

Every service MUST have:

```bash
# Node Environment
NODE_ENV=production|development|test

# Service Identity
SERVICE_NAME=scholar_auth|scholarship_api|student_pilot|etc
APP_BASE_URL=https://{service}-jamarrlmayes.replit.app

# Database (if applicable)
DATABASE_URL=postgresql://user:pass@host:port/dbname

# Observability
LOG_LEVEL=info|debug|warn|error
CORRELATION_ID_HEADER=X-Request-ID
```

### 2.2 Service Registry (ALL Services)

```bash
# Authentication Service
AUTH_API_BASE_URL=https://scholar-auth-jamarrlmayes.replit.app

# Core API
SCHOLARSHIP_API_BASE_URL=https://scholarship-api-jamarrlmayes.replit.app

# AI/ML Services
SAGE_API_BASE_URL=https://scholarship-sage-jamarrlmayes.replit.app
AGENT_API_BASE_URL=https://scholarship-agent-jamarrlmayes.replit.app

# Platform Services
AUTO_COM_CENTER_BASE_URL=https://auto-com-center-jamarrlmayes.replit.app
AUTO_PAGE_MAKER_BASE_URL=https://auto-page-maker-jamarrlmayes.replit.app

# Frontends
STUDENT_PILOT_BASE_URL=https://student-pilot-jamarrlmayes.replit.app
PROVIDER_REGISTER_BASE_URL=https://provider-register-jamarrlmayes.replit.app
```

### 2.3 Service-Specific Variables

#### scholar_auth
```bash
JWT_PRIVATE_KEY=<RS256 private key PEM format>
JWT_PUBLIC_KEY=<RS256 public key PEM format>
JWT_ISSUER=https://scholar-auth-jamarrlmayes.replit.app
JWT_AUDIENCE=scholarship-platform
JWT_ACCESS_TTL=900          # 15 minutes in seconds
JWT_REFRESH_TTL=604800      # 7 days in seconds
JWKS_CACHE_TTL=3600         # 1 hour
SESSION_SECRET=<random 32+ char string>
```

#### scholarship_api
```bash
JWKS_URL=https://scholar-auth-jamarrlmayes.replit.app/.well-known/jwks.json
JWT_ISSUER=https://scholar-auth-jamarrlmayes.replit.app
JWT_AUDIENCE=scholarship-platform
INTERNAL_API_KEY=<shared secret for service-to-service>
```

#### auto_com_center
```bash
POSTMARK_API_KEY=<from Replit Secrets>
SENDGRID_API_KEY=<from Replit Secrets>
TWILIO_ACCOUNT_SID=<from Replit Secrets>
TWILIO_AUTH_TOKEN=<from Replit Secrets>
TWILIO_PHONE_NUMBER=<verified phone>
EMAIL_FROM_ADDRESS=noreply@scholaraiadvisor.com
EMAIL_FROM_NAME=Scholar AI Advisor
NOTIFICATION_QUEUE_MAX_SIZE=10000
```

#### scholarship_sage, scholarship_agent
```bash
OPENAI_API_KEY=<from Replit Secrets>
OPENAI_MODEL=gpt-4o
SERVICE_CLIENT_ID=sage_service|agent_service
SERVICE_CLIENT_SECRET=<issued by scholar_auth>
```

---

## III. Authentication & Authorization Architecture

### 3.1 JWT Token Standard (RS256)

**Algorithm**: RS256 (RSA Signature with SHA-256)  
**Key Size**: 2048-bit minimum  
**Rotation**: Every 90 days (automated)

#### 3.1.1 Access Token Structure

```json
{
  "header": {
    "alg": "RS256",
    "typ": "JWT",
    "kid": "key-2025-11-13"
  },
  "payload": {
    "iss": "https://scholar-auth-jamarrlmayes.replit.app",
    "aud": "scholarship-platform",
    "sub": "user_12345",
    "email": "student@example.com",
    "roles": ["student"],
    "permissions": ["scholarships:read", "applications:write"],
    "iat": 1699891200,
    "exp": 1699892100,
    "jti": "token_abc123"
  }
}
```

#### 3.1.2 Required Claims

| Claim | Type | Required | Description |
|-------|------|----------|-------------|
| `iss` | string | ✅ | Issuer (scholar-auth URL) |
| `aud` | string | ✅ | Audience (scholarship-platform) |
| `sub` | string | ✅ | Subject (user ID) |
| `email` | string | ✅ | User email |
| `roles` | array | ✅ | User roles |
| `permissions` | array | ❌ | Fine-grained permissions (optional) |
| `iat` | number | ✅ | Issued at (Unix timestamp) |
| `exp` | number | ✅ | Expiration (Unix timestamp) |
| `jti` | string | ✅ | JWT ID (for revocation) |

### 3.2 RBAC Roles

#### 3.2.1 Standard Roles

| Role | Description | Granted To |
|------|-------------|------------|
| `student` | Student users | End users (B2C) |
| `provider` | Scholarship providers | Organizations (B2B) |
| `admin` | Platform administrators | Internal staff |
| `system_service` | Service-to-service | Backend microservices |
| `staff` | Customer support staff | Support team |

#### 3.2.2 Permission Scopes

**Format**: `{resource}:{action}`

**Examples**:
```
scholarships:read
scholarships:write
applications:read
applications:write
applications:admin
users:read
users:write
providers:admin
notifications:send
content:generate
```

### 3.3 JWKS Endpoint

**URL**: `https://scholar-auth-jamarrlmayes.replit.app/.well-known/jwks.json`

**Response Format**:
```json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "kid": "key-2025-11-13",
      "alg": "RS256",
      "n": "<modulus base64url>",
      "e": "AQAB"
    }
  ]
}
```

**Caching**: Services MUST cache JWKS responses for 1 hour minimum  
**Rotation**: Services MUST support multiple active keys during rotation

### 3.4 Service-to-Service Authentication

#### 3.4.1 OAuth2 Client Credentials Flow (Preferred)

**Grant Type**: `client_credentials`  
**Token Endpoint**: `https://scholar-auth-jamarrlmayes.replit.app/auth/token`

**Request**:
```http
POST /auth/token HTTP/1.1
Host: scholar-auth-jamarrlmayes.replit.app
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id=sage_service
&client_secret=<secret>
&scope=scholarship_api.read
```

**Response**:
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "scholarship_api.read"
}
```

#### 3.4.2 API Key Fallback (Temporary)

**Header**: `X-API-Key: <INTERNAL_API_KEY>`  
**Usage**: Only until OAuth2 client credentials fully deployed  
**Deprecation**: Target Nov 16, 2025

---

## IV. CORS Configuration

### 4.1 Backend Services CORS Policy

**Applies To**: scholar_auth, scholarship_api, scholarship_sage, auto_com_center, auto_page_maker

```javascript
// Express.js Example
const corsOptions = {
  origin: [
    process.env.STUDENT_PILOT_BASE_URL,
    process.env.PROVIDER_REGISTER_BASE_URL,
    'http://localhost:5000',  // Development only
    'http://127.0.0.1:5000'   // Development only
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Authorization',
    'Content-Type',
    'X-Request-ID',
    'X-API-Key'
  ],
  credentials: true,
  maxAge: 86400  // 24 hours
};

app.use(cors(corsOptions));
```

### 4.2 Development vs Production

**Development**:
- Allow `localhost` and `127.0.0.1`
- Log all CORS decisions for debugging

**Production**:
- ONLY allow explicit frontend origins
- Block all localhost/127.0.0.1 requests
- Log and alert on CORS violations

---

## V. Health Check Standards

### 5.1 Required Endpoint

**Path**: `/api/health`  
**Method**: GET  
**Authentication**: None (public)

### 5.2 Response Format

**Success (200 OK)**:
```json
{
  "service": "scholar_auth",
  "env": "production",
  "version": "1.2.3",
  "status": "healthy",
  "timestamp": "2025-11-13T17:00:00.000Z",
  "checks": {
    "db": {
      "status": "healthy",
      "latency_ms": 45
    },
    "auth_provider": {
      "status": "healthy",
      "latency_ms": 120
    }
  },
  "uptimeSeconds": 86400,
  "responseTime_ms": 50
}
```

**Degraded (200 OK with warnings)**:
```json
{
  "service": "scholarship_api",
  "status": "degraded",
  "timestamp": "2025-11-13T17:00:00.000Z",
  "checks": {
    "db": {
      "status": "healthy",
      "latency_ms": 45
    },
    "sage_api": {
      "status": "unhealthy",
      "error": "Connection timeout"
    }
  }
}
```

**Failure (503 Service Unavailable)**:
```json
{
  "service": "auto_com_center",
  "status": "unhealthy",
  "timestamp": "2025-11-13T17:00:00.000Z",
  "error": "Database connection failed"
}
```

### 5.3 Health Check Requirements

| Service | Critical Dependencies | Max Latency |
|---------|----------------------|-------------|
| scholar_auth | Database, Session Store | 100ms |
| scholarship_api | Database, scholar_auth JWKS | 120ms |
| student_pilot | scholarship_api | 80ms |
| provider_register | scholarship_api | 80ms |
| scholarship_sage | scholarship_api, OpenAI | 200ms |
| scholarship_agent | scholarship_api, auto_com_center | 150ms |
| auto_com_center | Database, Email/SMS providers | 120ms |
| auto_page_maker | Database | 100ms |

---

## VI. Structured Logging Standards

### 6.1 Log Format (JSON)

```json
{
  "timestamp": "2025-11-13T17:00:00.123Z",
  "level": "info|debug|warn|error",
  "service": "scholarship_api",
  "env": "production",
  "trace_id": "req_abc123",
  "span_id": "span_456",
  "user_id": "user_789",
  "method": "POST",
  "route": "/api/scholarships",
  "status": 201,
  "latency_ms": 145,
  "msg": "Scholarship created successfully",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid deadline date",
    "stack": "<only in non-prod>"
  }
}
```

### 6.2 Required Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `timestamp` | ISO 8601 | ✅ | Event timestamp |
| `level` | string | ✅ | Log level |
| `service` | string | ✅ | Service name |
| `env` | string | ✅ | Environment |
| `trace_id` | string | ✅ | Request correlation ID |
| `user_id` | string | ❌ | If authenticated |
| `method` | string | ✅ | HTTP method |
| `route` | string | ✅ | Route path |
| `status` | number | ✅ | HTTP status |
| `latency_ms` | number | ✅ | Response time |

### 6.3 PII Protection

**NEVER LOG**:
- Passwords (even hashed)
- JWT tokens (full value)
- API keys
- Social Security Numbers
- Credit card numbers
- Full email addresses in production (use masked: `u***@example.com`)

---

## VII. Error Response Standards

### 7.1 Standard Error Envelope

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      {
        "field": "email",
        "issue": "Must be a valid email address"
      }
    ],
    "request_id": "req_abc123",
    "timestamp": "2025-11-13T17:00:00.000Z"
  }
}
```

### 7.2 Error Taxonomy

| HTTP Code | Error Code | Usage |
|-----------|------------|-------|
| 400 | `VALIDATION_ERROR` | Invalid input data |
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Duplicate resource |
| 422 | `UNPROCESSABLE` | Semantic error |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |
| 503 | `SERVICE_UNAVAILABLE` | Dependency down |

---

## VIII. Runtime Validation

### 8.1 Boot-Time Environment Check

**Every service MUST**:
1. Validate all required environment variables exist
2. Fail fast with actionable error message
3. Log configuration summary (without secrets)

**Example (Node.js)**:
```javascript
const requiredEnvVars = [
  'NODE_ENV',
  'APP_BASE_URL',
  'AUTH_API_BASE_URL',
  'SCHOLARSHIP_API_BASE_URL',
  'DATABASE_URL'
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`FATAL: Missing required environment variable: ${varName}`);
    process.exit(1);
  }
});

console.log('✓ Environment validation passed');
console.log('Service:', process.env.SERVICE_NAME);
console.log('Environment:', process.env.NODE_ENV);
console.log('Base URL:', process.env.APP_BASE_URL);
```

### 8.2 Configuration Summary Endpoint

**Path**: `/api/config` (admin only)  
**Response**:
```json
{
  "service": "scholarship_api",
  "env": "production",
  "version": "1.2.3",
  "config": {
    "auth_url": "https://scholar-auth-jamarrlmayes.replit.app",
    "api_url": "https://scholarship-api-jamarrlmayes.replit.app",
    "frontend_origins": [
      "https://student-pilot-jamarrlmayes.replit.app",
      "https://provider-register-jamarrlmayes.replit.app"
    ],
    "features": {
      "mfa_enabled": true,
      "rate_limiting": true,
      "caching": true
    }
  }
}
```

---

## IX. Compliance Checklist

### 9.1 Pre-Deployment Checklist

- [ ] Zero hardcoded URLs in source code
- [ ] All inter-service URLs from environment variables
- [ ] Boot-time validation implemented
- [ ] CORS limited to frontend origins only
- [ ] JWT validation using JWKS endpoint
- [ ] RBAC roles and permissions enforced
- [ ] Structured logging with correlation IDs
- [ ] Health check endpoint implemented
- [ ] Error responses use standard envelope
- [ ] No secrets in logs or code
- [ ] Service-to-service auth configured

### 9.2 Code Review Requirements

**BLOCK MERGE IF**:
- Hardcoded URLs detected
- Secrets in source code
- Missing CORS configuration
- Missing health check endpoint
- PII logged without masking

---

## X. Migration Plan

### Phase 1: Foundation (Gate 0 - Nov 13)
- ✅ Environment variable standardization
- ✅ CORS configuration
- ✅ Health check implementation

### Phase 2: Authentication (Gate 1 - Nov 14)
- JWT RS256 implementation
- JWKS endpoint deployment
- Service-to-service OAuth2

### Phase 3: Integration (Gate 2-3 - Nov 15-16)
- All services using environment variables
- End-to-end auth flows tested
- Monitoring and alerting configured

### Phase 4: Production Hardening (Gate 4-5 - Nov 17-18)
- Security audit passed
- Load testing completed
- Rollback procedures verified

---

## XI. Support & Escalation

**Integration Lead**: Agent3 (auto_com_center DRI)  
**Escalation**: CEO for blocker decisions  
**War Room**: Daily standups at Gate checkpoints  
**Documentation**: This document is the single source of truth

**Last Updated**: 2025-11-13 17:00 UTC  
**Next Review**: 2025-11-18 (post-launch)
