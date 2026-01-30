# Data Retention Schedule — Scholar AI Advisor
**Version:** 1.0 (Draft for CEO Preview)  
**Effective Date:** 2025-11-14  
**Last Updated:** 2025-11-11  
**Owner:** Agent3 (Cross-App Coordination)  
**Next Review:** 2026-02-14 (Quarterly)

---

## Executive Summary

This document establishes the authoritative data retention policy for Scholar AI Advisor's 8-app ecosystem, aligned to our $10M profitable ARR mission while maintaining FERPA/COPPA/GDPR compliance, minimizing liability, and protecting student trust.

**Core Principles:**
1. Minimize data; retain only what drives student value and compliance
2. Default to aggregated/anonymized where possible
3. Enforce crypto-shredding and documented deletion paths
4. Honor legal holds with auditable approvals

**Scope:** All 8 applications (auto_page_maker, scholarship_api, scholar_auth, auto_com_center, provider_register, student_pilot, scholarship_agent, scholarship_sage)

---

## Application-Specific Retention Policies

### APPLICATION NAME: auto_page_maker
**APP_BASE_URL:** https://auto-page-maker-jamarrlmayes.replit.app

#### Data Classes and Retention

| Data Class | Hot Storage | Warm Storage | Cold/Aggregate | Deletion Trigger |
|------------|-------------|--------------|----------------|------------------|
| **Application Logs (non-PII)** | 14 days | 90 days | Roll-up metrics: 400 days | After 400 days |
| **SEO KPI Rollups** | 400 days (13 months) | N/A | N/A | After 400 days (YoY) |
| **Scholarship Catalog Content** | Indefinite | N/A | Quarterly accuracy review | Provider takedown (7 days) |
| **Web Analytics (GA4)** | Aggregated: 25 months | N/A | N/A | After 25 months |
| **Sitemap Generation Logs** | 14 days | 90 days | Metrics: 400 days | After 400 days |

#### Rationale
- **Public SEO surface:** Zero PII collection; auth-independent
- **Business value:** SEO metrics drive organic growth (primary low-CAC engine)
- **YoY comparisons:** 400-day retention enables growth trend analysis

#### Storage & Encryption
- **At-Rest:** Neon PostgreSQL (provider-managed AES-256 encryption)
- **In-Transit:** TLS 1.3 + HSTS enforced via Replit platform
- **Logs:** Pino structured logging (request_id, timestamps, HTTP status)

#### Lifecycle Automation
- Daily rollup files: Retained in `seo/daily_rollup/` for 400 days
- Application logs: Neon auto-purge after 90 days warm storage
- Catalog updates: Quarterly review cycle; provider takedowns within 7 days

#### DSAR Handling
- **N/A:** No PII collected; public scholarship data only
- **Provider Rights:** Takedown requests honored within 7 days

---

### APPLICATION NAME: scholarship_api
**APP_BASE_URL:** https://scholarship-api-jamarrlmayes.replit.app

#### Data Classes and Retention

| Data Class | Hot Storage | Warm Storage | Cold/Aggregate | Deletion Trigger |
|------------|-------------|--------------|----------------|------------------|
| **Application Logs (non-PII)** | 14 days | 90 days | Roll-up metrics: 400 days | After 400 days |
| **Business Events** | 400 days (13 months) | N/A | N/A | After 400 days |
| **Request Lineage (request_id)** | 30 days | 90 days | Aggregated: 400 days | After 400 days |
| **API Audit Logs** | 90 days | 365 days | 2 years (security) | After 2 years |
| **Scholarship Catalog** | Indefinite | N/A | Quarterly review | Provider takedown (7 days) |
| **Eligibility Determinations** | 365 days | N/A | Fairness metrics: 2 years | After 2 years |

#### Rationale
- **Deterministic backbone:** API provides rules-based eligibility; audit trails required
- **Business events:** Activation, matching, fee accrual drive ARR analytics
- **Explainability:** Retain eligibility logic for fairness/bias audits

#### Storage & Encryption
- **At-Rest:** Neon PostgreSQL (AES-256)
- **In-Transit:** TLS 1.3 + HSTS
- **Audit Logs:** Immutable append-only with request_id lineage

