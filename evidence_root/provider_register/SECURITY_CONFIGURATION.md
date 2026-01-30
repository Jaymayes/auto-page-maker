# Security Configuration - provider_register
**DRI**: Agent3  
**Last Updated**: 2025-11-13 02:30 UTC  
**Criticality**: HIGH

---

## Overview
This document outlines interim security measures for provider_register audit log access until full RBAC integration from scholar_auth is available.

---

## Audit Log Access Control

### Endpoint Protection
**Endpoint**: `GET /api/business-events`  
**Protection Level**: Admin-only  
**Enforcement**: Server-side email allow-list (fail closed)

### Implementation
```typescript
// server/routes.ts
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim())
  .filter(Boolean);

const isAdmin = ADMIN_EMAILS.length > 0 && ADMIN_EMAILS.includes(userEmail);

if (!isAdmin) {
  return res.status(403).json({ 
    message: "Forbidden: Admin access required for audit logs",
    code: "INSUFFICIENT_PRIVILEGES"
  });
}
```

---

## Required Environment Variable

### ADMIN_EMAILS
**Type**: Comma-separated email list  
**Required**: YES (for audit log access)  
**Example**: `admin@company.com,ceo@company.com,ops@company.com`  
**Default**: Empty string (no admins = no audit log access)

**Setting the variable**:
```bash
# In Replit Secrets tab, add:
ADMIN_EMAILS=your-admin-email@company.com

# For multiple admins:
ADMIN_EMAILS=admin1@company.com,admin2@company.com,admin3@company.com
```

**Security**: 
- Fail closed: If `ADMIN_EMAILS` is empty or not set, NO users can access audit logs
- Email matching is case-sensitive (use lowercase)
- Requires exact match (no wildcard or domain matching)

---

## Access Scenarios

### Scenario 1: Admin User Access
**User**: admin@company.com (in ADMIN_EMAILS allow-list)  
**Flow**:
1. User authenticates via Replit Auth
2. Navigates to `/admin/audit-logs`
3. Frontend queries `/api/auth/user` (authenticated)
4. Frontend fetches `/api/business-events`
5. Backend checks: `userEmail in ADMIN_EMAILS` → **PASS**
6. Audit logs displayed

**Result**: ✅ ACCESS GRANTED

---

### Scenario 2: Regular User Access
**User**: student@university.edu (NOT in ADMIN_EMAILS allow-list)  
**Flow**:
1. User authenticates via Replit Auth
2. Navigates to `/admin/audit-logs`
3. Frontend queries `/api/auth/user` (authenticated)
4. Frontend fetches `/api/business-events`
5. Backend checks: `userEmail in ADMIN_EMAILS` → **FAIL**
6. Backend returns HTTP 403 Forbidden
7. Frontend displays "Access Denied" message

**Result**: ❌ ACCESS DENIED (403)

**Server Log**:
```
[SECURITY] Audit log access denied for user abc-123 (student@university.edu)
```

---

### Scenario 3: Unauthenticated User Access
**User**: Anonymous (not logged in)  
**Flow**:
1. User attempts to navigate to `/admin/audit-logs`
2. Frontend queries `/api/auth/user` → **FAIL** (401 Unauthorized)
3. Frontend redirects to `/register`
4. User never reaches audit logs

**Result**: ❌ REDIRECT TO LOGIN

---

### Scenario 4: ADMIN_EMAILS Not Configured
**Configuration**: `ADMIN_EMAILS` environment variable is empty or not set  
**User**: ANY authenticated user (including intended admins)  
**Flow**:
1. User authenticates via Replit Auth
2. Navigates to `/admin/audit-logs`
3. Frontend fetches `/api/business-events`
4. Backend checks: `ADMIN_EMAILS.length > 0` → **FALSE**
5. Backend returns HTTP 403 Forbidden (fail closed)

**Result**: ❌ ACCESS DENIED FOR ALL USERS

**Security Rationale**: Fail-closed design ensures audit logs are never accidentally exposed if admin list is misconfigured.

---

## Frontend Protection

### Authentication Check
**Component**: `client/src/pages/admin-audit-logs.tsx`  
**Protection**: Query-based redirect

```typescript
const { data: user, isLoading, error } = useQuery({
  queryKey: ['/api/auth/user'],
  retry: false,
});

useEffect(() => {
  if (!isLoading && (error || !user)) {
    setLocation('/register'); // Redirect to login
  }
}, [user, isLoading, error]);
```

**Limitations**:
- Client-side only (bypassable with DevTools)
- **Relies on server-side enforcement** (backend is source of truth)
- Provides UX convenience, NOT security

---

## Security Audit Log

All unauthorized access attempts are logged server-side:

