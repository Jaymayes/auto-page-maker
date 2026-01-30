# DIFF_SUMMARY.md - A7 Telemetry Fix

**Incident ID:** INC-A8-FIX-AND-CONFIRM  
**Date:** 2026-01-04  
**App:** auto_page_maker (A7)

---

## File Changed

**File:** `server/lib/telemetry-client.ts`

### Change 1: Remove /ingest from Endpoint Array (Lines 5-8)

```diff
-// MASTER FLEET GO-LIVE PROMPT v3.4.1: Primary endpoint is /events
+// MASTER FLEET GO-LIVE PROMPT v3.5.1: Primary endpoint is /events
 const COMMAND_CENTER_BASE = process.env.COMMAND_CENTER_BASE || 'https://auto-com-center-jamarrlmayes.replit.app';
-// Try /events first per v3.4.1, fallback to /api/events, /ingest, then /api/report for backward compatibility
-const COMMAND_CENTER_ENDPOINTS = ['/events', '/api/events', '/ingest', '/api/report'];
+// v3.5.1: /ingest is deprecated and rejected by A8; use /events, /api/events, /api/report only
+const COMMAND_CENTER_ENDPOINTS = ['/events', '/api/events', '/api/report'];
```

### Change 2: Update Comment in flush() Method (Lines 417-418)

```diff
     // MASTER FLEET GO-LIVE v3.5.1: Send to Command Center with endpoint fallbacks
-    // Try /events, /api/events, /ingest in sequence
+    // v3.5.1: Try /events, /api/events, /api/report (legacy /ingest removed)
```

---

## Rationale

1. A8 (Command Center) rejects `/ingest` with 403 MISSING_TOKEN
2. Keeping `/ingest` in fallback chain causes unnecessary retry attempts
3. v3.5.1 protocol specifies `/events` as primary endpoint
4. Comments updated to prevent future regressions

---

## No Other Files Modified

This fix is isolated to the telemetry client. No changes to:
- Routes
- Probes
- Frontend components
- Database schema
