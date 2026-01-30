# student_pilot GA4 "First Document Upload" Deployment Package

**Version**: 1.0.0  
**Prepared**: 2025-11-14 01:32:00 MST  
**Target**: student_pilot mirrored workspace  
**Execution Time**: 30-45 minutes (Parallel with Hour 0-2)  

---

## Executive Summary

Wire "First Document Upload" activation event to GA4. This is the B2C activation North Star metric per CEO directive: "Document Hub activation is our most reliable engagement lever—optimize around it."

---

## Complete Implementation

**(See `evidence/gate2_frontends/GA4_FIRST_DOCUMENT_UPLOAD_IMPLEMENTATION.md` for detailed code and rationale)**

This package includes:
1. GA4 event tracking utility (`client/src/lib/analytics.ts`)
2. `trackFirstDocumentUpload()` with all required params
3. Integration into DocumentUpload component
4. User activation property tracking
5. Backend database fields for activation status
6. Testing procedures

---

## Quick Deployment Guide

### 1. Create Analytics Utility

**File**: `client/src/lib/analytics.ts`

```typescript
// Copy complete implementation from evidence/gate2_frontends/GA4_FIRST_DOCUMENT_UPLOAD_IMPLEMENTATION.md
// Section 1: GA4 Event Tracking Utility
```

### 2. Update Document Upload Component

**File**: `client/src/components/DocumentUpload.tsx`

```typescript
// Copy complete implementation from evidence/gate2_frontends/GA4_FIRST_DOCUMENT_UPLOAD_IMPLEMENTATION.md
// Section 2: Document Upload Component Integration
```

### 3. Update Database Schema

**File**: `shared/schema.ts`

Add to users table:
```typescript
export const users = pgTable('users', {
  // ... existing fields ...
  
  // Activation tracking
  isActivated: boolean('is_activated').default(false),
  activatedAt: timestamp('activated_at'),
  firstDocumentUploadedAt: timestamp('first_document_uploaded_at')
});
```

Run migration:
```bash
npm run db:push
```

### 4. Update Backend Upload Endpoint

**File**: `server/routes.ts`

```typescript
app.post('/api/documents/upload', async (req, res) => {
  const userId = req.user.id;
  
  // Upload document...
  const document = await storage.createDocument({...});

  // Check if first document
  const user = await storage.getUserById(userId);
  if (!user.firstDocumentUploadedAt) {
    await storage.updateUser(userId, {
      isActivated: true,
      activatedAt: new Date(),
      firstDocumentUploadedAt: new Date()
    });
    console.log('User activated:', { userId, milestone: 'first_document_upload' });
  }

  res.json({ success: true, document });
});
```

### 5. Verify GA4 Initialization

**File**: `client/index.html`

Ensure GA4 is initialized with correct Measurement ID:

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
trackFirstDocumentUpload({
  userId: 'test_user_123',
  documentType: 'resume',
  documentSize: 50000,
  uploadMethod: 'file_picker',
  timeToUpload: 15000
});

// Check dataLayer
console.log(window.dataLayer);
```

### 2. GA4 DebugView

1. Go to GA4 → Configure → DebugView
2. Upload a document in student_pilot
3. Event `first_document_upload` should appear within 30 seconds
4. Verify event parameters:
   - user_id
   - document_type
   - document_size_kb
   - upload_method
   - time_to_upload_seconds
   - activation_milestone: true
   - funnel_stage: activation

### 3. Evidence Required

**Screenshot showing**:
- GA4 DebugView with `first_document_upload` event
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
- [ ] Update DocumentUpload component to track first upload
- [ ] Add activation fields to users table schema
- [ ] Run `npm run db:push` to apply schema changes
- [ ] Update document upload endpoint to mark activation
- [ ] Verify GA4 script in `index.html`
- [ ] Set `VITE_GA_MEASUREMENT_ID` in Replit Secrets
- [ ] Test event firing in browser console
- [ ] Verify event appears in GA4 DebugView
- [ ] Take screenshot for evidence package

---

## B2C Funnel Tracking

**Key Metrics to Monitor**:
1. **Activation Rate**: (Users with first_document_upload) / (Total signups)
2. **Time to Activation**: Average `time_to_upload_seconds`
3. **Document Type Distribution**: Which documents activate users?
4. **Cohort Activation**: Activation rate by signup cohort

**Create GA4 Custom Report**:
- Dimensions: Event name, User ID, Document type, Upload method
- Metrics: Event count, Users, % of total users
- Filter: `event_name = first_document_upload`

---

**Deployment Package Complete**  
**Estimated Implementation Time**: 30-45 minutes  
**CEO Priority**: HIGH - B2C activation North Star metric
