# Disaster Recovery & Security Incident Response Runbook - ScholarMatch Platform

## 🚨 Emergency Response Procedures

### CORS-Related Incidents

#### **Spike in Blocked Origins**
```bash
# 1. Immediate Assessment
curl -s "http://localhost:5000/api/health" | jq '.security.cors.blocked_rate'

# 2. Verify Legitimate Origins Not Affected
curl -i -H "Origin: https://scholarmate.app" "https://api.scholarmate.com/healthz"
# Should return 200 with Access-Control-Allow-Origin header

# 3. Check Recent Configuration Changes
git log --oneline -10 server/middleware/cors.ts

# 4. Emergency Allowlist Update (if legitimate origin blocked)
export CORS_ALLOWLIST="existing-origins,https://new-legitimate-origin.com"
# Restart application
```

**Escalation**: If >3x baseline blocked rate persists >10 minutes

#### **Legitimate Origin Blocked**
```bash
# 1. Confirm Exact Match Requirements
echo "Checking origin format..."
# Must match: scheme + host + port exactly
# ❌ http://app.com vs https://app.com
# ❌ app.com vs https://app.com
# ❌ https://app.com:3000 vs https://app.com

# 2. Staging Safety Mode
export CORS_LOG_ONLY=true
# Restart in staging only - logs violations without blocking

# 3. CDN/Proxy Check
curl -i -H "Origin: https://expected-origin.com" \
  "https://api.scholarmate.com/healthz" | grep -i vary
# Should see: Vary: Origin, Access-Control-Request-Method, Access-Control-Request-Headers

# 4. Production Fix
export CORS_ALLOWLIST="https://app.scholarmate.com,https://www.scholarmate.com"
```

### Path Traversal Attack Response

#### **Active Directory Traversal Attempts**
```bash
# 1. Immediate Log Analysis
grep "Path traversal attempt" /var/log/scholarmate/security.log | tail -20

# 2. Attacker IP Identification
grep "SECURITY.*traversal" logs | awk '{print $NF}' | sort | uniq -c | sort -nr

# 3. Pattern Analysis
grep "../" logs | grep -E "(etc|proc|windows|system)" | wc -l

# 4. Emergency IP Blocking (if high volume from single IP)
# Add to WAF/firewall rules
iptables -A INPUT -s ATTACKER_IP -j DROP
```

**Auto-Ban Criteria**: >10 traversal attempts from single IP in 5 minutes

#### **System File Access Attempts**
```bash
# 1. Audit System Paths Attempted
grep "System path access" logs | grep -o "/[a-z/]*" | sort | uniq -c

# 2. Verify No Successful Access
# All attempts should return 403 - investigate any 200s
grep "System path.*200" logs

# 3. Enhanced Monitoring
# Add alerting for: /etc/passwd, /proc/version, C:\Windows\System32
```

### Unicode Attack Response

#### **Sophisticated Spoofing Campaign**
```bash
# 1. Analyze Attack Vectors
grep "UNICODE.*normalized" logs | grep -o "empty after normalization"

# 2. Check for Data Corruption
# Verify no malformed data in database
SELECT slug, title FROM landing_pages WHERE slug ~ '[^\x00-\x7F]';

# 3. Enhanced Protection
# Monitor for: zero-width characters, bidi override, combining characters
grep -P "[\u200B-\u200D\uFEFF]" logs
```

### Rate Limit Violations

#### **DDoS/High Volume Attack**
```bash
# 1. Current Rate Statistics
grep "RATE LIMIT" logs | tail -50 | awk '{print $6}' | sort | uniq -c

# 2. Origin-Based Analysis
grep "ORIGIN RATE LIMIT" logs | grep -o "origin [^ ]*" | sort | uniq -c

# 3. Emergency Rate Adjustment (if needed)
export RATE_LIMIT_WINDOW=300000  # 5 minutes
export RATE_LIMIT_MAX=50         # Reduced from 100
```

## 📊 Monitoring & Alerting

### Critical Metrics to Track

#### **Security Violations (Alert Thresholds)**
- **Blocked CORS Origins**: >2% of total requests OR >3x baseline
- **Path Traversal Attempts**: >5 per minute sustained
- **Unicode Attacks**: >10 empty identifiers per hour
- **Rate Limit Hits**: >20% of requests from single IP/origin

#### **Performance Degradation**
- **CORS Response Time**: >100ms p95 latency
- **Security Middleware**: >150ms total overhead
- **Preflight Cache Miss**: >30% cache miss rate

### Automated Response Actions

#### **High Severity (Auto-Block)**
```bash
# Path Traversal: >10 attempts from IP in 5 minutes
iptables -A INPUT -s $IP -j DROP

# Unicode Flooding: >50 empty identifier attempts per minute
# Rate limit specific patterns more aggressively

# CORS Abuse: >1000 blocked requests from single origin per hour
# Add to permanent blocklist
```

#### **Medium Severity (Enhanced Logging)**
```bash
# Log detailed request info for analysis
export LOG_SECURITY_DETAILS=true

# Increase rate limit monitoring frequency
export RATE_LIMIT_LOG_ALL=true
```

## 🔧 Configuration Recovery

### Safe Configuration Rollback
```bash
# 1. Emergency CORS Bypass (STAGING ONLY)
export CORS_LOG_ONLY=true

# 2. Restore Known Good Configuration
git checkout HEAD~1 server/middleware/cors.ts
git checkout HEAD~1 server/middleware/path-security.ts

# 3. Gradual Re-enablement
export CORS_ALLOWLIST="trusted-origin-only.com"
# Test thoroughly before adding more origins
```