#### Lifecycle Automation
- Business events: Auto-archive after 400 days
- Request lineage: Hot 30d → Warm 90d → Aggregate 400d
- Security incidents: 5-year retention (compliance)

#### DSAR Handling
- **Student Data:** Eligibility determinations tied to student_pilot accounts
- **Timeline:** Acknowledge 7 days, fulfill within 30 days
- **Deletion:** Crypto-shredding via backup rotation (35 days)

---

### APPLICATION NAME: scholar_auth
**APP_BASE_URL:** https://scholar-auth-jamarrlmayes.replit.app

#### Data Classes and Retention

| Data Class | Hot Storage | Warm Storage | Cold/Aggregate | Deletion Trigger |
|------------|-------------|--------------|----------------|------------------|
| **Authentication Logs** | 30 days (hot) | 180 days (warm) | 365 days (aggregated) | After 365 days |
| **IP Addresses** | 7 days (truncated after) | N/A | N/A | Truncated after 7 days |
| **Session Tokens (Redis)** | TTL: 24 hours | N/A | N/A | Auto-expire |
| **Refresh Tokens** | TTL: 30 days | N/A | N/A | Auto-expire or revoke |
| **MFA Factors (TOTP/WebAuthn)** | Until account deletion | N/A | N/A | Account deletion |
| **Audit Logs (auth events)** | 90 days | 365 days | 5 years (security) | After 5 years |
| **JWKS Keys** | Active + 1 rotation | N/A | N/A | After rotation cycle |

#### Rationale
- **Zero-trust auth:** Short-lived tokens, MFA enforcement, audit trails
- **Security incidents:** 5-year retention for forensic analysis
- **Privacy:** IP truncation after 7 days minimizes PII exposure

#### Storage & Encryption
- **At-Rest:** Neon PostgreSQL (AES-256) + Redis (in-memory)
- **In-Transit:** TLS 1.3 + HSTS; PKCE S256 for OIDC flows
- **Tokens:** RS256 JWTs with jti anti-replay

#### Lifecycle Automation
- Session tokens: Redis TTL auto-expire (24h)
- IP truncation: Cron job after 7 days
- Auth logs: Hot 30d → Warm 180d → Aggregate 365d

#### DSAR Handling
- **Access:** Provide auth event history (last 90 days)
- **Export:** JSON format with timestamps, devices, IP (truncated)
- **Delete:** Revoke all tokens, delete MFA factors, purge logs (30-day timeline)
- **Legal Hold:** Override with auditable CEO approval

---

### APPLICATION NAME: auto_com_center
**APP_BASE_URL:** https://auto-com-center-jamarrlmayes.replit.app

#### Data Classes and Retention

| Data Class | Hot Storage | Warm Storage | Cold/Aggregate | Deletion Trigger |
|------------|-------------|--------------|----------------|------------------|
| **Email Deliverability Telemetry** | 90 days | N/A | Aggregate metrics: 400 days | After 400 days |
| **Seed Inbox Artifacts** | 90 days | N/A | N/A | After 90 days |
| **ESP Logs (Postmark/SendGrid)** | 90 days | N/A | Aggregate: 400 days | After 400 days |
| **Suppression Lists** | Until opt-in or 2 years | N/A | N/A | After 2 years (CAN-SPAM) |
| **Bounce/Complaint Events** | 90 days | N/A | Aggregate: 400 days | After 400 days |
| **Queue Jobs (success/fail)** | 7 days | 30 days | Metrics: 400 days | After 400 days |
| **Application Logs** | 14 days | 90 days | Roll-up: 400 days | After 400 days |

#### Rationale
- **Deliverability monitoring:** Gate A compliance requires 90-day visibility
- **CAN-SPAM compliance:** 2-year suppression list retention
- **Aggregate metrics:** 400 days for YoY deliverability trends

#### Storage & Encryption
- **At-Rest:** Neon PostgreSQL (AES-256)
- **In-Transit:** TLS 1.3 + HSTS
- **ESP Integration:** Webhook signature verification (HMAC)

#### Lifecycle Automation
- Seed inbox artifacts: Auto-purge after 90 days
- Queue jobs: Hot 7d → Warm 30d → Metrics 400d
- Suppression lists: Cron check for 2-year expiry

