/**
 * CEO DIRECTIVE (Nov 13): Gate 0 - Orchestrator Endpoints
 * 
 * Agent Bridge Command Center endpoints for service-to-service orchestration
 * Required endpoints: /orchestrator/register, /orchestrator/heartbeat, 
 *                     /orchestrator/task/callback, /orchestrator/events
 * 
 * Security: HS256 SHARED_SECRET authentication until scholar_auth M2M is live (Gate 1)
 * After Gate 1: Switch to S2S opaque tokens via OAuth2 introspection
 * 
 * AGENT3 REMEDIATION: Migrated nonce cache from in-memory to Upstash Redis
 */

import express from 'express';
import { createHmac } from 'crypto';
import { Redis } from '@upstash/redis';

const router = express.Router();

// AGENT3 REMEDIATION: Redis-backed nonce cache for cross-instance replay protection
let redisClient: Redis | null = null;
let redisAvailable = false;

// In-memory fallback for nonce cache (used when Redis unavailable)
const localNonceCache = new Map<string, number>();

// Initialize Redis client if configured
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

// P0 FIX: Validate Redis URL format before initialization
if (redisUrl && redisToken) {
  // Check if URL and token might be swapped
  if (!redisUrl.startsWith('https://') && redisToken.startsWith('https://')) {
    console.warn('[Orchestrator] Redis URL/Token appear swapped, attempting to correct...');
    try {
      redisClient = new Redis({
        url: redisToken, // Use token as URL
        token: redisUrl   // Use URL as token
      });
      redisAvailable = true;
      console.log('[Orchestrator] Upstash Redis initialized (corrected swap)');
    } catch (err) {
      console.error('[Orchestrator] Redis init failed after swap correction, using in-memory fallback:', err);
    }
  } else if (redisUrl.startsWith('https://')) {
    try {
      redisClient = new Redis({
        url: redisUrl,
        token: redisToken
      });
      redisAvailable = true;
      console.log('[Orchestrator] Upstash Redis initialized for nonce cache');
    } catch (err) {
      console.error('[Orchestrator] Failed to initialize Redis, using in-memory fallback:', err);
    }
  } else {
    console.warn('[Orchestrator] UPSTASH_REDIS_REST_URL does not start with https://, using in-memory fallback');
  }
} else {
  console.warn('[Orchestrator] Redis not configured (UPSTASH_REDIS_REST_URL/TOKEN missing), using in-memory nonce cache');
}

// In-memory agent registry (will migrate to database in Gate 1)
interface RegisteredAgent {
  agentId: string;
  agentName: string;
  baseUrl: string;
  registeredAt: string;
  lastHeartbeat: string;
  status: 'online' | 'offline' | 'degraded';
  version?: string;
  capabilities?: string[];
}

const agentRegistry = new Map<string, RegisteredAgent>();

/**
 * Middleware: Verify HS256 SHARED_SECRET authentication (CEO DIRECTIVE - Gate 0)
 * 
 * Required Header Format:
 *   Authorization: HMAC-SHA256 signature=<hex>, timestamp=<unix_ms>, nonce=<random>
 * 
 * Signature computed as:
 *   HMAC-SHA256(shared_secret, timestamp + nonce + JSON.stringify(body))
 * 
 * Replay Protection:
 *   - Timestamp must be within 5 minutes of server time
 *   - Nonce must be unique (tracked in Redis or in-memory for 10 minutes)
 */

const NONCE_TTL_SECONDS = 600; // 10 minutes
const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000; // 5 minutes

// Helper: Check if nonce exists (Redis with in-memory fallback)
async function hasNonce(nonce: string): Promise<boolean> {
  if (redisClient && redisAvailable) {
    try {
      const exists = await redisClient.exists(`nonce:${nonce}`);
      return exists === 1;
    } catch (err) {
      console.error('[Orchestrator] Redis nonce check failed, using fallback:', err);
      // FAIL-SECURE: If Redis fails, reject the request to prevent replay attacks
      return true; // Assume nonce exists to be safe
    }
  }
  return localNonceCache.has(nonce);
}

