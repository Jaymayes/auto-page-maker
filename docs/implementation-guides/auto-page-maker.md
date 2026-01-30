# Auto Page Maker - Business Events Implementation Guide
**Week 2 Priority: SEO-Led Growth Engine**

## App Overview

**App Key:** `auto_page_maker`  
**Prompt File:** `docs/system-prompts/auto_page_maker.prompt`  
**Purpose:** Generate SEO landing pages at scale to drive low-CAC acquisition through organic traffic  
**Replit URL:** `https://auto-page-maker-*.replit.app`

## Mission

Programmatically generate 2,000+ high-quality landing pages with E-E-A-T trust indicators, canonical URLs, schema.org metadata, and UTM tagging. Drive organic sessions with <$5 CAC through SEO-first strategy.

## KPIs Owned

This app directly impacts:
- **Organic Sessions** - Feeds CAC collector for SEO-led acquisition cost
- **Pages Live** - Already tracked in SEO collector (currently 2,101+)
- **CTR by Page** - Click-through rate from search results
- **Leads per Page** - Conversion rate from visitor → lead capture
- **CAC Trend** - Organic-first CAC tracking vs paid channels

## Must-Emit Events (4 Required)

### 1. page_published
**When:** A new landing page goes live  
**Actor:** System  
**Properties:**
```typescript
{
  slug: string;           // URL slug (e.g., "california-stem-scholarships")
  topic: string;          // Content topic (e.g., "STEM scholarships")
  geo: string;            // Geographic target (e.g., "California", "US", "Global")
  template?: string;      // Template used (e.g., "state-major", "topic-only")
  wordCount?: number;     // Content length for quality tracking
  canonicalUrl?: string;  // Canonical URL for SEO
}
```

### 2. page_indexed
**When:** Search engine confirms page indexation  
**Actor:** System  
**Properties:**
```typescript
{
  slug: string;           // Same slug as page_published
  engine: string;         // Search engine (e.g., "google", "bing")
  rank?: number;          // Initial ranking position (optional)
  indexedAt?: string;     // ISO timestamp when indexed
  searchConsoleUrl?: string; // Link to Search Console data
}
```

### 3. page_viewed
**When:** User views a landing page  
**Actor:** Anonymous visitor  
**Session Required:** Yes (track user journey)  
**Properties:**
```typescript
{
  slug: string;           // Page slug viewed
  sessionId: string;      // REQUIRED - track multi-page sessions
  referrer?: string;      // Traffic source (organic, direct, referral)
  utmSource?: string;     // UTM source if present
  utmMedium?: string;     // UTM medium if present
  utmCampaign?: string;   // UTM campaign if present
  deviceType?: string;    // "mobile", "tablet", "desktop"
  location?: string;      // City/state from IP (PII-safe)
}
```

### 4. lead_captured
**When:** Visitor submits contact form or signs up from landing page  
**Actor:** Anonymous → User (conversion point)  
**Revenue Impact:** Feeds CAC calculation  
**Properties:**
```typescript
{
  leadId: string;         // Unique lead identifier (not email - PII safe)
  sourceSlug: string;     // Landing page that captured lead
  sessionId?: string;     // Link back to page_viewed events
  leadType?: string;      // "newsletter", "account", "contact"
  attributionPath?: string; // Pages visited before conversion
}
```

## Implementation

### Step 1: Copy Event Library

Copy `server/lib/business-events.ts` from Executive Command Center to your Auto Page Maker repo:

```bash
# In Executive Command Center
cat server/lib/business-events.ts

# Copy the entire file to Auto Page Maker
# Place it at: server/lib/business-events.ts
```

### Step 2: Instrument Events

#### Event 1: page_published

```typescript
// In your page generation service
import { emitBusinessEvent } from '../lib/business-events';

async function publishLandingPage(slug: string, topic: string, geo: string) {
  // Your existing page generation logic...
  
  // Emit event (fire-and-forget, non-blocking)
  await emitBusinessEvent('page_published', {
    slug,
    topic,
    geo,
    template: 'state-major', // or your template name
    wordCount: generatedContent.split(' ').length,
    canonicalUrl: `https://scholarmatch.com/scholarships/${slug}`
  }, {
    actorType: 'system',
    actorId: null // System-generated content
  });
}
```

#### Event 2: page_indexed

```typescript
// In your IndexNow or Search Console webhook handler
import { emitBusinessEvent } from '../lib/business-events';

async function handleIndexationConfirmation(slug: string, engine: string, rank?: number) {
  await emitBusinessEvent('page_indexed', {
    slug,
    engine,
    rank, // Optional initial rank
    indexedAt: new Date().toISOString(),
    searchConsoleUrl: `https://search.google.com/search-console?resource_id=${slug}`
  }, {
    actorType: 'system',
    actorId: null
  });
}
```

#### Event 3: page_viewed

```typescript
// In your page view tracking middleware or analytics
import { emitBusinessEvent } from '../lib/business-events';

