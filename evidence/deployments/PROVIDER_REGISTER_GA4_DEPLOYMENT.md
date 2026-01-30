# provider_register GA4 "First Scholarship Created" Deployment Package

**Version**: 1.0.0  
**Prepared**: 2025-11-14 01:33:00 MST  
**Target**: provider_register mirrored workspace  
**Execution Time**: 30-45 minutes (Parallel with Hour 0-2)  

---

## Executive Summary

Wire "First Scholarship Created" activation event to GA4 for provider activation tracking. This is the B2B activation metric.

---

## Complete Implementation

### 1. Create Analytics Utility

**File**: `client/src/lib/analytics.ts`

```typescript
// Google Analytics 4 event tracking

interface GA4Event {
  event_name: string;
  event_params?: Record<string, any>;
}

// Send event to GA4
export function trackEvent(eventName: string, params?: Record<string, any>) {
  if (typeof window === 'undefined' || !window.gtag) {
    console.warn('GA4 not initialized');
    return;
  }

  window.gtag('event', eventName, params);
  console.log('GA4 event tracked:', eventName, params);
}

// Provider Activation Events
export const ProviderActivationEvents = {
  FIRST_SCHOLARSHIP_CREATED: 'first_scholarship_created',
  FIRST_APPLICANT_REVIEWED: 'first_applicant_reviewed',
  DOMAIN_VERIFIED: 'provider_domain_verified'
} as const;

// Track First Scholarship Created
export function trackFirstScholarshipCreated(params: {
  providerId: string;
  scholarshipTitle: string;
  amount: number;
  category: string;
  deadline: string;
  timeToCreate: number; // milliseconds from account creation
}) {
  trackEvent(ProviderActivationEvents.FIRST_SCHOLARSHIP_CREATED, {
    provider_id: params.providerId,
    scholarship_title: params.scholarshipTitle,
    amount: params.amount,
    category: params.category,
    deadline: params.deadline,
    time_to_create_seconds: Math.round(params.timeToCreate / 1000),
    activation_milestone: true,
    funnel_stage: 'activation',
    user_type: 'provider'
  });

  // Mark provider as activated
  markProviderAsActivated(params.providerId);
}

// Mark provider as activated
function markProviderAsActivated(providerId: string) {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('set', 'user_properties', {
    user_id: providerId,
    user_type: 'provider',
    activation_status: 'activated',
    activation_date: new Date().toISOString()
  });
}

// Declare gtag for TypeScript
declare global {
  interface Window {
    gtag?: (
      command: string,
      targetId: string | Date,
      config?: Record<string, any>
    ) => void;
    dataLayer?: any[];
  }
}
```

---

### 2. Update Scholarship Creation Component

**File**: `client/src/pages/CreateScholarship.tsx` (or wherever scholarship creation happens)

```typescript
import { useState, useEffect } from 'react';
import { trackFirstScholarshipCreated } from '@/lib/analytics';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

export function CreateScholarship({ providerId, accountCreatedAt }: { providerId: string, accountCreatedAt: Date }) {
  const { toast } = useToast();
  const [hasCreatedBefore, setHasCreatedBefore] = useState(false);

  // Check if provider has created scholarships before
  useEffect(() => {
    const hasCreated = localStorage.getItem(`provider_${providerId}_has_created_scholarship`);
    setHasCreatedBefore(hasCreated === 'true');
  }, [providerId]);

  const handleCreateScholarship = async (scholarshipData: any) => {
    try {
      // Create scholarship via API
      const scholarship = await apiRequest('/api/scholarships', {
        method: 'POST',
        body: JSON.stringify(scholarshipData)
      });

      // SUCCESS: Track if this is FIRST scholarship created
      if (!hasCreatedBefore) {
        const timeToCreate = Date.now() - new Date(accountCreatedAt).getTime();
        
        trackFirstScholarshipCreated({
          providerId,
          scholarshipTitle: scholarshipData.title,
          amount: scholarshipData.amount,
          category: scholarshipData.category,
          deadline: scholarshipData.deadline,
          timeToCreate
        });

        // Mark as created (prevent duplicate tracking)
        localStorage.setItem(`provider_${providerId}_has_created_scholarship`, 'true');
        setHasCreatedBefore(true);

        // Show activation celebration
        toast({
          title: '🎉 Congratulations!',
          description: 'Your first scholarship is live. Students can now apply!',
          duration: 5000
        });
      }

      // Invalidate scholarships query
      queryClient.invalidateQueries({ queryKey: ['/api/scholarships'] });

      toast({
        title: 'Scholarship created',
        description: `${scholarshipData.title} is now live`
      });
    } catch (error) {
      toast({
        title: 'Creation failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  // ... rest of component
}
```

