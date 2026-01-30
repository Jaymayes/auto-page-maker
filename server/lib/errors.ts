import { v4 as uuidv4 } from 'uuid';

// AGENT3 v2.6 U4: Standard error format (exact spec)
export interface AGENT3ErrorResponse {
  error: {
    code: string;
    message: string;
    request_id: string;
  };
}

// Internal error with status for middleware
export interface StandardError extends AGENT3ErrorResponse {
  status: number;
}

export function buildError(
  code: string,
  message: string,
  status: number,
  details?: any, // Ignored per U4 spec
  traceId?: string
): StandardError {
  return {
    error: {
      code,
      message,
      request_id: traceId || uuidv4()
    },
    status
  };
}

export function sanitizeLogs(obj: any): any {
  if (typeof obj !== 'object' || obj === null) return obj;
  
  const sanitized = { ...obj };
  
  // Redact sensitive fields
  const sensitiveKeys = [
    'authorization',
    'cookie',
    'jwt_secret',
    'openai_api_key',
    'database_url',
    'session_secret',
    'password',
    'token',
    'key',
    'secret'
  ];
  
  for (const key in sanitized) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeLogs(sanitized[key]);
    }
  }
  
  return sanitized;
}