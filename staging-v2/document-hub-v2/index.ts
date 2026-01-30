import express, { Request, Response, NextFunction } from 'express';
import { resilientFetch } from '../shared/utils/resilience';

const app = express();
const PORT = process.env.PORT || 3002;
const API_KEY = process.env.DOCUMENT_HUB_API_KEY || 'dev-key';
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

interface Document {
  document_id: string;
  user_id: string;
  mime: string;
  size: number;
  filename: string;
  uploaded_at: string;
}

const documents: Map<string, Document> = new Map();

app.get('/health', (_req: Request, res: Response) => {
  const uptime_s = Math.floor((Date.now() - startTime) / 1000);
  res.json({
    service: 'document-hub-v2',
    version: '2.0.0',
    uptime_s,
    status: 'healthy'
  });
});

app.post('/upload', apiKeyAuth, async (req: Request, res: Response) => {
  const { user_id, filename, mime, size } = req.body;
  
  if (!user_id || !filename) {
    return res.status(400).json({ error: 'user_id and filename required' });
  }
  
  const document_id = `doc-${Date.now()}`;
  const doc: Document = {
    document_id,
    user_id,
    mime: mime || 'application/octet-stream',
    size: size || 0,
    filename,
    uploaded_at: new Date().toISOString()
  };
  
  documents.set(document_id, doc);
  
  try {
    const response = await resilientFetch(`${DATA_SERVICE_URL}/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.DATA_SERVICE_API_KEY || 'dev-key'
      },
      body: JSON.stringify({
        document_id,
        user_id,
        mime: doc.mime,
        size: doc.size,
        filename,
        uploaded_at: doc.uploaded_at
      })
    }, undefined, { maxRetries: 2, baseDelay: 500, maxDelay: 2000 });
    
    if (!response.ok) {
      console.error('[document-hub-v2] DataService returned error:', response.status);
    }
  } catch (err) {
    console.error('[document-hub-v2] Failed to persist to DataService:', err);
  }
  
  res.status(201).json({
    document_id,
    mime: doc.mime,
    size: doc.size,
    user_id
  });
});

app.get('/documents/:id', apiKeyAuth, (req: Request, res: Response) => {
  const doc = documents.get(req.params.id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }
  res.json(doc);
});

app.post('/webhooks/test', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Webhook test received' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[document-hub-v2] Running on 0.0.0.0:${PORT}`);
});

export default app;
