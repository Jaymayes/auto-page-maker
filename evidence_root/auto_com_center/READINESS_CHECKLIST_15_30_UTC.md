# 15:30 UTC Readiness Check - auto_com_center
## Gate A Preparation Checklist

**Date**: 2025-11-12  
**Time**: 15:30 UTC Target  
**DRI**: Agent3 (auto_com_center)  
**APP_BASE_URL**: https://auto-com-center-jamarrlmayes.replit.app

---

## CEO-Required Checklist Items

Per CEO directive: "Required on Postmark: SPF pass, DKIM verified (green), DMARC policy published (p=none acceptable for Gate A), webhooks live, seed-list test plan queued."

### 1. SPF Pass ⏳
**Requirement**: SPF authentication passing via Return-Path CNAME

**DNS Record Required**:
```
Type: CNAME
Host: pm-bounces.scholarmatch.com
Value: pm.mtasv.net
```

**Verification Steps**:
- [ ] DNS record added to provider
- [ ] Postmark shows Return-Path verified
- [ ] Test email headers show `spf=pass`

**Status**: 🟡 PENDING - Awaiting DNS configuration

---

### 2. DKIM Verified (Green Checkmark) ⏳
**Requirement**: DKIM record propagated and verified in Postmark dashboard

**DNS Record Status**:
```
Type: TXT (via CNAME delegation)
Host: 20251112142637pm._domainkey.scholarmatch.com
Status: Added, awaiting propagation
```

**Verification Steps**:
- [x] DNS record added to provider (14:00 UTC)
- [ ] DNS propagation complete (typical: 5-30 min)
- [ ] Postmark dashboard shows green checkmark
- [ ] Test email headers show `dkim=pass`

**Status**: 🟡 IN PROGRESS - DNS propagating (normal timeline)

**Expected**: Green checkmark by 15:00-15:30 UTC

---

### 3. DMARC Policy Published ⏳
**Requirement**: DMARC policy set to `p=none` (CEO-approved for Gate A)

**DNS Record Required**:
```
Type: TXT
Host: _dmarc.scholarmatch.com
Value: v=DMARC1; p=none; pct=100; rua=mailto:dmarc@scholarmatch.com; aspf=r;
```

**Verification Steps**:
- [ ] DNS record added to provider
- [ ] DNS propagation verified
- [ ] Test email headers show `dmarc=pass (p=NONE)`

**Status**: 🟡 PENDING - Awaiting DNS configuration

**Policy Details**:
- `p=none`: Monitor-only mode (approved for tonight)
- `aspf=r`: Relaxed SPF alignment (required for Postmark)
- `rua=mailto:dmarc@scholarmatch.com`: Aggregate reports destination
- **Escalation Path**: Move to `p=quarantine` after 48h of ≥95% placement, then `p=reject` after 7 days

---

### 4. Webhooks Live ⏳
**Requirement**: Postmark webhooks configured for delivery events

**Webhook Types Needed**:
- Delivery (successful sends)
- Bounce (hard/soft bounces)
- Spam Complaint (spam reports)
- Open (optional, GDPR consideration)
- Click (optional, tracking links)

**Configuration Steps**:
- [ ] Log into Postmark → Servers → Webhooks
- [ ] Add webhook URL: `https://auto-com-center-jamarrlmayes.replit.app/api/webhooks/postmark`
- [ ] Enable: Delivery, Bounce, Spam Complaint events
- [ ] Test webhook with sample event
- [ ] Verify webhook signature validation

**Status**: 🔴 NOT STARTED - Configuration needed

**Endpoint**: `/api/webhooks/postmark` (to be implemented)

---

### 5. Seed-List Test Plan Queued ✅
**Requirement**: 20-address seed list prepared for inbox placement testing

**Seed List**: `evidence_root/auto_com_center/seed_list_20_addresses.json`

**Composition**:
- Gmail: 8 addresses (40%)
- Outlook: 7 addresses (35%)
- iCloud: 5 addresses (25%)

**Test Procedure**:
1. Send test email to all 20 addresses
2. Wait 5 minutes for delivery
3. Check inbox placement per provider
4. Calculate: (Primary Inbox / Total Sent) × 100%
5. **Pass**: ≥19/20 in primary inbox (95%)

**Status**: ✅ PREPARED - Seed list documented

**Note**: Placeholder addresses provided - replace with real accessible accounts for actual testing

---

## Additional Readiness Items

### 6. API Endpoints Operational ✅
**Status**: ✅ DEPLOYED

Endpoints verified:
- [x] `/api/dkim/status` - Provider configuration
- [x] `/api/dkim/dns-records` - DNS setup guide
- [x] `/api/dkim/test` - Send verification test
- [x] `/send` - Transactional email (legacy)
- [x] `/api/send` - Transactional email (v2)

**Testing**:
```bash
# Status check
curl http://localhost:5000/api/dkim/status

# DNS records guide
curl http://localhost:5000/api/dkim/dns-records

# Send test email
curl -X POST http://localhost:5000/api/dkim/test \
  -H "Content-Type: application/json" \
  -d '{"test_email": "test@example.com"}'
```

---

### 7. Postmark API Key Configured ✅
**Status**: ✅ ACTIVE

```json
{
  "provider": "postmark",
  "configured": true,
  "api_key_set": {
    "postmark": true,
    "sendgrid": true,
    "ses": false
  }
}
```

---

