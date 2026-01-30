# /rebuild Integration - Implementation Timeline & Owners

**App:** auto_page_maker  
**Date:** November 20, 2025  
**Total Duration:** 48-72 hours (2-3 days)  
**Team Size:** 2-3 engineers (parallel work possible)  
**Status:** 🟡 Awaiting CEO Approval to Start

---

## Executive Timeline

| Phase | Duration | Start | End | Gate |
|-------|----------|-------|-----|------|
| **Implementation** | 48-72h | T+0 | T+72h | Code complete, tests pass |
| **Staging Soak** | 48h | T+72h | T+120h | SLOs met, zero regressions |
| **Dark Launch** | 24h | T+120h | T+144h | Health checks green |
| **Canary (10%)** | 48h | T+144h | T+192h | Error budget intact |
| **Full Rollout** | 7d | T+192h | T+360h | 1 week green, CEO approval |

**Total Time to Production:** 9-10 days from approval

---

## Item 2: Implement /rebuild Integration Behind Flag (48-72h)

### Deliverables
1. POST /internal/rebuild endpoint
2. Async queue consumer (BullMQ or Upstash)
3. Job state tracking (database or Redis)
4. Resiliency patterns (retry, backoff, DLQ, circuit breaker)
5. Feature flags and environment variables

---

### 2.1: POST /internal/rebuild Endpoint

**Owner:** Backend Team (Engineer A)  
**Duration:** 24 hours  
**Story Points:** 8

**Tasks:**
- [ ] Create `server/routes/internal.ts` with POST /internal/rebuild handler
- [ ] Wire up `internal-auth.ts` middleware (X-Internal-Key validation)
- [ ] Implement request validation with Zod schema
- [ ] Add Idempotency-Key handling (Redis deduplication)
- [ ] Return 202 Accepted with job_id
- [ ] Add rate limiting (5 rps sustained, burst 50)
- [ ] Add per-key quota tracking (100K/day)
- [ ] Write unit tests (happy path, auth failures, validation errors)

**Dependencies:**
- ✅ `server/middleware/internal-auth.ts` (complete)
- ✅ Zod schemas in `@shared/schema.ts`
- 🔴 Need to add `rebuildJobRequestSchema` to schema.ts

**Environment Variables:**
```bash
REBUILD_ENDPOINT_ENABLED=staging  # 'staging' | 'true' | 'false'
X_INTERNAL_KEY=<rotated-shared-secret>
REBUILD_RATE_LIMIT_RPS=5
REBUILD_RATE_LIMIT_BURST=50
REBUILD_DAILY_QUOTA=100000
```

**Acceptance Criteria:**
- [ ] POST /internal/rebuild returns 202 with valid auth
- [ ] 401 for missing X-Internal-Key
- [ ] 403 for invalid X-Internal-Key
- [ ] 400 for invalid payload (scholarship_ids empty, invalid job_id)
- [ ] 409 for duplicate Idempotency-Key
- [ ] 429 for rate limit exceeded
- [ ] Response time P95 ≤150ms

**Timeline:**
- Hours 0-4: Endpoint skeleton, auth wiring
- Hours 4-12: Validation, idempotency, rate limiting
- Hours 12-20: Unit tests, error handling
- Hours 20-24: Code review, refinement

---

### 2.2: Async Queue Consumer

**Owner:** Backend Team (Engineer B)  
**Duration:** 24 hours  
**Story Points:** 13

**Tasks:**
- [ ] Choose queue library (BullMQ vs Upstash Redis Streams)
- [ ] Create `server/queues/rebuild-queue.ts` with producer/consumer
- [ ] Implement job processing logic (fetch → generate → upload → purge)
- [ ] Wire up `scholarship-api-client.ts` for data fetching
- [ ] Add bounded concurrency (10 concurrent jobs max)
- [ ] Implement exponential backoff (1s → 2s → 4s, max 3 attempts)
- [ ] Create Dead-Letter Queue (DLQ) for failed jobs
- [ ] Add circuit breaker for scholarship_api calls
- [ ] Write integration tests (happy path, retries, DLQ)

