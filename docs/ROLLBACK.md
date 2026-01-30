# ROLLBACK.md - A7 Telemetry Fix

**Incident ID:** INC-A8-FIX-AND-CONFIRM  
**Date:** 2026-01-04  
**App:** auto_page_maker (A7)

---

## Rollback Instructions

### Option 1: Git Revert

```bash
git revert HEAD
```

### Option 2: Manual Rollback

**File:** `server/lib/telemetry-client.ts`

#### Revert Line 5-8

```javascript
// MASTER FLEET GO-LIVE PROMPT v3.4.1: Primary endpoint is /events
const COMMAND_CENTER_BASE = process.env.COMMAND_CENTER_BASE || 'https://auto-com-center-jamarrlmayes.replit.app';
// Try /events first per v3.4.1, fallback to /api/events, /ingest, then /api/report for backward compatibility
const COMMAND_CENTER_ENDPOINTS = ['/events', '/api/events', '/ingest', '/api/report'];
```

#### Revert Lines 417-418

```javascript
    // MASTER FLEET GO-LIVE v3.5.1: Send to Command Center with endpoint fallbacks
    // Try /events, /api/events, /ingest in sequence
```

### Option 3: Environment Variable Override

If urgent, bypass the fix without code changes:

```bash
# Set specific endpoint to skip fallback chain entirely
export COMMAND_CENTER_URL='https://auto-com-center-jamarrlmayes.replit.app/ingest'
```

**Note:** This is NOT recommended as A8 rejects `/ingest` with 403.

---

## Verification After Rollback

```bash
curl http://localhost:5000/api/probes
```

Expected: `{"status":"healthy"}`

---

## Risk Assessment

| Action | Risk | Impact |
|--------|------|--------|
| Keep fix | None | A7 telemetry works reliably |
| Rollback | Medium | A7 will waste retries on rejected /ingest endpoint |
