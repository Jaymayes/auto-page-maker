# Issue C: A8 Stale Incident Banners

**Target Repository:** auto-com-center (A8)
**Status:** PATCH SPECIFICATION (Requires A8 codebase access)

---

## Problem Statement

A8 incident banners can become stale when:
- An incident is resolved but banner persists
- Manual intervention is required to clear banners
- Old banners clutter the dashboard and create confusion

## Solution Design

### Before
- Banners set manually via admin action
- No automatic expiration
- Must manually clear after incident resolution

### After
- Banners have configurable TTL (default: 4 hours)
- Auto-clear when recovery detected (dependency status changes healthy→healthy)
- Admin endpoint to force-clear banners
- Auth-protected clear endpoint

---

## Implementation Specification

### Banner Schema Update

```typescript
interface IncidentBanner {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  createdAt: Date;
  expiresAt: Date | null;  // NEW: TTL support
  autoCleared: boolean;    // NEW: Track auto-clear
  clearedBy: string | null; // NEW: Admin who cleared
}
```

### TTL Configuration

```bash
# Banner TTL in hours (default 4)
BANNER_TTL_HOURS=4

# Enable auto-clear on recovery
BANNER_AUTO_CLEAR=true
```

### Admin Clear Endpoint

```typescript
// POST /api/admin/banners/:id/clear
// Auth: Admin role required

app.post('/api/admin/banners/:id/clear', 
  requireAuth, 
  requireAdmin, 
  async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    
    await bannerService.clearBanner(id, {
      clearedBy: req.user.email,
      reason,
      clearType: 'manual'
    });
    
    await auditLog.record({
      action: 'banner_cleared',
      bannerId: id,
      clearedBy: req.user.email,
      reason
    });
    
    res.json({ success: true });
  }
);
```

### Auto-Clear Logic

```typescript
// In health monitoring service
async function onHealthStatusChange(
  dependency: string, 
  oldStatus: string, 
  newStatus: string
) {
  if (oldStatus !== 'healthy' && newStatus === 'healthy') {
    // Dependency recovered
    const banners = await bannerService.getActiveBannersForDependency(dependency);
    
    for (const banner of banners) {
      await bannerService.clearBanner(banner.id, {
        clearType: 'auto',
        reason: `${dependency} recovered (${oldStatus} → ${newStatus})`
      });
    }
  }
}
```

---

## Feature Flags

| Flag | Default | Description |
|------|---------|-------------|
| `BANNER_TTL_HOURS` | `4` | Banner expiration time |
| `BANNER_AUTO_CLEAR` | `true` | Auto-clear on recovery |

---

## Risk Analysis

| Risk | Mitigation | Severity |
|------|------------|----------|
| Banner cleared too early | Configurable TTL, manual override | Low |
| Auto-clear false positive | Only clear on full recovery | Low |
| Audit trail missing | Comprehensive logging | Low |

---

## Rollback Plan

1. Set `BANNER_AUTO_CLEAR=false`
2. Increase `BANNER_TTL_HOURS=168` (1 week)
3. Manual clearing continues to work

---

## Security Review

- Clear endpoint requires admin authentication
- Audit log for all clear operations
- No PII in banner messages

---

## Tests Required

1. Unit test: Banner expires after TTL
2. Unit test: Auto-clear on recovery
3. Unit test: Admin clear with auth
4. Integration test: Audit logging
5. E2E: Banner lifecycle (create → expire)

---

## Merge Instructions

1. Apply this patch to the A8 (auto-com-center) repository
2. Add database migration for new banner fields
3. Add tests per specification
4. Deploy to staging with `BANNER_AUTO_CLEAR=true`
5. Verify banner auto-clear behavior
6. Roll out to production
