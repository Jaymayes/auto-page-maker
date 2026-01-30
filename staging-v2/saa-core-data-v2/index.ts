import express, { Request, Response, NextFunction } from 'express';

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.DATA_SERVICE_API_KEY || 'dev-key';
const startTime = Date.now();

app.use(express.json());

const apiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
  const key = req.headers['x-api-key'];
  if (key !== API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
};

interface User {
  id: string;
  email: string;
  is_ferpa_covered: boolean;
  created_at: string;
}

interface Provider {
  id: string;
  org: string;
  contact: string;
  created_at: string;
}

interface Scholarship {
  id: string;
  title: string;
  amount: number;
  deadline: string;
  tags: string[];
}

interface Purchase {
  id: string;
  student_id: string;
  credits: number;
  status: string;
}

interface Document {
  document_id: string;
  user_id: string;
  mime: string;
  size: number;
  filename: string;
  uploaded_at: string;
}

interface NLPFeatures {
  mission_fit: number;
  theme_coherence: number;
  academic_strength: number;
  leadership_indicators: number;
  community_engagement: number;
}

interface UserActivation {
  user_id: string;
  status: 'pending' | 'document_uploaded' | 'analysis_complete' | 'ready';
  document_id?: string;
  features?: NLPFeatures;
  updated_at: string;
}

const users: Map<string, User> = new Map();
const providers: Map<string, Provider> = new Map();
const scholarships: Map<string, Scholarship> = new Map();
const purchases: Map<string, Purchase> = new Map();
const documents: Map<string, Document> = new Map();
const activations: Map<string, UserActivation> = new Map();

scholarships.set('sch-001', { id: 'sch-001', title: 'STEM Excellence Award', amount: 5000, deadline: '2026-06-01', tags: ['stem', 'engineering'] });
scholarships.set('sch-002', { id: 'sch-002', title: 'First Generation Scholar', amount: 2500, deadline: '2026-05-15', tags: ['first-gen', 'undergraduate'] });
scholarships.set('sch-003', { id: 'sch-003', title: 'Community Leadership Grant', amount: 3000, deadline: '2026-07-01', tags: ['leadership', 'community'] });

app.get('/health', (_req: Request, res: Response) => {
  const uptime_s = Math.floor((Date.now() - startTime) / 1000);
  res.json({
    service: 'saa-core-data-v2',
    version: '2.0.0',
    uptime_s,
    status: 'healthy'
  });
});

app.post('/student/signup', apiKeyAuth, (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }
  const id = `stu-${Date.now()}`;
  const user: User = {
    id,
    email,
    is_ferpa_covered: false,
    created_at: new Date().toISOString()
  };
  users.set(id, user);
  res.status(201).json(user);
});

app.post('/provider/onboard', apiKeyAuth, (req: Request, res: Response) => {
  const { org, contact } = req.body;
  if (!org || !contact) {
    return res.status(400).json({ error: 'org and contact required' });
  }
  const id = `prov-${Date.now()}`;
  const provider: Provider = {
    id,
    org,
    contact,
    created_at: new Date().toISOString()
  };
  providers.set(id, provider);
  res.status(201).json(provider);
});

app.get('/scholarships/match', apiKeyAuth, (req: Request, res: Response) => {
  const query = (req.query.query as string || '').toLowerCase();
  const results = Array.from(scholarships.values()).filter(s =>
    s.title.toLowerCase().includes(query) ||
    s.tags.some(t => t.toLowerCase().includes(query))
  );
  res.json(results);
});

app.post('/credits/purchase', apiKeyAuth, (req: Request, res: Response) => {
  const { student_id, credits } = req.body;
  if (!student_id || !credits) {
    return res.status(400).json({ error: 'student_id and credits required' });
  }
  const id = `pur-${Date.now()}`;
  const purchase: Purchase = {
    id,
    student_id,
    credits,
    status: 'created'
  };
  purchases.set(id, purchase);
  res.status(201).json(purchase);
});

app.get('/users/:id', apiKeyAuth, (req: Request, res: Response) => {
  const user = users.get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});

app.patch('/users/:id/ferpa', apiKeyAuth, (req: Request, res: Response) => {
  const user = users.get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  user.is_ferpa_covered = req.body.is_ferpa_covered === true;
  res.json(user);
});

app.post('/documents', apiKeyAuth, (req: Request, res: Response) => {
  const { document_id, user_id, mime, size, filename, uploaded_at } = req.body;
  if (!document_id || !user_id || !filename) {
    return res.status(400).json({ error: 'document_id, user_id, and filename required' });
  }
  
  const doc: Document = {
    document_id,
    user_id,
    mime: mime || 'application/octet-stream',
    size: size || 0,
    filename,
    uploaded_at: uploaded_at || new Date().toISOString()
  };
  
  documents.set(document_id, doc);
  res.status(201).json(doc);
});

app.get('/documents/:id', apiKeyAuth, (req: Request, res: Response) => {
  const doc = documents.get(req.params.id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }
  res.json(doc);
});

app.post('/activations', apiKeyAuth, (req: Request, res: Response) => {
  const { user_id, status, document_id, features, updated_at } = req.body;
  if (!user_id) {
    return res.status(400).json({ error: 'user_id required' });
  }
  
  const activation: UserActivation = {
    user_id,
    status: status || 'pending',
    document_id,
    features,
    updated_at: updated_at || new Date().toISOString()
  };
  
  activations.set(user_id, activation);
  res.status(201).json(activation);
});

app.get('/activations/:user_id', apiKeyAuth, (req: Request, res: Response) => {
  const activation = activations.get(req.params.user_id);
  if (!activation) {
    return res.status(404).json({ error: 'Activation not found' });
  }
  res.json(activation);
});

app.patch('/activations/:user_id', apiKeyAuth, (req: Request, res: Response) => {
  const activation = activations.get(req.params.user_id);
  if (!activation) {
    return res.status(404).json({ error: 'Activation not found' });
  }
  
  if (req.body.status) activation.status = req.body.status;
  if (req.body.document_id) activation.document_id = req.body.document_id;
  if (req.body.features) activation.features = req.body.features;
  activation.updated_at = new Date().toISOString();
  
  res.json(activation);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[saa-core-data-v2] Running on 0.0.0.0:${PORT}`);
});

export default app;
