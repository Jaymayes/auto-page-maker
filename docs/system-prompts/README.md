# System Prompts - Scholar AI Advisor Platform
## Deployment Guide for All Eight Services

## Overview

This directory contains the approved system prompts for all eight Scholar AI Advisor applications. Each app loads the **Shared Directives** first, then appends its **app-specific overlay** to create the effective system prompt.

## File Structure

```
docs/system-prompts/
├── README.md                           # This file
├── shared_directives.prompt            # Common to all apps
├── executive_command_center.prompt     # Command Center overlay
├── auto_page_maker.prompt              # SEO engine overlay
├── provider_register.prompt            # B2B marketplace overlay
├── scholarship_api.prompt              # Search/match core overlay
├── scholarship_agent.prompt            # Marketing/growth overlay
├── student_pilot.prompt                # B2C student app overlay
├── scholar_auth.prompt                 # Identity/consent overlay
└── scholarship_sage.prompt             # AI advisor overlay
```

## Service to Prompt Mapping

| Service | Replit App | Prompt File |
|---------|------------|-------------|
| Executive Command Center | auto-com-center-jamarrlmayes.replit.app | `executive_command_center.prompt` |
| Auto Page Maker | auto-page-maker-jamarrlmayes.replit.app | `auto_page_maker.prompt` |
| Provider Register | provider-register-jamarrlmayes.replit.app | `provider_register.prompt` |
| Scholarship API | scholarship-api-jamarrlmayes.replit.app | `scholarship_api.prompt` |
| Scholarship Agent | scholarship-agent-jamarrlmayes.replit.app | `scholarship_agent.prompt` |
| Student Pilot | student-pilot-jamarrlmayes.replit.app | `student_pilot.prompt` |
| Scholar Auth | scholar-auth-jamarrlmayes.replit.app | `scholar_auth.prompt` |
| Scholarship Sage | scholarship-sage-jamarrlmayes.replit.app | `scholarship_sage.prompt` |

## Quick Deployment (3 Steps)

### 1. Copy Prompts to Each Service

For each service repository, copy both files:
```bash
# In each service repo
mkdir -p docs/system-prompts
cp shared_directives.prompt docs/system-prompts/
cp <service>.prompt docs/system-prompts/
```

### 2. Set Environment Variables

Add to `.env` or Replit Secrets:
```bash
SYSTEM_PROMPT_PATH=docs/system-prompts/<service>.prompt
SHARED_PROMPT_PATH=docs/system-prompts/shared_directives.prompt
```

### 3. Load Prompts at Service Boot

Add this loader to your service initialization:

```typescript
// server/lib/system-prompt-loader.ts
import { readFile } from 'fs/promises';
import { createHash } from 'crypto';

export async function loadSystemPrompt(): Promise<{
  prompt: string;
  hash: string;
  version: string;
}> {
  const sharedPath = process.env.SHARED_PROMPT_PATH || 'docs/system-prompts/shared_directives.prompt';
  const appPath = process.env.SYSTEM_PROMPT_PATH || 'docs/system-prompts/executive_command_center.prompt';

  try {
    const [sharedContent, appContent] = await Promise.all([
      readFile(sharedPath, 'utf-8'),
      readFile(appPath, 'utf-8'),
    ]);

    // Combine: shared first, then app-specific overlay
    const combinedPrompt = `${sharedContent}\n\n---\n\n${appContent}`;
    
    // Generate hash for verification
    const hash = createHash('sha256').update(combinedPrompt).digest('hex').substring(0, 16);
    
    // Version from environment or build
    const version = process.env.BUILD_VERSION || 'development';

    console.log(`[System Prompt] Loaded successfully - Hash: ${hash}, Version: ${version}`);
    
    return {
      prompt: combinedPrompt,
      hash,
      version,
    };
  } catch (error) {
    console.error('[System Prompt] Failed to load:', error);
    throw new Error('System prompt initialization failed');
  }
}

// Optional: Expose meta endpoint for verification (non-sensitive)
export function getPromptMetadata(prompt: { hash: string; version: string }) {
  return {
    promptHash: prompt.hash,
    activeVersion: prompt.version,
    loadedAt: new Date().toISOString(),
  };
}
```

### 4. Initialize at Service Boot

```typescript
// server/index.ts
import { loadSystemPrompt, getPromptMetadata } from './lib/system-prompt-loader.js';

(async () => {
  // Load system prompt early
  const systemPrompt = await loadSystemPrompt();
  
  // Make available globally if needed
  global.systemPrompt = systemPrompt;

  // Optional: Expose metadata endpoint
  app.get('/api/meta/prompt', (req, res) => {
    res.json(getPromptMetadata(systemPrompt));
  });

  // Rest of your service initialization...
})();
```

