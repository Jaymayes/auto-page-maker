# POST /internal/rebuild - API Contract (One-Pager)

**App:** auto_page_maker  
**Base URL:** https://auto-page-maker-jamarrlmayes.replit.app  
**Date:** November 20, 2025  
**Version:** v1.0  
**Status:** 🟡 Awaiting CEO Approval

---

## Purpose

Enable **scholarship_agent** to trigger asynchronous landing page regeneration for specific scholarships, supporting event-driven content freshness and autonomous SEO page generation at scale.

---

## Endpoint Specification

### Request

```http
POST /internal/rebuild
Host: auto-page-maker-jamarrlmayes.replit.app
Content-Type: application/json
X-Internal-Key: <rotated-shared-secret>
Idempotency-Key: <uuid-v4>
X-Trace-Id: <correlation-id>
Source-App: scholarship_agent
```

**Body Schema:**
```json
{
  "job_id": "string (uuid, required)",
  "scholarship_ids": ["string (uuid)"] (required, 1-1000 items),
  "template": "string (optional, default: 'default')",
  "priority": "low | normal | high (optional, default: 'normal')",
  "dry_run": "boolean (optional, default: false)",
  "scheduled_at": "ISO8601 (optional, immediate if omitted)",
  "data_version": "string (optional, for cache invalidation)",
  "invalidate_strategy": "changed_only | full (optional, default: 'changed_only')",
  "locale": "string (optional, default: 'en-US')"
}
```

**Example:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "scholarship_ids": [
    "abc123-def456-ghi789",
    "jkl012-mno345-pqr678"
  ],
  "template": "default",
  "priority": "normal",
  "dry_run": false,
  "invalidate_strategy": "changed_only"
}
```

---

### Response

**Success (202 Accepted):**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "state": "enqueued",
  "estimated_completion": "2025-11-20T16:45:00Z",
  "pages_queued": 2
}
```

**Error Responses:**

**400 Bad Request** (Validation failure)
```json
{
  "error": "Bad Request",
  "message": "scholarship_ids must contain 1-1000 items",
  "code": "INVALID_PAYLOAD"
}
```

**401 Unauthorized** (Missing X-Internal-Key)
```json
{
  "error": "Unauthorized",
  "message": "X-Internal-Key header required for internal API access",
  "code": "MISSING_INTERNAL_KEY"
}
```

**403 Forbidden** (Invalid X-Internal-Key)
```json
{
  "error": "Forbidden",
  "message": "Invalid X-Internal-Key",
  "code": "INVALID_INTERNAL_KEY"
}
```

**409 Conflict** (Duplicate Idempotency-Key)
```json
{
  "error": "Conflict",
  "message": "Job with this idempotency key already exists",
  "code": "DUPLICATE_JOB",
  "existing_job_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**429 Too Many Requests** (Rate limit exceeded)
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded: 5 requests per second sustained, burst 50",
  "code": "RATE_LIMIT_EXCEEDED",
  "retry_after": 10
}
```

**503 Service Unavailable** (Queue full or dependency down)
```json
{
  "error": "Service Unavailable",
  "message": "Rebuild queue at capacity, try again later",
  "code": "QUEUE_CAPACITY_EXCEEDED",
  "retry_after": 300
}
```

---

## Authentication & Security

### X-Internal-Key (Required)
- **Format:** `Bearer <shared-secret>` or raw secret in header value
- **Rotation:** Weekly via Replit Secrets
- **Storage:** `X_INTERNAL_KEY` environment variable (auto_page_maker)
- **Validation:** Constant-time comparison (prevents timing attacks)
- **Fail-closed:** Deny access if `X_INTERNAL_KEY` not configured

### IP Allowlist (Optional, Phase C)
- **Allowed IPs:** scholarship_agent deployment IPs only
- **Format:** Comma-separated in `REBUILD_ALLOWLIST_IPS` env var
- **Fallback:** If not configured, rely on X-Internal-Key only

### HMAC Signature (Optional, Phase D)
- **Algorithm:** HMAC-SHA256
- **Header:** `X-Signature: sha256=<hex-digest>`
- **Payload:** `job_id + scholarship_ids.join(',') + timestamp`
- **Purpose:** Prevent replay attacks and payload tampering

---

