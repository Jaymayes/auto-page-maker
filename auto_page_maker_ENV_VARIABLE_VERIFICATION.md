App: auto_page_maker | APP_BASE_URL: https://auto-page-maker-jamarrlmayes.replit.app

# Environment Variable Verification Checklist
**Required for 72-Hour Launch Control**

**Date**: 2025-11-21  
**App**: auto_page_maker  
**Verification Status**: IN PROGRESS

---

## CEO-Specified Required Variables

| Variable | Required? | Status | Value/Note |
|----------|-----------|--------|------------|
| APP_BASE_URL | ✅ Required | ⚠️ CHECK | Should be prod domain or dev URL |
| SCHOLARSHIP_API_URL | ✅ Required | ⚠️ CHECK | Must point to scholarship_api base URL |
| STUDENT_PILOT_URL | ✅ Required | ⚠️ CHECK | For UTM-tracked CTA links |

---

## Currently Verified Environment

### Secrets ✅ (Confirmed Present)

| Secret | Purpose | Status |
|--------|---------|--------|
| DATABASE_URL | PostgreSQL connection | ✅ Present |
| PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE | DB credentials | ✅ Present |
| OPENAI_API_KEY | AI content generation (future) | ✅ Present |
| JWT_SECRET | Session management | ✅ Present |
| SESSION_SECRET | Express sessions | ✅ Present |
| AGENT_BRIDGE_SHARED_SECRET | Agent Bridge auth | ✅ Present |
| VITE_GA_MEASUREMENT_ID | Google Analytics | ✅ Present |
| SEO_SCHEDULER_ENABLED | Enable/disable scheduler | ✅ Present |
| POSTMARK_API_KEY | Email via auto_com_center | ✅ Present |
| SENDGRID_API_KEY | Backup email provider | ✅ Present |
| DEFAULT_OBJECT_STORAGE_BUCKET_ID | Object storage | ✅ Present |
| PUBLIC_OBJECT_SEARCH_PATHS | Object storage public paths | ✅ Present |
| PRIVATE_OBJECT_DIR | Object storage private dir | ✅ Present |
| REPLIT_DOMAINS | Replit infrastructure | ✅ Present |
| REPLIT_DEV_DOMAIN | Dev domain | ✅ Present |
| REPL_ID | Replit app ID | ✅ Present |
| ADMIN_EMAILS | Admin notifications | ✅ Present |

### Missing/Unverified Variables ⚠️

| Variable | Impact | Action Required |
|----------|--------|-----------------|
| APP_BASE_URL | Cannot generate canonical URLs | **SET IMMEDIATELY** |
| SCHOLARSHIP_API_URL | Cannot fetch scholarship data | **SET IMMEDIATELY** |
| STUDENT_PILOT_URL | CTAs will be broken | **SET IMMEDIATELY** |

---

## Immediate Actions Required

### Action 1: Set APP_BASE_URL

**Purpose**: Base URL for canonical tags, sitemaps, and SEO

**Recommended Values**:
- **Production**: `https://scholarmatch.com` (when custom domain configured)
- **Dev/Testing**: `https://auto-page-maker-jamarrlmayes.replit.app`

**How to Set**:
```bash
# Via Replit Secrets UI
# OR via CLI:
replit secrets set APP_BASE_URL "https://auto-page-maker-jamarrlmayes.replit.app"
```

**Test After Setting**:
```bash
curl -s https://auto-page-maker-jamarrlmayes.replit.app/scholarship/1 | grep -o '<link rel="canonical"[^>]*>'
# Expected: <link rel="canonical" href="https://auto-page-maker-jamarrlmayes.replit.app/scholarship/1"/>
```

### Action 2: Set SCHOLARSHIP_API_URL

**Purpose**: Fetch scholarship data for page generation

**Recommended Value**:
```
https://scholarship-api-jamarrlmayes.replit.app
```
*(Adjust based on actual scholarship_api deployment)*

**How to Set**:
```bash
replit secrets set SCHOLARSHIP_API_URL "https://scholarship-api-jamarrlmayes.replit.app"
```

**Test After Setting**:
```bash
# Should return scholarship data
curl https://scholarship-api-jamarrlmayes.replit.app/api/scholarships?limit=5
```

### Action 3: Set STUDENT_PILOT_URL

**Purpose**: CTA button links with UTM tracking

**Recommended Value**:
```
https://student-pilot-jamarrlmayes.replit.app
```
*(Adjust based on actual student_pilot deployment)*

**How to Set**:
```bash
replit secrets set STUDENT_PILOT_URL "https://student-pilot-jamarrlmayes.replit.app"
```

**Test After Setting**:
```bash
# Check CTA links on any scholarship page
curl -s https://auto-page-maker-jamarrlmayes.replit.app/scholarship/1 | grep -o 'href="[^"]*student-pilot[^"]*"'
# Expected: href="https://student-pilot-jamarrlmayes.replit.app/signup?utm_source=auto_page_maker..."
```

---

## Verification Script

**Run after setting all variables**:

