# One-Click Apply — Product Specification
**Version:** 1.0.0
**Status:** DRAFT — 10% Test Traffic
**Owner:** Product
**Last Updated:** 2026-01-19

---

## Executive Summary

One-Click Apply accelerates scholarship application form-fill while enforcing strict "Editor/Coach, not Ghostwriter" principles. The feature pre-fills administrative fields only, requires explicit student review and consent, and maintains full FERPA/COPPA compliance.

---

## Core Principle

> **"Editor/Coach, not Ghostwriter"**

The AI assists with administrative efficiency. It never writes essays, personal statements, or creative content on behalf of students.

---

## Scope & Intent

| Allowed | Not Allowed |
|---------|-------------|
| Prefill profile fields (name, email, DOB) | Auto-generate essays |
| Prefill eligibility data (GPA, major, year) | Write personal statements |
| Prefill reusable facts (awards, activities) | Complete creative prompts |
| Administrative form automation | Background auto-submit |

**Positioning:** "Speed your admin tasks — you write your story."

---

## UX Requirements

### Pre-Submit Modal (Required)
1. **Disclosure:** List all prefilled fields vs. untouched fields
2. **Provider Terms:** Display provider's specific submission terms
3. **Consent Checkbox:** Explicit checkbox acknowledgment
4. **Final Submit:** Distinct "Submit Application" button

### Academic Integrity Notice
- Visible at Coach/Help touchpoint
- Visible at submission confirmation
- AI must refuse prohibited requests with policy message

### Review Flow
- Default focus: Review, not speed
- "View/Edit" step before any submission
- No auto-submit on page load

---

## Functional Constraints

| Constraint | Implementation |
|------------|----------------|
| Non-creative fields only | Profile, eligibility, reusable facts |
| Rate limits | Max N submissions/user/day (provider policy) |
| Human confirmation | Required before every submission |
| No background submit | Explicit user action only |

---

## Privacy & Compliance

### COPPA Age Gate
| Condition | Action |
|-----------|--------|
| DOB < 13 | Route to parental consent flow |
| User state | `Pending_Parent_Auth` |
| One-Click Apply | BLOCKED until consent |

### FERPA Access Control
| Condition | Action |
|-----------|--------|
| Unauthorized access attempt | Return 403 |
| Cross-student record access | BLOCKED + log to A8 |
| Audit trail | All access logged |

### Data Hygiene
| Rule | Implementation |
|------|----------------|
| PII in logs | 0 (event IDs, timestamps, provider ID only) |
| A8 telemetry | Event-level, no PII |

---

## Provider Safeguards

| Safeguard | Implementation |
|-----------|----------------|
| Provider-specific rules | Honor attachments, word limits, custom prompts |
| Complaint kill-switch | **Auto-disable if provider complaints > 0** |
| Audit trail | Timestamp, fields prefilled, confirmation hash |

---

## Accessibility

| Requirement | Implementation |
|-------------|----------------|
| WCAG 2.1 | Axe scan on all modals/flows |
| Build gate | Fail on Critical/Serious violations |
| Plain language | Clear explanation of feature scope |

---

## Operational SLOs

| Metric | Target | Breach Action |
|--------|--------|---------------|
| API P95 | ≤1.5s | Throttle 50% non-revenue @ 15min |
| Queue depth | ≤30 | Throttle + page Ops |
| Refund rate | ≤2.0% (24h) | Auto-revert feature |
| Refund delta | ≤+0.75pp vs baseline | Auto-revert feature |
| Provider complaints | 0 | **Immediate kill-switch** |
| Academic integrity violations | 0 | **Immediate disable** |

---

## Experiment Design

| Parameter | Value |
|-----------|-------|
| Traffic cap | ≤10% eligible users |
| Randomization | Locked (no mid-experiment changes) |
| Excluded | Users <13, users without consent |
| Decision window | 7 days OR 1,000 exposures (first) |

### Success Metrics
1. Completion rate lift (review → submit)
2. Provider acceptance rate
3. Refund rate delta
4. Complaint rate (must = 0)
5. Time-to-submit

---

## Kill-Switch Conditions

| Trigger | Action |
|---------|--------|
| Provider complaint ≥ 1 | Immediate disable |
| Refund > 2.0% (24h) | Auto-revert |
| Refund +0.75pp vs baseline | Auto-revert |
| Academic integrity violation | Immediate disable |
| FERPA/COPPA breach | Immediate disable |

---

## Strategic Linkage

Reinforces Playbook V2.0's "first document upload" activation thesis:
- Reduces friction on admin tasks
- Preserves student voice on creative content
- Integrates Coach value without integrity violations

---

## Approval & Sign-Off

| Role | Name | Date |
|------|------|------|
| Product | | |
| Engineering | | |
| Legal/Compliance | | |
| CEO | | |

---

*Document Version: 1.0.0 | Classification: Internal*