## Rate Limits & Quotas

### Per-Key Limits
- **Sustained:** 5 requests/second
- **Burst:** 50 requests (10-second window)
- **Daily Quota:** 100,000 jobs/day
- **Concurrency:** 10 active jobs per source app

### Response Headers
```http
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 4
X-RateLimit-Reset: 1700512800
X-RateLimit-Quota-Remaining: 95234
```

### Backoff Strategy (Client-Side)
- **429 response:** Exponential backoff starting at `retry_after` seconds
- **503 response:** Linear backoff with jitter
- **Max retries:** 3 attempts with backoff (1s → 2s → 4s)

---

## Idempotency

### Idempotency-Key Header (Required)
- **Format:** UUID v4
- **TTL:** 24 hours (deduplication window)
- **Storage:** Redis with `idempotency:<key>` key
- **Behavior:**
  - First request: Enqueue job, store key → job_id mapping
  - Duplicate request: Return 409 Conflict with existing job_id
  - After TTL: Key expires, can reuse (treated as new job)

### Safe to Retry
- **Same Idempotency-Key:** Always safe, returns existing job
- **Different Idempotency-Key:** Creates new job (same scholarships regenerated twice)

---

## Asynchronous Processing Model

### Queue Architecture
```
scholarship_agent → POST /internal/rebuild → Upstash Redis Streams
                                              ↓
                                         BullMQ Consumer
                                              ↓
                                    scholarship_api (fetch data)
                                              ↓
                                    Page Generation (PDFKit, templates)
                                              ↓
                                    Object Storage (Replit App Storage)
                                              ↓
                                    Sitemap Update (lastmod, priority)
                                              ↓
                                    CDN Purge (changed pages only)
                                              ↓
                                    Job State: completed/failed
```

### Job States
1. **enqueued** - Accepted, waiting in queue
2. **processing** - Consumer picked up job, fetching data
3. **generating** - Rendering pages with templates
4. **uploading** - Writing to object storage
5. **invalidating** - Purging CDN cache
6. **completed** - Success, pages live
7. **failed** - Error occurred (see job.error for details)

### State Transitions
- `enqueued → processing` (worker picks up job)
- `processing → generating` (data fetched successfully)
- `generating → uploading` (pages rendered)
- `uploading → invalidating` (pages written to storage)
- `invalidating → completed` (CDN purged, success)
- `*any* → failed` (error at any stage, DLQ if max retries exceeded)

---

## Job Status Polling (Future)

**Not implemented in Phase A, documented for future:**

```http
GET /internal/jobs/{job_id}
X-Internal-Key: <shared-secret>

Response 200 OK:
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "state": "completed",
  "created_at": "2025-11-20T16:30:00Z",
  "started_at": "2025-11-20T16:30:05Z",
  "completed_at": "2025-11-20T16:32:15Z",
  "duration_seconds": 130,
  "pages_generated": 2,
  "pages_failed": 0,
  "urls": [
    "https://auto-page-maker.replit.app/scholarships/abc123",
    "https://auto-page-maker.replit.app/scholarships/jkl012"
  ],
  "error": null
}
```

---

## SLOs & Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| **API Accept P95** | ≤150ms | Request processing time |
| **E2E Rebuild P95** | ≤5 minutes | Job enqueued → completed |
| **Success Rate** | ≥99% | (completed + duplicate) / total |
| **Queue Depth** | <100 jobs | Active + enqueued jobs |
| **CDN Purge Lag** | ≤60 seconds | Page updated → CDN reflects change |
| **Uptime** | 99.9% | /internal/rebuild availability |

---

## Error Handling & Retries

### Consumer-Side Retries
- **Max Attempts:** 3
- **Backoff:** Exponential (1s → 2s → 4s)
- **Retry Conditions:**
  - scholarship_api timeout (503, 504)
  - Object storage write failure (transient)
  - CDN purge API failure (transient)

### Non-Retryable Errors (Immediate Failure)
- Invalid scholarship_ids (404 from scholarship_api)
- Template not found
- Data validation failure
- Duplicate content detected (hash collision)

### Dead-Letter Queue (DLQ)
- **Trigger:** Job fails 3 times
- **Storage:** `rebuild_jobs_dlq` Redis stream
- **Alert:** Slack notification on DLQ entry
- **Resolution:** Manual investigation, replay from DLQ UI

