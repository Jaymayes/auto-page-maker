import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { nanoid } from 'nanoid';

// Standard error response interface
export interface ErrorResponse {
  error_code: string;
  message: string;
  details?: any;
  correlation_id: string;
  status: number;
  timestamp: string;
}

// Custom error class with structured information
export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: any;

  constructor(message: string, status: number = 500, code?: string, details?: any) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code || this.getDefaultCode(status);
    this.details = details;
  }

  private getDefaultCode(status: number): string {
    switch (status) {
      case 400: return 'BAD_REQUEST';
      case 401: return 'UNAUTHORIZED';
      case 403: return 'FORBIDDEN';
      case 404: return 'NOT_FOUND';
      case 409: return 'CONFLICT';
      case 413: return 'PAYLOAD_TOO_LARGE';
      case 422: return 'VALIDATION_ERROR';
      case 429: return 'RATE_LIMIT_EXCEEDED';
      case 500: return 'INTERNAL_ERROR';
      case 503: return 'SERVICE_UNAVAILABLE';
      default: return 'UNKNOWN_ERROR';
    }
  }
}

// Service unavailable errors for missing configuration
export class ServiceUnavailableError extends AppError {
  constructor(service: string, reason: string) {
    super(
      `${service} service unavailable: ${reason}`,
      503,
      `${service.toUpperCase()}_UNAVAILABLE`
    );
  }
}

// Security configuration errors
export class SecurityConfigurationError extends AppError {
  constructor(message: string) {
    super(message, 503, 'SECURITY_NOT_CONFIGURED');
  }
}

// Global error handler middleware
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Skip if response already sent
  if (res.headersSent) {
    return next(error);
  }

  // Generate correlation ID
  const correlationId = req.headers['x-trace-id'] as string || nanoid();

  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Internal server error';
  let details: any = undefined;

  // Handle different error types
  if (error instanceof AppError) {
    status = error.status;
    code = error.code;
    message = error.message;
    details = error.details;
  } else if (error instanceof ZodError) {
    status = 422;
    code = 'VALIDATION_ERROR';
    message = 'Invalid request data';
    details = { errors: error.errors };
  } else {
    // Log unexpected errors
    console.error(`[ERROR] ${correlationId}:`, {
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      headers: req.headers,
      body: req.body,
    });
  }

  // Always return JSON for API routes, HTML for UI routes
  const isApiRoute = req.path.startsWith('/api') || req.path.startsWith('/agent');
  
  if (isApiRoute) {
    const errorResponse: ErrorResponse = {
      error_code: code,
      message,
      details,
      correlation_id: correlationId,
      status,
      timestamp: new Date().toISOString(),
    };

    res.status(status).json(errorResponse);
  } else {
    // For UI routes, return HTML error page or redirect
    res.status(status).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Error ${status}</title></head>
        <body>
          <h1>Error ${status}</h1>
          <p>${message}</p>
          <p>Correlation ID: ${correlationId}</p>
        </body>
      </html>
    `);
  }

  // Log the error response
  console.log(`[${req.method}] ${req.path} ${status} :: ${JSON.stringify({ code, message, correlationId })}`);
}

// 404 handler for unmatched routes
export function notFoundHandler(req: Request, res: Response): void {
  const isApiRoute = req.path.startsWith('/api') || req.path.startsWith('/agent');
  
  if (isApiRoute) {
    const correlationId = req.headers['x-trace-id'] as string || nanoid();
    const errorResponse: ErrorResponse = {
      error_code: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.path}`,
      correlation_id: correlationId,
      status: 404,
      timestamp: new Date().toISOString(),
    };
    res.status(404).json(errorResponse);
  } else {
    // Serve the React app for client-side routing
    res.sendFile('index.html', { root: 'dist/public' });
  }
}

// Correlation ID middleware
export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlationId = req.headers['x-trace-id'] as string || nanoid();
  req.headers['x-trace-id'] = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
}

// Security not configured handler
export function securityNotConfiguredHandler(req: Request, res: Response): void {
  const correlationId = req.headers['x-trace-id'] as string || nanoid();
  
  const errorResponse: ErrorResponse = {
    error_code: 'SECURITY_NOT_CONFIGURED',
    message: 'Security features not configured for this environment',
    details: {
      environment: process.env.NODE_ENV || 'development',
      hint: 'Configure SHARED_SECRET and JWT_SECRET environment variables'
    },
    correlation_id: correlationId,
    status: 503,
    timestamp: new Date().toISOString(),
  };

  res.status(503).json(errorResponse);
}