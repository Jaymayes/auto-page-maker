import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import type { Request, Response, NextFunction } from 'express';
import { buildError } from '../lib/errors.js';

export interface S2SAuthenticatedRequest extends Request {
  serviceClient?: {
    clientId: string;
    scopes: string[];
    sub: string;
  };
}

interface JwtPayload {
  sub: string;
  iss: string;
  aud: string;
  exp: number;
  nbf?: number;
  iat: number;
  scope?: string;
  permissions?: string[];
  client_id?: string;
}

const AUTH_ISSUER = process.env.AUTH_ISSUER || 'https://scholar-auth-jamarrlmayes.replit.app';
const AUTH_AUDIENCE = process.env.AUTH_AUDIENCE || 'scholar-platform';
const AUTH_JWKS_URL = process.env.AUTH_JWKS_URL || `${AUTH_ISSUER}/.well-known/jwks.json`;

const client = jwksClient({
  jwksUri: AUTH_JWKS_URL,
  cache: true,
  cacheMaxAge: 3600000,
  rateLimit: true,
  jwksRequestsPerMinute: 10
});

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  client.getSigningKey(header.kid, (err: Error | null, key: any) => {
    if (err) {
      return callback(err);
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export function validateS2SToken(req: S2SAuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    const error = buildError(
      'S2S_AUTHENTICATION_REQUIRED',
      'Service-to-service access token required',
      401
    );
    return res.status(401).json(error);
  }

  jwt.verify(
    token,
    getKey,
    {
      issuer: AUTH_ISSUER,
      audience: AUTH_AUDIENCE,
      algorithms: ['RS256']
    },
    (err, decoded) => {
      if (err) {
        console.error('[S2S_AUTH] Token verification failed:', err.message);
        const error = buildError(
          'INVALID_S2S_TOKEN',
          'Invalid or expired service token',
          401
        );
        return res.status(401).json(error);
      }

      const payload = decoded as JwtPayload;

      const now = Math.floor(Date.now() / 1000);
      if (payload.nbf && payload.nbf > now) {
        const error = buildError(
          'TOKEN_NOT_YET_VALID',
          'Token not yet valid',
          401
        );
        return res.status(401).json(error);
      }

      // Support both 'scope' (space-delimited string) and 'permissions' (array) claims
      // Per platform standard: if scope claim is missing, enforce permissions[] as first-class authorization source
      let scopes: string[] = [];
      if (payload.scope) {
        scopes = payload.scope.split(' ');
      } else if (payload.permissions && Array.isArray(payload.permissions)) {
        scopes = payload.permissions;
      }
      
      req.serviceClient = {
        clientId: payload.client_id || payload.sub,
        scopes,
        sub: payload.sub
      };

      console.log(`[S2S_AUTH] Service authenticated: ${req.serviceClient.clientId}, scopes: ${scopes.join(', ')} (from ${payload.scope ? 'scope' : 'permissions'})`);
      next();
    }
  );
}

export function requireS2SScope(...requiredScopes: string[]) {
  return (req: S2SAuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.serviceClient) {
      const error = buildError(
        'S2S_AUTHENTICATION_REQUIRED',
        'Service authentication required',
        401
      );
      return res.status(401).json(error);
    }

    const hasAllScopes = requiredScopes.every(scope => 
      req.serviceClient!.scopes.includes(scope)
    );

    if (!hasAllScopes) {
      console.warn(
        `[S2S_AUTH] Insufficient scopes for ${req.serviceClient.clientId}. ` +
        `Required: [${requiredScopes.join(', ')}], ` +
        `Has: [${req.serviceClient.scopes.join(', ')}]`
      );
      const error = buildError(
        'INSUFFICIENT_S2S_PERMISSIONS',
        `Missing required scopes: ${requiredScopes.join(', ')}`,
        403
      );
      return res.status(403).json(error);
    }

    next();
  };
}