---

### 3. Update Database Schema

**File**: `shared/schema.ts`

Add to providers table:
```typescript
export const providers = pgTable('providers', {
  // ... existing fields ...
  
  // Activation tracking
  isActivated: boolean('is_activated').default(false),
  activatedAt: timestamp('activated_at'),
  firstScholarshipCreatedAt: timestamp('first_scholarship_created_at')
});
```

Run migration:
```bash
npm run db:push
```

---

### 4. Update Backend Scholarship Creation Endpoint

**File**: `server/routes.ts`

```typescript
app.post('/api/scholarships', async (req, res) => {
  const providerId = req.user.id; // From auth middleware
  
  // Create scholarship...
  const scholarship = await storage.createScholarship({...req.body, providerId});

  // Check if this is provider's first scholarship
  const provider = await storage.getProviderById(providerId);
  if (!provider.firstScholarshipCreatedAt) {
    // Mark as activated
    await storage.updateProvider(providerId, {
      isActivated: true,
      activatedAt: new Date(),
      firstScholarshipCreatedAt: new Date()
    });

    console.log('Provider activated:', { providerId, activationMilestone: 'first_scholarship_created' });
  }

  res.json({ success: true, scholarship });
});
```

---

### 5. Verify GA4 Initialization

**File**: `client/index.html`

```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

Replace `G-XXXXXXXXXX` with value from `VITE_GA_MEASUREMENT_ID` env var.

---

## Testing Procedure

### 1. Browser Console Test

```javascript
// After implementing, test in browser console
trackFirstScholarshipCreated({
  providerId: 'test_provider_123',
  scholarshipTitle: 'Test Scholarship',
  amount: 5000,
  category: 'academic',
  deadline: '2025-12-31',
  timeToCreate: 300000 // 5 minutes
});

// Check dataLayer
console.log(window.dataLayer);
```

### 2. GA4 DebugView

1. Go to GA4 → Configure → DebugView
2. Create a scholarship in provider_register
3. Event `first_scholarship_created` should appear within 30 seconds
4. Verify event parameters:
   - provider_id
   - scholarship_title
   - amount
   - category
   - deadline
   - time_to_create_seconds
   - activation_milestone: true
   - funnel_stage: activation
   - user_type: provider

### 3. Evidence Required

**Screenshot showing**:
- GA4 DebugView with `first_scholarship_created` event
- Event parameters expanded
- Timestamp showing event fired

---

## Environment Variables

```bash
# GA4 Measurement ID
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX  # Get from GA4 dashboard
```

---

## Deployment Checklist

- [ ] Create `client/src/lib/analytics.ts` with GA4 utilities
- [ ] Update CreateScholarship component to track first creation
- [ ] Add activation fields to providers table schema
- [ ] Run `npm run db:push` to apply schema changes
- [ ] Update scholarship creation endpoint to mark activation
- [ ] Verify GA4 script in `index.html`
- [ ] Set `VITE_GA_MEASUREMENT_ID` in Replit Secrets
- [ ] Test event firing in browser console
- [ ] Verify event appears in GA4 DebugView
- [ ] Take screenshot for evidence package

---

## B2B Funnel Tracking

**Key Metrics to Monitor**:
1. **Activation Rate**: (Providers with first_scholarship_created) / (Total provider signups)
2. **Time to Activation**: Average `time_to_create_seconds`
3. **Scholarship Category Distribution**: Which categories do providers start with?
4. **Average First Scholarship Amount**: Indicates provider quality

**Create GA4 Custom Report**:
- Dimensions: Event name, Provider ID, Category, Amount ranges
- Metrics: Event count, Providers, % of total providers
- Filter: `event_name = first_scholarship_created AND user_type = provider`

---

**Deployment Package Complete**  
**Estimated Implementation Time**: 30-45 minutes  
**CEO Priority**: HIGH - B2B activation tracking
