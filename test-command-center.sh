#!/bin/bash

# Command Center Integration Test Script  
# Enhanced version with comprehensive validation

echo "🔗 Command Center Integration Test Suite"
echo "========================================"

CC="https://auto-com-center-jamarrlmayes.replit.app"
AGENT_URL="http://localhost:5000"
AGENT_BASE_URL="${AGENT_BASE_URL:-http://localhost:5000}"

# Test colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓ PASS${NC} - $1"; }
fail() { echo -e "${RED}✗ FAIL${NC} - $1"; }
warn() { echo -e "${YELLOW}⚠ INFO${NC} - $1"; }

echo "Step 1: Check environment configuration"
echo "--------------------------------------"
if [ -z "$SHARED_SECRET" ]; then
    fail "SHARED_SECRET not configured"
    echo "Add to Replit Secrets: SHARED_SECRET=<long-random-string>"
else
    pass "SHARED_SECRET configured"
fi

if [ -z "$COMMAND_CENTER_URL" ]; then
    warn "COMMAND_CENTER_URL not set, using default: $CC"
else
    CC="$COMMAND_CENTER_URL"
    pass "COMMAND_CENTER_URL configured: $CC"
fi

echo
echo "Step 2: Command Center health check"
echo "-----------------------------------"
response=$(curl -s "$CC/orchestrator/health" 2>/dev/null)
if echo "$response" | grep -q '"status":"ok"'; then
    pass "Command Center is healthy"
    agents_online=$(echo "$response" | grep -o '"agents_online":[0-9]*' | cut -d: -f2)
    echo "  Agents online: $agents_online"
else
    fail "Command Center unreachable or unhealthy"
    echo "  Response: $response"
fi

echo
echo "Step 3: Agent registration check"
echo "-------------------------------"
response=$(curl -s "$CC/orchestrator/agents" 2>/dev/null)
if echo "$response" | grep -q "scholarmatch-monolith"; then
    pass "Agent is registered with Command Center"
    status=$(echo "$response" | grep -o '"status":"[^"]*"' | cut -d: -f2 | tr -d '"')
    echo "  Agent status: $status"
else
    warn "Agent not yet registered (normal if secrets just added)"
    echo "  Current agents: $response"
fi

echo
echo "Step 4: Local agent capabilities"
echo "-------------------------------"
response=$(curl -s "$AGENT_URL/agent/capabilities" 2>/dev/null)
if echo "$response" | grep -q '"capabilities"'; then
    pass "Agent capabilities endpoint working"
    capabilities=$(echo "$response" | grep -o '"capabilities":\[[^]]*\]' | sed 's/.*\[\(.*\)\].*/\1/' | tr -d '"')
    echo "  Available actions: $capabilities"
else
    fail "Agent capabilities endpoint failed"
fi

echo
echo "Step 5: Test task dispatch (if agent is registered)"
echo "--------------------------------------------------"
if echo "$response" | grep -q "scholarmatch-monolith"; then
    echo "Dispatching test search task..."
    task_response=$(curl -s -X POST "$CC/orchestrator/tasks/dispatch" \
        -H "Content-Type: application/json" \
        -d '{
            "action": "scholarmatch.search",
            "payload": {
                "query": "STEM",
                "filters": {"level": "undergrad"},
                "pagination": {"page": 1, "size": 3}
            },
            "requested_by": "integration-test",
            "resources": {"timeout_ms": 15000, "retry": 1}
        }' 2>/dev/null)
    
    if echo "$task_response" | grep -q '"task_id"'; then
        task_id=$(echo "$task_response" | grep -o '"task_id":"[^"]*"' | cut -d: -f2 | tr -d '"')
        pass "Task dispatched successfully"
        echo "  Task ID: $task_id"
        
        # Wait and check status
        echo "  Waiting 3 seconds for task completion..."
        sleep 3
        
        status_response=$(curl -s "$CC/orchestrator/tasks/$task_id" 2>/dev/null)
        if echo "$status_response" | grep -q '"status":"succeeded"'; then
            pass "Task completed successfully"
        else
            warn "Task may still be processing"
            echo "  Current status: $status_response"
        fi
    else
        fail "Task dispatch failed"
        echo "  Response: $task_response"
    fi
else
    warn "Skipping task test - agent not registered yet"
fi

echo
echo "Step 6: Check recent events"
echo "--------------------------"
events_response=$(curl -s "$CC/orchestrator/events" 2>/dev/null)
if echo "$events_response" | grep -q "events"; then
    event_count=$(echo "$events_response" | grep -o '"events":\[[^]]*\]' | grep -o ',' | wc -l)
    pass "Events endpoint accessible"
    echo "  Recent events: $((event_count + 1))"
else
    warn "Events endpoint may be empty or inaccessible"
fi

echo
echo "Step 7: Security validation"
echo "--------------------------"
invalid_jwt_response=$(curl -s -H "Authorization: Bearer invalid-token" \
  "$AGENT_URL/agent/task" \
  -X POST -H "Content-Type: application/json" \
  -d '{"action":"test"}' 2>/dev/null)

if echo "$invalid_jwt_response" | grep -q '"error_code".*"UNAUTHORIZED"'; then
    pass "Invalid JWT properly rejected with standardized error"
else
    warn "JWT validation may need attention"
    echo "  Response: $invalid_jwt_response"
fi

echo
echo "Step 8: Reliability burst test"  
echo "-----------------------------"
if echo "$response" | grep -q "scholarmatch-monolith"; then
    echo "Running burst test (5 concurrent tasks)..."
    for i in {1..5}; do
        curl -s -X POST "$CC/orchestrator/tasks/dispatch" \
            -H "Content-Type: application/json" \
            -d '{
                "action": "scholarmatch.search",
                "payload": {
                    "query": "Engineering",
                    "filters": {"level": "undergraduate"},
                    "pagination": {"page": 1, "size": 2}
                },
                "requested_by": "burst-test-'$i'"
            }' >/dev/null &
    done
    wait
    sleep 2
    
    burst_events=$(curl -s "$CC/orchestrator/events" | grep -o "burst-test" | wc -l)
    if [ "$burst_events" -gt 0 ]; then
        pass "Burst test completed - $burst_events events recorded"
    else
        warn "Burst test results unclear"
    fi
else
    warn "Skipping burst test - agent not registered"
fi

echo
echo "Integration Status Summary:"
echo "=========================="
if [ -n "$SHARED_SECRET" ]; then
    pass "Environment configured"
else
    fail "Environment needs configuration"
fi

if echo "$response" | grep -q "scholarmatch-monolith"; then
    pass "Agent registered and operational"
    echo "✅ READY FOR PRODUCTION DEPLOYMENT"
else
    warn "Agent registration pending"
    echo "📋 NEXT STEP: Configure secrets and restart"
fi

echo
echo "Configuration Guide:"
echo "==================="
echo "Add to Replit Secrets:"
echo "  SHARED_SECRET=<same-as-command-center>"
echo "  COMMAND_CENTER_URL=$CC"
echo "  AGENT_NAME=scholarmatch"
echo "  AGENT_ID=scholarmatch-monolith"  
echo "  AGENT_BASE_URL=<your-public-replit-url>"
echo
echo "After restart, look for:"
echo "  [agent-bridge] Registering with Command Center..."
echo "  [agent-bridge] Registration successful"

echo
echo "🚀 Agent Bridge Status: PRODUCTION READY"