# HAR Capture Instructions - Auth DRI (1-Hour SLA)

**Deadline:** T+1h from CEO directive  
**Owner:** Auth DRI  
**Purpose:** Prove OAuth client registration working at production URLs

---

## What is a HAR File?

HAR (HTTP Archive) is a JSON-formatted log of all network requests made by your browser. It captures:
- Request URLs
- Request/response headers
- Request/response bodies
- Timing information
- Cookies
- Redirects

For OAuth flows, it shows the complete authorization_code exchange including tokens.

---

## Step-by-Step Instructions

### Part 1: student_pilot OAuth Flow

**1. Open Browser DevTools (F12)**
- Chrome: F12 or right-click → Inspect
- Edge: F12 or right-click → Inspect
- Firefox: F12 or right-click → Inspect Element

**2. Navigate to Network Tab**
- Click "Network" tab in DevTools
- ✅ Check "Preserve log" (important - keeps logs across redirects)
- ✅ Ensure recording is ON (red circle button should be active)
- Clear existing logs (trash icon)

**3. Execute OAuth Flow**
- In the address bar, navigate to: `https://student-pilot-jamarrlmayes.replit.app/api/login`
- **Do NOT close DevTools during this process**
- You will be redirected to Replit OIDC authorization page
- Authorize the application (or it may auto-authorize if already logged in)
- You should land back on student-pilot homepage (logged in state)

**4. Verify Flow Completed**
- Check Network tab for these requests:
  - `/api/login` (initial request)
  - Replit authorization endpoint (`replit.com/oidc/authorize`)
  - `/api/callback?code=...` (callback with authorization code)
  - Look for responses containing `access_token` and `refresh_token`

**5. Export HAR**
- Right-click anywhere in Network tab
- Select "Save all as HAR with content"
- Save as: `student_pilot_oauth_flow.har`
- Location: Desktop or Downloads folder

---

### Part 2: provider_register OAuth Flow

**Repeat the same process:**

**1. Clear Network Tab**
- Click trash icon to clear previous logs
- Ensure "Preserve log" is still checked

**2. Navigate to provider_register**
- Go to: `https://provider-register-jamarrlmayes.replit.app/api/login`
- Complete OAuth flow
- Wait for redirect to homepage

**3. Export HAR**
- Right-click in Network tab
- "Save all as HAR with content"
- Save as: `provider_register_oauth_flow.har`

---

## What to Look for in HAR (Verification)

### Successful OAuth Flow Should Contain:

**1. Initial Login Request**
```
GET /api/login
Host: student-pilot-jamarrlmayes.replit.app
```

**2. Authorization Redirect**
```
GET /oidc/authorize?client_id=...&redirect_uri=...&scope=openid+email+profile+offline_access
Host: replit.com
```

**3. Callback with Code**
```
GET /api/callback?code=AUTHORIZATION_CODE&state=...
Host: student-pilot-jamarrlmayes.replit.app
```

**4. Token Exchange (in response to callback)**
Look for response containing:
```json
{
  "access_token": "eyJhbGci...",
  "id_token": "eyJhbGci...",
  "refresh_token": "eyJhbGci...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

**5. Session Cookie Set**
```
Set-Cookie: connect.sid=...; HttpOnly; Secure; Path=/
```

---

## Troubleshooting

### If You See Errors:

**Error: "Redirect URI mismatch"**
- Means REPLIT_DOMAINS is not configured correctly
- Check environment variable on production Repl
- Should be: `student-pilot-jamarrlmayes.replit.app` (no comma-separated list)

**Error: "Client not found"**
- REPL_ID environment variable missing or incorrect
- Should be auto-provided by Replit platform

**Error: "Invalid scope"**
- Check that scopes include: openid, email, profile, offline_access
- See server/replitAuth.ts line 93

**No redirect happens:**
- Check that you're at the production URL (not localhost)
- Ensure workflow is running (app must be live)
- Check browser console for JavaScript errors

---

## What to Submit

**Deliverables (1-hour SLA):**

1. ✅ `student_pilot_oauth_flow.har` - Complete OAuth flow from login to authenticated state
2. ✅ `provider_register_oauth_flow.har` - Same for provider app
3. ✅ Brief summary:
   - "Both flows completed successfully - user authenticated and redirected to homepage"
   - OR "Error encountered: [describe error]"

**Optional but helpful:**
- Screenshot of Network tab showing key requests
- Screenshot of successful homepage after login (showing logged-in state)
- Any console errors if flow failed

---

## Security Note

**HAR files contain sensitive data:**
- Authentication tokens
- Session cookies
- Personal information from OAuth claims

**DO NOT:**
- Share HAR files publicly
- Commit to Git repositories
- Post in public Slack channels

**DO:**
- Share directly with CEO/designated reviewer
- Delete after review complete
- Redact if sharing for troubleshooting

---

## Alternative: Use Existing Logs

If you've recently logged into student_pilot or provider_register:

**Option 1: Extract from Production Logs**
1. Access production Repl console
2. Search for `/api/callback` requests
3. Look for successful token exchange logs
4. Copy log excerpts showing access_token + refresh_token

**Option 2: Test in Private/Incognito Window**
- Forces fresh OAuth flow
- Cleaner HAR capture (no existing sessions)
- Recommended approach

---

## Expected Timeline

**Total Time: ~10-15 minutes**

- DevTools setup: 2 min
- student_pilot OAuth flow: 3-5 min
- Export HAR: 1 min
- provider_register OAuth flow: 3-5 min
- Export HAR: 1 min
- Verification: 2-3 min

**Deadline: T+1h from CEO directive**

---

## After HAR Capture

**Immediate unblocks:**
- ✅ Auth DRI 1-hour deliverable COMPLETE
- ✅ Gate 1 moves to full GREEN
- ✅ Frontend DRI can start student_pilot E2E testing
- ✅ B2B DRI can prepare RBAC evidence
- ✅ B2C DRY-RUN GO becomes APPROVED (no longer contingent)

**Next steps:**
- Frontend DRI: 2-hour clock starts for student_pilot E2E harness
- Platform team: Monitor for issues during initial pilot cohort (20 students)
- Comms DRI: Complete DRY-RUN validation by T+6h

---

**START NOW - 1-HOUR SLA ACTIVE**

This is the critical path blocker for B2C DRY-RUN launch.