---

## Observability & Metrics

### Prometheus Metrics (Exposed on /metrics)
```prometheus
# Request metrics
rebuild_requests_total{status="accepted|rejected|failed"} counter
rebuild_request_duration_seconds{quantile="0.5|0.95|0.99"} histogram

# Job metrics
rebuild_jobs_enqueued_total counter
rebuild_jobs_completed_total counter
rebuild_jobs_failed_total counter
rebuild_jobs_retried_total counter
rebuild_jobs_dlq_total counter

# Performance metrics
rebuild_job_duration_seconds{quantile="0.5|0.95|0.99"} histogram
rebuild_queue_depth gauge
rebuild_pages_generated_total counter
rebuild_cdn_purge_duration_seconds{quantile="0.95"} histogram
```

### Structured Logging
```json
{
  "timestamp": "2025-11-20T16:30:00Z",
  "level": "info",
  "service": "auto_page_maker",
  "trace_id": "abc123-trace",
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "source_app": "scholarship_agent",
  "event": "rebuild_job_enqueued",
  "scholarship_count": 2,
  "priority": "normal",
  "estimated_duration_seconds": 120
}
```

---

## SEO Safety & Content Integrity

### Duplicate Detection
- **Hash:** `MD5(scholarship_id + template + locale)`
- **Cache:** Redis with 24h TTL
- **Behavior:** If hash exists and page unchanged, skip generation (return cached URL)

### Canonical Enforcement
- **Rule:** All generated pages MUST have `rel="canonical"` tag
- **Staging:** Canonical points to production URL (prevents index duplication)
- **Validation:** Fail job if canonical tag missing or malformed

### Sitemap Updates
- **lastmod:** Set to job completion timestamp for changed pages only
- **priority:** Recalculated based on page freshness and scholarship popularity
- **Validation:** Sitemap must validate against XML schema before CDN purge

### Noindex for Thin Content
- **Rule:** Pages with <500 words auto-tagged with `noindex`
- **Alert:** Slack notification if >10% of batch are thin
- **Override:** `force_index: true` in payload (admin only)

---

## Rollout Plan

### Phase A: Staging Soak (48h)
- **Traffic:** 1,000 jobs from scholarship_agent (staging)
- **Feature Flag:** `REBUILD_ENDPOINT_ENABLED=staging`
- **Validation:** All SLOs met, zero SEO regressions
- **Exit Criteria:** ≥99% success rate, P95 E2E ≤5 min

### Phase B: Dark Launch (Production)
- **Traffic:** 0 jobs (endpoint enabled but not advertised)
- **Feature Flag:** `REBUILD_ENDPOINT_ENABLED=true`
- **IP Allowlist:** scholarship_agent IPs only
- **Validation:** Health checks pass, metrics populating
- **Exit Criteria:** 24h uptime, zero alerts

### Phase C: Canary (10% Volume)
- **Traffic:** 10% of rebuild volume via /rebuild, 90% via cron
- **Feature Flag:** `REBUILD_TRAFFIC_PERCENTAGE=10`
- **Validation:** SLO error budget intact, queue drains <10 min post-burst
- **Exit Criteria:** 48h green, no DLQ spikes

### Phase D: Full Rollout (100%)
- **Traffic:** 100% of rebuild volume via /rebuild
- **Feature Flag:** `REBUILD_TRAFFIC_PERCENTAGE=100`
- **Cron:** Demoted to fallback (daily full rebuild)
- **Validation:** Event-driven architecture live, SLOs met for 1 week
- **Exit Criteria:** CEO approval, kill switch tested

---

## Fallback & Rollback

### Kill Switch
- **Env Var:** `REBUILD_ENDPOINT_ENABLED=false`
- **Effect:** Return 503 Service Unavailable on all POST /internal/rebuild
- **Fallback:** Cron-based nightly rebuild takes over (existing behavior)
- **SLA:** <5 min to disable endpoint, <1 hour for cron to trigger

### Rollback Plan
1. Set `REBUILD_ENDPOINT_ENABLED=false`
2. Drain queue (wait for active jobs to complete or timeout after 10 min)
3. Verify cron-based rebuild running successfully
4. Alert scholarship_agent to stop sending jobs
5. Root cause analysis and remediation
6. Re-enable with hotfix after validation

