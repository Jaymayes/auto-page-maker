import { Request, Response, NextFunction } from 'express';

/**
 * Cost Telemetry Middleware (CEO Directive)
 * Tracks $/1k requests by endpoint and feature, plus AI token cost per task
 */

interface CostMetrics {
  totalRequests: number;
  infraCost: number; // Estimated infra cost
  aiTokenCost: number; // AI API costs (OpenAI)
  costPer1k: number;
  breakdown: {
    [endpoint: string]: {
      requests: number;
      infraCost: number;
      aiTokenCost: number;
      costPer1k: number;
    };
  };
  features: {
    search: { requests: number; cost: number; aiTokens: number };
    save: { requests: number; cost: number; aiTokens: number };
    apply: { requests: number; cost: number; aiTokens: number };
    landingPageGen: { requests: number; cost: number; aiTokens: number };
  };
}

// Cost constants (CEO directive: maintain 4× AI service markup)
const COSTS = {
  // Neon PostgreSQL (estimated)
  dbReadCost: 0.00001, // $0.01 per 1000 reads
  dbWriteCost: 0.00005, // $0.05 per 1000 writes
  
  // Compute (Replit hosting)
  computeCostPerMs: 0.000001, // $1 per 1M ms = $0.001 per 1000 ms
  
  // OpenAI API (GPT-4o)
  gpt4oInputCostPer1kTokens: 0.005, // $5 per 1M tokens
  gpt4oOutputCostPer1kTokens: 0.015, // $15 per 1M tokens
  
  // Target markup
  aiServiceMarkup: 4.0 // CEO directive: 4× markup on AI costs
};

const costMetrics: CostMetrics = {
  totalRequests: 0,
  infraCost: 0,
  aiTokenCost: 0,
  costPer1k: 0,
  breakdown: {},
  features: {
    search: { requests: 0, cost: 0, aiTokens: 0 },
    save: { requests: 0, cost: 0, aiTokens: 0 },
    apply: { requests: 0, cost: 0, aiTokens: 0 },
    landingPageGen: { requests: 0, cost: 0, aiTokens: 0 }
  }
};

/**
 * Estimate infra cost for a request
 */
function estimateInfraCost(duration: number, dbQueries: number = 1): number {
  const computeCost = duration * COSTS.computeCostPerMs;
  const dbCost = dbQueries * COSTS.dbReadCost;
  return computeCost + dbCost;
}

/**
 * Track AI token usage and cost
 */
export function trackAITokenUsage(
  feature: 'search' | 'save' | 'apply' | 'landingPageGen',
  inputTokens: number,
  outputTokens: number
) {
  const inputCost = (inputTokens / 1000) * COSTS.gpt4oInputCostPer1kTokens;
  const outputCost = (outputTokens / 1000) * COSTS.gpt4oOutputCostPer1kTokens;
  const totalCost = (inputCost + outputCost) * COSTS.aiServiceMarkup; // Apply 4× markup
  
  costMetrics.aiTokenCost += totalCost;
  costMetrics.features[feature].aiTokens += inputTokens + outputTokens;
  costMetrics.features[feature].cost += totalCost;
  
  return {
    inputCost,
    outputCost,
    totalCost,
    markup: COSTS.aiServiceMarkup
  };
}

/**
 * Middleware to track cost telemetry per request
 */
export function costTelemetryMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  // Normalize endpoint
  const endpoint = req.path.replace(/\/\d+/g, '/:id').replace(/\/[0-9a-f-]{36}/g, '/:id');
  
  if (!costMetrics.breakdown[endpoint]) {
    costMetrics.breakdown[endpoint] = {
      requests: 0,
      infraCost: 0,
      aiTokenCost: 0,
      costPer1k: 0
    };
  }
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const dbQueries = (req as any).dbQueryCount || 1; // Track DB queries if available
    
    // Estimate costs
    const infraCost = estimateInfraCost(duration, dbQueries);
    
    // Update global metrics
    costMetrics.totalRequests++;
    costMetrics.infraCost += infraCost;
    
    // Update endpoint breakdown
    costMetrics.breakdown[endpoint].requests++;
    costMetrics.breakdown[endpoint].infraCost += infraCost;
    
    // Calculate cost per 1k requests
    const totalCost = costMetrics.infraCost + costMetrics.aiTokenCost;
    costMetrics.costPer1k = (totalCost / costMetrics.totalRequests) * 1000;
    costMetrics.breakdown[endpoint].costPer1k = 
      ((costMetrics.breakdown[endpoint].infraCost + costMetrics.breakdown[endpoint].aiTokenCost) / 
       costMetrics.breakdown[endpoint].requests) * 1000;
    
    // Track feature-specific costs
    if (endpoint.includes('/scholarships')) {
      costMetrics.features.search.requests++;
      costMetrics.features.search.cost += infraCost;
    } else if (endpoint.includes('/user-scholarships')) {
      if (req.method === 'POST') {
        costMetrics.features.save.requests++;
        costMetrics.features.save.cost += infraCost;
      }
    } else if (endpoint.includes('/landing-pages')) {
      costMetrics.features.landingPageGen.requests++;
      costMetrics.features.landingPageGen.cost += infraCost;
    }
  });
  
  next();
}

/**
 * Get current cost metrics
 */
export function getCostMetrics(): CostMetrics {
  return { ...costMetrics };
}

/**
 * Get cost per 1k requests (CEO gate: within ±20% of model forecast)
 */
export function getCostPer1k(): number {
  return costMetrics.costPer1k;
}

/**
 * Check if cost is within target margins (CEO directive)
 */
export function isCostWithinTarget(targetCostPer1k: number = 0.50): boolean {
  const variance = Math.abs(costMetrics.costPer1k - targetCostPer1k) / targetCostPer1k;
  return variance <= 0.20; // ±20% tolerance
}

/**
 * Get AI service markup validation (CEO directive: maintain 4× markup)
 */
export function validateAIMarkup(): { isValid: boolean; currentMarkup: number; targetMarkup: number } {
  return {
    isValid: COSTS.aiServiceMarkup === 4.0,
    currentMarkup: COSTS.aiServiceMarkup,
    targetMarkup: 4.0
  };
}

/**
 * Reset cost metrics
 */
export function resetCostMetrics() {
  costMetrics.totalRequests = 0;
  costMetrics.infraCost = 0;
  costMetrics.aiTokenCost = 0;
  costMetrics.costPer1k = 0;
  costMetrics.breakdown = {};
  Object.keys(costMetrics.features).forEach(key => {
    const feature = key as keyof typeof costMetrics.features;
    costMetrics.features[feature] = { requests: 0, cost: 0, aiTokens: 0 };
  });
}
