# Provider Register - Business Events Implementation Guide
**Priority: Week 1 (Critical for B2B Revenue Visibility)**

## Overview
Provider Register drives B2B revenue through the 3% platform fee on scholarships posted. This guide shows you exactly how to instrument the 5 required business events.

## Setup (Copy-Paste)

### 1. Copy Business Events Library
```bash
# Copy from Executive Command Center
cp server/lib/business-events.ts <your-repo>/server/lib/
```

### 2. Set Environment Variables
```bash
# Add to .env
APP_NAME=provider_register
NODE_ENV=production
DATABASE_URL=<your-db-url>
```

### 3. Load System Prompts
```bash
# Copy prompts
mkdir -p docs/system-prompts
cp docs/system-prompts/shared_directives.prompt <your-repo>/docs/system-prompts/
cp docs/system-prompts/provider_register.prompt <your-repo>/docs/system-prompts/

# Set in .env
SHARED_PROMPT_PATH=docs/system-prompts/shared_directives.prompt
SYSTEM_PROMPT_PATH=docs/system-prompts/provider_register.prompt
```

## Required Events (5 Total)

### Event 1: provider_registered
**When**: Organization completes initial registration
**Where**: After successful account creation

```typescript
import { emitBusinessEvent } from '../lib/business-events';

// In your provider signup endpoint
app.post('/api/providers/register', async (req, res) => {
  try {
    // Your existing registration logic
    const provider = await createProvider(req.body);
    
    // Emit registration event
    await emitBusinessEvent('provider_registered', {
      providerType: req.body.organizationType, // 'university' | 'foundation' | 'corporate' | 'nonprofit'
      source: req.query.utm_source || 'direct',
      organizationSize: req.body.size || 'unknown',
    }, {
      actorType: 'provider',
      actorId: provider.id,
      orgId: provider.id,
      sessionId: req.sessionID,
    });
    
    res.json({ provider });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Event 2: provider_verified
**When**: Provider completes verification process (KYC/organization validation)
**Where**: After manual or automated verification approval

```typescript
import { emitBusinessEvent } from '../lib/business-events';

