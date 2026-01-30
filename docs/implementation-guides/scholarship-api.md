# Scholarship API - Business Events Implementation Guide
**Priority: Week 1 (Critical for Engagement Funnel Visibility)**

## Overview
Scholarship API powers the engagement funnel from discovery to application submission. This guide shows you exactly how to instrument the 5 required business events.

## Setup (Copy-Paste)

### 1. Copy Business Events Library
```bash
# Copy from Executive Command Center
cp server/lib/business-events.ts <your-repo>/server/lib/
```

### 2. Set Environment Variables
```bash
# Add to .env
APP_NAME=scholarship_api
NODE_ENV=production
DATABASE_URL=<your-db-url>
```

### 3. Load System Prompts
```bash
# Copy prompts
mkdir -p docs/system-prompts
cp docs/system-prompts/shared_directives.prompt <your-repo>/docs/system-prompts/
cp docs/system-prompts/scholarship_api.prompt <your-repo>/docs/system-prompts/

# Set in .env
SHARED_PROMPT_PATH=docs/system-prompts/shared_directives.prompt
SYSTEM_PROMPT_PATH=docs/system-prompts/scholarship_api.prompt
```

## Required Events (5 Total)

### Event 1: scholarship_viewed
**When**: User views scholarship details
**Where**: Scholarship detail GET endpoint

```typescript
import { emitBusinessEvent } from '../lib/business-events';

// In your scholarship detail endpoint
app.get('/api/scholarships/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const scholarship = await getScholarship(req.params.id);
    
    // Emit view event (supports anonymous users)
    await emitBusinessEvent('scholarship_viewed', {
      scholarshipId: req.params.id,
      viewSource: req.query.source || 'direct', // 'search' | 'recommendation' | 'landing_page' | 'direct'
      segment: scholarship.matchSegment || 'unknown', // 'high_likelihood' | 'competitive' | 'long_shot'
      amount: scholarship.amount,
      deadline: scholarship.deadline,
    }, {
      actorType: userId ? 'student' : 'anonymous',
      actorId: userId || null,
      sessionId: req.sessionID,
    });
    
    res.json({ scholarship });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Event 2: scholarship_saved
**When**: User saves/bookmarks a scholarship
**Where**: Save action endpoint

```typescript
import { emitBusinessEvent } from '../lib/business-events';