```bash
#!/bin/bash
echo "=== auto_page_maker Environment Verification ==="
echo ""
echo "1. APP_BASE_URL"
if [ -z "$APP_BASE_URL" ]; then
  echo "   ❌ NOT SET"
else
  echo "   ✅ $APP_BASE_URL"
fi

echo ""
echo "2. SCHOLARSHIP_API_URL"
if [ -z "$SCHOLARSHIP_API_URL" ]; then
  echo "   ❌ NOT SET"
else
  echo "   ✅ $SCHOLARSHIP_API_URL"
  echo "   Testing connectivity..."
  curl -s -o /dev/null -w "   HTTP %{http_code}\n" "$SCHOLARSHIP_API_URL/health" || echo "   ⚠️  Connection failed"
fi

echo ""
echo "3. STUDENT_PILOT_URL"
if [ -z "$STUDENT_PILOT_URL" ]; then
  echo "   ❌ NOT SET"
else
  echo "   ✅ $STUDENT_PILOT_URL"
fi

echo ""
echo "4. DATABASE_URL"
if [ -z "$DATABASE_URL" ]; then
  echo "   ❌ NOT SET"
else
  echo "   ✅ Present (length: ${#DATABASE_URL} chars)"
fi

echo ""
echo "5. SEO_SCHEDULER_ENABLED"
if [ -z "$SEO_SCHEDULER_ENABLED" ]; then
  echo "   ⚠️  NOT SET (defaults to false)"
else
  echo "   ✅ $SEO_SCHEDULER_ENABLED"
fi

echo ""
echo "=== Verification Complete ==="
```

---

## Health Endpoint Test

**After setting variables, verify app health**:

```bash
# Health check (includes DB)
curl -s https://auto-page-maker-jamarrlmayes.replit.app/health | jq

# Expected output:
# {
#   "status": "healthy",
#   "database": "connected",
#   "timestamp": "2025-11-21T..."
# }

# Ready check (dependencies)
curl -s https://auto-page-maker-jamarrlmayes.replit.app/ready | jq

# Expected output:
# {
#   "status": "ready",
#   "dependencies": {
#     "scholarship_api": "connected",
#     "database": "ready"
#   }
# }
```

---

## Post-Configuration Validation

### Test 1: Canonical URLs ✅

```bash
# Any page should have canonical with APP_BASE_URL
curl -s https://auto-page-maker-jamarrlmayes.replit.app/ | grep canonical
# Expected: <link rel="canonical" href="https://auto-page-maker-jamarrlmayes.replit.app/"/>
```

### Test 2: Sitemap URLs ✅

```bash
# Sitemap should use APP_BASE_URL for all URLs
curl -s https://auto-page-maker-jamarrlmayes.replit.app/sitemap.xml | grep -o '<loc>[^<]*</loc>' | head -3
# Expected: <loc>https://auto-page-maker-jamarrlmayes.replit.app/...</loc>
```

### Test 3: CTAs to student_pilot ✅

```bash
# Apply Now buttons should link to STUDENT_PILOT_URL
curl -s https://auto-page-maker-jamarrlmayes.replit.app/scholarship/1 | grep -o 'href="[^"]*utm_source=auto_page_maker[^"]*"' | head -1
# Expected: Contains STUDENT_PILOT_URL base
```

### Test 4: Scholarship Data Loading ✅

```bash
# Index page should show scholarships from scholarship_api
curl -s https://auto-page-maker-jamarrlmayes.replit.app/scholarships | grep -c 'scholarship-card'
# Expected: >0 (at least one scholarship displayed)
```

---

## Evidence Package (For CEO)

**After setting all variables, provide**:

1. **Screenshot**: Environment variables set in Replit Secrets UI
2. **Test Output**: Verification script results (all ✅)
3. **Health Check**: `/health` and `/ready` endpoint JSON responses
4. **Sample Page**: Screenshot of scholarship page showing:
   - Canonical URL with APP_BASE_URL
   - CTA button linking to STUDENT_PILOT_URL
   - Valid scholarship data displayed

**Template Report**:
```
Subject: auto_page_maker Environment Verification Complete

✅ APP_BASE_URL set: [value]
✅ SCHOLARSHIP_API_URL set: [value]
✅ STUDENT_PILOT_URL set: [value]
✅ All health checks passing
✅ Canonical URLs validated
✅ CTA links validated

Evidence attached (4 screenshots).

Status: Ready for launch control validation.
```

---

## Escalation

**If variables cannot be set**:
- Check Replit Secrets UI permissions
- Verify user has admin access to this Repl
- Try setting via CLI: `replit secrets set KEY "value"`

**If health checks fail after setting**:
- Restart workflow: `replit workflows restart "Start application"`
- Check server logs for errors
- Verify scholarship_api is deployed and accessible

**CEO escalation criteria**:
- Cannot set variables after 15 minutes
- Health checks fail after variable configuration
- CTA links still broken after restart

---

**Prepared By**: Agent3 (auto_page_maker)  
**Date**: 2025-11-21  
**Status**: Awaiting variable configuration  
**Blocking**: Launch control 0-6 hour validation
