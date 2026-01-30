# auto_com_center Production Publish Instructions

**CEO GO Directive Received**: 2025-11-01T02:00:00Z  
**DRI**: auto_com_center Lead (Comms DRI)  
**SLA**: T+5 min publish confirmation, T+15 min evidence bundle

---

## ⚠️ CRITICAL: MANUAL ACTION REQUIRED

Agent3 cannot click the "Publish" button in Replit UI. **You must execute this manually.**

---

## STEP 1: PUBLISH TO PRODUCTION (T+0 to T+5)

### Actions:
1. **Navigate to**: https://replit.com/@jamarrlmayes/workspace
2. **Click**: "Deployments" tab (left sidebar)
3. **Click**: "Publish" button (or "Redeploy" if already published)
4. **Wait**: 3-5 minutes for deployment to complete
5. **Confirm**: Build ID and deployment timestamp

### Post to War-Room (T+5):
```
auto_com_center: PUBLISHED ✅
Build ID: <from Replit>
Timestamp: <YYYY-MM-DDTHH:MM:SSZ>
Status: Dry-run mode enabled, proceeding to verification
```

---

## STEP 2: RUN VERIFICATION SCRIPT (T+5 to T+15)

### Execute Verification:
```bash
# From workspace directory
./verify_auto_com_center_production.sh
```

**This script will:**
1. ✅ Verify /canary v2.7 (8 fields, version, dependencies_ok)
2. ✅ Check security headers (6/6)
3. ✅ Measure P95 latency (30 samples, target ≤120ms)
4. ✅ Test scholar_auth JWKS reachability (may be degraded if Gate 1 not GREEN)
5. ✅ Validate M2M token flow (may be blocked if Gate 1 not GREEN)
6. ✅ Post 2 synthetic events (deadline_approaching, new_match_found)
7. ✅ Check delivery provider health (Email/SMS in dry-run)
8. ✅ Validate kill-switch (DISABLE_SEND=true)

**Output:** Evidence file `auto_com_center_evidence_<timestamp>.log`

---

## STEP 3: POST EVIDENCE BUNDLE (T+15)

### Upload to War-Room:
```
auto_com_center: Evidence Bundle Submitted

Canary v2.7: ✅ GREEN
- 8 fields present
- version="v2.7"
- dependencies_ok=true
- security_headers: 6/6 present
- P95: <X>ms (≤120ms target)

Auth/JWKS Reachability:
- [✅ GREEN | ⚠️ DEGRADED - pending Gate 1]
- Note: <details if degraded>

M2M Token Flow:
- [✅ GREEN | ⚠️ BLOCKED - pending Gate 1]
- Note: <details if blocked>

Event Ingestion: ✅ GREEN
- 2 synthetic events posted
- Queue status: stable
- Templates rendered in dry-run

Delivery Providers: ✅ GREEN
- Email/SMTP: health check passing (dry-run)
- SMS gateway: health check passing (dry-run)
- Credentials verified
- Throttling active

Kill-Switch: ✅ GREEN
- DISABLE_SEND=true
- Dry-run mode ENABLED
- No external sends will occur

Overall Status: auto_com_center GREEN (dry-run)
Evidence file: <attach log file>
```

---

## PRODUCTION CONSTRAINTS (FIRST 48 HOURS)

### Feature Flags (MUST BE SET):
```bash
DISABLE_SEND=true              # No actual message delivery
PROMO_SENDS=false             # No promotional campaigns
RETRIES_ENABLED=true          # Retry logic active
RATE_LIMIT_ENABLED=true       # 10 msgs/min cap
```

### Mode:
- **Dry-run ONLY** for first 48 hours
- **Transactional templates** permitted in dry-run
- **No promotional** sends
- **Receive-and-queue** mode until Gate 1 (scholar_auth) GREEN

### Security:
- ✅ JWT validation enforced on all inbound events
- ✅ No bypasses permitted
- ✅ If Gate 1 not GREEN: remain in receive-and-queue (no dispatch)

### Observability:
- ✅ Request/queue metrics enabled
- ✅ Error budget tracking active
- ✅ Structured logs at INFO level
- ✅ WARN level on delivery failures

---

## ROLLBACK CRITERIA (IMMEDIATE PAUSE)

**Any ONE of these triggers immediate pause:**

| Trigger | Threshold | Action |
|---------|-----------|--------|
| 5xx errors | ≥1% over 5 minutes | DISABLE_SEND=true, pause consumers |
| JWT validation failures | ≥2% over 5 minutes | Pause event ingestion, revert deployment |
| Queue depth | >2x baseline for 10 min | Pause consumers, investigate |
| P95 latency | >300ms for 5 minutes | Toggle DISABLE_SEND=true, investigate |