// In your verification approval endpoint
app.post('/api/providers/:id/verify', async (req, res) => {
  try {
    const providerId = req.params.id;
    const { verificationType, verifiedBy } = req.body;
    
    // Your existing verification logic
    await updateProviderStatus(providerId, 'verified');
    
    // Emit verification event
    await emitBusinessEvent('provider_verified', {
      verificationType, // 'email' | 'organization' | 'tax_id' | 'manual_review'
      verifiedBy, // 'system' | admin user ID
      verifiedAt: new Date().toISOString(),
      documentsSubmitted: req.body.documents || [],
    }, {
      actorType: 'provider',
      actorId: providerId,
      orgId: providerId,
      sessionId: req.sessionID,
    });
    
    res.json({ success: true, status: 'verified' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Event 3: provider_active
**When**: Provider posts their first scholarship
**Where**: After first scholarship goes live

```typescript
import { emitBusinessEvent } from '../lib/business-events';

// Check in your scholarship creation endpoint
app.post('/api/scholarships', async (req, res) => {
  try {
    const providerId = req.user.providerId;
    
    // Your existing scholarship creation
    const scholarship = await createScholarship({ ...req.body, providerId });
    
    // Check if this is first scholarship
    const scholarshipCount = await getProviderScholarshipCount(providerId);
    
    if (scholarshipCount === 1) {
      // First scholarship - provider is now active
      await emitBusinessEvent('provider_active', {
        firstScholarshipId: scholarship.id,
        daysSinceRegistration: getDaysSinceRegistration(providerId),
        timeToFirstPost: getTimeToFirstPost(providerId),
      }, {
        actorType: 'provider',
        actorId: providerId,
        orgId: providerId,
        sessionId: req.sessionID,
      });
    }
    
    res.json({ scholarship });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Event 4: scholarship_posted ⭐ (Revenue Event)
**When**: Provider creates or updates a scholarship listing
**Where**: After scholarship publication

```typescript
import { emitBusinessEvent, calculateProviderFee } from '../lib/business-events';

// In your scholarship creation endpoint
app.post('/api/scholarships', async (req, res) => {
  try {
    const providerId = req.user.providerId;
    const { amount, title, deadline, criteria } = req.body;
    
    // Your existing scholarship creation
    const scholarship = await createScholarship({
      providerId,
      amount,
      title,
      deadline,
      criteria,
    });
    
    // Calculate 3% platform fee
    const feeData = calculateProviderFee(amount); // Returns { fee_base_usd, fee_pct, fee_usd }
    
    // Emit scholarship posted with fee data
    await emitBusinessEvent('scholarship_posted', {
      scholarshipId: scholarship.id,
      ...feeData, // fee_base_usd, fee_pct: 0.03, fee_usd
      amount,
      category: req.body.category || 'general',
      eligibilityCriteria: Object.keys(criteria).length,
    }, {
      actorType: 'provider',
      actorId: providerId,
      orgId: providerId,
      sessionId: req.sessionID,
    });
    
    res.json({ scholarship, platformFee: feeData.fee_usd });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Event 5: provider_churned
**When**: Provider becomes inactive (no posts in 90+ days or closes account)
**Where**: Scheduled job or account closure

```typescript
import { emitBusinessEvent } from '../lib/business-events';

// In your account closure endpoint
app.post('/api/providers/:id/close', async (req, res) => {
  try {
    const providerId = req.params.id;
    const { reason } = req.body;
    
    // Your existing closure logic
    const lastPostDate = await getLastScholarshipPostDate(providerId);
    const daysSinceLastPost = Math.floor((Date.now() - lastPostDate.getTime()) / (1000 * 60 * 60 * 24));
    
    await closeProviderAccount(providerId);
    
    // Emit churn event
    await emitBusinessEvent('provider_churned', {
      reason, // 'voluntary' | 'inactive' | 'policy_violation' | 'other'
      daysSinceLastPost,
      totalScholarshipsPosted: await getProviderScholarshipCount(providerId),
      lifetimeRevenue: await getProviderLifetimeRevenue(providerId),
    }, {
      actorType: 'provider',
      actorId: providerId,
      orgId: providerId,
      sessionId: req.sessionID,
    });
    
    res.json({ success: true, status: 'closed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Automated churn detection (cron job)
async function detectInactiveProviders() {
  const inactiveProviders = await getProvidersInactiveFor(90); // 90 days
  
  for (const provider of inactiveProviders) {
    const daysSinceLastPost = Math.floor(
      (Date.now() - provider.lastPostDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    await emitBusinessEvent('provider_churned', {
      reason: 'inactive',
      daysSinceLastPost,
      totalScholarshipsPosted: provider.scholarshipCount,
      lifetimeRevenue: provider.lifetimeRevenue,
    }, {
      actorType: 'system',
      actorId: null,
      orgId: provider.id,
      requestId: generateRequestId(),
      sessionId: null,
    });
    
    await markProviderAsChurned(provider.id);
  }
}
```

## Verification Checklist

### Step 1: Emit Test Events
```bash
# Register provider
curl -X POST https://provider-register.replit.app/api/providers/register \
  -H "Content-Type: application/json" \
  -d '{"organizationName":"Test Foundation","organizationType":"foundation"}'

# Verify provider
curl -X POST https://provider-register.replit.app/api/providers/1/verify \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"verificationType":"manual_review","verifiedBy":"admin123"}'

# Post first scholarship (triggers provider_active + scholarship_posted)
curl -X POST https://provider-register.replit.app/api/scholarships \
  -H "Authorization: Bearer <provider-token>" \
  -d '{"amount":5000,"title":"Test Scholarship","deadline":"2026-06-01"}'

# Post second scholarship
curl -X POST https://provider-register.replit.app/api/scholarships \
  -H "Authorization: Bearer <provider-token>" \
  -d '{"amount":10000,"title":"Another Scholarship","deadline":"2026-07-01"}'
```

### Step 2: Verify in Database
```sql
-- Check all provider events (should see 4+ events)
SELECT 
  event_name,
  actor_type,
  org_id,
  properties,
  ts
FROM business_events
WHERE app = 'provider_register'
  AND ts > NOW() - interval '1 hour'
ORDER BY ts DESC;

-- Verify fee calculation is correct
SELECT 
  event_name,
  properties->>'fee_base_usd' as scholarship_amount,
  properties->>'fee_pct' as fee_percentage,
  properties->>'fee_usd' as platform_fee,
  (properties->>'fee_usd')::numeric = (properties->>'fee_base_usd')::numeric * 0.03 as fee_correct
FROM business_events
WHERE app = 'provider_register'
  AND event_name = 'scholarship_posted'
ORDER BY ts DESC;

-- Check provider lifecycle
SELECT 
  org_id,
  STRING_AGG(event_name, ' → ' ORDER BY ts) as lifecycle_path
FROM business_events
WHERE app = 'provider_register'
  AND org_id IS NOT NULL
GROUP BY org_id;

-- Expected path: provider_registered → provider_verified → provider_active → scholarship_posted
```

### Step 3: Check Executive KPI
```bash
# Trigger manual KPI generation
curl -X POST https://auto-com-center-jamarrlmayes.replit.app/api/executive/kpi/generate

# Should show:
# - Active providers (count of providers with scholarship_posted in last 90 days)
# - 3% fee revenue (sum of fee_usd from scholarship_posted events)
# - Provider activation rate (provider_active / provider_registered)
```

## Revenue Calculation Details

The 3% platform fee is calculated server-side:
```typescript
// Example: $10,000 scholarship
const feeData = calculateProviderFee(10000);
// Returns:
// {
//   fee_base_usd: 10000,
//   fee_pct: 0.03,
//   fee_usd: 300  // $10,000 × 3% = $300
// }
```

This ensures:
1. Consistent fee calculation across all endpoints
2. Server-side validation (client can't manipulate fees)
3. Accurate revenue reporting in Executive KPI

## Common Issues

### Issue: Fee calculation returns NaN
**Solution**: Ensure amount is a number, not string
```typescript
const amount = parseFloat(req.body.amount);
const feeData = calculateProviderFee(amount);
```

### Issue: provider_active never fires
**Solution**: Check scholarship count logic
```typescript
// Count AFTER creating scholarship
const scholarship = await createScholarship(...);
const count = await getProviderScholarshipCount(providerId);
if (count === 1) { /* emit provider_active */ }
```

### Issue: Multiple provider_active events for same provider
**Solution**: Add idempotency check
```typescript
const alreadyActive = await hasEmittedEvent(providerId, 'provider_active');
if (!alreadyActive && scholarshipCount === 1) {
  await emitBusinessEvent('provider_active', ...);
}
```

## Success Criteria
- ✅ All 5 events emit without errors
- ✅ `fee_usd` = `fee_base_usd` × 0.03 on all scholarship_posted events
- ✅ Executive KPI shows non-zero B2B metrics within 72 hours
- ✅ Provider registration → verification → posting tracked end-to-end

## Support
Questions? Check Executive Command Center:
- GET /api/prompts/verify - Verify prompts loaded
- GET /api/executive/kpi/latest - Latest KPI snapshot
- POST /api/events/log - Direct event logging endpoint
