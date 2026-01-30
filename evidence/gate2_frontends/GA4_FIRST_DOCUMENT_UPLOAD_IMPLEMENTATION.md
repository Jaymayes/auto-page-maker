# GA4 "First Document Upload" Activation Event Implementation

**Prepared**: 2025-11-14 01:10:00 MST (T+10)  
**Target Applications**: student_pilot, provider_register  
**CEO Directive**: "Wire GA4 'First Document Upload' activation event now. This is our B2C activation lever."  

---

## Why This Matters (CEO Context)

**Per Playbook V2.0**: "Document Hub activation is our most reliable engagement lever—optimize around it."

**B2C Funnel**:
1. User signs up (acquisition)
2. **User uploads first document** ← **ACTIVATION POINT** (this event)
3. User receives scholarship recommendations (engagement)
4. User applies to scholarships (conversion)
5. User purchases credits (monetization)

**This event measures**: % of new users reaching value creation milestone.

---

## Implementation

### 1. GA4 Event Tracking Utility

**File**: `client/src/lib/analytics.ts` (create if doesn't exist)

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

// Activation Events (Primary KPIs)
export const ActivationEvents = {
  FIRST_DOCUMENT_UPLOAD: 'first_document_upload',
  FIRST_APPLICATION_SUBMIT: 'first_application_submit',
  FIRST_SCHOLARSHIP_MATCH: 'first_scholarship_match'
} as const;

// Track First Document Upload (CEO Priority Event)
export function trackFirstDocumentUpload(params: {
  userId: string;
  documentType: string; // 'resume', 'transcript', 'essay', etc.
  documentSize: number; // bytes
  uploadMethod: 'drag_drop' | 'file_picker' | 'paste';
  timeToUpload: number; // milliseconds from page load
}) {
  trackEvent(ActivationEvents.FIRST_DOCUMENT_UPLOAD, {
    user_id: params.userId,
    document_type: params.documentType,
    document_size_kb: Math.round(params.documentSize / 1024),
    upload_method: params.uploadMethod,
    time_to_upload_seconds: Math.round(params.timeToUpload / 1000),
    activation_milestone: true, // Flag for executive dashboard
    funnel_stage: 'activation'
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

### 2. Document Upload Component Integration

**File**: `client/src/components/DocumentUpload.tsx` (or wherever upload happens)

```typescript
import { useState, useEffect } from 'react';
import { trackFirstDocumentUpload } from '@/lib/analytics';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

export function DocumentUpload({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [pageLoadTime] = useState(Date.now());
  const [hasUploadedBefore, setHasUploadedBefore] = useState(false);

  // Check if user has uploaded before (to identify FIRST upload)
  useEffect(() => {
    // Check localStorage or user profile
    const hasUploaded = localStorage.getItem(`user_${userId}_has_uploaded_document`);
    setHasUploadedBefore(hasUploaded === 'true');
  }, [userId]);

  const handleFileUpload = async (file: File, uploadMethod: 'drag_drop' | 'file_picker' | 'paste') => {
    try {
      // Determine document type from file
      const documentType = getDocumentType(file.name, file.type);
      
      // Upload file to backend
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', documentType);
      
      const response = await apiRequest('/api/documents/upload', {
        method: 'POST',
        body: formData
      });

      // SUCCESS: Track if this is FIRST document upload
      if (!hasUploadedBefore) {
        const timeToUpload = Date.now() - pageLoadTime;
        
        trackFirstDocumentUpload({
          userId,
          documentType,
          documentSize: file.size,
          uploadMethod,
          timeToUpload
        });

        // Mark as uploaded (prevent duplicate tracking)
        localStorage.setItem(`user_${userId}_has_uploaded_document`, 'true');
        setHasUploadedBefore(true);

        // Show activation celebration
        toast({
          title: '🎉 Great start!',
          description: 'Your first document is uploaded. Let\'s find scholarships for you!',
          duration: 5000
        });
      }

      // Invalidate documents query
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });

      toast({
        title: 'Document uploaded',
        description: `${file.name} uploaded successfully`
      });
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  // ... rest of component
}

// Helper to determine document type
function getDocumentType(filename: string, mimeType: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  if (ext === 'pdf' && filename.toLowerCase().includes('resume')) return 'resume';
  if (ext === 'pdf' && filename.toLowerCase().includes('cv')) return 'resume';
  if (ext === 'pdf' && filename.toLowerCase().includes('transcript')) return 'transcript';
  if (ext === 'pdf') return 'essay';
  if (['doc', 'docx'].includes(ext)) return 'essay';
  if (['jpg', 'jpeg', 'png'].includes(ext)) return 'photo';
  
  return 'other';
}
```

---

### 3. GA4 Configuration (index.html)

**File**: `client/index.html`

Ensure GA4 is initialized:

```html
<!-- Google Analytics 4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  // Configure GA4
  gtag('config', 'G-XXXXXXXXXX', {
    send_page_view: true,
    user_id: undefined, // Set after authentication
    custom_map: {
      dimension1: 'user_type', // student, provider, admin
      dimension2: 'activation_status', // activated, not_activated
      dimension3: 'document_count'
    }
  });
</script>
```

**Replace `G-XXXXXXXXXX` with actual GA4 Measurement ID** (from `VITE_GA_MEASUREMENT_ID` env var).

---

### 4. User Property Tracking (Mark Activated Users)

**File**: `client/src/lib/analytics.ts` (add to existing file)

```typescript
// Set user as "activated" after first document upload
export function markUserAsActivated(userId: string) {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('set', 'user_properties', {
    user_id: userId,
    activation_status: 'activated',
    activation_date: new Date().toISOString()
  });
}

// Call this after tracking first document upload
export function trackFirstDocumentUpload(params: {
  userId: string;
  documentType: string;
  documentSize: number;
  uploadMethod: 'drag_drop' | 'file_picker' | 'paste';
  timeToUpload: number;
}) {
  // Track event
  trackEvent(ActivationEvents.FIRST_DOCUMENT_UPLOAD, {
    user_id: params.userId,
    document_type: params.documentType,
    document_size_kb: Math.round(params.documentSize / 1024),
    upload_method: params.uploadMethod,
    time_to_upload_seconds: Math.round(params.timeToUpload / 1000),
    activation_milestone: true,
    funnel_stage: 'activation'
  });

  // Mark user as activated
  markUserAsActivated(params.userId);
}
```

---

### 5. Backend: Track Activation in Database

**File**: `shared/schema.ts` (add field to users table)

```typescript
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  // ... other fields ...
  
  // Activation tracking
  isActivated: boolean('is_activated').default(false),
  activatedAt: timestamp('activated_at'),
  firstDocumentUploadedAt: timestamp('first_document_uploaded_at')
});
```

**File**: `server/routes.ts` (update document upload endpoint)

```typescript
app.post('/api/documents/upload', async (req, res) => {
  const userId = req.user.id; // From auth middleware
  
  // Upload document logic...
  const document = await storage.createDocument({...});

  // Check if this is user's first document
  const user = await storage.getUserById(userId);
  if (!user.firstDocumentUploadedAt) {
    // Mark as activated
    await storage.updateUser(userId, {
      isActivated: true,
      activatedAt: new Date(),
      firstDocumentUploadedAt: new Date()
    });

    console.log('User activated:', { userId, activationMilestone: 'first_document_upload' });
  }

  res.json({ success: true, document });
});
```

---

### 6. Provider Registration (Same Pattern)

**File**: `client/src/pages/ProviderRegistration.tsx` (in provider_register workspace)

Same pattern for provider activation:

```typescript
import { trackEvent } from '@/lib/analytics';

const ProviderActivationEvents = {
  FIRST_SCHOLARSHIP_CREATED: 'first_scholarship_created',
  FIRST_APPLICANT_REVIEWED: 'first_applicant_reviewed'
} as const;

// When provider creates their first scholarship
function trackFirstScholarshipCreated(providerId: string, scholarshipData: any) {
  trackEvent(ProviderActivationEvents.FIRST_SCHOLARSHIP_CREATED, {
    provider_id: providerId,
    scholarship_amount: scholarshipData.amount,
    activation_milestone: true,
    funnel_stage: 'activation',
    user_type: 'provider'
  });

  // Mark provider as activated
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('set', 'user_properties', {
      user_id: providerId,
      user_type: 'provider',
      activation_status: 'activated',
      activation_date: new Date().toISOString()
    });
  }
}
```

---

### 7. GA4 Dashboard Configuration

**Create Custom Report in GA4**:

1. Go to GA4 → Explore → Create new exploration
2. Add these dimensions:
   - Event name
   - User ID
   - Document type
   - Upload method
3. Add these metrics:
   - Event count (first_document_upload)
   - Users
   - % of total users (activation rate)
4. Filter: `event_name = first_document_upload`
5. Save as "B2C Activation Funnel"

**Key Metrics to Track**:
- **Activation Rate**: (Users with first_document_upload) / (Total signups)
- **Time to Activation**: Average `time_to_upload_seconds` from event params
- **Document Type Distribution**: Which documents do users upload first?
- **Cohort Activation**: Track activation rate by signup cohort

---

### 8. Testing the Implementation

**Manual Test**:
```typescript
// In browser console after implementing
trackFirstDocumentUpload({
  userId: 'test_user_123',
  documentType: 'resume',
  documentSize: 50000,
  uploadMethod: 'file_picker',
  timeToUpload: 15000
});

// Check: window.dataLayer should show the event
console.log(window.dataLayer);
```

**Verify in GA4**:
1. Go to GA4 → Configure → DebugView
2. Perform a document upload
3. Event should appear within 30 seconds
4. Check event parameters are correct

---

### 9. Required Environment Variables

**Add to both student_pilot and provider_register**:

```bash
# .env
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX  # Replace with actual GA4 ID
```

**Check secret**:
```bash
# In Replit Secrets
VITE_GA_MEASUREMENT_ID  # Must be present for GA4 to work
```

---

### 10. Implementation Checklist

**student_pilot**:
- [ ] Create `client/src/lib/analytics.ts`
- [ ] Add `trackFirstDocumentUpload()` to DocumentUpload component
- [ ] Update `shared/schema.ts` with activation fields
- [ ] Update `/api/documents/upload` endpoint
- [ ] Verify GA4 initialization in `index.html`
- [ ] Test event tracking in DebugView

**provider_register**:
- [ ] Create `client/src/lib/analytics.ts`
- [ ] Add `trackFirstScholarshipCreated()` to scholarship creation form
- [ ] Update `shared/schema.ts` with provider activation fields
- [ ] Update `/api/scholarships` endpoint
- [ ] Verify GA4 initialization in `index.html`
- [ ] Test event tracking in DebugView

---

**Prepared By**: Agent3 (Program Integrator)  
**Ready for Application**: Upon student_pilot and provider_register workspace access  
**Estimated Implementation Time**: 30-45 minutes per application  
**CEO Priority**: HIGH - This is the B2C activation North Star metric