#### DSAR Handling
- **Student Data:** Email addresses, bounce/complaint status
- **Access:** Provide deliverability status (last 90 days)
- **Delete:** Remove from suppression list (unless legal hold)
- **Timeline:** 30 days for DSAR fulfillment

---

### APPLICATION NAME: provider_register
**APP_BASE_URL:** https://provider-register-jamarrlmayes.replit.app

#### Data Classes and Retention

| Data Class | Hot Storage | Warm Storage | Cold/Aggregate | Deletion Trigger |
|------------|-------------|--------------|----------------|------------------|
| **Provider Profile (KYC/Tax)** | 7 years | N/A | N/A | After 7 years (AML/accounting) |
| **Scholarship Offers (active)** | While live | N/A | Historical: 400 days | Takedown request (7 days) |
| **Payout Records** | 7 years | N/A | N/A | After 7 years (accounting) |
| **3% Platform Fee Events** | 400 days (13 months) | N/A | Aggregate: 7 years | After 7 years |
| **Audit Logs (RBAC)** | 90 days | 365 days | 2 years | After 2 years |
| **Application Logs** | 14 days | 90 days | Roll-up: 400 days | After 400 days |

#### Rationale
- **Financial compliance:** 7-year retention for KYC, payouts, fee accrual (IRS/AML)
- **B2B ARR tracking:** 3% platform fee events drive revenue analytics
- **Provider rights:** Offer takedown within 7 days on request

#### Storage & Encryption
- **At-Rest:** Neon PostgreSQL (AES-256)
- **In-Transit:** TLS 1.3 + HSTS
- **Stripe Integration:** PCI-DSS compliant (Stripe-managed)

#### Lifecycle Automation
- KYC/Tax: Manual review before 7-year auto-archive
- Offers: Takedown within 7 days; historical retention 400 days
- Fee events: Hot 400d → Aggregate 7 years (accounting)

#### DSAR Handling
- **Provider Data:** KYC, offers, payouts, fee history
- **Access:** Provide full provider record (JSON export)
- **Delete:** Honor after 7-year accounting period (unless legal hold)
- **Timeline:** 30 days for DSAR fulfillment

---

### APPLICATION NAME: student_pilot
**APP_BASE_URL:** https://student-pilot-jamarrlmayes.replit.app

#### Data Classes and Retention

| Data Class | Hot Storage | Warm Storage | Cold/Aggregate | Deletion Trigger |
|------------|-------------|--------------|----------------|------------------|
| **Student Profile (PII)** | Until account deletion | N/A | N/A | Account deletion |
| **Uploaded Documents** | Active use | 90 days post-deletion | N/A | 90 days after account deletion |
| **Application Drafts** | Active use | 90 days post-deletion | N/A | 90 days after account deletion |
| **Credit Purchase History** | 7 years | N/A | N/A | After 7 years (accounting) |
| **Activation Events** | 400 days (13 months) | N/A | Aggregate: 2 years | After 2 years |
| **Essay/Document AI Analysis** | Until document deletion | N/A | Aggregate metrics only | Document deletion |
| **Audit Logs (RBAC)** | 90 days | 365 days | 2 years | After 2 years |
| **Application Logs** | 14 days | 90 days | Roll-up: 400 days | After 400 days |

#### Rationale
- **Student control:** "Delete now" option for documents/drafts
- **FERPA/COPPA:** No data collection for under-13; purge within 24h if detected
- **Financial compliance:** 7-year credit purchase retention (IRS)
- **Activation telemetry:** 400 days for YoY conversion analysis

#### Storage & Encryption
- **At-Rest:** Neon PostgreSQL + Object Storage (AES-256)
- **In-Transit:** TLS 1.3 + HSTS
- **Documents:** Server-side encryption (S3-compatible)

#### Lifecycle Automation
- Student profiles: Retain until deletion request
- Documents: Active use → 90 days post-deletion → purge
- Credit history: 7-year retention (auto-archive)
- Activation events: Hot 400d → Aggregate 2 years

