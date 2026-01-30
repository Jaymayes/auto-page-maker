# Command Center Integration Checklist

## Pre-Integration Setup ✅ COMPLETE

- [x] Agent Bridge implementation with 6 core capabilities
- [x] JWT authentication and security middleware  
- [x] Rate limiting and input validation
- [x] Async task processing with callbacks
- [x] Error handling and trace correlation
- [x] Health and capabilities endpoints

## Environment Configuration

Add these secrets to your Replit project:

### Required Secrets
```
SHARED_SECRET=<same-long-random-string-as-command-center>
COMMAND_CENTER_URL=https://auto-com-center-jamarrlmayes.replit.app  
AGENT_NAME=scholarmatch
AGENT_ID=scholarmatch-monolith
AGENT_BASE_URL=<your-replit-app-url>
```

### Optional Secrets  
```
HEARTBEAT_INTERVAL_MS=60000
JWT_SECRET=<random-string-for-local-auth>
OPENAI_API_KEY=<your-openai-key>
```

## Command Center Configuration

Ensure Command Center has:
```
SHARED_SECRET=<same-as-agent>
AGENTS_ALLOWLIST=<your-replit-app-url>,<other-agent-urls>
JWT_ISSUER=auto-com-center
JWT_AUDIENCE=scholar-sync-agents
```

## Integration Test Checklist

### Phase 1: Basic Connectivity
- [ ] Command Center health check returns `{"status":"ok"}`
- [ ] Agent appears in `/orchestrator/agents` with status=online
- [ ] Agent capabilities endpoint returns 6 scholarmatch actions
- [ ] Logs show "Agent registered" and "Heartbeat ok"

### Phase 2: Task Processing  
- [ ] Dispatch `scholarmatch.search` task succeeds
- [ ] Task status progresses: queued → dispatched → succeeded
- [ ] Task result contains `items[]`, `total`, `took_ms`
- [ ] Events logged with matching trace_id

### Phase 3: Security & Resilience
- [ ] Invalid JWT tokens rejected with 401
- [ ] Rate limiting triggers at 6 requests/minute
- [ ] Task validation rejects malformed payloads
- [ ] Agent auto-reconnects after restart

## Available Actions

### Core Search & Discovery
- **scholarmatch.search** - Advanced scholarship search with filters
- **scholarmatch.match** - AI-powered student matching algorithm

### Content Generation
- **scholarmatch.generate_page** - Landing page creation with AI
- **scholarmatch.analyze_essay** - Essay feedback and scoring  

### Analytics & Operations
- **scholarmatch.generate_sitemap** - Dynamic SEO sitemap
- **scholarmatch.track_interaction** - User behavior tracking

## Test Commands

```bash
# Check Command Center health
curl https://auto-com-center-jamarrlmayes.replit.app/orchestrator/health

# List registered agents  
curl https://auto-com-center-jamarrlmayes.replit.app/orchestrator/agents

# Test agent capabilities
curl https://your-app.replit.app/agent/capabilities

# Dispatch test task
curl -X POST https://auto-com-center-jamarrlmayes.replit.app/orchestrator/tasks/dispatch \
  -H "Content-Type: application/json" \
  -d '{
    "action": "scholarmatch.search",
    "payload": {"query": "STEM", "filters": {"level": "undergrad"}},
    "requested_by": "test"
  }'

# Run comprehensive test
./test-command-center.sh
```

## Success Indicators

✅ **Agent Registration**: Shows in Command Center agent list  
✅ **Heartbeat Active**: `last_seen` timestamp updates every 60s
✅ **Task Processing**: End-to-end task execution with results
✅ **Event Logging**: Trace correlation across systems
✅ **Security**: Proper JWT validation and rate limiting

## Next Steps After Integration

1. **Multi-Agent Workflows**: Connect other agents for orchestration
2. **Cross-Agent Tasks**: Implement search → match → generate workflows  
3. **Monitoring**: Set up alerts for failures and performance metrics
4. **Documentation**: Create runbooks for common operations

The ScholarMatch Agent Bridge is production-ready and will seamlessly integrate with the Command Center once environment variables are configured.