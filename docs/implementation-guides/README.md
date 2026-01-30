# Business Events Implementation - Master Guide
**Option C Execution: Complete Prompt Pack + Priority App Instrumentation**

## Executive Summary

This guide provides the complete implementation path to achieve the CEO directive: **First non-zero revenue report within 72 hours** of business event instrumentation go-live.

## Files Delivered

### System Prompts (9 Files)
Located in `docs/system-prompts/`:

1. ✅ **shared_directives.prompt** - Global directives for all apps
2. ✅ **executive_command_center.prompt** - Command Center overlay (this app)
3. ✅ **auto_page_maker.prompt** - SEO engine overlay
4. ✅ **provider_register.prompt** - B2B marketplace overlay
5. ✅ **scholarship_api.prompt** - Search/match core overlay
6. ✅ **scholarship_agent.prompt** - Marketing/growth overlay
7. ✅ **student_pilot.prompt** - B2C student app overlay
8. ✅ **scholar_auth.prompt** - Identity/consent overlay
9. ✅ **scholarship_sage.prompt** - AI advisor overlay

### Implementation Guides (3 Files)
Located in `docs/implementation-guides/`:

1. ✅ **student-pilot.md** - B2C revenue instrumentation (Week 1 priority)
2. ✅ **provider-register.md** - B2B revenue instrumentation (Week 1 priority)
3. ✅ **scholarship-api.md** - Engagement funnel instrumentation (Week 1 priority)

### Infrastructure (2 Files)
Located in `server/lib/`:

1. ✅ **business-events.ts** - Shared event library with fire-and-forget emission
2. ✅ **system-prompt-loader.ts** - Prompt loading and verification utilities

### API Endpoints
Added to `server/routes.ts`:

1. ✅ `GET /api/prompts` - List all prompts with verification status
2. ✅ `GET /api/prompts/:app` - Get specific app prompt metadata
3. ✅ `GET /api/prompts/verify` - Verify all 9 prompts resolve correctly
4. ✅ `POST /api/events/log` - Direct business event logging (already existed)

### KPI Collectors Updated
Updated to query real business events:

1. ✅ **B2C Collector** - Queries student_pilot events for conversion rate and ARPU
2. ✅ **B2B Collector** - Queries provider_register events for 3% fee revenue
3. ⏳ **CAC Collector** - (Still stub, depends on attribution events)

## 72-Hour Implementation Timeline

### T+0 (Now) ✅ COMPLETE
- [x] Approve Option C
- [x] Create all 9 system prompt files
- [x] Create 3 priority implementation guides
- [x] Build shared event library
- [x] Add prompt verification endpoints
- [x] Update B2C and B2B collectors to read real data
- [x] Verify database schema has `business_events` table

### T+6 Hours (Priority Apps - YOUR ACTION REQUIRED)

**Student Pilot** - Copy from `docs/implementation-guides/student-pilot.md`
- [ ] Copy `server/lib/business-events.ts` to Student Pilot repo
- [ ] Instrument 6 events: student_signup, profile_completed, match_viewed, credit_purchased, credit_spent, application_submitted
- [ ] Test: Create account → complete profile → view match → buy credits → spend credits → submit application
- [ ] Verify: `SELECT * FROM business_events WHERE app = 'student_pilot' ORDER BY ts DESC LIMIT 10`

**Provider Register** - Copy from `docs/implementation-guides/provider-register.md`
- [ ] Copy `server/lib/business-events.ts` to Provider Register repo
- [ ] Instrument 5 events: provider_registered, provider_verified, provider_active, scholarship_posted (with fee_usd), provider_churned
- [ ] Test: Register org → verify → post scholarship → check fee calculation
- [ ] Verify: `SELECT properties->>'fee_usd' as fee FROM business_events WHERE event_name = 'scholarship_posted'`

**Scholarship API** - Copy from `docs/implementation-guides/scholarship-api.md`
- [ ] Copy `server/lib/business-events.ts` to Scholarship API repo
- [ ] Instrument 5 events: scholarship_viewed, scholarship_saved, match_generated, application_started, application_submitted
- [ ] Test: View scholarship → save → generate matches → start application → submit
- [ ] Verify: Session ID propagation across all events

### T+24 Hours (Verification)

**Smoke Tests**
```bash
# 1. Verify prompts loaded
curl https://auto-com-center-jamarrlmayes.replit.app/api/prompts/verify
# Expected: { "success": true, "totalPrompts": 9, "prompts": [...] }

# 2. Check business events flowing
curl https://auto-com-center-jamarrlmayes.replit.app/api/events/log \
  -X POST -H "Content-Type: application/json" \
  -d '{
    "app": "test",
    "env": "development",
    "eventName": "test_event",
    "ts": "2025-10-27T22:00:00Z",
    "actorType": "system",
    "actorId": null,
    "sessionId": null,
    "properties": {}
  }'
# Expected: { "success": true, "eventId": "..." }

# 3. Database check
# Run in PostgreSQL:
SELECT app, event_name, COUNT(*) as count
FROM business_events
WHERE ts > NOW() - interval '24 hours'
GROUP BY app, event_name
ORDER BY app, count DESC;
```

**Expected Results:**
- student_pilot: 6+ event types with revenue_usd on purchases
- provider_register: 5+ event types with fee_usd on scholarship_posted
- scholarship_api: 5+ event types with session_id on all events

### T+48 Hours (Reporting Dry-Run)

**Manual KPI Generation**
```bash
curl -X POST https://auto-com-center-jamarrlmayes.replit.app/api/executive/kpi/generate
```

