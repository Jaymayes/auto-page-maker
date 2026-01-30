# Command Center Integration Test Plan

## Current Status
- ✅ Agent Bridge implementation complete with all security fixes
- ✅ Environment configuration system operational
- ⏳ Waiting for secrets configuration to activate Command Center integration

## Required Secrets Configuration

Add these exact values to your Replit Secrets tab:

```
SHARED_SECRET = <must-match-command-center-secret>
COMMAND_CENTER_URL = https://auto-com-center-jamarrlmayes.replit.app
AGENT_NAME = scholarmatch
AGENT_ID = scholarmatch-monolith
AGENT_BASE_URL = https://<your-repl-name>-<your-username>.replit.app
```

**Note**: Replace `AGENT_BASE_URL` with your actual public Replit URL.

## Expected Startup Sequence After Restart

Look for these log messages:
```
🔧 [CONFIG] Development mode - Some features disabled: (should be minimal warnings)
[agent-bridge] Registering with Command Center...
[agent-bridge] Registration successful
[agent-bridge] Heartbeat started
4:XX:XX AM [express] serving on port 5000
```

## Live Test Plan (Fast & Conclusive)

### 1. Sanity Checks
```bash
# Health endpoint
curl https://<your-agent-url>/healthz
# Expected: {"status":"ok","timestamp":"...","agent_id":"scholarmatch-monolith"}

# Agent capabilities  
curl https://<your-agent-url>/agent/capabilities
# Expected: {"agent_id":"scholarmatch-monolith","capabilities":[...6 actions...]}
```

### 2. Registration Verification
```bash
# Check agent appears in Command Center
curl https://auto-com-center-jamarrlmayes.replit.app/orchestrator/agents
# Expected: Agent "scholarmatch-monolith" with status "online"

# Verify heartbeat updates
curl https://auto-com-center-jamarrlmayes.replit.app/orchestrator/agents
# Expected: "last_seen" timestamp updates every 60 seconds
```

### 3. Task Flow Testing
```bash
# Run comprehensive test
./test-command-center.sh

# Expected results:
# ✅ Agent registered and online
# ✅ All 6 capabilities working
# ✅ Tasks complete with correlation IDs
# ✅ Structured JSON errors for invalid requests
```

### 4. Security Validation
```bash
# Test invalid JWT (should get 401)
curl -H "Authorization: Bearer invalid" \
  https://<your-agent-url>/agent/task \
  -X POST -d '{"action":"test"}'

# Expected: 401 with standardized error format
```

### 5. Reliability Testing
```bash
# Burst test (10 mixed tasks)
for i in {1..10}; do
  curl -X POST https://auto-com-center-jamarrlmayes.replit.app/orchestrator/tasks/dispatch \
    -H "Content-Type: application/json" \
    -d '{
      "action": "scholarmatch.search",
      "payload": {"query": "STEM", "filters": {"level": "undergrad"}},
      "requested_by": "burst-test-'$i'"
    }' &
done
wait

# Expected: No race condition warnings, all tasks complete
```

## Test Automation Script

I've prepared an enhanced test script for immediate use once secrets are configured.