#### DSAR Handling
- **Access:** Full student record (profile, documents, purchases, activation)
- **Export:** ZIP archive (JSON + PDF documents)
- **Delete:** 
  - Immediate: Profile, documents, drafts (within 30 days)
  - Crypto-shred: Backups via rotation (35 days)
  - Retain: Credit purchases (7 years, anonymized where possible)
- **Timeline:** Acknowledge 7 days, fulfill within 30 days
- **Children:** If under-13 detected, purge within 24 hours + incident report

---

### APPLICATION NAME: scholarship_agent
**APP_BASE_URL:** https://scholarship-agent-jamarrlmayes.replit.app

#### Data Classes and Retention

| Data Class | Hot Storage | Warm Storage | Cold/Aggregate | Deletion Trigger |
|------------|-------------|--------------|----------------|------------------|
| **Fairness Telemetry** | 365 days | N/A | 2 years (violations) | After 2 years |
| **Model Explanations (rationale)** | 365 days | N/A | Aggregate: 2 years | After 2 years |
| **Match Events** | 400 days (13 months) | N/A | Aggregate: 2 years | After 2 years |
| **Parity Violations** | 2 years | N/A | N/A | After 2 years |
| **HOTL Approval Records** | 2 years | N/A | N/A | After 2 years |
| **Audit Logs (autonomous actions)** | 90 days | 365 days | 5 years | After 5 years |
| **Application Logs** | 14 days | 90 days | Roll-up: 400 days | After 400 days |

#### Rationale
- **Responsible AI:** Fairness metrics, rationale coverage (≥95%), parity monitoring
- **Explainability:** Model decisions traceable for 2 years (bias audits)
- **HOTL governance:** Approval gates, override mechanisms (2-year audit trail)

#### Storage & Encryption
- **At-Rest:** Neon PostgreSQL (AES-256)
- **In-Transit:** TLS 1.3 + HSTS
- **Audit Logs:** Immutable append-only with request_id lineage

#### Lifecycle Automation
- Fairness telemetry: Hot 365d → Violations 2 years
- Match events: Hot 400d → Aggregate 2 years
- HOTL records: 2-year retention (compliance)
- Audit logs: Hot 90d → Warm 365d → 5 years (security)

#### DSAR Handling
- **Student Data:** Match events, rationale for recommendations
- **Access:** Provide match history + explanations (last 365 days)
- **Delete:** Purge match events (30-day timeline); retain aggregate fairness metrics
- **Bias Audits:** Retain parity data (anonymized) for 2 years

---

### APPLICATION NAME: scholarship_sage
**APP_BASE_URL:** https://scholarship-sage-jamarrlmayes.replit.app

#### Data Classes and Retention

| Data Class | Hot Storage | Warm Storage | Cold/Aggregate | Deletion Trigger |
|------------|-------------|--------------|----------------|------------------|
| **Cross-App KPI Rollups** | 400 days (13 months) | N/A | N/A | After 400 days |
| **Fairness Telemetry Dashboard** | 365 days | N/A | 2 years (violations) | After 2 years |
| **B2C/B2B Analytics** | 400 days (13 months) | N/A | N/A | After 400 days |
| **SLO Dashboards** | 90 days (real-time) | N/A | Aggregate: 400 days | After 400 days |
| **Gate Tracker** | 90 days | N/A | Archive: Indefinite | N/A (historical record) |
| **Application Logs** | 14 days | 90 days | Roll-up: 400 days | After 400 days |

#### Rationale
- **BI backbone:** Centralized analytics for CEO decision-making
- **YoY comparisons:** 400-day retention enables growth trend analysis
- **Historical gates:** Permanent archive of go-live decisions

#### Storage & Encryption
- **At-Rest:** Neon PostgreSQL (AES-256)
- **In-Transit:** TLS 1.3 + HSTS
- **Dashboards:** Read-only observer mode (no PII collection)

#### Lifecycle Automation
- KPI rollups: Hot 400 days → Auto-archive
- SLO dashboards: Real-time 90d → Aggregate 400d
- Gate tracker: Permanent historical archive

#### DSAR Handling
- **N/A:** Aggregated/anonymized analytics only; no individual PII

---

## Cross-Cutting Standards

### Storage & Encryption