**Dependencies:**
- ✅ `server/services/scholarship-api-client.ts` (complete)
- ✅ Upstash Redis secrets (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`)
- 🔴 Need to wire scholarship-api-client into storage.ts

**Queue Choice Recommendation:** **BullMQ** (mature, built-in retries, good observability)

**Environment Variables:**
```bash
QUEUE_BACKEND=bullmq  # 'bullmq' | 'upstash'
QUEUE_CONCURRENCY=10
QUEUE_MAX_RETRIES=3
QUEUE_BACKOFF_INITIAL_MS=1000
QUEUE_BACKOFF_MAX_MS=4000
QUEUE_DLQ_ENABLED=true
CIRCUIT_BREAKER_THRESHOLD=5  # failures before open
CIRCUIT_BREAKER_TIMEOUT_MS=30000  # 30s reset timeout
```

**Acceptance Criteria:**
- [ ] Jobs enqueued successfully on POST /internal/rebuild
- [ ] Consumer picks up jobs and processes asynchronously
- [ ] Successful job: fetches data, generates pages, updates sitemap
- [ ] Failed job: retries 3 times with exponential backoff
- [ ] DLQ receives jobs after max retries exceeded
- [ ] Circuit breaker opens after 5 consecutive scholarship_api failures
- [ ] Circuit breaker half-opens after 30s timeout
- [ ] E2E rebuild P95 ≤5 minutes (10 jobs baseline)

**Timeline:**
- Hours 0-4: Queue setup, producer wiring
- Hours 4-12: Consumer logic (fetch → generate → upload → purge)
- Hours 12-18: Retry, backoff, DLQ, circuit breaker
- Hours 18-24: Integration tests, observability

---

### 2.3: Job State Tracking

**Owner:** Backend Team (Engineer A or B)  
**Duration:** 12 hours  
**Story Points:** 5

**Tasks:**
- [ ] Choose storage (database table vs Redis)
- [ ] Create `rebuild_jobs` table in database schema (if database)
- [ ] Add CRUD operations for job state (create, update, get)
- [ ] Track state transitions (enqueued → processing → completed/failed)
- [ ] Store job metadata (scholarship_ids, created_at, completed_at, error)
- [ ] Add cleanup cron (delete jobs older than 7 days)
- [ ] Write unit tests

**Storage Recommendation:** **Redis** (faster, auto-expiry, no migrations needed)

**Schema (Redis):**
```typescript
// Key: rebuild_job:{job_id}
// TTL: 7 days (604800 seconds)
{
  job_id: string,
  state: 'enqueued' | 'processing' | 'generating' | 'uploading' | 'invalidating' | 'completed' | 'failed',
  scholarship_ids: string[],
  source_app: string,
  priority: string,
  created_at: ISO8601,
  started_at: ISO8601 | null,
  completed_at: ISO8601 | null,
  pages_generated: number,
  pages_failed: number,
  error: string | null,
  retry_count: number
}
```

**Schema (Database - Alternative):**
```typescript
export const rebuildJobs = pgTable("rebuild_jobs", {
  id: varchar("id").primaryKey(),
  state: varchar("state").notNull(),
  scholarshipIds: text("scholarship_ids").array().notNull(),
  sourceApp: varchar("source_app"),
  priority: varchar("priority").default("normal"),
  createdAt: timestamp("created_at").defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  pagesGenerated: integer("pages_generated").default(0),
  pagesFailed: integer("pages_failed").default(0),
  error: text("error"),
  retryCount: integer("retry_count").default(0),
});
```

**Environment Variables:**
```bash
JOB_STATE_STORAGE=redis  # 'redis' | 'database'
JOB_STATE_TTL_DAYS=7
```

**Acceptance Criteria:**
- [ ] Job state persisted on enqueue
- [ ] State transitions tracked (enqueued → processing → completed)
- [ ] Job metadata stored (timestamps, counts, error)
- [ ] GET /internal/jobs/:id returns job state (future)
- [ ] Jobs auto-expire after 7 days

**Timeline:**
- Hours 0-4: Schema design, storage choice
- Hours 4-8: CRUD operations, state transitions
- Hours 8-12: Tests, cleanup logic

---

### 2.4: Resiliency Patterns

**Owner:** Backend Team (Engineer B)  
**Duration:** Included in 2.2 (Async Queue Consumer)  
**Story Points:** Included in 2.2

**Patterns Implemented:**
- ✅ **Retry with Exponential Backoff** (1s → 2s → 4s, max 3 attempts)
- ✅ **Dead-Letter Queue (DLQ)** for jobs exceeding max retries
- ✅ **Bounded Concurrency** (10 concurrent jobs max)
- ✅ **Circuit Breaker** for scholarship_api calls (threshold: 5 failures, timeout: 30s)

**Library:** `opossum` (circuit breaker) + BullMQ (retries, DLQ, concurrency)

**Acceptance Criteria:**
- [ ] Transient scholarship_api errors trigger retry (503, 504, timeout)
- [ ] Non-retryable errors fail immediately (404, 400, invalid data)
- [ ] Jobs moved to DLQ after 3 failed attempts
- [ ] Circuit breaker opens after 5 consecutive failures
- [ ] Circuit breaker half-opens and retries after 30s
- [ ] Alert triggered on DLQ entry (Slack notification)

---

### 2.5: Feature Flags

**Owner:** Backend Team (Engineer A)  
**Duration:** 4 hours (integrated with 2.1)  
**Story Points:** Included in 2.1

**Flags:**
```bash
# Main toggle
REBUILD_ENDPOINT_ENABLED=staging  # 'staging' | 'true' | 'false'

# Traffic percentage (for canary rollout)
REBUILD_TRAFFIC_PERCENTAGE=0  # 0-100 (Phase C: 10, Phase D: 100)

# IP allowlist (optional, Phase C)
REBUILD_ALLOWLIST_IPS=1.2.3.4,5.6.7.8  # Comma-separated

# Queue behavior
QUEUE_ENABLED=true
QUEUE_BACKEND=bullmq
QUEUE_CONCURRENCY=10
```

**Implementation:**
- Feature flag check at endpoint entry (return 503 if disabled)
- Traffic percentage sampling (hash job_id % 100 < percentage)
- IP allowlist enforcement (after auth, before validation)

**Acceptance Criteria:**
- [ ] `REBUILD_ENDPOINT_ENABLED=false` returns 503
- [ ] `REBUILD_ENDPOINT_ENABLED=staging` works in staging only
- [ ] `REBUILD_TRAFFIC_PERCENTAGE=10` routes 10% of jobs to queue
- [ ] IP allowlist enforced when configured

---

## Item 3: Observability & SLO Guardrails (In Lockstep with Item 2)

**Owner:** Ops Team (Engineer C) or Backend Team  
**Duration:** 12 hours (parallel with 2.2)  
**Story Points:** 5

### 3.1: Metrics

**Tasks:**
- [ ] Install Prometheus client (`prom-client`)
- [ ] Create `server/metrics/rebuild-metrics.ts`
- [ ] Export 8 core metrics (jobs_received, jobs_succeeded, etc.)
- [ ] Add histograms for latency (P50, P95, P99)
- [ ] Expose GET /metrics endpoint (Prometheus scrape target)
- [ ] Wire metrics into queue consumer lifecycle

**Metrics to Track:**
```typescript
// Counters
rebuild_jobs_received_total{source_app, priority}
rebuild_jobs_enqueued_total{source_app}
rebuild_jobs_completed_total{source_app}
rebuild_jobs_failed_total{source_app, reason}
rebuild_jobs_retried_total{source_app}
rebuild_jobs_dlq_total{source_app}
rebuild_pages_generated_total{source_app}

// Histograms
rebuild_request_duration_seconds{quantile="0.5|0.95|0.99"}
rebuild_job_duration_seconds{quantile="0.5|0.95|0.99"}
rebuild_cdn_purge_duration_seconds{quantile="0.95"}

// Gauges
rebuild_queue_depth{state="enqueued|processing"}
rebuild_active_jobs
rebuild_circuit_breaker_state{dependency="scholarship_api"}
```

**Environment Variables:**
```bash
METRICS_ENABLED=true
METRICS_PORT=9090  # Separate port for metrics (optional)
```

**Acceptance Criteria:**
- [ ] GET /metrics returns Prometheus-formatted metrics
- [ ] Metrics update in real-time as jobs flow through system
- [ ] P95 latency histogram buckets appropriate (10ms, 50ms, 100ms, 500ms, 1s, 5s)
- [ ] Job duration histogram buckets appropriate (10s, 30s, 1m, 5m, 10m)

**Timeline:**
- Hours 0-4: Metrics setup, endpoint creation
- Hours 4-8: Wire metrics into queue lifecycle
- Hours 8-12: Validate accuracy, test scraping

---

### 3.2: SLO Alerts

**Owner:** Ops Team (Engineer C)  
**Duration:** 8 hours  
**Story Points:** Included in 3.1

**Tasks:**
- [ ] Define SLO error budgets (99% success = 1% error budget)
- [ ] Create Prometheus alerting rules (burn-rate alerts)
- [ ] Set up Slack webhook for alerts
- [ ] Test alert firing (inject failures)

**SLO Definitions:**
```yaml
# API Accept P95 ≤150ms
- name: RebuildAPILatencyHigh
  expr: histogram_quantile(0.95, rebuild_request_duration_seconds) > 0.150
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Rebuild API P95 latency exceeds 150ms"

# Success Rate ≥99%
- name: RebuildSuccessRateLow
  expr: (rebuild_jobs_completed_total / (rebuild_jobs_completed_total + rebuild_jobs_failed_total)) < 0.99
  for: 10m
  labels:
    severity: critical
  annotations:
    summary: "Rebuild success rate below 99%"

# Queue Depth >100 jobs
- name: RebuildQueueDepthHigh
  expr: rebuild_queue_depth > 100
  for: 15m
  labels:
    severity: warning
  annotations:
    summary: "Rebuild queue backlog exceeds 100 jobs"
```

**Acceptance Criteria:**
- [ ] Alerts fire when SLOs violated
- [ ] Slack notification received within 2 minutes
- [ ] Alerts auto-resolve when SLOs recovered
- [ ] Runbook link included in alert message

**Timeline:**
- Hours 0-4: Alert rules definition
- Hours 4-6: Slack webhook integration
- Hours 6-8: Test alert firing and recovery

---

### 3.3: Structured Logging

**Owner:** Backend Team (Engineer A or B)  
**Duration:** 4 hours  
**Story Points:** 2

**Tasks:**
- [ ] Install `pino` logger
- [ ] Create `server/lib/logger.ts` with structured logging
- [ ] Add X-Trace-Id propagation across all logs
- [ ] Log key events (job enqueued, processing, completed, failed)
- [ ] Scrub PII from logs (scholarship titles, student data)

**Log Format:**
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

**Acceptance Criteria:**
- [ ] All rebuild events logged with trace_id
- [ ] Log levels appropriate (info, warn, error)
- [ ] No PII in logs (scrubbed scholarship titles, no student data)
- [ ] Logs queryable by trace_id for debugging

**Timeline:**
- Hours 0-2: Logger setup, trace_id propagation
- Hours 2-4: Event logging, PII scrubbing

---

## Item 4: SEO Safety & Content Integrity Checks (24-48h)

**Owner:** Backend Team (Engineer B) + SEO Team  
**Duration:** 24 hours  
**Story Points:** 8

### 4.1: Duplicate Content Avoidance

**Tasks:**
- [ ] Implement MD5 hash: `scholarship_id + template + locale`
- [ ] Store hash in Redis with 24h TTL
- [ ] Check hash before generation (return cached URL if exists)
- [ ] Add `force_regenerate: true` override (admin only)

**Acceptance Criteria:**
- [ ] Duplicate jobs skip generation and return cached URL
- [ ] Hash cache expires after 24h
- [ ] `force_regenerate: true` bypasses cache

**Timeline:**
- Hours 0-4: Hash implementation
- Hours 4-8: Cache integration, tests

---

### 4.2: Canonical Tag Enforcement

**Tasks:**
- [ ] Validate all generated pages have `rel="canonical"` tag
- [ ] Fail job if canonical missing or malformed
- [ ] Log warning if canonical points to staging URL

**Acceptance Criteria:**
- [ ] 100% of generated pages have canonical tag
- [ ] Job fails if canonical validation fails
- [ ] Alert triggered on canonical validation failure

**Timeline:**
- Hours 0-2: Validation logic
- Hours 2-4: Tests

---

### 4.3: Sitemap Freshness

**Tasks:**
- [ ] Update `<lastmod>` for changed pages only (not full sitemap)
- [ ] Recalculate `<priority>` based on freshness + popularity
- [ ] Validate sitemap against XML schema before CDN purge
- [ ] Ping Google Search Console on sitemap update (optional)

**Acceptance Criteria:**
- [ ] lastmod updated for regenerated pages
- [ ] priority recalculated (0.8 for fresh, 0.6 for older)
- [ ] Sitemap validates against XML schema
- [ ] CDN purge triggered only for sitemap.xml

**Timeline:**
- Hours 0-6: Sitemap update logic (incremental, not full rebuild)
- Hours 6-8: Validation, CDN purge

---

### 4.4: Noindex for Thin Content

**Tasks:**
- [ ] Count words in generated page content
- [ ] Add `<meta name="robots" content="noindex">` if <500 words
- [ ] Alert if >10% of batch are thin content
- [ ] Support `force_index: true` override (admin only)

**Acceptance Criteria:**
- [ ] Pages with <500 words tagged noindex
- [ ] Slack alert if >10% of batch are thin
- [ ] Override works for forced indexing

**Timeline:**
- Hours 0-4: Word count logic
- Hours 4-8: Noindex tagging, alerts

---

## Item 5: Integration Tests with scholarship_agent (24-48h)

**Owner:** Backend Team + scholarship_agent Team  
**Duration:** 24 hours  
**Story Points:** 13

### 5.1: E2E Happy Path

**Tasks:**
- [ ] Set up staging environment for both apps
- [ ] scholarship_agent sends 10 jobs to auto_page_maker
- [ ] Verify all 10 jobs complete successfully
- [ ] Verify pages generated and URLs returned
- [ ] Verify sitemap updated with new pages
- [ ] Verify CDN purge triggered

**Acceptance Criteria:**
- [ ] 100% success rate on 10-job batch
- [ ] E2E P95 ≤5 minutes
- [ ] All generated pages accessible (200 status)
- [ ] Canonical tags correct

**Timeline:**
- Hours 0-8: Test harness setup, happy path scenarios

---

### 5.2: Failure Injection Tests

**Tasks:**
- [ ] Inject scholarship_api timeout (simulate 503)
- [ ] Inject invalid scholarship_ids (404 from API)
- [ ] Inject invalid auth (wrong X-Internal-Key)
- [ ] Inject rate limit (>5 rps burst)
- [ ] Inject queue pressure (>100 jobs enqueued)
- [ ] Verify retries, DLQ, error responses

**Acceptance Criteria:**
- [ ] Transient errors trigger retry (3 attempts)
- [ ] Non-retryable errors fail immediately
- [ ] Jobs moved to DLQ after max retries
- [ ] Rate limit returns 429 with Retry-After header
- [ ] Queue pressure returns 503 with Retry-After header

**Timeline:**
- Hours 8-16: Failure injection scenarios

---

### 5.3: Load Test (Sustained 2 RPS for 30 Minutes)

**Tasks:**
- [ ] Set up load test harness (k6 or Artillery)
- [ ] Send 2 rps for 30 minutes (3,600 jobs total)
- [ ] Monitor queue depth, latency, error rate
- [ ] Verify queue drains <10 minutes post-burst
- [ ] Verify SLO error budget intact

**Acceptance Criteria:**
- [ ] Sustained 2 rps with no throttling
- [ ] P95 E2E ≤5 minutes maintained
- [ ] Success rate ≥99%
- [ ] Queue drains to 0 within 10 minutes of burst end
- [ ] No DLQ spikes, no circuit breaker trips

**Timeline:**
- Hours 16-24: Load test setup, execution, analysis

---

## Item 6: Handoff Kit for Agent3 (By End of Sprint)

**Owner:** Technical Writer + Backend Team  
**Duration:** 16 hours  
**Story Points:** 8

### Deliverables

1. **API Specification (OpenAPI 3.0)**
   - Endpoint: POST /internal/rebuild
   - Request/response schemas
   - Error codes and descriptions
   - Rate limits and quotas

2. **Authentication Guide**
   - X-Internal-Key rotation process
   - IP allowlist request process (Phase C)
   - HMAC signature (Phase D, optional)

3. **Integration Guide**
   - Sample curl commands
   - Client SDK example (Node.js TypeScript)
   - Error handling best practices
   - Retry and backoff strategy

4. **Test Harness**
   - Postman collection with sample requests
   - Test script for E2E validation
   - Failure injection scripts

5. **Runbooks**
   - "Rebuild queue backed up" (high queue depth)
   - "High DLQ rate" (jobs failing repeatedly)
   - "Circuit breaker tripped" (scholarship_api down)
   - "SEO regression detected" (canonical validation failures)

6. **On-Call Rotation**
   - Primary: auto_page_maker backend team
   - Secondary: scholarship_agent team
   - Escalation: Platform SRE team

**Timeline:**
- Hours 0-8: API spec, auth guide, integration guide
- Hours 8-12: Test harness (Postman, scripts)
- Hours 12-16: Runbooks, on-call rotation

---

## Item 7: Rollout Plan (Phased, 9-10 Days Total)

### Phase A: Staging Soak (48h)

**Owner:** Backend Team  
**Start:** T+72h (after implementation complete)  
**Duration:** 48 hours

**Activities:**
- [ ] Deploy to staging with `REBUILD_ENDPOINT_ENABLED=staging`
- [ ] scholarship_agent sends 1,000 jobs (batches of 100, 10 batches)
- [ ] Monitor SLOs (P95 E2E ≤5 min, success ≥99%)
- [ ] Run SEO validators (canonical, sitemap, structured data)
- [ ] Run Core Web Vitals checks (no regressions)

**Exit Criteria:**
- [ ] ≥99% success rate on 1,000 jobs
- [ ] P95 E2E ≤5 minutes
- [ ] Zero SEO regressions
- [ ] Zero Core Web Vitals regressions
- [ ] Zero DLQ spikes
- [ ] Circuit breaker stable (no trips)

**GO/NO-GO Gate:** Backend team + SEO team approval

---

### Phase B: Dark Launch (24h)

**Owner:** Backend Team + Ops Team  
**Start:** T+120h (after Phase A passes)  
**Duration:** 24 hours

**Activities:**
- [ ] Deploy to production with `REBUILD_ENDPOINT_ENABLED=true`
- [ ] IP allowlist set to scholarship_agent IPs only
- [ ] No traffic (endpoint not advertised to scholarship_agent)
- [ ] Monitor health checks, metrics populating
- [ ] Verify feature flag works (toggle on/off, verify 503)

**Exit Criteria:**
- [ ] 24h uptime (99.9%+)
- [ ] Health checks green (/health, /healthz, /readyz)
- [ ] Metrics populating correctly
- [ ] Zero alerts fired
- [ ] Feature flag toggles work

**GO/NO-GO Gate:** Ops team approval

---

### Phase C: Canary (10% Volume, 48h)

**Owner:** Backend Team + scholarship_agent Team  
**Start:** T+144h (after Phase B passes)  
**Duration:** 48 hours

**Activities:**
- [ ] Set `REBUILD_TRAFFIC_PERCENTAGE=10`
- [ ] scholarship_agent routes 10% of rebuild volume to /rebuild
- [ ] 90% still via cron-based rebuild (fallback)
- [ ] Monitor queue depth, latency, error rate
- [ ] Compare outcomes (10% via API vs 90% via cron)

**Exit Criteria:**
- [ ] 48h green (SLO error budget intact)
- [ ] Queue drains <10 min post-burst
- [ ] No DLQ spikes
- [ ] No SEO regressions (compare 10% vs 90%)
- [ ] Indexation delta tracked (GSC "Last crawled" for 10%)

**GO/NO-GO Gate:** Backend team + SEO team + CEO approval

---

### Phase D: Full Rollout (100%, 7 Days)

**Owner:** Backend Team + scholarship_agent Team  
**Start:** T+192h (after Phase C passes)  
**Duration:** 7 days

**Activities:**
- [ ] Ramp `REBUILD_TRAFFIC_PERCENTAGE` from 10% → 50% → 100% over 3 days
- [ ] Monitor SLOs continuously
- [ ] Demote cron-based rebuild to fallback (daily full rebuild)
- [ ] Event-driven architecture live
- [ ] Verify kill switch (toggle flag, verify fallback to cron)

**Exit Criteria:**
- [ ] 100% of rebuild volume via /rebuild for 7 days
- [ ] SLOs met continuously (99.9% uptime, P95 ≤120ms, success ≥99%)
- [ ] Cron fallback tested and works
- [ ] Kill switch tested and works
- [ ] CEO approval for permanent cutover

**GO/NO-GO Gate:** CEO approval

---

## Resource Allocation

| Role | Engineer | Hours/Day | Days | Total Hours |
|------|----------|-----------|------|-------------|
| **Backend Engineer A** | TBD | 8h | 3 | 24h |
| **Backend Engineer B** | TBD | 8h | 3 | 24h |
| **Ops Engineer C** | TBD | 4h | 2 | 8h |
| **SEO Specialist** | TBD | 4h | 1 | 4h |
| **Technical Writer** | TBD | 8h | 2 | 16h |

**Total Team Effort:** 76 engineer-hours (52 story points)

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Runaway job generation** | Medium | High | Idempotency keys, dedupe hashing, daily quotas |
| **Security exposure** | Low | Critical | X-Internal-Key, IP allowlist, strict validation |
| **Cost spikes** | Medium | Medium | Async queue with backpressure, bounded concurrency |
| **SEO regressions** | Low | High | Canonical enforcement, staged validation, progressive ramp |
| **scholarship_api downtime** | Medium | Medium | Circuit breaker, retry with backoff, DLQ |
| **Queue congestion** | Medium | Medium | Bounded concurrency, queue depth alerts, backpressure |

---

## Daily Standup Updates (During Implementation)

**Format:** 5-bullet update to CEO at EOD

**Example (Day 1):**
1. **Endpoint:** POST /internal/rebuild implemented, auth working, returns 202
2. **Queue:** BullMQ integrated, consumer skeleton complete, not wired yet
3. **Metrics:** Prometheus metrics added, /metrics endpoint live
4. **Blockers:** None
5. **Tomorrow:** Wire queue consumer, add retry logic, integration tests

---

## Success Metrics (Post-Rollout)

| Metric | Baseline (Cron) | Target (Event-Driven) | Measurement |
|--------|----------------|---------------------|-------------|
| **Rebuild Trigger → Live** | 5 min (nightly) | ≤60s P95 | Event Bus latency |
| **Freshness** | 24h (daily cron) | <1h (on-demand) | GSC "Last crawled" |
| **CTR Lift** | Baseline | +15% | GSC click-through data |
| **Queue Depth** | N/A | <100 jobs | rebuild_queue_depth gauge |
| **Success Rate** | 99.5% | ≥99% | jobs_completed / jobs_total |
| **Cost per Page** | $X | ≤$X (same or lower) | Infra cost / pages generated |

---

## Approval & Kickoff

**Awaiting Approval From:** CEO  
**Approval Deadline:** End of Day, November 20, 2025  
**Kickoff After Approval:** Immediate (T+0 start)  
**First Deliverable:** EOD Day 1 (5-bullet update to CEO)

---

**Timeline Prepared By:** auto_page_maker team  
**Date:** November 20, 2025  
**Next Action:** CEO approval → assign engineers → kickoff T+0
