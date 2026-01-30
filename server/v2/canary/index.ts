import { Request, Response, NextFunction, Router } from 'express';
import crypto from 'crypto';

const router = Router();

interface CanaryConfig {
  featureFlag: string;
  percentEnabled: number;
  rolloutStage: 'disabled' | 'canary_5' | 'canary_25' | 'canary_50' | 'full';
  lastUpdated: Date;
  rollbackTriggered: boolean;
  rollbackReason?: string;
}

const canaryConfigs: Record<string, CanaryConfig> = {
  DATASERVICE_READ_CANARY: {
    featureFlag: 'DATASERVICE_READ_CANARY',
    percentEnabled: 0,
    rolloutStage: 'disabled',
    lastUpdated: new Date(),
    rollbackTriggered: false
  },
  A6_DASHBOARD_CANARY: {
    featureFlag: 'A6_DASHBOARD_CANARY',
    percentEnabled: 0,
    rolloutStage: 'disabled',
    lastUpdated: new Date(),
    rollbackTriggered: false
  },
  A1_AUTH_CANARY: {
    featureFlag: 'A1_AUTH_CANARY',
    percentEnabled: 0,
    rolloutStage: 'disabled',
    lastUpdated: new Date(),
    rollbackTriggered: false
  }
};

function getUserBucket(userId: string): number {
  const hash = crypto.createHash('sha256').update(userId).digest('hex');
  return parseInt(hash.substring(0, 8), 16) % 100;
}

export function isCanaryEnabled(featureFlag: string, userId: string): boolean {
  const config = canaryConfigs[featureFlag];
  if (!config || config.rollbackTriggered) {
    return false;
  }
  const bucket = getUserBucket(userId);
  return bucket < config.percentEnabled;
}

export function getCanaryConfig(featureFlag: string): CanaryConfig | null {
  return canaryConfigs[featureFlag] || null;
}

export function setCanaryPercentage(featureFlag: string, percent: number): boolean {
  if (!canaryConfigs[featureFlag]) {
    return false;
  }
  canaryConfigs[featureFlag].percentEnabled = Math.max(0, Math.min(100, percent));
  canaryConfigs[featureFlag].lastUpdated = new Date();
  
  if (percent === 0) {
    canaryConfigs[featureFlag].rolloutStage = 'disabled';
  } else if (percent <= 5) {
    canaryConfigs[featureFlag].rolloutStage = 'canary_5';
  } else if (percent <= 25) {
    canaryConfigs[featureFlag].rolloutStage = 'canary_25';
  } else if (percent <= 50) {
    canaryConfigs[featureFlag].rolloutStage = 'canary_50';
  } else {
    canaryConfigs[featureFlag].rolloutStage = 'full';
  }
  
  return true;
}

export function triggerRollback(featureFlag: string, reason: string): boolean {
  if (!canaryConfigs[featureFlag]) {
    return false;
  }
  canaryConfigs[featureFlag].percentEnabled = 0;
  canaryConfigs[featureFlag].rolloutStage = 'disabled';
  canaryConfigs[featureFlag].rollbackTriggered = true;
  canaryConfigs[featureFlag].rollbackReason = reason;
  canaryConfigs[featureFlag].lastUpdated = new Date();
  
  console.log(`[CANARY] Rollback triggered for ${featureFlag}: ${reason}`);
  return true;
}

export function resetRollback(featureFlag: string): boolean {
  if (!canaryConfigs[featureFlag]) {
    return false;
  }
  canaryConfigs[featureFlag].rollbackTriggered = false;
  canaryConfigs[featureFlag].rollbackReason = undefined;
  canaryConfigs[featureFlag].lastUpdated = new Date();
  return true;
}

export function canaryMiddleware(featureFlag: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string || 'anonymous';
    const isEnabled = isCanaryEnabled(featureFlag, userId);
    
    (req as any).canaryEnabled = isEnabled;
    (req as any).canaryFlag = featureFlag;
    
    res.setHeader('X-Canary-Flag', featureFlag);
    res.setHeader('X-Canary-Enabled', isEnabled ? '1' : '0');
    
    next();
  };
}

router.get('/api/v1/canary/status', (req: Request, res: Response) => {
  res.json({
    success: true,
    configs: Object.values(canaryConfigs)
  });
});

router.get('/api/v1/canary/:featureFlag', (req: Request, res: Response) => {
  const { featureFlag } = req.params;
  const config = getCanaryConfig(featureFlag);
  
  if (!config) {
    return res.status(404).json({ success: false, error: 'Feature flag not found' });
  }
  
  res.json({ success: true, config });
});

router.post('/api/v1/canary/:featureFlag/set', (req: Request, res: Response) => {
  const { featureFlag } = req.params;
  const { percent } = req.body;
  
  if (typeof percent !== 'number' || percent < 0 || percent > 100) {
    return res.status(400).json({ success: false, error: 'Percent must be 0-100' });
  }
  
  const success = setCanaryPercentage(featureFlag, percent);
  if (!success) {
    return res.status(404).json({ success: false, error: 'Feature flag not found' });
  }
  
  const config = getCanaryConfig(featureFlag);
  console.log(`[CANARY] ${featureFlag} set to ${percent}% (stage: ${config?.rolloutStage})`);
  
  res.json({ success: true, config });
});

router.post('/api/v1/canary/:featureFlag/rollback', (req: Request, res: Response) => {
  const { featureFlag } = req.params;
  const { reason } = req.body;
  
  const success = triggerRollback(featureFlag, reason || 'Manual rollback');
  if (!success) {
    return res.status(404).json({ success: false, error: 'Feature flag not found' });
  }
  
  res.json({ success: true, message: 'Rollback triggered', config: getCanaryConfig(featureFlag) });
});

router.post('/api/v1/canary/:featureFlag/reset', (req: Request, res: Response) => {
  const { featureFlag } = req.params;
  
  const success = resetRollback(featureFlag);
  if (!success) {
    return res.status(404).json({ success: false, error: 'Feature flag not found' });
  }
  
  res.json({ success: true, message: 'Rollback reset', config: getCanaryConfig(featureFlag) });
});

router.get('/api/v1/canary/check/:featureFlag/:userId', (req: Request, res: Response) => {
  const { featureFlag, userId } = req.params;
  
  const config = getCanaryConfig(featureFlag);
  if (!config) {
    return res.status(404).json({ success: false, error: 'Feature flag not found' });
  }
  
  const bucket = getUserBucket(userId);
  const isEnabled = isCanaryEnabled(featureFlag, userId);
  
  res.json({
    success: true,
    featureFlag,
    userId,
    bucket,
    percentEnabled: config.percentEnabled,
    isEnabled
  });
});

export default router;

export {
  CanaryConfig,
  canaryConfigs
};