app.get('/scholarships/:slug', async (req, res) => {
  const { slug } = req.params;
  
  // Render page first (don't block)
  res.render('landing-page', { slug, ... });
  
  // Track view (fire-and-forget)
  await emitBusinessEvent('page_viewed', {
    slug,
    sessionId: req.sessionID, // REQUIRED
    referrer: req.get('referrer'),
    utmSource: req.query.utm_source as string,
    utmMedium: req.query.utm_medium as string,
    utmCampaign: req.query.utm_campaign as string,
    deviceType: req.useragent?.isMobile ? 'mobile' : 'desktop',
    location: extractSafeLocation(req.ip) // City/state only, no PII
  }, {
    actorType: 'anonymous',
    actorId: null,
    sessionId: req.sessionID // Pass explicitly for clarity
  });
});
```

**IMPORTANT:** Configure express-session BEFORE routes:

```typescript
import session from 'express-session';

app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
}));
```

#### Event 4: lead_captured

```typescript
// In your contact form or signup handler
import { emitBusinessEvent } from '../lib/business-events';
import { nanoid } from 'nanoid';

app.post('/api/leads/capture', async (req, res) => {
  const { email, sourceSlug } = req.body;
  
  // Create lead in your system
  const leadId = nanoid(); // DO NOT use email (PII)
  
  // Capture lead
  await createLead({ leadId, email, sourceSlug });
  
  // Track conversion (fire-and-forget)
  await emitBusinessEvent('lead_captured', {
    leadId, // Safe identifier, not email
    sourceSlug,
    sessionId: req.sessionID,
    leadType: 'account', // or 'newsletter', 'contact'
    attributionPath: getSessionPageViews(req.sessionID) // "page1 → page2 → converted"
  }, {
    actorType: 'user', // Converted from anonymous
    actorId: leadId, // Now has identifier
    sessionId: req.sessionID
  });
  
  res.json({ success: true, leadId });
});
```

### Step 3: Load System Prompts

Add prompt loading at app startup:

```typescript
// In server/index.ts or main app file
import { loadSystemPrompt } from './lib/system-prompt-loader';

async function initializeApp() {
  try {
    // Load prompts at boot
    const promptMetadata = await loadSystemPrompt('auto_page_maker');
    console.log('Loaded prompt:', promptMetadata.promptHash);
    
    // Store in app context for reference
    app.locals.promptHash = promptMetadata.promptHash;
    
  } catch (error) {
    console.error('Failed to load system prompt:', error);
    // Non-fatal - app can still run
  }
}

initializeApp().then(() => {
  app.listen(5000, () => console.log('Auto Page Maker running'));
});
```

### Step 4: Add Prompt Endpoints

```typescript
// Expose prompt metadata for verification
app.get('/api/prompts/auto_page_maker', async (req, res) => {
  const { getPromptMetadata } = await import('./lib/system-prompt-loader');
  const metadata = await getPromptMetadata('auto_page_maker');
  res.json(metadata);
});
```

## Testing

### Test Sequence

```bash
# 1. Publish a test page
curl -X POST http://localhost:5000/api/pages/generate \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "test-california-stem",
    "topic": "STEM scholarships",
    "geo": "California"
  }'

# 2. View the page (in browser or curl)
curl http://localhost:5000/scholarships/test-california-stem \
  -H "Cookie: connect.sid=YOUR_SESSION_ID"

# 3. Capture a lead
curl -X POST http://localhost:5000/api/leads/capture \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_ID" \
  -d '{
    "email": "test@example.com",
    "sourceSlug": "test-california-stem"
  }'

# 4. Simulate indexation (manual trigger or webhook)
curl -X POST http://localhost:5000/api/indexation/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "test-california-stem",
    "engine": "google",
    "rank": 15
  }'
```

### Verification Queries

```sql
-- Check all Auto Page Maker events
SELECT 
  event_name,
  COUNT(*) as count,
  MAX(ts) as latest_event
FROM business_events
WHERE app = 'auto_page_maker'
GROUP BY event_name
ORDER BY count DESC;

-- Expected results:
-- page_published: 1+
-- page_viewed: 1+ (one per visitor)
-- lead_captured: 1+
-- page_indexed: 1+ (after indexation)

-- Verify page view tracking with sessionId
SELECT 
  session_id,
  STRING_AGG(properties->>'slug', ' → ' ORDER BY ts) as page_journey,
  COUNT(*) as pages_viewed,
  MAX(ts) - MIN(ts) as session_duration
FROM business_events
WHERE app = 'auto_page_maker'
  AND event_name = 'page_viewed'
  AND session_id IS NOT NULL
GROUP BY session_id
ORDER BY session_duration DESC
LIMIT 10;

-- Check lead attribution
SELECT 
  properties->>'leadId' as lead_id,
  properties->>'sourceSlug' as source,
  properties->>'attributionPath' as journey,
  session_id,
  ts
FROM business_events
WHERE app = 'auto_page_maker'
  AND event_name = 'lead_captured'