### 8. SendGrid Pre-Staging (Contingency) ⏳
**Requirement**: SendGrid DNS records pre-staged for 16:00 UTC pivot

**DNS Records Needed** (if pivot required):
```
# DKIM s1
Type: CNAME
Host: s1._domainkey.scholarmatch.com
Value: s1.domainkey.[uid].wl[id].sendgrid.net

# DKIM s2
Type: CNAME
Host: s2._domainkey.scholarmatch.com
Value: s2.domainkey.[uid].wl[id].sendgrid.net

# Domain verification
Type: CNAME
Host: [as provided by SendGrid]
Value: [as provided by SendGrid]
```

**Action Required**:
1. Log into SendGrid: https://app.sendgrid.com
2. Settings → Sender Authentication → Authenticate Domain
3. Enter: scholarmatch.com
4. Copy DNS records
5. Add to DNS provider
6. Wait for verification

**Status**: 🔴 NOT STARTED - User action required

**Pivot Conditions** (both must be true at 16:00 UTC):
1. Postmark DKIM not verified OR inbox placement <95% after 30 min test
2. **AND** SendGrid domain/DKIM fully verified and ready

---

## 16:00 UTC Pivot Decision Matrix

| Postmark Status | SendGrid Status | Decision |
|----------------|-----------------|----------|
| DKIM verified + ≥95% placement | Any | **STAY on Postmark** |
| DKIM not verified | SendGrid verified | **PIVOT to SendGrid** |
| DKIM not verified | SendGrid not verified | **STAY on Postmark, monitor** |
| DKIM verified, <95% placement | SendGrid verified | **PIVOT to SendGrid** |
| DKIM verified, <95% placement | SendGrid not verified | **STAY on Postmark, investigate** |

**CEO Directive**: "Do not pivot if SendGrid is not fully verified by 16:00 UTC."

---

## Evidence Requirements for 15:30 UTC

### Documents to Prepare
- [x] Seed list: `seed_list_20_addresses.json`
- [x] Readiness checklist: This document
- [ ] DNS configuration screenshots
- [ ] Postmark verification status
- [ ] Webhook configuration screenshots

### Metrics to Collect
- [ ] Current DNS propagation status
- [ ] Postmark dashboard verification status
- [ ] Test email authentication headers (if DKIM verified)
- [ ] Webhook test results (if configured)

---

## Risk Assessment (15:30 UTC)

### GREEN (Low Risk) ✅
- Email service infrastructure deployed
- API endpoints operational
- Postmark/SendGrid API keys configured
- Seed list prepared

### YELLOW (Monitoring Required) 🟡
- DKIM DNS propagation (in progress, normal timeline)
- Return-Path CNAME (pending user configuration)
- DMARC TXT (pending user configuration)
- SendGrid pre-staging (contingency, not blocking)

### RED (Action Required) 🔴
- Webhooks not configured (must complete before Gate A)
- Seed list uses placeholder emails (need real accounts for testing)

---

## Action Items for User (Before 15:30 UTC)

**Critical (Blocks Readiness Check)**:
1. Add Return-Path CNAME: `pm-bounces → pm.mtasv.net`
2. Add DMARC TXT: `_dmarc → v=DMARC1; p=none; pct=100; rua=mailto:dmarc@scholarmatch.com; aspf=r;`
3. Verify Postmark shows DKIM green checkmark

**Important (Contingency)**:
4. Pre-stage SendGrid DNS records (get from SendGrid dashboard)

**Optional (Can complete 15:30-20:00)**:
5. Replace seed list placeholder emails with real accessible accounts

---

## Action Items for Agent3 (Before 15:30 UTC)

**Must Complete**:
1. Implement webhook endpoint: `/api/webhooks/postmark`
2. Add webhook signature validation
3. Configure Postmark webhook URLs
4. Test webhook processing with sample events
5. Prepare 30,000 event replay test infrastructure

**Evidence Collection**:
6. Screenshot DNS provider showing all records
7. Screenshot Postmark dashboard showing verification status
8. Capture test email headers (once DKIM verified)
9. Document webhook test results

---

## Timeline to Gate A

| Time (UTC) | Milestone | Status |
|------------|-----------|--------|
| **14:00** | Checkpoint published | ✅ DONE |
| **15:00** | Expected DKIM propagation | 🟡 IN PROGRESS |
| **15:30** | **Readiness check** | 🔴 PENDING |
| **16:00** | Pivot decision | SCHEDULED |
| **18:00** | Final preparations | SCHEDULED |
| **20:00-20:15** | **Gate A execution** | SCHEDULED |
| **20:30** | Evidence published | SCHEDULED |

---

## Summary

**Overall Readiness**: 🟡 **60% COMPLETE**

**Critical Path Items**:
1. ⏳ DNS propagation (DKIM, Return-Path, DMARC) - In progress
2. 🔴 Webhook configuration - Not started
3. ✅ Email service infrastructure - Complete
4. ✅ Seed list preparation - Complete

**Recommended Actions**:
- User: Add Return-Path + DMARC DNS records immediately
- Agent3: Implement webhook endpoint before 15:30 UTC
- Both: Monitor Postmark for DKIM green checkmark

**Risk Level**: **MEDIUM** - On track but time-sensitive DNS work required

---

**Last Updated**: 2025-11-12 14:55 UTC  
**Next Update**: 15:30 UTC Readiness Check Results  
**Owner**: Agent3 (auto_com_center DRI)
