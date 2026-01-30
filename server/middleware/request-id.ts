import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const clientProvidedTraceId = req.headers['x-trace-id'] as string;
  
  if (clientProvidedTraceId) {
    (req as any)._clientProvidedTraceId = true;
    res.setHeader('X-Trace-ID', clientProvidedTraceId);
  } else {
    const generatedTraceId = uuidv4();
    req.headers['x-trace-id'] = generatedTraceId;
    (req as any)._clientProvidedTraceId = false;
    res.setHeader('X-Trace-ID', generatedTraceId);
  }
  
  next();
}