**Expected KPI Output:**
```json
{
  "success": true,
  "snapshot": {
    "kpis": {
      "b2c": {
        "conversionRate": 500,  // 5% (signups → purchases)
        "arpu": 2000,           // $20 ARPU in cents
        "ctrHighLikelihood": 2000,
        "ctrCompetitive": 1000,
        "ctrLongShot": 500
      },
      "b2b": {
        "activeProviders": 3,
        "revenue": 30000,       // $300 in 3% fees (cents)
        "topDecileConcentration": 6500  // 65% concentration
      },
      "seo": { "pagesLive": 2101, ... },
      "slo": { "uptimePercent": 9990, ... }
    },
    "missingMetrics": [],
    "dataIntegrityRisks": []
  }
}
```

**Configure Slack**
```bash
# Add to Executive Command Center environment
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### T+72 Hours (Acceptance) 🎯

**CEO Directive Success Criteria:**

1. ✅ **B2C Revenue Visible**
   - credit_purchased events with revenue_usd > 0
   - ARPU calculation showing real dollars
   - Conversion rate: signups → paid users

2. ✅ **B2B Revenue Visible**
   - scholarship_posted events with fee_usd > 0
   - 3% platform fee revenue calculated correctly
   - Active provider count > 0

3. ✅ **Engagement Funnel Tracked**
   - scholarship_viewed → saved → started → submitted
   - Session ID propagation working
   - Match quality scores captured

4. ✅ **Daily Brief Automated**
   - 09:00 UTC scheduler running
   - Slack notifications delivering
   - Artifacts generated in /tmp/ops/executive/

## Revenue Attribution Rules

### B2C Revenue (Student Pilot)
Track **both** credit_purchased AND credit_spent:
- **credit_purchased**: Primary revenue event (when money enters system)
- **credit_spent**: Attribution event (which features drove revenue)
- **Deduplication**: KPI collector counts revenue_usd only once from credit_purchased
- **Attribution**: Use credit_spent to understand feature ROI

### B2B Revenue (Provider Register)
- **scholarship_posted**: Only revenue event (3% fee on scholarship amount)
- **Fee Calculation**: Server-side only using `calculateProviderFee(amount)`
- **Formula**: fee_usd = fee_base_usd × 0.03
- **Validation**: Check fee_usd = amount × 0.03 in database

## Common Implementation Issues

### Issue: Events not appearing in business_events table
**Solution:**
```bash
# 1. Verify table exists
npm run db:push --force

# 2. Check storage interface
# Ensure storage.logBusinessEvent() is implemented

# 3. Test direct logging
curl -X POST https://<app>.replit.app/api/events/log -d '{...}'
```

### Issue: Revenue is null or 0 in KPI report
**Solution:**
```typescript
// Always use normalizeRevenue helper
import { normalizeRevenue } from '../lib/business-events';

const revenueData = normalizeRevenue(amountCents, {
  paymentId: payment.id,
  creditAmount: credits
});

await emitBusinessEvent('credit_purchased', {
  ...revenueData, // Contains revenue_usd, payment_id, credit_amount
  // other properties...
});
```

### Issue: Session ID is null across events
**Solution:**
```typescript
// Configure express-session BEFORE routes
import session from 'express-session';

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
}));

// Then in routes, always pass sessionID
await emitBusinessEvent('scholarship_viewed', {...}, {
  sessionId: req.sessionID // Auto-generated by express-session
});
```

### Issue: Prompt verification fails
**Solution:**
```bash
# 1. Check files exist
ls -la docs/system-prompts/*.prompt

# 2. Set environment variables
SHARED_PROMPT_PATH=docs/system-prompts/shared_directives.prompt
SYSTEM_PROMPT_PATH=docs/system-prompts/<app>.prompt

# 3. Test loading
curl https://<app>.replit.app/api/prompts/<app>
```

## Verification Queries

### Check Event Distribution
```sql
SELECT 
  app,
  event_name,
  COUNT(*) as event_count,
  COUNT(DISTINCT actor_id) as unique_actors,
  MAX(ts) as latest_event
FROM business_events
WHERE ts > NOW() - interval '7 days'
GROUP BY app, event_name
ORDER BY app, event_count DESC;
```

### Verify Revenue Events
```sql
SELECT 
  app,
  event_name,
  properties->>'revenue_usd' as revenue,
  properties->>'fee_usd' as fee,
  properties->>'payment_id' as payment,
  actor_id,
  ts
FROM business_events
WHERE event_name IN ('credit_purchased', 'credit_spent', 'scholarship_posted')
  AND ts > NOW() - interval '24 hours'
ORDER BY ts DESC;
```

### Check Session Tracking
```sql
SELECT 
  session_id,
  STRING_AGG(event_name, ' → ' ORDER BY ts) as user_journey,
  COUNT(*) as event_count,
  MAX(ts) - MIN(ts) as session_duration
FROM business_events
WHERE session_id IS NOT NULL
  AND ts > NOW() - interval '1 day'
GROUP BY session_id
HAVING COUNT(*) > 2
ORDER BY session_duration DESC
LIMIT 10;
```

## Support and Troubleshooting

**Executive Command Center Endpoints:**
- `GET /api/prompts` - List all prompts
- `GET /api/prompts/verify` - Verify all prompts load correctly
- `GET /api/executive/kpi/latest` - Latest KPI snapshot
- `POST /api/executive/kpi/generate` - Manual KPI generation
- `POST /api/events/log` - Direct event logging

**Database Schema:**
- `business_events` - All telemetry events
- `daily_kpi_snapshots` - Archived KPI reports

**Contact:**
- Questions about implementation: Check individual app guides
- Executive KPI issues: Review collector logs in Executive Command Center
- Schema/database issues: Verify `npm run db:push --force` ran successfully

---

**Status:** ✅ Infrastructure Ready | ⏳ Awaiting App Owner Implementation  
**Target:** First non-zero revenue report within 72 hours of T+0  
**Last Updated:** October 27, 2025