// In your save endpoint
app.post('/api/scholarships/:id/save', async (req, res) => {
  try {
    const userId = req.user.id;
    const scholarshipId = req.params.id;
    
    // Your existing save logic
    await saveScholarshipForUser(userId, scholarshipId);
    
    // Emit save event
    await emitBusinessEvent('scholarship_saved', {
      scholarshipId,
      savedFrom: req.body.source || 'detail_page', // 'search_results' | 'detail_page' | 'recommendation'
      matchScore: req.body.matchScore || null,
    }, {
      actorType: 'student',
      actorId: userId,
      sessionId: req.sessionID,
    });
    
    res.json({ success: true, saved: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Event 3: match_generated
**When**: AI generates personalized scholarship matches
**Where**: Match generation endpoint

```typescript
import { emitBusinessEvent } from '../lib/business-events';

// In your match generation endpoint
app.post('/api/matches/generate', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Your existing matching logic
    const matches = await generateMatches(userId, {
      algorithm: req.body.algorithm || 'ai_v1',
      limit: req.body.limit || 20,
    });
    
    // Calculate average match score
    const avgMatchScore = matches.reduce((sum, m) => sum + m.score, 0) / matches.length;
    
    // Emit match generation event
    await emitBusinessEvent('match_generated', {
      scholarshipIds: matches.map(m => m.id),
      algorithm: req.body.algorithm || 'ai_v1',
      matchScore: avgMatchScore,
      matchCount: matches.length,
      segments: {
        highLikelihood: matches.filter(m => m.segment === 'high_likelihood').length,
        competitive: matches.filter(m => m.segment === 'competitive').length,
        longShot: matches.filter(m => m.segment === 'long_shot').length,
      },
    }, {
      actorType: 'student',
      actorId: userId,
      sessionId: req.sessionID,
    });
    
    res.json({ matches });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Event 4: application_started
**When**: User begins application process
**Where**: Application start/draft creation endpoint

```typescript
import { emitBusinessEvent } from '../lib/business-events';

// In your application start endpoint
app.post('/api/applications/:scholarshipId/start', async (req, res) => {
  try {
    const userId = req.user.id;
    const { scholarshipId } = req.params;
    
    // Your existing application creation
    const application = await createApplicationDraft({
      userId,
      scholarshipId,
      startedAt: new Date(),
    });
    
    // Emit application start event
    await emitBusinessEvent('application_started', {
      applicationId: application.id,
      scholarshipId,
      startedFrom: req.body.source || 'detail_page', // 'saved' | 'detail_page' | 'recommendation'
      matchScore: req.body.matchScore || null,
    }, {
      actorType: 'student',
      actorId: userId,
      sessionId: req.sessionID,
    });
    
    res.json({ application });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Event 5: application_submitted
**When**: User submits completed application
**Where**: Application submission endpoint

```typescript
import { emitBusinessEvent } from '../lib/business-events';

// In your application submission endpoint
app.post('/api/applications/:applicationId/submit', async (req, res) => {
  try {
    const userId = req.user.id;
    const { applicationId } = req.params;
    
    // Get application details
    const application = await getApplication(applicationId);
    const startTime = new Date(application.startedAt);
    const completionTimeMinutes = (Date.now() - startTime.getTime()) / (1000 * 60);
    
    // Your existing submission logic
    await submitApplication(applicationId, req.body);
    
    // Emit submission event
    await emitBusinessEvent('application_submitted', {
      applicationId,
      scholarshipId: application.scholarshipId,
      completionTimeMinutes: Math.round(completionTimeMinutes),
      requirementsMet: req.body.requirements?.length || 0,
      documentsUploaded: req.body.documents?.length || 0,
    }, {
      actorType: 'student',
      actorId: userId,
      sessionId: req.sessionID,
    });
    
    res.json({ success: true, application });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Engagement Funnel Tracking

The 5 events form a complete engagement funnel:

```
scholarship_viewed (Entry)
         ↓
scholarship_saved (Interest)
         ↓
match_generated (Personalization)
         ↓
application_started (Intent)
         ↓
application_submitted (Conversion)
```

Track funnel metrics:
```sql
-- Funnel conversion rates
WITH funnel AS (
  SELECT
    COUNT(DISTINCT CASE WHEN event_name = 'scholarship_viewed' THEN session_id END) as viewed,
    COUNT(DISTINCT CASE WHEN event_name = 'scholarship_saved' THEN session_id END) as saved,
    COUNT(DISTINCT CASE WHEN event_name = 'application_started' THEN session_id END) as started,
    COUNT(DISTINCT CASE WHEN event_name = 'application_submitted' THEN session_id END) as submitted
  FROM business_events
  WHERE app = 'scholarship_api'
    AND ts > NOW() - interval '7 days'
)
SELECT
  viewed,
  saved,
  started,
  submitted,
  ROUND(100.0 * saved / NULLIF(viewed, 0), 2) as view_to_save_pct,
  ROUND(100.0 * started / NULLIF(saved, 0), 2) as save_to_start_pct,
  ROUND(100.0 * submitted / NULLIF(started, 0), 2) as start_to_submit_pct
FROM funnel;
```

## Session ID Propagation

**Critical**: Session ID must persist across the entire user journey.

### Express Session Setup
```typescript
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';

const PgSession = connectPgSimple(session);

app.use(session({
  store: new PgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'session',
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  },
}));
```

### Accessing Session ID
```typescript
// In any route handler
const sessionId = req.sessionID; // Auto-generated by express-session

await emitBusinessEvent('scholarship_viewed', {...}, {
  sessionId: sessionId, // Pass through to all events
});
```

## Verification Checklist

### Step 1: Emit Test Events
```bash
# View scholarship
curl https://scholarship-api.replit.app/api/scholarships/1 \
  -H "Cookie: connect.sid=<session-cookie>"

# Save scholarship
curl -X POST https://scholarship-api.replit.app/api/scholarships/1/save \
  -H "Authorization: Bearer <token>" \
  -H "Cookie: connect.sid=<session-cookie>" \
  -d '{"source":"detail_page"}'

# Generate matches
curl -X POST https://scholarship-api.replit.app/api/matches/generate \
  -H "Authorization: Bearer <token>" \
  -H "Cookie: connect.sid=<session-cookie>"

# Start application
curl -X POST https://scholarship-api.replit.app/api/applications/1/start \
  -H "Authorization: Bearer <token>" \
  -H "Cookie: connect.sid=<session-cookie>"

# Submit application
curl -X POST https://scholarship-api.replit.app/api/applications/app123/submit \
  -H "Authorization: Bearer <token>" \
  -H "Cookie: connect.sid=<session-cookie>" \
  -d '{"requirements":[],"documents":[]}'
```

### Step 2: Verify in Database
```sql
-- Check session tracking (should all have same session_id)
SELECT 
  event_name,
  session_id,
  actor_id,
  properties->>'scholarshipId' as scholarship_id,
  ts
FROM business_events
WHERE app = 'scholarship_api'
  AND ts > NOW() - interval '1 hour'
ORDER BY session_id, ts;

-- Verify funnel completeness
SELECT 
  session_id,
  STRING_AGG(event_name, ' → ' ORDER BY ts) as journey
FROM business_events
WHERE app = 'scholarship_api'
  AND session_id IS NOT NULL
GROUP BY session_id
HAVING COUNT(*) > 2;

-- Expected journey: scholarship_viewed → scholarship_saved → application_started → application_submitted
```

### Step 3: Check Executive KPI
```bash
# Trigger manual KPI generation
curl -X POST https://auto-com-center-jamarrlmayes.replit.app/api/executive/kpi/generate

# Should show:
# - View-to-save conversion rate
# - Save-to-apply conversion rate
# - Match quality scores
# - Application completion rates
```

## Common Issues

### Issue: Session ID is always null
**Solution**: Configure express-session middleware before routes
```typescript
app.use(session({ ... })); // Must come before routes
app.use('/api', routes);
```

### Issue: Session ID changes between requests
**Solution**: Ensure cookies are passed in requests
```typescript
// Frontend: Configure fetch to include credentials
fetch('/api/scholarships/1', {
  credentials: 'include', // Critical for session cookies
});
```

### Issue: Anonymous views not tracking
**Solution**: Use session ID for anonymous users
```typescript
await emitBusinessEvent('scholarship_viewed', {...}, {
  actorType: userId ? 'student' : 'anonymous',
  actorId: userId || null,
  sessionId: req.sessionID, // Always present
});
```

## Success Criteria
- ✅ All 5 events emit without errors
- ✅ Session ID present on all events (both authenticated and anonymous)
- ✅ Executive KPI shows non-zero engagement metrics within 72 hours
- ✅ View → save → start → submit funnel tracked end-to-end

## Support
Questions? Check Executive Command Center:
- GET /api/prompts/verify - Verify prompts loaded
- GET /api/executive/kpi/latest - Latest KPI snapshot
- POST /api/events/log - Direct event logging endpoint
