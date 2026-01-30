# Gate A: DKIM Verification Protocol
## auto_com_center Deliverability Certification

**Date**: 2025-11-12  
**DRI**: Agent3 (Release Captain)  
**App**: auto_com_center  
**APP_BASE_URL**: https://auto-com-center-jamarrlmayes.replit.app

---

## Executive Summary

Gate A requires DKIM/SPF/DMARC verification for email authentication to achieve:
- **Inbox placement**: ≥99%
- **P95 latency**: ≤120 ms
- **Error rate**: <0.1%
- **Authentication**: DKIM, SPF, and DMARC all passing

**Current Status**: Email service configured with Postmark (primary) and SendGrid (fallback)

---

## Timeline & Checkpoints

| Time (UTC) | Milestone | Action |
|------------|-----------|--------|
| **NOW** | Email service configured | ✅ Postmark + SendGrid API keys active |
| **14:00** | DKIM checkpoint | Verify DNS records configured and DKIM passing |
| **16:00** | Pivot decision | If DKIM not verified, execute ESP fallback |
| **20:00-20:15** | **Gate A execution** | Final deliverability certification test |
| **20:30** | Evidence due | Publish authentication headers and test results |

---

## Provider Configuration

### Primary: Postmark
- **Status**: ✅ API key configured
- **Provider**: `postmark`
- **Domain**: `scholarmatch.com`
- **From Address**: `noreply@scholarmatch.com`

### Fallback: SendGrid
- **Status**: ✅ API key configured (standby)
- **Activation**: Automatic if Postmark fails

### API Status Endpoint
```bash
GET /api/dkim/status
```

**Response**:
```json
{
  "provider": "postmark",
  "from_address": "noreply@scholarmatch.com",
  "domain": "scholarmatch.com",
  "configured": true,
  "api_key_set": {
    "postmark": true,
    "sendgrid": true,
    "ses": false
  }
}
```

---

## DNS Configuration Required

### Step 1: Log into Postmark

1. Navigate to: https://account.postmarkapp.com
2. Go to: **Sender Signatures** → **Add Domain**
3. Enter domain: `scholarmatch.com`

### Step 2: DNS Records (Provided by Postmark)

Postmark will generate unique records. Expected format:

#### DKIM Record (CNAME)
```
Host: [date-stamp]._domainkey.scholarmatch.com
Type: CNAME
Value: [date-stamp].dkim.postmarkapp.com
```

#### Return-Path Record (CNAME) - for SPF alignment
```
Host: pm-bounces.scholarmatch.com
Type: CNAME
Value: pm.mtasv.net
```

#### DMARC Record (TXT)
```
Host: _dmarc.scholarmatch.com
Type: TXT
Value: v=DMARC1; p=none; pct=100; rua=mailto:dmarc@scholarmatch.com; aspf=r;
```

### Step 3: Add to DNS Provider

- **Cloudflare**: DNS → Records → Add record (disable proxy for CNAME records)
- **GoDaddy/Namecheap**: DNS Management → Add TXT/CNAME
- **Route 53**: Hosted Zones → Create Record Set

### Step 4: Verify in Postmark

1. Wait 5 minutes - 48 hours for DNS propagation (usually 15-30 minutes)
2. Click **"Verify"** button in Postmark dashboard
3. Confirm all records show **green checkmarks**

---

## DKIM Verification Test

### Endpoint
```bash
POST /api/dkim/test
Content-Type: application/json

{
  "test_email": "your-email@gmail.com"
}
```

### Expected Response
```json
{
  "success": true,
  "result": {
    "provider": "postmark",
    "domain": "scholarmatch.com",
    "dkim_verified": true,
    "spf_verified": false,
    "dmarc_configured": false,
    "test_message_id": "msg_12345...",
    "timestamp": "2025-11-12T14:00:00.000Z"
  },
  "instructions": "Check the email headers..."
}
```

### Manual Verification Steps

1. **Send test email** to Gmail/Outlook address
2. **Open the email** and click: **More actions** → **Show original**
3. **Check Authentication-Results header**:
   ```
   Authentication-Results: mx.google.com;
        dkim=pass header.i=@scholarmatch.com header.s=[selector] header.b=ABC123;
        spf=pass (google.com: domain of noreply@scholarmatch.com designates xxx.xxx.xxx.xxx as permitted sender) smtp.mailfrom=pm-bounces.scholarmatch.com;
        dmarc=pass (p=NONE sp=NONE dis=NONE) header.from=scholarmatch.com
   ```

