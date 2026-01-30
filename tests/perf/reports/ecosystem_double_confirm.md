# Ecosystem Double Confirmation Matrix
## RUN_ID: CEOSPRINT-20260123-EXEC-ZT3G-FIX-AUTH-009

### Confirmation Sources
- HTTP: Direct curl probe with X-Trace-Id
- Logs: Application logs (where accessible)
- A8: Telemetry event round-trip

| App | Component | HTTP | Logs | A8 | Verdict |
|-----|-----------|------|------|-----|---------|
| A1 | /health | ✅ 200 | N/A | N/A | PASS |
| A1 | S256 in discovery | ✅ Present | N/A | N/A | PASS |
| A1 | provider-register redirect | ❌ 400 | N/A | N/A | **FAIL** |
| A5 | /health | ✅ 200 | N/A | N/A | PASS |
| A5 | /api/auth/login | ❌ 404 | N/A | N/A | **FAIL** |
| A6 | /health | ✅ 200 | N/A | N/A | PASS |
| A6 | PKCE in redirect | ❌ Missing | N/A | N/A | **FAIL** |
| A7 | /api/health | ✅ 200 | ✅ | ✅ | PASS (3/3) |
| A8 | Event ingestion | ✅ Accepted | N/A | ✅ | PASS |

### Blocking Issues
1. A1: Client registry has wrong redirect_uris for provider-register
2. A5: /api/auth/login route does not exist
3. A6: Login redirect missing PKCE code_challenge
