import express, { Request, Response, NextFunction } from 'express';

const app = express();
const PORT = process.env.PORT || 3004;
const API_KEY = process.env.VERIFIER_API_KEY || 'dev-key';
const startTime = Date.now();

app.use(express.json());

const apiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
  const key = req.headers['x-api-key'];
  if (key !== API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
};

interface VerificationResult {
  pass: boolean;
  score: number;
  reasons: string[];
}

interface CorrectionResult {
  corrected: string;
  score: number;
  changes: string[];
}

app.get('/health', (_req: Request, res: Response) => {
  const uptime_s = Math.floor((Date.now() - startTime) / 1000);
  res.json({
    service: 'saa-verifier-v2',
    version: '2.0.0',
    uptime_s,
    status: 'healthy'
  });
});

app.post('/verify', apiKeyAuth, (req: Request, res: Response) => {
  const { input, rubric } = req.body;
  
  if (!input) {
    return res.status(400).json({ error: 'input required' });
  }
  
  const inputLength = input.length;
  const hasStructure = input.includes('.') && input.includes(' ');
  const wordCount = input.split(/\s+/).length;
  
  const reasons: string[] = [];
  let score = 0.5;
  
  if (wordCount < 50) {
    reasons.push('Content too brief (< 50 words)');
    score -= 0.2;
  } else if (wordCount > 100) {
    score += 0.15;
  }
  
  if (!hasStructure) {
    reasons.push('Missing proper sentence structure');
    score -= 0.15;
  }
  
  if (rubric) {
    const rubricTerms = rubric.toLowerCase().split(',').map((t: string) => t.trim());
    const matchedTerms = rubricTerms.filter((term: string) => 
      input.toLowerCase().includes(term)
    );
    if (matchedTerms.length > 0) {
      score += 0.1 * matchedTerms.length;
    } else {
      reasons.push('Missing key rubric terms');
    }
  }
  
  score = Math.max(0, Math.min(1, score));
  const pass = score >= 0.6;
  
  if (pass && reasons.length === 0) {
    reasons.push('Content meets quality standards');
  }
  
  const result: VerificationResult = { pass, score: Math.round(score * 100) / 100, reasons };
  res.json(result);
});

app.post('/auto-correct', apiKeyAuth, (req: Request, res: Response) => {
  const { input, reasons } = req.body;
  
  if (!input) {
    return res.status(400).json({ error: 'input required' });
  }
  
  let corrected = input;
  const changes: string[] = [];
  
  if (!input.endsWith('.') && !input.endsWith('!') && !input.endsWith('?')) {
    corrected = corrected.trim() + '.';
    changes.push('Added ending punctuation');
  }
  
  if (corrected.length > 0 && corrected[0] !== corrected[0].toUpperCase()) {
    corrected = corrected[0].toUpperCase() + corrected.slice(1);
    changes.push('Capitalized first letter');
  }
  
  corrected = corrected.replace(/\s+/g, ' ').trim();
  if (corrected !== input.replace(/\s+/g, ' ').trim()) {
    changes.push('Normalized whitespace');
  }
  
  const result: CorrectionResult = {
    corrected,
    score: 0.75,
    changes
  };
  
  res.json(result);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[saa-verifier-v2] Running on 0.0.0.0:${PORT}`);
});

export default app;