4. **Required**: All three must show `pass`:
   - `dkim=pass`
   - `spf=pass`
   - `dmarc=pass`

---

## 14:00 UTC Checkpoint Criteria

### PASS Requirements
- ✅ DNS records added to domain provider
- ✅ Postmark shows all records verified (green checkmarks)
- ✅ Test email sent successfully
- ✅ Authentication headers show `dkim=pass`, `spf=pass`, `dmarc=pass`

### FAIL Triggers
- ❌ DNS records not propagated after 2 hours
- ❌ DKIM verification failing in Postmark dashboard
- ❌ Test email authentication headers show `fail` or `none`

### If FAIL: 16:00 UTC Pivot Plan

**Immediate Actions**:
1. Switch provider to SendGrid (already configured as fallback)
2. Follow SendGrid DNS setup (see below)
3. Re-run verification tests
4. Publish updated evidence by 18:00 UTC

---

## SendGrid Fallback DNS Records

### SendGrid DKIM Setup (if needed)

1. Navigate to: https://app.sendgrid.com
2. Settings → **Sender Authentication** → **Authenticate Your Domain**
3. Select DNS provider → Enter `scholarmatch.com`
4. Enable **"Use Automated Security"** (recommended)

**Expected Records**:
```
# DKIM s1
Host: s1._domainkey.scholarmatch.com
Type: CNAME
Value: s1.domainkey.[uid].wl[id].sendgrid.net

# DKIM s2
Host: s2._domainkey.scholarmatch.com
Type: CNAME
Value: s2.domainkey.[uid].wl[id].sendgrid.net

# SPF (add to existing SPF record)
include:sendgrid.net
```

---

## Gate A Execution Window: 20:00-20:15 UTC

### Test Plan

1. **Send 100 test emails** via `/send` endpoint
2. **Measure P95 latency** (target: ≤120 ms)
3. **Track error rate** (target: <0.1%)
4. **Verify inbox placement** (target: ≥99%)
5. **Capture authentication headers** from Gmail/Outlook

### Evidence Collection

**Required artifacts**:
- DNS record screenshots (Postmark/Cloudflare dashboards)
- Postmark verification status (all green checkmarks)
- Test email authentication headers (raw email source)
- P95 latency measurements from `/healthz` endpoint
- Error rate telemetry
- Message IDs and delivery logs

**Evidence Bundle Location**: `evidence_root/auto_com_center/gate_a_results/`

---

## Pass Criteria for Gate A

| Metric | Target | Measurement |
|--------|--------|-------------|
| Inbox Placement | ≥99% | Manual test to Gmail/Outlook/Yahoo |
| P95 Latency | ≤120 ms | `/healthz` endpoint |
| Error Rate | <0.1% | 100 test sends, max 0 failures |
| DKIM | pass | Email headers |
| SPF | pass | Email headers |
| DMARC | pass | Email headers |

---

## Escalation Path

**14:00 UTC Checkpoint FAIL**:
- Escalate to CEO at T+15 minutes
- Execute SendGrid pivot by 16:00 UTC
- Re-run verification tests
- Delay Gate A window if needed (requires CEO approval)

**20:00 UTC Gate A FAIL**:
- Immediate rollback to manual fallback mode
- Publish incident report within 30 minutes
- Schedule post-mortem and re-attempt window

---

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/dkim/status` | GET | Check provider configuration |
| `/api/dkim/dns-records` | GET | Get DNS setup instructions |
| `/api/dkim/test` | POST | Send verification test email |
| `/send` or `/api/send` | POST | Send transactional email |

---

## Next Steps (Immediate)

1. **DNS Configuration** (NOW - 14:00 UTC)
   - Add Postmark DNS records to scholarmatch.com
   - Verify propagation
   - Confirm green checkmarks in Postmark

2. **Test Email Send** (14:00 UTC)
   - Send test email to Gmail address
   - Capture and verify authentication headers
   - Document results

3. **14:30 UTC**: Publish checkpoint results
4. **20:00 UTC**: Execute Gate A deliverability certification
5. **20:30 UTC**: Publish final evidence bundle

---

**Status**: 🟡 Awaiting DNS configuration  
**Next Checkpoint**: 14:00 UTC (DKIM verification)  
**Owner**: Agent3 (auto_com_center DRI)  
**Last Updated**: 2025-11-12 14:09 UTC
