import { Request, Response, NextFunction } from 'express';

/**
 * Cohort Tagging Middleware
 * Tags all requests with cohort and traffic source for Phase 1 beta tracking
 * 
 * Phase 1: cohort=phase1_d0-d3, traffic_source=beta
 * Future phases: cohort=phase2_d4-d7, cohort=phase3_d8+, etc.
 */

interface CohortConfig {
  cohort: string;
  trafficSource: string;
  startDate: string;
  endDate: string;
}

// Active cohort configuration (CEO directive: Phase 1, D0-D3)
const ACTIVE_COHORT: CohortConfig = {
  cohort: 'phase1_d0-d3',
  trafficSource: 'beta',
  startDate: '2025-10-09',
  endDate: '2025-10-12'
};

/**
 * Adds cohort metadata to request object
 * Available as req.cohortTags for logging and analytics
 */
export function cohortTaggingMiddleware(req: Request, res: Response, next: NextFunction) {
  // Attach cohort tags to request object for downstream use
  (req as any).cohortTags = {
    cohort: ACTIVE_COHORT.cohort,
    traffic_source: ACTIVE_COHORT.trafficSource,
    phase: 'phase1',
    day_range: 'd0-d3'
  };

  // Add cohort headers to response for client-side tracking
  res.setHeader('X-Cohort-ID', ACTIVE_COHORT.cohort);
  res.setHeader('X-Traffic-Source', ACTIVE_COHORT.trafficSource);

  next();
}

/**
 * Get current cohort configuration
 */
export function getActiveCohort(): CohortConfig {
  return ACTIVE_COHORT;
}

/**
 * Update cohort configuration (for phase transitions)
 * Call this when advancing to Phase 2, Phase 3, etc.
 */
export function updateCohort(config: Partial<CohortConfig>) {
  Object.assign(ACTIVE_COHORT, config);
}

/**
 * Enhanced logging with cohort tags
 */
export function logWithCohort(req: Request, level: 'info' | 'warn' | 'error', message: string, meta?: any) {
  const cohortTags = (req as any).cohortTags || {};
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...cohortTags,
    ...meta,
    method: req.method,
    path: req.path,
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    userAgent: req.headers['user-agent']
  };

  console.log(JSON.stringify(logEntry));
}