**At-Rest Encryption:**
- **Database:** Neon PostgreSQL (provider-managed AES-256)
- **Object Storage:** S3-compatible server-side encryption (AES-256)
- **Backups:** Encrypted snapshots with key rotation

**In-Transit Encryption:**
- **TLS:** 1.2+ enforced (prefer 1.3)
- **HSTS:** Preload enabled across all apps
- **API Communication:** JWT RS256 signatures, PKCE S256 for OIDC

**Key Management:**
- **Rotation:** Quarterly review; emergency rotation within 24 hours
- **Access:** Least-privilege IAM policies
- **Crypto-Shredding:** Key revocation enables GDPR-compliant deletion

### Backup & Recovery

**PITR (Point-In-Time Recovery):**
- **Neon PostgreSQL:** 7-day PITR window
- **RPO:** ≤15 minutes
- **RTO:** ≤30 minutes

**Backup Retention:**
- **Weekly Full Backups:** Retained 4 weeks
- **Monthly Backups:** Retained 12 months
- **Purge:** Rotation-based (30-35 days for DSAR compliance)

**DR Test:**
- **Frequency:** Quarterly
- **Next Test:** Nov 17, 02:00-04:00 UTC
- **Evidence Due:** Nov 18, 12:00 UTC

### DSAR Workflow

**Request Timeline:**
1. **Acknowledge:** Within 7 days
2. **Fulfill:** Within 30 days
3. **Deletion:** Propagate to backups within 35 days (rotation + crypto-shredding)

**Single Control Plane:**
- **Orchestration:** scholarship_sage coordinates cross-app deletions
- **Audit Trail:** request_id lineage for all DSAR operations
- **Legal Hold:** Override with CEO approval (auditable)

**Endpoints:**
- **/api/access:** Retrieve student data (JSON export)
- **/api/export:** Full data package (ZIP: JSON + documents)
- **/api/delete:** Initiate deletion workflow (30-day SLA)

**Verification:**
- Post-deletion confirmation email
- Audit log entry with completion timestamp
- Backup purge verification (35-day rotation)

### Children's Data (COPPA)

**Policy:**
- **Prohibited:** No data collection for users under 13
- **Detection:** Age verification at registration (student_pilot)
- **Incident Response:** If detected, purge within 24 hours + incident report

**Purge Procedure:**
1. Immediate account suspension
2. Delete profile, documents, logs within 24h
3. Notify CEO + compliance team
4. Document incident in audit log (5-year retention)

### Legal Hold

**Override Mechanism:**
- **Trigger:** Litigation, regulatory investigation, or security incident
- **Approval:** CEO or Legal Counsel (auditable)
- **Scope:** Freeze deletion for specified data classes
- **Documentation:** Hold notice with expiration date

**Audit Trail:**
- Hold start/end timestamps
- Affected data classes
- Approver identity
- Justification (case number, regulatory reference)

### Quarterly Review

**Schedule:**
- **Next Review:** 2026-02-14 (90 days from effective date)
- **Owner:** scholarship_sage DRI
- **CEO Approval:** Required for any policy changes

**Review Checklist:**
- Regulatory changes (FERPA/COPPA/GDPR updates)
- Retention period effectiveness (data minimization)
- DSAR fulfillment metrics (average time, volumes)
- Storage costs vs. business value
- Security incidents requiring extended retention

---

## Implementation Roadmap

### Immediate (Nov 11-14, 2025)

**Nov 12, 12:00 UTC:** Business events schema finalized (scholarship_api, provider_register, auto_com_center)

**Nov 12, 18:00 UTC:** RBAC matrices + encryption confirmation (all apps)

**Nov 12, 22:00 UTC:** Draft data retention schedule for CEO preview ✅ (THIS DOCUMENT)

**Nov 14, 18:00 UTC:** Privacy/DSAR endpoints complete (student_pilot, scholar_auth, scholarship_api)

**Nov 14, 20:00 UTC:** Final data retention schedule approved and published

### Short-Term (Nov 15-30, 2025)

**Lifecycle Automation:**
- Implement cron jobs for log purging (14d hot → 90d warm → 400d aggregate)
- Configure S3 lifecycle policies (object storage)
- IP truncation automation (scholar_auth, 7-day window)

