import * as fs from 'fs';
import * as path from 'path';

interface Criterion {
  id: string;
  description: string;
  threshold: number | boolean;
  unit: string;
  consecutiveCheckpoints?: number;
  operator?: string;
}

interface ChecklistConfig {
  version: string;
  lastUpdated: string;
  criteria: Criterion[];
  gatingStatus: string;
  requiresHitlOverride: boolean;
}

interface CheckResult {
  passed: boolean;
  failures: string[];
}

interface CheckpointTracker {
  [criteriaId: string]: number;
}

const configPath = path.join(__dirname, '../config/b2c-ungate-checklist.json');
let checklistConfig: ChecklistConfig | null = null;
const consecutivePassTracker: CheckpointTracker = {};

function loadConfig(): ChecklistConfig {
  if (!checklistConfig) {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    checklistConfig = JSON.parse(configContent) as ChecklistConfig;
  }
  return checklistConfig;
}

function getCriterion(criteriaId: string): Criterion | undefined {
  const config = loadConfig();
  return config.criteria.find(c => c.id === criteriaId);
}

export function checkCriteria(criteriaId: string, value: number | boolean): boolean {
  const criterion = getCriterion(criteriaId);
  if (!criterion) {
    throw new Error(`Unknown criteria: ${criteriaId}`);
  }

  let passed = false;
  const operator = criterion.operator || '<=';

  if (criterion.unit === 'boolean') {
    passed = value === criterion.threshold;
  } else if (criterion.unit === 'percent' || criterion.unit === 'ms' || criterion.unit === 'count') {
    const numValue = value as number;
    const numThreshold = criterion.threshold as number;

    switch (criteriaId) {
      case 'success_rate':
        passed = numValue >= numThreshold;
        break;
      case 'error_rate_5xx':
        passed = numValue < numThreshold;
        break;
      case 'error_budget_burn':
        passed = numValue <= numThreshold;
        break;
      case 'p95_latency':
      case 'p99_latency':
        passed = numValue <= numThreshold;
        break;
      case 'webhook_403':
      case 'a3_revenue_blocker':
        passed = numValue === numThreshold;
        break;
      case 'url_delta_positive':
        passed = operator === '>' ? numValue > numThreshold : numValue >= numThreshold;
        break;
      default:
        passed = numValue <= numThreshold;
    }
  }

  if (passed) {
    consecutivePassTracker[criteriaId] = (consecutivePassTracker[criteriaId] || 0) + 1;
  } else {
    consecutivePassTracker[criteriaId] = 0;
  }

  return passed;
}

export function evaluateAllCriteria(metrics: Record<string, number | boolean>): CheckResult {
  const config = loadConfig();
  const failures: string[] = [];
  let allPassed = true;

  for (const criterion of config.criteria) {
    const value = metrics[criterion.id];
    
    if (value === undefined) {
      failures.push(`Missing metric for ${criterion.id}: ${criterion.description}`);
      allPassed = false;
      continue;
    }

    const passed = checkCriteria(criterion.id, value);
    
    if (!passed) {
      failures.push(`${criterion.id}: ${criterion.description} (current: ${value})`);
      allPassed = false;
    } else if (criterion.consecutiveCheckpoints) {
      const consecutivePasses = consecutivePassTracker[criterion.id] || 0;
      if (consecutivePasses < criterion.consecutiveCheckpoints) {
        failures.push(`${criterion.id}: ${criterion.description} (needs ${criterion.consecutiveCheckpoints} consecutive passes, has ${consecutivePasses})`);
        allPassed = false;
      }
    }
  }

  return {
    passed: allPassed,
    failures
  };
}

export function getConsecutivePasses(criteriaId: string): number {
  return consecutivePassTracker[criteriaId] || 0;
}

export function resetConsecutivePasses(criteriaId?: string): void {
  if (criteriaId) {
    consecutivePassTracker[criteriaId] = 0;
  } else {
    Object.keys(consecutivePassTracker).forEach(key => {
      consecutivePassTracker[key] = 0;
    });
  }
}

export function getGatingStatus(): string {
  const config = loadConfig();
  return config.gatingStatus;
}

export function requiresHitlOverride(): boolean {
  const config = loadConfig();
  return config.requiresHitlOverride;
}