// Helper: Store nonce (Redis with in-memory fallback)
async function storeNonce(nonce: string): Promise<void> {
  if (redisClient && redisAvailable) {
    try {
      await redisClient.setex(`nonce:${nonce}`, NONCE_TTL_SECONDS, '1');
      return;
    } catch (err) {
      console.error('[Orchestrator] Redis nonce store failed, using fallback:', err);
    }
  }
  // In-memory fallback
  localNonceCache.set(nonce, Date.now() + (NONCE_TTL_SECONDS * 1000));
}

// Clean up expired nonces from in-memory fallback every minute
setInterval(() => {
  const now = Date.now();
  for (const [nonce, expiry] of localNonceCache.entries()) {
    if (expiry < now) {
      localNonceCache.delete(nonce);
    }
  }
}, 60 * 1000);

// AGENT3 REMEDIATION: Made async for Redis nonce operations
async function verifySharedSecret(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing Authorization header'
    });
  }

  const sharedSecret = process.env.AGENT_BRIDGE_SHARED_SECRET || process.env.SHARED_SECRET;
  
  if (!sharedSecret) {
    console.error('[Orchestrator] FATAL: SHARED_SECRET not configured');
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Orchestrator not configured (missing SHARED_SECRET)'
    });
  }

  // Parse HMAC-SHA256 header: "HMAC-SHA256 signature=<hex>, timestamp=<unix_ms>, nonce=<random>"
  if (!authHeader.startsWith('HMAC-SHA256 ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid authentication format. Expected: HMAC-SHA256 signature=<hex>, timestamp=<unix_ms>, nonce=<random>'
    });
  }

  const authParams = authHeader.substring(12);
  const params = new Map<string, string>();
  
  authParams.split(', ').forEach(param => {
    const [key, value] = param.split('=');
    if (key && value) {
      params.set(key.trim(), value.trim());
    }
  });

  const signature = params.get('signature');
  const timestamp = params.get('timestamp');
  const nonce = params.get('nonce');

  if (!signature || !timestamp || !nonce) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing required HMAC parameters: signature, timestamp, nonce'
    });
  }

  // Replay protection: Check timestamp skew
  const requestTime = parseInt(timestamp, 10);
  const serverTime = Date.now();
  const timeDiff = Math.abs(serverTime - requestTime);

  if (timeDiff > MAX_TIMESTAMP_SKEW_MS) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Request timestamp too old or too far in future (max skew: 5 minutes)'
    });
  }

  // AGENT3 REMEDIATION: Redis-backed nonce uniqueness check
  const nonceExists = await hasNonce(nonce);
  if (nonceExists) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Nonce already used (replay attack detected)'
    });
  }

  // Verify HMAC signature
  const body = JSON.stringify(req.body);
  const message = timestamp + nonce + body;
  const expectedSignature = createHmac('sha256', sharedSecret)
    .update(message)
    .digest('hex');

  if (signature !== expectedSignature) {
    console.warn(`[Orchestrator] HMAC verification failed for nonce ${nonce}`);
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid HMAC signature'
    });
  }

  // AGENT3 REMEDIATION: Store nonce in Redis to prevent replay
  await storeNonce(nonce);

  console.log(`[Orchestrator] HMAC verified for nonce ${nonce}, timestamp ${timestamp}`);
  next();
}

/**
 * POST /orchestrator/register
 * Register an agent with the command center
 * 
 * Body:
 * {
 *   "agent_id": "scholarship-api-prod",
 *   "agent_name": "scholarship_api",
 *   "base_url": "https://scholarship-api-jamarrlmayes.replit.app",
 *   "version": "v1.0",
 *   "capabilities": ["crud", "search", "recommendations"]
 * }
 */
router.post('/register', verifySharedSecret, (req, res) => {
  const { agent_id, agent_name, base_url, version, capabilities } = req.body;

  if (!agent_id || !agent_name || !base_url) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Missing required fields: agent_id, agent_name, base_url'
    });
  }

  const agent: RegisteredAgent = {
    agentId: agent_id,
    agentName: agent_name,
    baseUrl: base_url,
    registeredAt: new Date().toISOString(),
    lastHeartbeat: new Date().toISOString(),
    status: 'online',
    version,
    capabilities
  };

  agentRegistry.set(agent_id, agent);

  console.log(`[Orchestrator] Agent registered: ${agent_id} (${agent_name}) at ${base_url}`);

  res.status(201).json({
    message: 'Agent registered successfully',
    agent_id,
    registered_at: agent.registeredAt
  });
});

