# Hybrid Prompt Architecture - Deployment Guide
**Option C: Keep Separate Files + Add Universal Prompt with Feature Flag**

## Executive Summary

Successfully implemented hybrid prompt architecture to support the 72-hour revenue goal while establishing a single source of truth for future scaling.

### What Was Delivered

✅ **Universal Prompt File** (`docs/system-prompts/universal.prompt`)
- Single source of truth with [SHARED] + 8 app overlays
- Runtime overlay selection based on `app_key`
- 1,789 characters total

✅ **Feature Flag System** (`PROMPT_MODE` environment variable)
- `separate` (default): Load shared + app-specific files
- `universal`: Load from universal.prompt with runtime selection

✅ **Enhanced System Prompt Loader** (`server/lib/system-prompt-loader.ts`)
- `loadSeparatePrompt()`: Original behavior (Week 1 apps)
- `loadUniversalPrompt()`: Runtime overlay extraction
- `extractOverlay()`: Parse [SHARED] + [APP: X] sections
- `getOverlayContent()`: Debug utility for overlay inspection

✅ **New API Endpoints**
- `GET /api/prompts/universal?app=X` - Force universal mode test
- `GET /api/prompts/overlay/:app` - Extract specific overlay
- `GET /api/prompts/verify` - Now shows `mode` in response

✅ **Backward Compatibility**
- All existing per-app prompts still work (Week 1 ready)
- No breaking changes to instrumentation guides
- Gradual rollout per app via feature flag

---

## Architecture Comparison

### Before (Separate Files Only)
```
docs/system-prompts/
├── shared_directives.prompt
├── executive_command_center.prompt
├── student_pilot.prompt
├── provider_register.prompt
└── ...8 files total
```

**Load Pattern:**
```typescript
const shared = await readFile('shared_directives.prompt');
const app = await readFile(`${appName}.prompt`);
const combined = shared + app;
```

### After (Hybrid)
```
docs/system-prompts/
├── shared_directives.prompt       # Still used in 'separate' mode
├── universal.prompt                # NEW: Single source of truth
├── executive_command_center.prompt # Still used in 'separate' mode
├── student_pilot.prompt
└── ...9 files total
```

**Load Pattern (Mode-Aware):**
```typescript
const mode = process.env.PROMPT_MODE || 'separate';

if (mode === 'universal') {
  const universal = await readFile('universal.prompt');
  const combined = extractOverlay(universal, appName);
} else {
  const shared = await readFile('shared_directives.prompt');
  const app = await readFile(`${appName}.prompt`);
  const combined = shared + app;
}
```

---

## Rollout Timeline (T+0 to T+72h)

### T+0 (NOW) - Infrastructure Complete ✅
- [x] Create `universal.prompt` with all 8 app overlays
- [x] Update `system-prompt-loader.ts` with feature flag support
- [x] Add `/api/prompts/universal` and `/api/prompts/overlay/:app` endpoints
- [x] Test universal loading for executive_command_center
- [x] Verify overlay extraction for student_pilot

**Status:** PROMPT_MODE=separate (default) - all apps use existing files

### T+0 to T+24h - Week 1 Apps (Revenue Critical)
**Keep separate mode** for these apps:
- Student Pilot
- Provider Register
- Scholarship API

**Reason:** Implementation guides already distributed, teams instrumenting events NOW. Don't change horses mid-race.

**Action:** Monitor business_events table for first revenue events

### T+24h to T+48h - Test Universal Mode
**Pilot apps:** Scholarship API and Scholarship Agent
1. Set `PROMPT_MODE=universal` for these two apps only
2. Verify prompts load correctly: `GET /api/prompts/:app` shows `mode: "universal"`
3. Confirm all must-emit events still work
4. Check KPI collector still reads events correctly

**Acceptance:** No errors in logs, events flowing to business_events table

### T+48h to T+72h - Expand Universal Mode
**Enable for:** Student Pilot, Provider Register
1. Set `PROMPT_MODE=universal`
2. Verify `revenue_usd` and `fee_usd` calculations unchanged
3. Confirm daily KPI brief at 09:00 UTC includes real revenue
4. Test Slack notifications deliver successfully

**Acceptance:** First non-zero revenue report confirms CEO directive success

### Week 2+ - Full Universal Migration
**Remaining apps:** Auto Page Maker, Scholar Auth, Scholarship Sage
1. Enable `PROMPT_MODE=universal` per app
2. Deprecate separate prompt files (keep as fallback)
3. Make universal.prompt canonical editing surface
4. Auto-generate separate files from universal for team readability

---

## API Endpoints Reference

### 1. List All Prompts
```bash
GET /api/prompts
```

**Response:**
```json
{
  "success": true,
  "prompts": [
    {"app": "executive_command_center", "hash": "e64c9e34c2e1e547", "exists": true},
    {"app": "student_pilot", "hash": "...", "exists": true},
    ...
  ]
}
```

### 2. Get Single App Prompt Metadata
```bash
GET /api/prompts/:app
```