---

## Client Integration Guide (scholarship_agent)

### Example: Enqueue Rebuild Job

```bash
curl -X POST https://auto-page-maker-jamarrlmayes.replit.app/internal/rebuild \
  -H "Content-Type: application/json" \
  -H "X-Internal-Key: ${X_INTERNAL_KEY}" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "X-Trace-Id: trace-$(date +%s)" \
  -H "Source-App: scholarship_agent" \
  -d '{
    "job_id": "'$(uuidgen)'",
    "scholarship_ids": [
      "abc123-def456-ghi789",
      "jkl012-mno345-pqr678"
    ],
    "priority": "normal",
    "invalidate_strategy": "changed_only"
  }'
```

**Expected Response:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "state": "enqueued",
  "estimated_completion": "2025-11-20T16:45:00Z",
  "pages_queued": 2
}
```

### Error Handling (Client-Side)

```typescript
async function enqueueRebuild(scholarshipIds: string[]): Promise<string> {
  const jobId = crypto.randomUUID();
  const idempotencyKey = crypto.randomUUID();
  
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`${AUTO_PAGE_MAKER_URL}/internal/rebuild`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Key': process.env.X_INTERNAL_KEY!,
          'Idempotency-Key': idempotencyKey,
          'X-Trace-Id': `trace-${Date.now()}`,
          'Source-App': 'scholarship_agent',
        },
        body: JSON.stringify({
          job_id: jobId,
          scholarship_ids: scholarshipIds,
          priority: 'normal',
        }),
      });
      
      if (response.status === 202) {
        const data = await response.json();
        return data.job_id;
      }
      
      if (response.status === 409) {
        // Duplicate job, return existing
        const data = await response.json();
        return data.existing_job_id;
      }
      
      if (response.status === 429) {
        // Rate limited, exponential backoff
        const retryAfter = parseInt(response.headers.get('Retry-After') || '10');
        await sleep(retryAfter * 1000 * Math.pow(2, attempts));
        attempts++;
        continue;
      }
      
      if (response.status === 503) {
        // Service unavailable, linear backoff with jitter
        await sleep(5000 + Math.random() * 5000);
        attempts++;
        continue;
      }
      
      throw new Error(`Rebuild request failed: ${response.status}`);
      
    } catch (error) {
      if (attempts === maxAttempts - 1) throw error;
      attempts++;
      await sleep(1000 * Math.pow(2, attempts));
    }
  }
  
  throw new Error('Max retry attempts exceeded');
}
```

---

## Open Questions for CEO Approval

1. **HMAC Signature:** Required for Phase A, or defer to Phase D?
   - **Recommendation:** Defer to Phase D (X-Internal-Key sufficient for now)

2. **IP Allowlist:** Enforce in Phase A, or wait for Phase C?
   - **Recommendation:** Phase C (staging doesn't need it, adds complexity)

3. **Job Status Polling:** Implement GET /internal/jobs/:id in Phase A?
   - **Recommendation:** Defer (not required, scholarship_agent can use X-Trace-Id for correlation)

4. **Daily Quota:** 100K jobs/day sufficient, or increase to 1M?
   - **Recommendation:** Start at 100K, monitor queue depth and adjust

5. **Dry Run Mode:** Support `dry_run: true` for testing?
   - **Recommendation:** Yes, implement (useful for scholarship_agent testing)

---

## Approval Checklist

- [ ] API contract reviewed and approved by CEO
- [ ] Rate limits appropriate (5 rps sustained, burst 50)
- [ ] SLO targets achievable (P95 E2E ≤5 min, success ≥99%)
- [ ] Security model sufficient (X-Internal-Key, constant-time comparison)
- [ ] Rollout plan approved (Phases A-D with exit criteria)
- [ ] Fallback/rollback plan acceptable (kill switch + cron fallback)
- [ ] Open questions resolved
- [ ] Implementation tickets cut (52 story points, 48-72h ETA)

---

**Contract Prepared By:** auto_page_maker team  
**Date:** November 20, 2025  
**Awaiting Approval From:** CEO  
**Next Action:** CEO approval → implementation kickoff (48-72h timeline)
