import type { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";

function loadSev1Controls(): { telemetryBypass: boolean } {
  try {
    const configPath = path.join(process.cwd(), "server/config/pilot/sev1_controls.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      return {
        telemetryBypass: config.telemetry_gate?.TELEMETRY_REQUIRE_IDEMPOTENCY === false
      };
    }
  } catch (e) {
    console.warn("[IDEMPOTENCY] Failed to load SEV-1 controls:", e);
  }
  return { telemetryBypass: false };
}

interface IdempotencyRecord {
  response: {
    status: number;
    body: any;
    contentType: string;
  };
  expiresAt: number;
  isReplaying?: boolean;
}

const idempotencyCache = new Map<string, IdempotencyRecord>();

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of idempotencyCache.entries()) {
    if (now > record.expiresAt) {
      idempotencyCache.delete(key);
    }
  }
}, 60000);

const DEDUPLICATION_WINDOW_MS = 15 * 60 * 1000;

function getClientIdentifier(req: Request): string {
  const user = (req as any).user?.claims?.sub;
  if (user) return `user:${user}`;
  
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const clientIp = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
    return `ip:${clientIp}`;
  }
  
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return `ip:${Array.isArray(realIp) ? realIp[0] : realIp}`;
  }
  
  const remoteAddr = req.socket?.remoteAddress || req.ip || 'unknown';
  return `ip:${remoteAddr.replace('::ffff:', '')}`;
}

export const idempotencyMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const mutableMethods = ["POST", "PUT", "PATCH", "DELETE"];
  if (!mutableMethods.includes(req.method)) {
    return next();
  }

  const sev1Controls = loadSev1Controls();
  const idempotencyKey = req.headers["x-idempotency-key"] as string;
  const clientProvidedTraceId = (req as any)._clientProvidedTraceId === true;

  const missingHeaders: string[] = [];
  if (!idempotencyKey) missingHeaders.push("X-Idempotency-Key");
  if (!clientProvidedTraceId) missingHeaders.push("X-Trace-Id");

  if (missingHeaders.length > 0) {
    if (sev1Controls.telemetryBypass) {
      const bodyString = JSON.stringify(req.body || {});
      const serverFingerprint = crypto.createHash("sha256").update(bodyString).digest("hex");
      console.log(`[IDEMPOTENCY] SEV-1 bypass active - accepting request with server fingerprint: ${serverFingerprint.substring(0, 16)}...`);
      (req as any)._serverFingerprint = serverFingerprint;
      (req as any)._missingHeaders = missingHeaders;
      return next();
    }
    
    console.warn(`[IDEMPOTENCY] Missing headers for ${req.path}: ${missingHeaders.join(", ")}`);
    return res.status(428).json({
      error: "Precondition Required",
      message: `Missing required header${missingHeaders.length > 1 ? 's' : ''}: ${missingHeaders.join(" and ")} ${missingHeaders.length > 1 ? 'are' : 'is'} required for mutable operations.`,
      missing_headers: missingHeaders
    });
  }

  const clientId = getClientIdentifier(req);
  const compositeKey = `${clientId}:${idempotencyKey}`;

  const cachedRecord = idempotencyCache.get(compositeKey);
  if (cachedRecord && Date.now() <= cachedRecord.expiresAt) {
    console.log(`[IDEMPOTENCY] Duplicate request detected for key: ${compositeKey}. Returning cached response.`);
    
    res.setHeader('X-Idempotency-Replay', 'true');
    res.setHeader('Content-Type', cachedRecord.response.contentType || 'application/json');
    
    return res.status(cachedRecord.response.status).send(cachedRecord.response.body);
  }

  const originalSend = res.send;
  const originalJson = res.json;
  let responseCached = false;

  const cacheResponse = (body: any, contentType: string) => {
    if (responseCached) return;
    if (res.statusCode < 500) {
      responseCached = true;
      console.log(`[IDEMPOTENCY] Caching response for key: ${compositeKey} (status: ${res.statusCode})`);
      idempotencyCache.set(compositeKey, {
        response: {
          status: res.statusCode,
          body,
          contentType
        },
        expiresAt: Date.now() + DEDUPLICATION_WINDOW_MS
      });
    }
  };

  res.json = function(body: any) {
    cacheResponse(body, 'application/json');
    return originalJson.call(this, body);
  };

  res.send = function(body: any) {
    const contentType = res.getHeader('Content-Type') as string || 'text/html';
    cacheResponse(body, contentType);
    return originalSend.call(this, body);
  };

  next();
};
