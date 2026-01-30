import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { buildError, sanitizeLogs } from '../lib/errors.js';
import pino from 'pino';

const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'env.JWT_SECRET',
      'env.OPENAI_API_KEY',
      'env.DATABASE_URL',
      'env.SESSION_SECRET'
    ]
  }
});

export function notFoundHandler(req: Request, res: Response) {
  const requestId = (req as any).requestId || '';
  const error = buildError(
    'NOT_FOUND',
    `Route ${req.method} ${req.path} not found`,
    404,
    undefined,
    requestId
  );
  // AGENT3 v2.6 U4: Return only the error object
  res.status(404).json({ error: error.error });
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const traceId = req.headers['x-trace-id'] as string || err.traceId;
  
  // Log error with sanitization
  logger.error(sanitizeLogs({
    error: {
      message: err.message,
      stack: err.stack,
      code: err.code
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body
    },
    traceId
  }), 'Request error');

  let error: any;
  const requestId = (req as any).requestId || traceId || '';

  if (err instanceof ZodError) {
    // AGENT3 v2.6 U4: Flatten validation errors into message
    const validationSummary = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    error = buildError(
      'VALIDATION_ERROR',
      `Invalid request data: ${validationSummary}`,
      422,
      undefined,
      requestId
    );
  } else if (err.name === 'AuthenticationError') {
    error = buildError(
      'AUTHENTICATION_ERROR',
      'Authentication required',
      401,
      undefined,
      requestId
    );
  } else if (err.name === 'AuthorizationError') {
    error = buildError(
      'AUTHORIZATION_ERROR',
      'Insufficient permissions',
      403,
      undefined,
      requestId
    );
  } else if (err.code === 'RATE_LIMIT_EXCEEDED') {
    error = buildError(
      'RATE_LIMIT_EXCEEDED',
      'Too many requests. Please try again later.',
      429,
      undefined,
      requestId
    );
  } else if (err.status && err.status < 500) {
    error = buildError(
      err.code || 'CLIENT_ERROR',
      err.message || 'Bad request',
      err.status,
      undefined,
      requestId
    );
  } else {
    // Server errors - don't expose internal details
    error = buildError(
      'INTERNAL_SERVER_ERROR',
      'An internal error occurred',
      500,
      undefined,
      requestId
    );
  }

  // AGENT3 v2.6 U4: Return only the error object (status used for HTTP status code)
  res.status(error.status).json({ error: error.error });
}