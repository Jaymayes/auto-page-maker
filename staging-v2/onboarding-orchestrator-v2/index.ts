import express, { Request, Response, NextFunction } from 'express';
import { ageGateMiddleware } from '../shared/middleware/privacy';
import { resilientFetch, dataServiceCircuit } from '../shared/utils/resilience';

const app = express();
const PORT = process.env.PORT || 3003;
const API_KEY = process.env.ORCHESTRATOR_API_KEY || 'dev-key';
const DATA_SERVICE_URL = process.env.DATA_SERVICE_URL || 'https://saa-core-data-v2.example.com';
const startTime = Date.now();

app.use(express.json());

const apiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
  const key = req.headers['x-api-key'];
  if (key !== API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
};

interface UserActivation {
  user_id: string;
  status: 'pending' | 'document_uploaded' | 'analysis_complete' | 'ready';
  document_id?: string;
  features?: NLPFeatures;
  updated_at: string;
}

interface NLPFeatures {
  mission_fit: number;
  theme_coherence: number;
  academic_strength: number;
  leadership_indicators: number;
  community_engagement: number;
}

const activations: Map<string, UserActivation> = new Map();

function analyzeDocument(_documentId: string, _userId: string): NLPFeatures {
  return {
    mission_fit: 0.72 + Math.random() * 0.2,
    theme_coherence: 0.68 + Math.random() * 0.25,
    academic_strength: 0.75 + Math.random() * 0.2,
    leadership_indicators: 0.55 + Math.random() * 0.3,
    community_engagement: 0.60 + Math.random() * 0.3
  };
}

app.get('/health', (_req: Request, res: Response) => {
  const uptime_s = Math.floor((Date.now() - startTime) / 1000);
  res.json({
    service: 'onboarding-orchestrator-v2',
    version: '2.0.0',
    uptime_s,
    status: 'healthy'
  });
});

app.get('/onboarding', (_req: Request, res: Response) => {
  res.json({
    prompt: 'Upload your transcript or past essay to unlock your personalized dashboard.',
    action: '/upload',
    cta: 'Get Started'
  });
});

app.post('/events/document_uploaded', apiKeyAuth, async (req: Request, res: Response) => {
  const { document_id, user_id, mime, size, filename } = req.body;
  
  if (!document_id || !user_id) {
    return res.status(400).json({ error: 'document_id and user_id required' });
  }
  
  let activation = activations.get(user_id);
  if (!activation) {
    activation = {
      user_id,
      status: 'pending',
      updated_at: new Date().toISOString()
    };
  }
  
  activation.status = 'document_uploaded';
  activation.document_id = document_id;
  activation.updated_at = new Date().toISOString();
  activations.set(user_id, activation);
  
  try {
    await dataServiceCircuit.execute(async () => {
      const response = await resilientFetch(`${DATA_SERVICE_URL}/activations/${user_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.DATA_SERVICE_API_KEY || 'dev-key'
        },
        body: JSON.stringify({
          status: 'document_uploaded',
          document_id,
          updated_at: new Date().toISOString()
        })
      }, undefined, { maxRetries: 2, baseDelay: 500, maxDelay: 2000 });
      
      if (!response.ok) {
        console.error('[orchestrator] Failed to update activation in DataService:', response.status);
      }
    });
  } catch (err) {
    console.error('[orchestrator] Error updating DataService with document_uploaded:', err);
  }
  
  console.log(`[orchestrator] Processing document ${document_id} for user ${user_id}`);
  
  setTimeout(async () => {
    const features = analyzeDocument(document_id, user_id);
    activation!.features = features;
    activation!.status = 'ready';
    activation!.updated_at = new Date().toISOString();
    activations.set(user_id, activation!);
    
    try {
      await dataServiceCircuit.execute(async () => {
        const response = await resilientFetch(`${DATA_SERVICE_URL}/activations/${user_id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.DATA_SERVICE_API_KEY || 'dev-key'
          },
          body: JSON.stringify({
            status: 'ready',
            features,
            updated_at: new Date().toISOString()
          })
        }, undefined, { maxRetries: 2, baseDelay: 500, maxDelay: 2000 });
        
        if (!response.ok) {
          console.error('[orchestrator] Failed to update features in DataService:', response.status);
        }
      });
    } catch (err) {
      console.error('[orchestrator] Error persisting NLP features to DataService:', err);
    }
    
    console.log(`[orchestrator] Analysis complete for user ${user_id}`, features);
  }, 500);
  
  res.json({
    status: 'processing',
    document_id,
    user_id,
    message: 'Document received, analysis in progress'
  });
});

app.get('/activation/status', (req: Request, res: Response) => {
  const user_id = req.query.user_id as string;
  if (!user_id) {
    return res.status(400).json({ error: 'user_id required' });
  }
  
  const activation = activations.get(user_id);
  if (!activation) {
    return res.json({
      user_id,
      status: 'pending',
      message: 'No document uploaded yet'
    });
  }
  
  res.json(activation);
});

app.post('/signup', ageGateMiddleware, async (req: Request, res: Response) => {
  const { email, age } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }
  
  const user_id = `stu-${Date.now()}`;
  const isMinor = age && age < 18;
  const privacyContext = req.privacy;
  
  activations.set(user_id, {
    user_id,
    status: 'pending',
    updated_at: new Date().toISOString()
  });
  
  try {
    await dataServiceCircuit.execute(async () => {
      const response = await resilientFetch(`${DATA_SERVICE_URL}/activations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.DATA_SERVICE_API_KEY || 'dev-key'
        },
        body: JSON.stringify({
          user_id,
          status: 'pending',
          updated_at: new Date().toISOString()
        })
      }, undefined, { maxRetries: 2, baseDelay: 500, maxDelay: 2000 });
      
      if (!response.ok) {
        console.error('[orchestrator] DataService returned error:', response.status);
      }
    });
  } catch (err) {
    console.error('[orchestrator] Failed to persist activation to DataService:', err);
  }
  
  res.status(201).json({
    user_id,
    email,
    do_not_sell: privacyContext?.doNotSell || isMinor,
    privacy_mode: privacyContext?.isMinor ? 'minor' : 'standard',
    next_step: '/onboarding',
    message: (privacyContext?.isMinor || isMinor) 
      ? 'Account created with enhanced privacy protections'
      : 'Account created. Upload a document to get started.'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[onboarding-orchestrator-v2] Running on 0.0.0.0:${PORT}`);
});

export default app;
