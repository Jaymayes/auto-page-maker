# Hard Filter Tuning Runbook

## Overview
This runbook guides tuning the "Hard Filters" in the scholarship matching system to balance False Positive Rate (FPR) and False Negative Rate (FNR).

## Problem: Valid Scholarships Being Hidden (High FNR)

### Symptoms
- Students report not seeing scholarships they should qualify for
- Low scholarship discovery rates
- Complaints about "missing" opportunities

### Diagnosis Steps

1. **Check deadline filter**
   - Verify timezone handling (UTC vs local)
   - Check for data quality issues (null/invalid dates)
   - Query: `SELECT * FROM scholarships WHERE deadline IS NULL`

2. **Check GPA filter**
   - Verify GPA scale normalization (4.0 vs 5.0 scale)
   - Check if requirements.gpa is properly populated
   - Consider adding tolerance: `minGpa >= requirements.gpa - 0.1`

3. **Check major filter**
   - Review fuzzy matching threshold
   - Check for major synonyms (e.g., "CS" vs "Computer Science")
   - Consider expanding to related majors

4. **Check state/residency filter**
   - Verify state code normalization
   - Check for "national" scholarships being filtered
   - Ensure "all states" scholarships pass through

### Tuning Parameters

| Filter | Strictness | Trade-off |
|--------|------------|-----------|
| Deadline | Strict (default) | High FPR reduction, minimal FNR |
| GPA | Optional | Enable only when user provides GPA |
| Major | Fuzzy match | Allow partial matches to reduce FNR |
| State | Exact match | Filter only when user specifies |
| Level | Inclusive | Include "all" level scholarships |

### Quick Fixes

1. **Relax deadline filter** (temporary)
   ```javascript
   excludeExpired: false  // Show all, including expired
   ```

2. **Disable GPA filter**
   ```javascript
   // Don't pass minGpa parameter
   ```

3. **Expand major matching**
   ```javascript
   // Use .includes() instead of exact match
   // Already implemented with fuzzy normalization
   ```

### Monitoring

- Track FPR: `SELECT COUNT(*) FROM matches WHERE eligibility_verified = false`
- Track FNR: Survey students on missed opportunities
- Target: FPR < 5%, FNR < 3%

### Escalation

If FNR exceeds 5%, escalate to ML team for review of:
- Semantic search weights
- Hard filter thresholds
- Data quality issues