**DSAR Tooling:**
- Single control plane UI (scholarship_sage)
- Cross-app deletion orchestration
- Crypto-shredding integration with backup rotation

**Monitoring:**
- Retention policy compliance dashboards
- DSAR fulfillment SLA tracking
- Storage cost vs. retention alerts

### Long-Term (Dec 2025 - Q1 2026)

**SOC 2 Readiness:**
- Audit trail completeness verification
- Third-party assessment prep
- Control mapping documentation

**Continuous Improvement:**
- Quarterly policy reviews
- DSAR process optimization
- Data minimization opportunities

---

## Appendices

### Appendix A: Data Class Summary Matrix

| Data Class | Retention Period | Legal Basis | Applicable Apps |
|------------|------------------|-------------|-----------------|
| Auth logs (IP, device) | 30d hot, 180d warm, 365d agg | Security + fraud prevention | scholar_auth |
| Student PII | Until deletion | Consent + contract | student_pilot |
| Credit purchases | 7 years | Accounting (IRS) | student_pilot, provider_register |
| Provider KYC | 7 years | AML compliance | provider_register |
| Business events | 400 days (13 months) | Legitimate interest (analytics) | All apps |
| Fairness telemetry | 365d hot, 2y violations | Responsible AI governance | scholarship_agent, scholarship_sage |
| Security incidents | 5 years | Legal compliance | All apps |
| Public catalog | Indefinite (quarterly review) | Legitimate interest | auto_page_maker, scholarship_api |

### Appendix B: Storage Locations

| App | Database | Object Storage | Cache/Session | Logs |
|-----|----------|----------------|---------------|------|
| auto_page_maker | Neon PostgreSQL | N/A | N/A | Pino → Neon |
| scholarship_api | Neon PostgreSQL | N/A | N/A | Pino → Neon |
| scholar_auth | Neon PostgreSQL | N/A | Redis (sessions) | Pino → Neon |
| auto_com_center | Neon PostgreSQL | N/A | N/A | Pino → Neon |
| provider_register | Neon PostgreSQL | N/A | N/A | Pino → Neon |
| student_pilot | Neon PostgreSQL | S3-compatible (docs) | N/A | Pino → Neon |
| scholarship_agent | Neon PostgreSQL | N/A | N/A | Pino → Neon |
| scholarship_sage | Neon PostgreSQL | N/A | N/A | Pino → Neon |

### Appendix C: Deletion Flowchart

```
DSAR Delete Request Received
         ↓
Acknowledge within 7 days
         ↓
Validate identity + scope
         ↓
Check for legal hold → [YES] → Notify requester + hold data
         ↓ [NO]
Execute cross-app deletion
    ├─ student_pilot: Profile, documents, drafts
    ├─ scholar_auth: Sessions, tokens, MFA factors, auth logs
    ├─ scholarship_api: Eligibility history (retain aggregate fairness)
    ├─ auto_com_center: Email status, suppression (unless legal)
    ├─ scholarship_agent: Match events (retain aggregate fairness)
    └─ provider_register: Provider data (after 7-year period)
         ↓
Mark for crypto-shred in backups
         ↓
Confirm deletion within 30 days
         ↓
Backup rotation completes purge (35 days)
         ↓
Send confirmation + audit log entry
```

### Appendix D: CEO Review Checklist (Quarterly)

- [ ] Regulatory changes reviewed (FERPA/COPPA/GDPR)
- [ ] Retention periods align with business value
- [ ] DSAR metrics reviewed (avg time, volumes, bottlenecks)
- [ ] Storage costs vs. retention justified
- [ ] Security incidents requiring extended retention identified
- [ ] Data minimization opportunities documented
- [ ] Policy updates approved and communicated
- [ ] Next review scheduled (90 days)

---

## Signatures

**Prepared By:** Agent3 (Cross-App Coordination)  
**Date:** 2025-11-11  
**Status:** Draft for CEO Preview (Due Nov 12, 22:00 UTC)  
**Final Approval:** CEO Scholar AI Advisor  
**Effective Date:** 2025-11-14  

---

**END OF DOCUMENT**
