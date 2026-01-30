# Student Pilot - Business Events Implementation Guide
**Priority: Week 1 (Critical for B2C Revenue Visibility)**

## Overview
Student Pilot drives B2C revenue through credit purchases and application submissions. This guide shows you exactly how to instrument the 6 required business events.

## Setup (Copy-Paste)

### 1. Copy Business Events Library
```bash
# Copy from Executive Command Center
cp server/lib/business-events.ts <your-repo>/server/lib/
```

### 2. Set Environment Variables
```bash
# Add to .env
APP_NAME=student_pilot
NODE_ENV=production
DATABASE_URL=<your-db-url>
```

### 3. Load System Prompts
```bash
# Copy prompts
mkdir -p docs/system-prompts
cp docs/system-prompts/shared_directives.prompt <your-repo>/docs/system-prompts/
cp docs/system-prompts/student_pilot.prompt <your-repo>/docs/system-prompts/

# Set in .env
SHARED_PROMPT_PATH=docs/system-prompts/shared_directives.prompt
SYSTEM_PROMPT_PATH=docs/system-prompts/student_pilot.prompt
```

## Required Events (6 Total)

### Event 1: student_signup
**When**: User completes registration
**Where**: After successful account creation

```typescript
import { emitBusinessEvent } from '../lib/business-events';

// In your signup endpoint
app.post('/api/auth/signup', async (req, res) => {
  try {
    // Your existing signup logic
    const user = await createUser(req.body);
    
    // Emit event (fire-and-forget)
    await emitBusinessEvent('student_signup', {
      signupSource: req.query.utm_source || 'direct',
      referralCode: req.body.referralCode || null,
    }, {
      actorType: 'student',
      actorId: user.id,
      sessionId: req.sessionID,
    });
    
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Event 2: profile_completed
**When**: Student completes ≥70% of profile fields
**Where**: After profile update

```typescript
import { emitBusinessEvent } from '../lib/business-events';