**Incident Response:**
1. Toggle DISABLE_SEND=true immediately
2. Pause event consumers
3. Revert to last stable deployment
4. Post incident note in war-room within 10 minutes

---

## COORDINATION WITH PLATFORM GATES

### Gate 1 (scholar_auth):
- **Publish**: Independent (proceed now)
- **Full functionality**: Requires Gate 1 GREEN
- **If Gate 1 not GREEN yet**:
  - ✅ Publish proceeds
  - ✅ Remain in receive-and-queue mode
  - ✅ No token validation (queued for later)
  - **Action**: Rerun auth/token tests when Gate 1 flips GREEN

### Gate 2 (scholarship_api):
- **Does not block** auto_com_center publish
- **Action**: Quick canary pull when Gate 2 flips GREEN to validate event schema compatibility

---

## WAR-ROOM UPDATE CADENCE

| Time | Update Required |
|------|-----------------|
| T+5 min | Publish confirmation + Build ID |
| T+15 min | Evidence bundle + status GREEN (dry-run) |
| Hourly (first 6h) | SLO metrics, queue depth, any issues |
| Every 4h (48h window) | Condensed status update |
| **Immediate** | Any threshold breach or incident |

---

## SLO MONITORING (FIRST 48 HOURS)

### Targets:
- **Uptime**: ≥99.9%
- **5xx errors**: <0.5%
- **P95 latency**: ≤120ms
- **Auth success**: ≥98%
- **Queue depth**: Stable (no sustained growth)
- **DLQ ratio**: <0.5%

### Metrics to Track:
1. Event ingestion rate (events/min)
2. Queue depth over time
3. Template render latency
4. Delivery provider health checks
5. Error rates by type (validation, auth, provider)

---

## DEVELOPMENT BASELINE (Reference)

**From development environment:**
```json
{
  "app": "auto_com_center",
  "version": "v2.7",
  "status": "ok",
  "p95_ms": 0,
  "security_headers": {
    "present": ["strict-transport-security", "content-security-policy", 
                "x-frame-options", "x-content-type-options", 
                "referrer-policy", "permissions-policy"],
    "missing": []
  },
  "dependencies_ok": true
}
```

**Expected production to match or exceed these metrics.**

---

## TROUBLESHOOTING

### Problem: Verification script fails

**Symptom**: Script errors or timeouts  
**Cause**: Production deployment not complete or endpoints not responding  
**Fix**: Wait 2-3 additional minutes, retry script

### Problem: JWKS reachability degraded

**Symptom**: Auth check returns 308/404/500  
**Cause**: Gate 1 (scholar_auth) not GREEN yet  
**Fix**: Document as "pending Gate 1", rerun after Gate 1 flips GREEN

### Problem: M2M token blocked

**Symptom**: Token acquisition returns 401/403  
**Cause**: Gate 1 not GREEN (expected behavior)  
**Fix**: Document as "expected block", rerun after Gate 1 GREEN

### Problem: Dry-run mode DISABLED

**Symptom**: Verification shows DISABLE_SEND=false  
**Cause**: Environment variable not set correctly  
**Fix**: IMMEDIATE ROLLBACK - external sends may occur!

---

## SUCCESS CRITERIA

**Production auto_com_center is GREEN when:**
- ✅ /canary returns v2.7 with 8 fields
- ✅ 6/6 security headers present
- ✅ P95 ≤120ms (30-sample baseline)
- ✅ Dry-run mode ENABLED (DISABLE_SEND=true)
- ✅ Event queue operational
- ✅ Delivery providers healthy (dry-run)
- ✅ Kill-switch validated

**If Gate 1 not GREEN yet:**
- ⚠️ Auth/JWKS: Document as "degraded - pending Gate 1"
- ⚠️ M2M tokens: Document as "blocked - pending Gate 1"
- ✅ All other checks must pass

---

## RATIONALE (Prime Directive Alignment)

**Reliable transactional communications** are foundational to:
- **Trust**: Students and providers expect timely notifications
- **Conversion**: Deadline reminders drive application completion
- **CAC**: Organic engagement reduces paid acquisition needs
- **SLOs**: Platform reliability depends on communication infrastructure

**Dry-run mode protects:**
- **Revenue risk**: Zero revenue impact until full validation
- **Compliance**: No accidental SPAM/regulatory violations
- **Trust**: No user complaints from errant sends

**This publish removes final blocker to FOC for auto_com_center without introducing risk.**

---

**EXECUTE NOW: Click "Publish" in Replit and run verification script within 15 minutes.**

**END OF INSTRUCTIONS**