ORDER BY ts DESC
LIMIT 20;

-- Verify no PII in events (should return 0 rows)
SELECT *
FROM business_events
WHERE app = 'auto_page_maker'
  AND (
    properties::text ILIKE '%@%.%' OR -- Email patterns
    properties->>'email' IS NOT NULL OR
    properties->>'phone' IS NOT NULL
  );
```

## SEO & Attribution Guidelines

### Canonical URLs
Always include canonical URLs in page_published:
```typescript
canonicalUrl: `https://scholarmatch.com/scholarships/${slug}`
```

### UTM Tagging
For paid campaigns promoting organic pages:
```
https://scholarmatch.com/scholarships/california-stem?utm_source=google&utm_medium=cpc&utm_campaign=stem-ca
```
These are captured in page_viewed for attribution.

### Schema.org Metadata
Include structured data in your pages:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ScholarshipOffer",
  "name": "California STEM Scholarships",
  "description": "...",
  "url": "https://scholarmatch.com/scholarships/california-stem"
}
</script>
```

### Duplicate Content Avoidance
- Use canonical URLs for similar pages
- Emit page_published only once per unique slug
- Track template variants separately in properties

### PII Protection
**NEVER emit:**
- Email addresses
- Phone numbers
- Full names
- Precise locations (lat/lon)

**SAFE to emit:**
- Lead IDs (generated, not email)
- City/state (aggregated location)
- Session IDs (temporary, rotated)
- Page slugs (public URLs)

## KPI Impact

### CAC Collector
This app feeds the CAC collector with organic traffic data:
```typescript
// In Executive Command Center CAC collector
const organicLeads = await db
  .select({ count: sql`COUNT(DISTINCT properties->>'leadId')` })
  .from(businessEvents)
  .where(
    and(
      eq(businessEvents.app, 'auto_page_maker'),
      eq(businessEvents.eventName, 'lead_captured'),
      gte(businessEvents.ts, thirtyDaysAgo)
    )
  );

// CAC = $0 (organic) vs paid channels
const organicCac = 0; // SEO-led has no direct acquisition cost
```

### SEO Collector
Pages live already tracked, but add indexation rate:
```typescript
const pagesPublished = await countEvents('page_published');
const pagesIndexed = await countEvents('page_indexed');
const indexationRate = (pagesIndexed / pagesPublished) * 100;
```

## Common Issues

### Issue: sessionId is null on page_viewed
**Solution:** Configure express-session before route handlers:
```typescript
import session from 'express-session';

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));

// THEN define routes
app.get('/scholarships/:slug', ...);
```

### Issue: UTM parameters not captured
**Solution:** Use query parser middleware:
```typescript
import express from 'express';
app.use(express.urlencoded({ extended: true }));

// Then access in routes
const utmSource = req.query.utm_source as string;
```

### Issue: Duplicate page_published events
**Solution:** Deduplicate by slug before emitting:
```typescript
const existingPage = await db
  .select()
  .from(businessEvents)
  .where(
    and(
      eq(businessEvents.app, 'auto_page_maker'),
      eq(businessEvents.eventName, 'page_published'),
      sql`properties->>'slug' = ${slug}`
    )
  )
  .limit(1);

if (existingPage.length === 0) {
  await emitBusinessEvent('page_published', {...});
}
```

### Issue: Email addresses appearing in events
**Solution:** Always use lead IDs, never email:
```typescript
// BAD - PII leak
await emitBusinessEvent('lead_captured', {
  email: 'user@example.com' // ❌ NEVER DO THIS
});

// GOOD - Safe identifier
import { nanoid } from 'nanoid';
const leadId = nanoid();
await emitBusinessEvent('lead_captured', {
  leadId, // ✅ Safe, no PII
  sourceSlug: 'page-slug'
});
```

## Acceptance Criteria

### Week 2 Milestone
- [ ] All 4 events instrumented (page_published, page_indexed, page_viewed, lead_captured)
- [ ] Session tracking working (page_viewed has sessionId)
- [ ] Attribution path captured on lead_captured
- [ ] No PII in business_events table (verified by query)
- [ ] Prompt loaded successfully (GET /api/prompts/auto_page_maker returns hash)
- [ ] KPI impact visible in CAC collector (organic leads counted)

### Production Readiness
- [ ] Canonical URLs on all published pages
- [ ] Schema.org metadata implemented
- [ ] UTM tagging working for paid campaigns
- [ ] IndexNow integration confirms page_indexed events
- [ ] Lead capture form not leaking email to events
- [ ] Session duration tracking working (multi-page journeys)

---

**Next Steps:**
1. Copy `business-events.ts` and `system-prompt-loader.ts` to Auto Page Maker repo
2. Instrument all 4 events in your page generation pipeline
3. Test full journey: publish → index → view → capture lead
4. Verify events in database with queries above
5. Confirm prompt loads at startup
6. Monitor KPI impact in Executive Command Center

**Support:** Check `docs/implementation-guides/README.md` for troubleshooting and verification queries.