/**
 * POST /orchestrator/heartbeat
 * Send heartbeat to maintain agent registration
 * 
 * Body:
 * {
 *   "agent_id": "scholarship-api-prod",
 *   "status": "online",
 *   "metrics": {
 *     "p95_latency_ms": 45,
 *     "error_rate": 0.001,
 *     "requests_per_minute": 120
 *   }
 * }
 */
router.post('/heartbeat', verifySharedSecret, (req, res) => {
  const { agent_id, status, metrics } = req.body;

  if (!agent_id) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Missing required field: agent_id'
    });
  }

  const agent = agentRegistry.get(agent_id);

  if (!agent) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Agent ${agent_id} not registered. Please register first.`
    });
  }

  // Update heartbeat
  agent.lastHeartbeat = new Date().toISOString();
  if (status) {
    agent.status = status;
  }

  console.log(`[Orchestrator] Heartbeat received from ${agent_id}: ${status || 'online'}`);

  res.json({
    message: 'Heartbeat acknowledged',
    agent_id,
    status: agent.status,
    next_heartbeat_due_in_seconds: 30
  });
});

/**
 * POST /orchestrator/task/callback
 * Agent reports task completion status
 * 
 * Body:
 * {
 *   "agent_id": "scholarship-agent-prod",
 *   "task_id": "task-123",
 *   "status": "completed",
 *   "result": { ... },
 *   "error": null
 * }
 */
router.post('/task/callback', verifySharedSecret, (req, res) => {
  const { agent_id, task_id, status, result, error } = req.body;

  if (!agent_id || !task_id || !status) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Missing required fields: agent_id, task_id, status'
    });
  }

  console.log(`[Orchestrator] Task callback from ${agent_id}: task_id=${task_id}, status=${status}`);

  // TODO: Store task completion in database (Gate 1)
  // TODO: Trigger notifications via auto_com_center (Gate 2)

  res.json({
    message: 'Task callback acknowledged',
    task_id,
    status
  });
});

/**
 * POST /orchestrator/events
 * Agent sends business events for centralized logging
 * 
 * Body:
 * {
 *   "agent_id": "student-pilot-prod",
 *   "events": [
 *     {
 *       "event_name": "user_signup",
 *       "timestamp": "2025-11-13T19:00:00Z",
 *       "user_id": "user-123",
 *       "metadata": { "source": "google" }
 *     }
 *   ]
 * }
 */
router.post('/events', verifySharedSecret, (req, res) => {
  const { agent_id, events } = req.body;

  if (!agent_id || !Array.isArray(events)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Missing required fields: agent_id, events (array)'
    });
  }

  console.log(`[Orchestrator] Received ${events.length} events from ${agent_id}`);

  // TODO: Store events in business_events table (Gate 1)
  // For now, just log them

  res.json({
    message: 'Events received',
    count: events.length,
    agent_id
  });
});

/**
 * GET /orchestrator/agents
 * List all registered agents (admin endpoint)
 */
router.get('/agents', verifySharedSecret, (req, res) => {
  const agents = Array.from(agentRegistry.values()).map(agent => ({
    agent_id: agent.agentId,
    agent_name: agent.agentName,
    base_url: agent.baseUrl,
    status: agent.status,
    registered_at: agent.registeredAt,
    last_heartbeat: agent.lastHeartbeat,
    version: agent.version,
    capabilities: agent.capabilities
  }));

  res.json({
    total: agents.length,
    agents
  });
});

/**
 * GET /orchestrator/status
 * Command center health status (no auth required for monitoring)
 */
router.get('/status', (req, res) => {
  const totalAgents = agentRegistry.size;
  const onlineAgents = Array.from(agentRegistry.values()).filter(a => a.status === 'online').length;
  const degradedAgents = Array.from(agentRegistry.values()).filter(a => a.status === 'degraded').length;
  const offlineAgents = Array.from(agentRegistry.values()).filter(a => a.status === 'offline').length;

  res.json({
    status: 'operational',
    timestamp: new Date().toISOString(),
    agents: {
      total: totalAgents,
      online: onlineAgents,
      degraded: degradedAgents,
      offline: offlineAgents
    },
    version: 'v2.7',
    command_center: 'auto_com_center'
  });
});

export { router as orchestratorRouter };