// In your profile update endpoint
app.patch('/api/profile', async (req, res) => {
  try {
    const userId = req.user.id;
    const updatedProfile = await updateProfile(userId, req.body);
    
    // Calculate completion
    const requiredFields = ['name', 'email', 'gpa', 'major', 'graduationYear'];
    const completedFields = requiredFields.filter(f => updatedProfile[f]);
    const completionPercent = (completedFields.length / requiredFields.length) * 100;
    
    // Emit if >= 70% complete
    if (completionPercent >= 70) {
      await emitBusinessEvent('profile_completed', {
        completionPercent,
        fieldsCompleted: completedFields,
      }, {
        actorType: 'student',
        actorId: userId,
        sessionId: req.sessionID,
      });
    }
    
    res.json({ profile: updatedProfile, completionPercent });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Event 3: match_viewed
**When**: Student views a scholarship match detail page
**Where**: Scholarship detail GET endpoint

```typescript
import { emitBusinessEvent } from '../lib/business-events';

// In your scholarship detail endpoint
app.get('/api/matches/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const scholarship = await getScholarship(req.params.id);
    
    // Emit view event (works for anonymous too)
    await emitBusinessEvent('match_viewed', {
      scholarshipId: req.params.id,
      segment: scholarship.segment, // 'high_likelihood' | 'competitive' | 'long_shot'
      matchScore: scholarship.matchScore || 0,
      amount: scholarship.amount,
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

### Event 4: credit_purchased ⭐ (Revenue Event)
**When**: Student completes credit purchase
**Where**: After successful payment

```typescript
import { emitBusinessEvent, normalizeRevenue } from '../lib/business-events';

// In your payment success endpoint
app.post('/api/credits/purchase', async (req, res) => {
  try {
    const userId = req.user.id;
    const { amountCents, creditQuantity, paymentId } = req.body;
    
    // Your existing payment processing
    const purchase = await processPayment({ userId, amountCents, creditQuantity, paymentId });
    
    // Emit revenue event
    const revenueData = normalizeRevenue(amountCents, { 
      paymentId, 
      creditAmount: creditQuantity 
    });
    
    await emitBusinessEvent('credit_purchased', {
      ...revenueData, // revenue_usd, payment_id, credit_amount
      creditQuantity,
      purchaseId: purchase.id,
    }, {
      actorType: 'student',
      actorId: userId,
      sessionId: req.sessionID,
    });
    
    res.json({ success: true, credits: purchase.credits });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Event 5: credit_spent ⭐ (Revenue Attribution)
**When**: Student uses credits (essay assistance, AI features, etc.)
**Where**: After credit deduction

```typescript
import { emitBusinessEvent, normalizeRevenue } from '../lib/business-events';

// In your credit consumption endpoint
app.post('/api/credits/spend', async (req, res) => {
  try {
    const userId = req.user.id;
    const { creditsSpent, feature, scholarshipId } = req.body;
    
    // Your existing credit deduction
    const creditValueCents = creditsSpent * 100; // $1 per credit
    await deductCredits(userId, creditsSpent);
    
    // Emit spend event with revenue attribution
    const revenueData = normalizeRevenue(creditValueCents, { creditAmount: creditsSpent });
    
    await emitBusinessEvent('credit_spent', {
      ...revenueData,
      creditsSpent,
      feature, // 'essay_assistance' | 'ai_match' | 'premium_checklist' etc.
      scholarshipId: scholarshipId || null,
    }, {
      actorType: 'student',
      actorId: userId,
      sessionId: req.sessionID,
    });
    
    res.json({ success: true, remainingCredits: await getCredits(userId) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Event 6: application_submitted
**When**: Student submits scholarship application
**Where**: After successful application submission

```typescript
import { emitBusinessEvent } from '../lib/business-events';

// In your application submission endpoint
app.post('/api/applications/:scholarshipId/submit', async (req, res) => {
  try {
    const userId = req.user.id;
    const { scholarshipId } = req.params;
    
    // Your existing submission logic
    const startTime = req.body.startedAt ? new Date(req.body.startedAt) : new Date();
    const completionTimeMinutes = (Date.now() - startTime.getTime()) / (1000 * 60);
    
    const application = await submitApplication({
      userId,
      scholarshipId,
      answers: req.body.answers,
    });
    
    // Emit submission event
    await emitBusinessEvent('application_submitted', {
      applicationId: application.id,
      scholarshipId,
      completionTimeMinutes: Math.round(completionTimeMinutes),
      creditsUsed: req.body.creditsUsed || 0,
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

## Verification Checklist

### Step 1: Emit Test Events
```bash
# Create a test student journey
curl -X POST https://student-pilot.replit.app/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Complete profile
curl -X PATCH https://student-pilot.replit.app/api/profile \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"Test","gpa":3.5,"major":"CS","graduationYear":2026}'

# View match
curl https://student-pilot.replit.app/api/matches/1

# Purchase credits
curl -X POST https://student-pilot.replit.app/api/credits/purchase \
  -H "Authorization: Bearer <token>" \
  -d '{"amountCents":2000,"creditQuantity":20,"paymentId":"pay_test123"}'

# Spend credits
curl -X POST https://student-pilot.replit.app/api/credits/spend \
  -H "Authorization: Bearer <token>" \
  -d '{"creditsSpent":5,"feature":"essay_assistance"}'

# Submit application
curl -X POST https://student-pilot.replit.app/api/applications/1/submit \
  -H "Authorization: Bearer <token>" \
  -d '{"answers":{},"creditsUsed":5}'
```

### Step 2: Verify in Database
```sql
-- Check events logged (should see 6 events)
SELECT 
  event_name,
  actor_type,
  actor_id,
  properties,
  ts
FROM business_events
WHERE app = 'student_pilot'
  AND ts > NOW() - interval '1 hour'
ORDER BY ts DESC;

-- Verify revenue events have correct structure
SELECT 
  event_name,
  properties->>'revenue_usd' as revenue,
  properties->>'payment_id' as payment_id,
  properties->>'credit_amount' as credits
FROM business_events
WHERE app = 'student_pilot'
  AND event_name IN ('credit_purchased', 'credit_spent')
ORDER BY ts DESC;
```

### Step 3: Check Executive KPI
```bash
# Trigger manual KPI generation
curl -X POST https://auto-com-center-jamarrlmayes.replit.app/api/executive/kpi/generate

# Should show:
# - B2C conversion rate (signups → credit purchases)
# - ARPU from credits (total revenue_usd / unique students)
# - Application completion rate (started → submitted)
```

## Common Issues

### Issue: Events not appearing in database
**Solution**: Check that `DATABASE_URL` is set and `business_events` table exists
```bash
npm run db:push --force
```

### Issue: Revenue is null or undefined
**Solution**: Always use `normalizeRevenue()` helper
```typescript
const revenueData = normalizeRevenue(amountCents, { paymentId, creditAmount });
```

### Issue: Session ID is always null
**Solution**: Ensure express-session middleware is configured
```typescript
import session from 'express-session';
app.use(session({ secret: 'your-secret', resave: false, saveUninitialized: true }));
```

## Success Criteria
- ✅ All 6 events emit without errors
- ✅ `revenue_usd` present on credit_purchased and credit_spent
- ✅ Executive KPI shows non-zero B2C metrics within 72 hours
- ✅ Student signup → purchase → submit journey tracked end-to-end

## Support
Questions? Check Executive Command Center:
- GET /api/prompts/verify - Verify prompts loaded
- GET /api/executive/kpi/latest - Latest KPI snapshot
- POST /api/events/log - Direct event logging endpoint
