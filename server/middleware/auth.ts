import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { buildError } from '../lib/errors.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: string;
  };
}

// MISS-002: JWT Authentication middleware
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    const error = buildError(
      'AUTHENTICATION_REQUIRED',
      'Access token required',
      401
    );
    return res.status(401).json(error);
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('JWT_SECRET environment variable not set');
    const error = buildError(
      'INTERNAL_SERVER_ERROR',
      'Authentication service unavailable',
      500
    );
    return res.status(500).json(error);
  }

  try {
    // MED-003: Proper JWT payload typing
    interface JwtPayload { 
      sub: string; 
      email?: string; 
      exp: number; 
      iat: number; 
    }
    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: 'user'
    };
    next();
  } catch (err) {
    const error = buildError(
      'INVALID_TOKEN',
      'Invalid or expired token',
      401
    );
    return res.status(401).json(error);
  }
}

// Optional authentication - doesn't fail if no token
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    return next();
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return next();
  }

  try {
    // MED-003: Proper JWT payload typing
    interface JwtPayload { 
      sub: string; 
      email?: string; 
      exp: number; 
      iat: number; 
    }
    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: 'user'
    };
  } catch (err) {
    // Invalid token, but continue without user
  }
  
  next();
}

// Role-based authorization
export function requireRole(role: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      const error = buildError(
        'AUTHENTICATION_REQUIRED',
        'Authentication required',
        401
      );
      return res.status(401).json(error);
    }

    if (req.user.role !== role && req.user.role !== 'admin') {
      const error = buildError(
        'INSUFFICIENT_PERMISSIONS',
        'Insufficient permissions for this operation',
        403
      );
      return res.status(403).json(error);
    }

    next();
  };
}