```typescript
console.warn(`[SECURITY] Audit log access denied for user ${userId} (${userEmail})`);
```

**Log Format**:
```
[SECURITY] Audit log access denied for user abc-123-def-456 (student@university.edu)
```

**Use Cases**:
- Detect access violation attempts
- Identify compromised accounts
- Audit compliance verification

---

## Upgrade Path: Full RBAC Integration

### Current State (Interim)
- Email allow-list via `ADMIN_EMAILS` environment variable
- Server-side enforcement at API route level
- Manual configuration required

### Target State (Post-scholar_auth)
- Role-based access control (RBAC) with `admin` role claim
- Centralized role management via scholar_auth
- Automatic synchronization with identity provider

### Migration Plan (Task PB4)
1. ✅ **COMPLETE**: Interim email allow-list (current implementation)
2. ⏳ **PENDING**: Await scholar_auth RBAC evidence (Gate C)
3. ⏳ **PENDING**: Replace `ADMIN_EMAILS` check with role claim:
   ```typescript
   const userRoles = req.user?.claims?.roles || [];
   const isAdmin = userRoles.includes('admin');
   ```
4. ⏳ **PENDING**: Remove `ADMIN_EMAILS` environment variable
5. ⏳ **PENDING**: Update documentation to reflect role-based access

**Estimated Migration**: Nov 13-14, pending scholar_auth evidence delivery

---

## Testing

### Unit Test Scenarios
1. **Authenticated admin** (in allow-list) → HTTP 200 + audit logs returned
2. **Authenticated non-admin** → HTTP 403 + error message
3. **Unauthenticated user** → HTTP 401 + authentication required
4. **Empty ADMIN_EMAILS** → HTTP 403 for all users (fail closed)

### Integration Test
```typescript
// Test: Admin access granted
const adminEmail = 'admin@company.com';
process.env.ADMIN_EMAILS = adminEmail;
const res = await request(app)
  .get('/api/business-events')
  .set('Authorization', `Bearer ${adminToken}`)
  .expect(200);
expect(res.body).toBeInstanceOf(Array);

// Test: Non-admin access denied
const studentEmail = 'student@university.edu';
const res2 = await request(app)
  .get('/api/business-events')
  .set('Authorization', `Bearer ${studentToken}`)
  .expect(403);
expect(res2.body.code).toBe('INSUFFICIENT_PRIVILEGES');
```

---

## Deployment Checklist

Before deploying to production, ensure:

1. ✅ `ADMIN_EMAILS` environment variable is configured in Replit Secrets
2. ✅ At least one admin email is listed (CEO, CTO, or designated admin)
3. ✅ Admin emails match Replit Auth email claims exactly
4. ✅ Server logs are monitored for `[SECURITY]` warnings
5. ✅ Frontend redirects unauthenticated users to `/register`
6. ✅ Backend returns 403 for unauthorized users (not 401)

---

## Security Posture

**Strengths**:
- ✅ Fail-closed design (no admin list = no access)
- ✅ Server-side enforcement (not client-side only)
- ✅ Explicit deny logging for audit trail
- ✅ Frontend UX prevents accidental navigation
- ✅ Separation of authentication (Replit Auth) and authorization (ADMIN_EMAILS)

**Limitations** (Interim Solution):
- ⚠️ Manual email list management (no centralized UI)
- ⚠️ No granular permissions (admin = full audit log access)
- ⚠️ Environment variable updates require redeployment
- ⚠️ No self-service admin onboarding workflow

**Risk Level**: **MEDIUM** (acceptable for Private Beta with monitoring)

---

## Incident Response

### Scenario: Unauthorized Access Attempt
**Detection**: Server logs show `[SECURITY] Audit log access denied`  
**Action**:
1. Review user email and ID from log entry
2. Verify if user should have admin access
3. If legitimate: Add email to `ADMIN_EMAILS` and redeploy
4. If malicious: Investigate account compromise, revoke session

### Scenario: Admin Email Misconfigured
**Detection**: Legitimate admin cannot access audit logs  
**Symptoms**: HTTP 403 error, "Access Denied" message  
**Action**:
1. Verify `ADMIN_EMAILS` environment variable in Replit Secrets
2. Check for typos, extra spaces, or case mismatches
3. Update variable and restart workflow
4. Test access with corrected email

---

## Contact Information

**DRI**: Agent3  
**Security Escalation**: CEO (via Slack #incidents)  
**RBAC Integration**: Pending scholar_auth (Gate C, Agent TBD)

---

**Status**: INTERIM SOLUTION - Approved for Private Beta  
**Expiration**: Replace with full RBAC by Nov 14-15 (post-scholar_auth evidence)  
**Review Cadence**: Daily during beta (first 72 hours), weekly thereafter