**Example:**
```bash
curl http://localhost:5000/api/prompts/executive_command_center
```

**Response:**
```json
{
  "app": "executive_command_center",
  "promptHash": "e64c9e34c2e1e547",
  "activeVersion": "workspace",
  "loadedAt": "2025-10-27T23:09:49.206Z",
  "mode": "separate"
}
```

### 3. Test Universal Mode Loading
```bash
GET /api/prompts/universal?app={appName}
```

**Example:**
```bash
curl 'http://localhost:5000/api/prompts/universal?app=student_pilot'
```

**Response:**
```json
{
  "app": "student_pilot",
  "promptHash": "a09a099f44c20cb4",
  "activeVersion": "workspace",
  "loadedAt": "2025-10-28T02:53:15.123Z",
  "mode": "universal",
  "contentPreview": "[SHARED]...",
  "fullLength": 1014
}
```

### 4. Extract Specific Overlay (Debug)
```bash
GET /api/prompts/overlay/:app
```

**Example:**
```bash
curl http://localhost:5000/api/prompts/overlay/provider_register
```

**Response:**
```json
{
  "app": "provider_register",
  "overlayContent": "[SHARED]\n\nCompany context...\n\n---\n\n[APP: provider_register]\n\nScope: provider onboarding...",
  "length": 1022
}
```

### 5. Verify All Prompts Load Correctly
```bash
GET /api/prompts/verify
```

**Response:**
```json
{
  "success": true,
  "mode": "separate",
  "totalPrompts": 8,
  "prompts": [...],
  "message": "All prompts verified successfully"
}
```

---

## Feature Flag Configuration

### Environment Variable: `PROMPT_MODE`

**Values:**
- `separate` (default): Use existing per-app files
- `universal`: Use universal.prompt with runtime selection

**Per-App Override:**
```bash
# Executive Command Center
PROMPT_MODE=universal npm run dev

# Student Pilot (separate repo)
PROMPT_MODE=separate npm run dev
```

**Production (.env):**
```bash
# Week 1: All apps use separate
PROMPT_MODE=separate

# Week 2: Pilot apps use universal
PROMPT_MODE=universal  # Only for scholarship_api, scholarship_agent

# Week 3+: All apps migrate to universal
PROMPT_MODE=universal
```

---

## Testing Universal Mode

### Step 1: Verify File Exists
```bash
ls -lh docs/system-prompts/universal.prompt
# Expected: ~1.8KB file
```

### Step 2: Test Overlay Extraction
```bash
curl 'http://localhost:5000/api/prompts/overlay/executive_command_center' | jq .
```

**Expected:**
```json
{
  "app": "executive_command_center",
  "overlayContent": "[SHARED]...[APP: executive_command_center]...",
  "length": 1014
}
```

### Step 3: Test Universal Loading
```bash
curl 'http://localhost:5000/api/prompts/universal?app=student_pilot' | jq .
```

**Expected:**
```json
{
  "app": "student_pilot",
  "mode": "universal",
  "promptHash": "a09a099f44c20cb4",
  "fullLength": 1014
}
```

### Step 4: Switch Mode and Verify
```bash
# Set universal mode
export PROMPT_MODE=universal

# Restart app
npm run dev

# Check endpoint
curl http://localhost:5000/api/prompts/executive_command_center
```

**Expected `mode` field:**
```json
{
  "mode": "universal"
}
```

### Step 5: Verify Business Events Still Work
```bash
curl -X POST http://localhost:5000/api/events/log \
  -H "Content-Type: application/json" \
  -d '{
    "app": "student_pilot",
    "env": "development",
    "eventName": "credits_purchased",
    "ts": "2025-10-28T03:00:00Z",
    "actorType": "user",
    "actorId": "test-user-123",
    "properties": {"revenue_usd": 2000, "credits": 10}
  }'
```

**Expected:**
```json
{
  "success": true,
  "eventId": "..."
}
```

---

## Migration Checklist Per App

For each app transitioning to universal mode:

### Pre-Migration
- [ ] Verify app overlay exists in universal.prompt
- [ ] Test overlay extraction: `GET /api/prompts/overlay/:app`
- [ ] Confirm all must-emit events documented in overlay

### Migration
- [ ] Set `PROMPT_MODE=universal` in app environment
- [ ] Restart app
- [ ] Verify prompt loads: `GET /api/prompts/:app` shows `mode: "universal"`
- [ ] Check app logs for "Loaded universal" message

### Post-Migration
- [ ] Emit test event for each must-emit type
- [ ] Verify events appear in business_events table
- [ ] Confirm KPI collector reads events correctly
- [ ] Monitor error rate for 24 hours

### Rollback (If Issues)
- [ ] Unset `PROMPT_MODE` (reverts to `separate`)
- [ ] Restart app
- [ ] Verify `GET /api/prompts/:app` shows `mode: "separate"`
- [ ] Confirm business events still flowing

---

## Universal Prompt Structure

The universal.prompt file contains:

### [META] Section
- Purpose, runtime selection rules
- Global SLOs, Responsible AI guardrails
- Revenue model, PII redaction policy