## Business Events Instrumentation Priority

**Critical for Revenue Visibility (Week 1):**

1. **Student Pilot** - B2C revenue tracking
   - `student_signup`, `credit_purchased`, `credit_spent`
   - Required for: ARPU, free-to-paid conversion

2. **Provider Register** - B2B revenue tracking
   - `provider_verified`, `scholarship_posted` (with fee data)
   - Required for: 3% fee revenue, active providers

3. **Scholarship API** - Engagement funnel
   - `scholarship_viewed`, `scholarship_saved`, `application_started`
   - Required for: CTR metrics, conversion funnel

**Important for Growth (Week 2):**

4. **Auto Page Maker** - SEO performance
   - `page_published`, `sitemap_submitted`, `indexnow_submitted`
   - Required for: Pages live, indexation tracking

5. **Scholar Auth** - Auth health
   - `login_succeeded`, `login_failed`, `email_verified`, `consent_recorded`
   - Required for: Login success rate, consent compliance

**Nice-to-Have (Week 3+):**

6. **Scholarship Sage** - AI effectiveness
   - `recommendation_shown`, `recommendation_accepted`

7. **Scholarship Agent** - Attribution
   - `campaign_launched`, `lead_acquired`, `conversion_attributed`

8. **Executive Command Center** - Already instrumented
   - `scheduler_job_run`, `kpi_missing_data`, `kpi_slo_breach`

## Verification Checklist

For each service after deployment:

- [ ] Prompt files copied to `docs/system-prompts/`
- [ ] Environment variables set (`SYSTEM_PROMPT_PATH`, `SHARED_PROMPT_PATH`)
- [ ] Loader implemented and tested
- [ ] Service logs prompt hash at boot
- [ ] `/api/meta/prompt` endpoint returns metadata (optional)
- [ ] Required business events instrumented
- [ ] Events visible in `business_events` table within 24h
- [ ] Executive KPI Brief shows non-zero metrics for this service

## Testing the Integration

### 1. Verify Prompt Loading
```bash
# Check service logs for successful load
grep "System Prompt" logs/application.log

# Expected: [System Prompt] Loaded successfully - Hash: abc123..., Version: v1.0.0
```

### 2. Test Metadata Endpoint
```bash
curl https://<service>.replit.app/api/meta/prompt

# Expected:
# {
#   "promptHash": "abc123...",
#   "activeVersion": "v1.0.0",
#   "loadedAt": "2025-10-27T20:00:00.000Z"
# }
```

### 3. Verify Business Events
```sql
-- Check events are being logged
SELECT 
  app,
  event_name,
  COUNT(*) as event_count,
  MAX(ts) as latest_event
FROM business_events
WHERE app = '<service-name>'
  AND ts > NOW() - INTERVAL '24 hours'
GROUP BY app, event_name
ORDER BY event_count DESC;
```

### 4. Check Executive KPI Brief
```bash
# Trigger manual KPI generation
curl -X POST https://auto-com-center-jamarrlmayes.replit.app/api/executive/kpi/generate

# Check for service metrics in response
# Expected: Non-zero values for instrumented metrics
```

## CEO Directive Compliance

✅ **Immediate Actions (This Week):**
1. Deploy prompts to all eight services
2. Instrument Student Pilot, Provider Register, and Scholarship API for business events
3. Configure Slack webhook: `SLACK_WEBHOOK_URL` in Executive Command Center
4. Run manual KPI brief after instrumentation complete

🎯 **Success Criteria (72 Hours):**
- First non-zero B2C revenue report (from Student Pilot events)
- First non-zero B2B revenue report (from Provider Register events)
- All critical events flowing to `business_events` table
- Daily executive brief showing real metrics at 09:00 UTC

## Troubleshooting

### Prompt Not Loading
- Verify file paths in environment variables
- Check file permissions: `chmod 644 docs/system-prompts/*.prompt`
- Look for syntax errors in prompt files

### Events Not Appearing
- Verify `business_events` table exists
- Check storage interface has `logBusinessEvent` method
- Ensure fire-and-forget emission doesn't throw unhandled errors
- Review app logs for emission failures

### KPI Brief Shows "No Data"
- Confirm events are in database: `SELECT * FROM business_events LIMIT 10`
- Verify event names match collector expectations (e.g., `student_signup` not `signup`)
- Check collector is querying correct time window
- Review `missingMetrics` array in KPI snapshot

## Support

For issues or questions about prompt deployment:
1. Check this README first
2. Review Executive Command Center logs
3. Verify business events are flowing
4. Contact platform team with prompt hash and service name

---

**Last Updated:** October 27, 2025  
**Version:** 1.0.0  
**Status:** ✅ Ready for Production Deployment
