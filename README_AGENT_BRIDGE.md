# ScholarMatch Agent Bridge

The ScholarMatch platform can now operate as an intelligent agent within a distributed orchestration system. The Agent Bridge allows the platform to register with a Command Center and handle cross-application tasks while maintaining its standalone functionality.

## Environment Configuration

To enable the Agent Bridge, set these environment variables:

### Required for Agent Bridge
```bash
# Command Center connection
COMMAND_CENTER_URL=https://auto-com-center-jamarrlmayes.replit.app

# Shared secret for JWT authentication (same across all agents)
SHARED_SECRET=your-long-random-secret-string

# Agent identification
AGENT_NAME=scholarmatch
AGENT_ID=scholarmatch-monolith
AGENT_BASE_URL=https://your-app-name-yourname.replit.app

# JWT configuration (automatically set)
JWT_ISSUER=auto-com-center
JWT_AUDIENCE=scholar-sync-agents
```

### Optional for Enhanced Authentication
```bash
# For JWT-protected endpoints within ScholarMatch
JWT_SECRET=your-jwt-secret-for-local-auth

# For AI-powered features
OPENAI_API_KEY=your-openai-api-key
```

## Agent Capabilities

The ScholarMatch agent exposes these actions to the Command Center:

### Core Search & Discovery
- **`scholarmatch.search`** - Advanced scholarship search with filtering
  ```json
  {
    "action": "scholarmatch.search",
    "payload": {
      "query": "STEM scholarships",
      "filters": {
        "major": "computer science",
        "state": "california", 
        "level": "undergraduate",
        "isActive": true
      },
      "pagination": { "page": 1, "size": 10 }
    }
  }
  ```

### Intelligent Matching
- **`scholarmatch.match`** - AI-powered student-scholarship matching
  ```json
  {
    "action": "scholarmatch.match", 
    "payload": {
      "student_profile": {
        "major": "computer science",
        "gpa": 3.7,
        "state": "california",
        "level": "undergraduate"
      },
      "scholarship_list": [] // optional, uses all active if empty
    }
  }
  ```

### Content Generation  
- **`scholarmatch.generate_page`** - AI-powered landing page creation
  ```json
  {
    "action": "scholarmatch.generate_page",
    "payload": {
      "template": "major-state",
      "templateData": {
        "major": "Engineering", 
        "state": "California"
      },
      "title": "Engineering Scholarships in California",
      "slug": "engineering-california",
      "seo": { "description": "Find engineering scholarships..." }
    }
  }
  ```

### Analytics & SEO
- **`scholarmatch.generate_sitemap`** - Dynamic sitemap generation
- **`scholarmatch.track_interaction`** - User behavior tracking
- **`scholarmatch.analyze_essay`** - Essay analysis and feedback

## API Endpoints

### Agent Management
- `GET /agent/capabilities` - Returns agent info and capabilities
- `POST /agent/register` - Local registration endpoint for diagnostics  
- `POST /agent/task` - Accepts tasks from Command Center (JWT protected)

### Enhanced Health Check
- `GET /healthz` - Health status with agent identification

## Security Features

### JWT Authentication
- All inter-agent communication uses HS256 JWT tokens
- Tokens include agent identification and are verified against SHARED_SECRET
- Rate limiting: 5 tasks per minute to prevent abuse

### Input Validation
- All task payloads validated with Zod schemas
- Trace ID verification for request correlation
- Input sanitization for security

### Error Handling
- Structured error responses with trace IDs
- Graceful fallbacks when services unavailable
- Comprehensive logging for debugging

## Operational Behavior

### Automatic Registration
When SHARED_SECRET is configured, the agent:
1. Registers with Command Center on startup
2. Sends heartbeat every 60 seconds  
3. Appears in Command Center's `/orchestrator/ui`

### Task Processing
1. **Immediate Response**: Returns 202 Accepted with task_id
2. **Status Updates**: Sends accepted → in_progress → succeeded/failed
3. **Result Callback**: Posts final results to Command Center
4. **Event Logging**: Sends completion events for audit trails

### Async Processing
- Tasks processed asynchronously to prevent blocking
- Real-time status updates via callbacks
- Comprehensive error reporting

## Testing the Agent Bridge

### 1. Check Agent Status
```bash
curl http://localhost:5000/agent/capabilities
# Returns: {"agent_id":"scholarmatch-monolith","name":"scholarmatch","capabilities":[...],"version":"1.0.0","health":"ok"}

curl http://localhost:5000/healthz  
# Returns: {"status":"ok","timestamp":"...","agent_id":"scholarmatch-monolith","last_seen":"..."}
```

### 2. Test Task Endpoint (requires JWT)
```bash
# This requires a valid JWT from Command Center
curl -X POST http://localhost:5000/agent/task \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -H "X-Trace-Id: test-trace-123" \
  -d '{
    "task_id": "test-task-123",
    "action": "scholarmatch.search", 
    "payload": {"query": "computer science", "filters": {"state": "california"}},
    "reply_to": "http://command-center/callback",
    "trace_id": "test-trace-123",
    "requested_by": "test-user"
  }'
```

## Integration with Command Center

Once both ScholarMatch and the Command Center are configured:

1. **Automatic Discovery**: ScholarMatch appears in `/orchestrator/agents`
2. **Task Dispatch**: Command Center can route actions to ScholarMatch
3. **Result Tracking**: View task status at `/orchestrator/tasks/{task_id}`
4. **Event Monitoring**: Monitor events at `/orchestrator/events`

## Standalone Operation

The Agent Bridge is completely optional:
- **Without SHARED_SECRET**: Operates as normal ScholarMatch platform
- **With SHARED_SECRET**: Adds orchestration capabilities
- **Zero Breaking Changes**: All existing APIs continue to work

## Error States & Fallbacks

### Configuration Issues
- Missing SHARED_SECRET: Bridge disabled, warning logged
- Invalid Command Center URL: Registration fails gracefully
- Network issues: Retries with exponential backoff

### Task Processing Errors  
- Invalid actions: Returns structured error with available actions
- Processing failures: Detailed error reporting with trace correlation
- Timeout handling: Configurable timeouts with proper cleanup

## Performance Considerations

### Rate Limiting
- Task endpoint: 5 requests/minute (aligned with AI operations)
- Registration/heartbeat: No limits (essential operations)
- Existing API limits unchanged

### Resource Usage
- Async task processing prevents blocking
- Minimal memory overhead for task queuing
- Heartbeat interval: 60 seconds (configurable)

The Agent Bridge transforms ScholarMatch into a composable service that can participate in complex, multi-agent workflows while maintaining its full standalone capabilities.