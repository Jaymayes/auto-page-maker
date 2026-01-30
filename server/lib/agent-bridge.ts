import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config, features, buildAgentUrl } from '../config/environment';

// Environment configuration using centralized config
// AGENT3 v2.5: Compatibility shim for SHARED_SECRET naming
// Standard: SHARED_SECRET (org-wide convention)
// Fallback: AGENT_BRIDGE_SHARED_SECRET (legacy, remove after migration)
const getSharedSecret = () => {
  const sharedSecret = config.SHARED_SECRET;
  const legacySecret = config.AGENT_BRIDGE_SHARED_SECRET;
  
  if (sharedSecret) {
    return sharedSecret;
  }
  
  if (legacySecret) {
    console.warn('[Agent Bridge] Using AGENT_BRIDGE_SHARED_SECRET (legacy). Please migrate to SHARED_SECRET.');
    return legacySecret;
  }
  
  return '';
};

// CEO DIRECTIVE (Nov 13): Zero hardcoded URLs - COMMAND_CENTER_URL required
if (!config.COMMAND_CENTER_URL && process.env.NODE_ENV === 'production') {
  console.error('[Agent Bridge] FATAL: COMMAND_CENTER_URL not set in production');
}

export const agentConfig = {
  commandCenterUrl: config.COMMAND_CENTER_URL || process.env.AUTO_COM_CENTER_BASE_URL || '',
  sharedSecret: getSharedSecret(),
  agentName: config.AGENT_NAME || 'scholarmatch',
  agentId: config.AGENT_ID || 'scholarmatch-monolith',
  agentBaseUrl: config.AGENT_BASE_URL || buildAgentUrl('/'),
  jwtIssuer: 'auto-com-center',
  jwtAudience: 'scholar-sync-agents'
};

// Message schemas
export const TaskSchema = z.object({
  task_id: z.string(),
  action: z.string(),
  payload: z.record(z.any()),
  reply_to: z.string(),
  trace_id: z.string(),
  requested_by: z.string(),
  resources: z.object({
    priority: z.number().optional(),
    timeout_ms: z.number().optional(),
    retry: z.number().optional()
  }).optional()
});

export const ResultSchema = z.object({
  task_id: z.string(),
  status: z.enum(['accepted', 'in_progress', 'succeeded', 'failed']),
  result: z.record(z.any()).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.any()).optional()
  }).optional(),
  trace_id: z.string()
});

export const EventSchema = z.object({
  event_id: z.string(),
  type: z.string(),
  source: z.string(),
  data: z.record(z.any()),
  time: z.string(),
  trace_id: z.string()
});

export type Task = z.infer<typeof TaskSchema>;
export type Result = z.infer<typeof ResultSchema>;
export type Event = z.infer<typeof EventSchema>;

// Agent capabilities
export const AGENT_CAPABILITIES = [
  'scholarmatch.search',
  'scholarmatch.match',
  'scholarmatch.generate_page',
  'scholarmatch.analyze_essay',
  'scholarmatch.generate_sitemap',
  'scholarmatch.track_interaction'
];

// JWT verification middleware with proper error handling
export function verifyAgentJWT(token: string): { valid: boolean; payload?: any; error?: string } {
  if (!agentConfig.sharedSecret) {
    if (config.NODE_ENV === 'production') {
      console.error('[SECURITY] FATAL: JWT verification attempted without SHARED_SECRET in production');
      throw new Error('Security misconfiguration: SHARED_SECRET required in production');
    }
    console.warn('[SECURITY] JWT verification failed - SHARED_SECRET not configured');
    return { valid: false, error: 'SHARED_SECRET not configured' };
  }

  try {
    const payload = jwt.verify(token, agentConfig.sharedSecret, {
      issuer: agentConfig.jwtIssuer,
      audience: agentConfig.jwtAudience,
      algorithms: ['HS256']
    });
    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Invalid token' };
  }
}

// Sign JWT for outbound requests
export function signAgentJWT(payload: object): string {
  if (!agentConfig.sharedSecret) {
    throw new Error('SHARED_SECRET not configured for JWT signing');
  }

  return jwt.sign(payload, agentConfig.sharedSecret, {
    issuer: agentConfig.jwtIssuer,
    audience: agentConfig.jwtAudience,
    algorithm: 'HS256',
    expiresIn: '1h'
  });
}

// HTTP client for Command Center communication
export async function callCommandCenter(
  endpoint: string,
  method: 'GET' | 'POST' = 'POST',
  body?: any,
  headers: Record<string, string> = {}
): Promise<Response> {
  const token = signAgentJWT({
    agent_id: agentConfig.agentId,
    agent_name: agentConfig.agentName
  });

  const response = await fetch(`${agentConfig.commandCenterUrl}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Agent-Id': agentConfig.agentId,
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });

  return response;
}

// Agent registration and heartbeat
export async function registerAgent(): Promise<boolean> {
  try {
    const response = await callCommandCenter('/orchestrator/register', 'POST', {
      agent_id: agentConfig.agentId,
      name: agentConfig.agentName,
      base_url: agentConfig.agentBaseUrl,
      capabilities: AGENT_CAPABILITIES
    });

    if (response.ok) {
      console.log(`[agent-bridge] Registered successfully with Command Center`);
      return true;
    } else {
      console.error(`[agent-bridge] Registration failed: ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.error(`[agent-bridge] Registration error:`, error);
    return false;
  }
}

export async function sendHeartbeat(): Promise<boolean> {
  try {
    const response = await callCommandCenter('/orchestrator/heartbeat', 'POST', {
      agent_id: agentConfig.agentId
    });

    if (response.ok) {
      console.log(`[agent-bridge] Heartbeat sent successfully`);
      return true;
    } else {
      console.error(`[agent-bridge] Heartbeat failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`[agent-bridge] Heartbeat error:`, error);
    return false;
  }
}

// Send result callback to Command Center
export async function sendResult(result: Result): Promise<void> {
  try {
    const response = await callCommandCenter(
      `/orchestrator/tasks/${result.task_id}/callback`,
      'POST',
      result,
      { 'X-Trace-Id': result.trace_id }
    );

    if (!response.ok) {
      console.error(`[agent-bridge] Failed to send result for task ${result.task_id}: ${response.status}`);
    }
  } catch (error) {
    console.error(`[agent-bridge] Error sending result:`, error);
  }
}

// Send event to Command Center
export async function sendEvent(event: Event): Promise<void> {
  try {
    const response = await callCommandCenter('/orchestrator/events', 'POST', event, {
      'X-Trace-Id': event.trace_id
    });

    if (!response.ok) {
      console.error(`[agent-bridge] Failed to send event: ${response.status}`);
    }
  } catch (error) {
    console.error(`[agent-bridge] Error sending event:`, error);
  }
}

// Start agent bridge (registration and heartbeat)
export function startAgentBridge(): void {
  if (!agentConfig.sharedSecret) {
    console.warn('[agent-bridge] SHARED_SECRET not set - agent bridge disabled');
    return;
  }

  // Initial registration
  registerAgent();

  // Heartbeat every 60 seconds
  setInterval(async () => {
    await sendHeartbeat();
  }, 60000);

  console.log(`[agent-bridge] Started for agent ${agentConfig.agentId} -> ${agentConfig.commandCenterUrl}`);
}