### Production Emergency Access
```bash
# 1. Server-to-Server Verification
curl -X POST "https://api.scholarmate.com/api/emergency-health" \
  -H "X-Emergency-Token: $EMERGENCY_TOKEN"

# 2. Bypass Origin Check (Emergency Only)
curl -X POST "https://api.scholarmate.com/api/admin/cors-bypass" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"temporary_origin": "https://emergency.tool.com", "duration": 300}'
```

## 📋 Post-Incident Review

### Data Collection
1. **Timeline**: Exact start/end times of incident
2. **Impact**: Number of blocked legitimate requests
3. **Response**: Actions taken and their effectiveness
4. **Root Cause**: Configuration error, attack pattern, etc.

### Improvement Actions
1. **Configuration**: Update allowlists, thresholds
2. **Monitoring**: Add new alerts, adjust thresholds
3. **Documentation**: Update runbooks, procedures
4. **Testing**: Add edge cases to security test suite

### Security Audit Checklist
- [ ] Review all CORS configuration changes
- [ ] Verify no sensitive data exposed in logs
- [ ] Confirm all attack vectors properly blocked
- [ ] Test emergency response procedures
- [ ] Update security team contacts and escalation paths

## 🚨 Emergency Contacts

- **Security Team**: security@scholarmate.com
- **DevOps Oncall**: +1-555-DEVOPS
- **Platform Team**: platform@scholarmate.com
- **Management Escalation**: cto@scholarmate.com

---

## 🗄️ DISASTER RECOVERY PROCEDURES

### Database Backup & Restore

#### **Point-in-Time Recovery (Neon PostgreSQL)**
```bash
# 1. Check Current Backup Status
curl -H "Authorization: Bearer $NEON_API_KEY" \
  "https://console.neon.tech/api/v2/projects/$PROJECT_ID/databases/$DATABASE_ID/backups"

# 2. Create Manual Backup Point
# Neon automatically creates continuous backups
# Manual backup via database export:
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 3. Point-in-Time Restore (via Neon Console)
# Navigate to: Neon Console > Project > Databases > Restore
# Select timestamp within retention period (7-30 days based on plan)

# 4. Verify Restore Success
psql $RESTORED_DATABASE_URL -c "\\dt"
psql $RESTORED_DATABASE_URL -c "SELECT COUNT(*) FROM users;"
psql $RESTORED_DATABASE_URL -c "SELECT COUNT(*) FROM scholarships;"
```

**RPO (Recovery Point Objective):** ≤15 minutes (Neon continuous backup)  
**RTO (Recovery Time Objective):** ≤2 hours (including validation)

#### **Application State Recovery**
```bash
# 1. Codebase Rollback
git log --oneline -10  # Find last known good commit
git checkout <COMMIT_SHA>

# 2. Environment Recovery
# Restore from secure backup:
export DATABASE_URL="$BACKUP_DATABASE_URL"
export OPENAI_API_KEY="$BACKUP_OPENAI_KEY"
export JWT_SECRET="$BACKUP_JWT_SECRET"

# 3. Service Restart
npm run dev  # Development
# Or trigger Replit deployment for production

# 4. Health Validation
curl http://localhost:5000/healthz
curl http://localhost:5000/api/scholarships/stats
```

### Infrastructure Recovery

#### **Full System Recovery Procedure**
```bash
# 1. Database Recovery
# Follow Point-in-Time Recovery above

# 2. Application Recovery
git clone <REPOSITORY_URL>
cd scholarmatch-platform
npm install

# 3. Environment Configuration
# Restore environment variables from secure backup
cp .env.backup .env

# 4. Database Schema Recovery
npm run db:push --force

# 5. Service Validation
npm run dev
# Verify all endpoints respond correctly
```

**Full Recovery RTO:** ≤4 hours  
**Data Loss RPO:** ≤15 minutes

#### **Backup Schedule & Validation**

**Automated Backups (Neon):**
- Continuous WAL backups: Every 15 minutes
- Full database snapshots: Daily at 02:00 UTC
- Retention period: 7 days (free) / 30 days (paid)

**Manual Backup Testing:**
```bash
# Weekly DR Test (Sundays 03:00 UTC)
#!/bin/bash
set -e

# 1. Create test backup
TEST_BACKUP="dr_test_$(date +%Y%m%d_%H%M%S).sql"
pg_dump $DATABASE_URL > "$TEST_BACKUP"

# 2. Verify backup integrity
if [ -s "$TEST_BACKUP" ]; then
  echo "✅ Backup file created successfully"
else
  echo "❌ Backup failed - file empty or missing"
  exit 1
fi

# 3. Test restore process (to test database)
psql $TEST_DATABASE_URL < "$TEST_BACKUP"

# 4. Validate restored data
RESTORED_COUNT=$(psql $TEST_DATABASE_URL -t -c "SELECT COUNT(*) FROM users;")
ORIGINAL_COUNT=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM users;")

if [ "$RESTORED_COUNT" -eq "$ORIGINAL_COUNT" ]; then
  echo "✅ DR test successful - data integrity verified"
else
  echo "❌ DR test failed - data mismatch detected"
  exit 1
fi

# 5. Cleanup
rm "$TEST_BACKUP"
psql $TEST_DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

**Last Successful DR Test:** [TO BE UPDATED]  
**Next Scheduled Test:** Every Sunday 03:00 UTC  
**Test Owner:** Infrastructure Team

---

**Remember**: Security incidents require rapid response but careful analysis. When in doubt, err on the side of caution and escalate quickly.