### [SHARED] Section
- Company context and prime directive
- Must-emit event schema
- Global KPIs and refusals

### [APP: X] Sections (8 total)
- `[APP: scholar_auth]` - Auth and consent
- `[APP: student_pilot]` - B2C journey
- `[APP: provider_register]` - B2B onboarding
- `[APP: scholarship_api]` - Search and matching
- `[APP: executive_command_center]` - KPI aggregation
- `[APP: auto_page_maker]` - SEO engine
- `[APP: scholarship_agent]` - Growth automation
- `[APP: scholarship_sage]` - AI advisor

Each overlay defines:
- Scope (in-scope actions)
- Must-emit events with schemas
- KPIs influenced
- Refusals (out-of-scope actions)

---

## Troubleshooting

### Issue: Universal prompt not loading
**Symptoms:** `GET /api/prompts/universal?app=X` returns 404

**Solution:**
```bash
# 1. Verify file exists
ls docs/system-prompts/universal.prompt

# 2. Check environment variable
echo $UNIVERSAL_PROMPT_PATH
# Should be empty (uses default)

# 3. Test overlay extraction directly
curl 'http://localhost:5000/api/prompts/overlay/student_pilot'
```

### Issue: Overlay not found for app
**Symptoms:** Error: `Overlay not found for app: X in universal.prompt`

**Solution:**
```bash
# Check app name matches exactly
grep "\[APP: student_pilot\]" docs/system-prompts/universal.prompt

# Verify no typos
curl 'http://localhost:5000/api/prompts/overlay/student_pilot'
```

### Issue: Mode stuck on "separate"
**Symptoms:** `GET /api/prompts/:app` always shows `mode: "separate"`

**Solution:**
```bash
# 1. Set environment variable
export PROMPT_MODE=universal

# 2. Restart app (CRITICAL)
npm run dev

# 3. Verify mode changed
curl http://localhost:5000/api/prompts/executive_command_center | jq .mode
# Expected: "universal"
```

### Issue: Hash changed after switching modes
**Expected behavior** - hashes WILL differ between modes

**Reason:**
- Separate mode: hash of shared_directives.prompt + app.prompt
- Universal mode: hash of [SHARED] + [APP: X] extracted from universal.prompt

**This is normal!** Different content = different hash.

---

## Success Metrics

### Week 1 (Revenue Critical)
- [ ] All 3 Week 1 apps emit events to business_events
- [ ] First revenue_usd > 0 from Student Pilot (credit_purchased)
- [ ] First fee_usd > 0 from Provider Register (scholarship_posted)
- [ ] Daily KPI brief at T+72h shows non-zero B2C/B2B revenue

### Week 2 (Pilot Universal)
- [ ] 2 apps successfully migrated to PROMPT_MODE=universal
- [ ] No increase in error rate after migration
- [ ] All must-emit events still flowing correctly
- [ ] KPI collectors reading universal-mode events

### Week 3+ (Full Migration)
- [ ] All 8 apps running on universal.prompt
- [ ] Separate prompt files deprecated (kept as fallback)
- [ ] Auto-generated separate files from universal (tooling)
- [ ] Single-edit surface reduces prompt drift

---

## Future Enhancements

### Week 4+: Auto-Generation Tooling
Create script to generate separate files from universal:

```bash
npm run prompts:generate
# Reads universal.prompt
# Extracts [SHARED] + each [APP: X]
# Writes to docs/system-prompts/{app}.prompt
# Updates MANIFEST.json
```

### Week 5+: Prompt Versioning
Add version control:
```typescript
// In universal.prompt
[META]
version: 1.1.0
changelog:
  - 1.1.0: Added scholarship_sage overlay
  - 1.0.0: Initial release with 8 apps
```

### Week 6+: Runtime A/B Testing
Test prompt variations:
```typescript
PROMPT_MODE=universal_variant_a  // Test new wording
PROMPT_MODE=universal_variant_b  // Control
```

---

## Contact and Support

**Implementation Questions:**
- Check `docs/implementation-guides/README.md` for app-specific guides
- Review `docs/system-prompts/MANIFEST.json` for prompt metadata

**Universal Prompt Issues:**
- Test overlay extraction: `GET /api/prompts/overlay/:app`
- Verify mode: `GET /api/prompts/:app`
- Check logs for "Loaded universal" or "Loaded separate" messages

**Business Events Issues:**
- Review `server/lib/business-events.ts` for event helpers
- Check `business_events` table for missing events
- Verify `revenue_usd` and `fee_usd` calculations

---

**Status:** ✅ Hybrid Architecture Deployed (v1.1)  
**Mode:** PROMPT_MODE=separate (default, Week 1 velocity preserved)  
**Universal Prompt:** 8,758 bytes with comprehensive sections A-H  
**Verified:** All 8 overlays extracting correctly (4,521-5,260 chars each)  
**Next:** T+24h pilot universal mode with Scholarship API  
**Target:** T+72h first non-zero revenue report  
**Last Updated:** October 28, 2025 - v1.1 deployed and verified
