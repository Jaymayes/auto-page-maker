import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { db } from '../../db.js';
import { users, uploads } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

const A8_COMMAND_CENTER_URL = process.env.COMMAND_CENTER_URL || 'https://auto-com-center-jamarrlmayes.replit.app/api/report';
const A8_AUTH_TOKEN = process.env.COMMAND_CENTER_TOKEN || process.env.A8_API_TOKEN || '';

interface OnboardingRequest extends Request {
  traceId: string;
  idempotencyKey: string;
}

function generateTraceId(): string {
  return `onb-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

function generateIdempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomUUID().slice(0, 12)}`;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function emitA8Event(
  eventName: string,
  payload: Record<string, any>,
  traceId: string,
  idempotencyKey: string,
  maxRetries = 3
): Promise<{ success: boolean; attempts: number; error?: string }> {
  const eventPayload = {
    event: eventName,
    app: 'onboarding-orchestrator',
    timestamp: new Date().toISOString(),
    trace_id: traceId,
    ...payload,
  };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Trace-Id': traceId,
        'X-Idempotency-Key': idempotencyKey,
      };
      
      if (A8_AUTH_TOKEN) {
        headers['Authorization'] = `Bearer ${A8_AUTH_TOKEN}`;
      }
      
      const response = await fetch(A8_COMMAND_CENTER_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(eventPayload),
      });

      if (response.ok) {
        console.log(`[ONBOARDING] A8 event ${eventName} emitted successfully (attempt ${attempt})`);
        return { success: true, attempts: attempt };
      }

      const errorText = await response.text().catch(() => 'Unknown error');
      console.warn(`[ONBOARDING] A8 event ${eventName} failed (attempt ${attempt}/${maxRetries}): ${response.status} - ${errorText}`);

      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return { success: false, attempts: attempt, error: `Client error: ${response.status}` };
      }
    } catch (error: any) {
      console.warn(`[ONBOARDING] A8 event ${eventName} network error (attempt ${attempt}/${maxRetries}):`, error.message);
    }

    if (attempt < maxRetries) {
      const backoffMs = Math.pow(2, attempt) * 100;
      console.log(`[ONBOARDING] Retrying in ${backoffMs}ms...`);
      await sleep(backoffMs);
    }
  }

  return { success: false, attempts: maxRetries, error: 'Max retries exceeded' };
}

function ensureTraceId(req: Request, res: Response, next: NextFunction) {
  const onbReq = req as OnboardingRequest;
  onbReq.traceId = (req.headers['x-trace-id'] as string) || generateTraceId();
  res.setHeader('X-Trace-Id', onbReq.traceId);
  next();
}

router.use(ensureTraceId);

router.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'onboarding-orchestrator',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  });
});

const guestUserSchema = z.object({
  email: z.string().email().optional(),
  sessionId: z.string().optional(),
  deviceFingerprint: z.string().optional(),
});

router.post('/api/v1/onboarding/guest', async (req: Request, res: Response) => {
  const onbReq = req as OnboardingRequest;
  const traceId = onbReq.traceId;
  const idempotencyKey = generateIdempotencyKey('guest');

  try {
    const validated = guestUserSchema.parse(req.body);
    
    const guestId = `guest-${randomUUID()}`;
    
    const [createdUser] = await db.insert(users).values({
      id: guestId,
      email: validated.email || null,
      onboardingStatus: 'guest',
      privacyMode: 'standard',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    const a8Result = await emitA8Event(
      'GuestCreated',
      {
        user_id: createdUser.id,
        email: validated.email || null,
        session_id: validated.sessionId || null,
        device_fingerprint: validated.deviceFingerprint || null,
      },
      traceId,
      idempotencyKey
    );

    console.log(`[ONBOARDING] Guest user created: ${createdUser.id}`);

    res.status(201).json({
      success: true,
      data: {
        user_id: createdUser.id,
        onboarding_status: createdUser.onboardingStatus,
        created_at: createdUser.createdAt,
      },
      meta: {
        trace_id: traceId,
        idempotency_key: idempotencyKey,
        a8_event_sent: a8Result.success,
        a8_attempts: a8Result.attempts,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.errors,
        trace_id: traceId,
      });
    }
    console.error('[ONBOARDING] Guest creation failed:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create guest user',
      trace_id: traceId,
    });
  }
});

const uploadSchema = z.object({
  userId: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().positive(),
  documentType: z.enum(['transcript', 'essay', 'resume', 'other']).default('other'),
  storageKey: z.string().optional(),
});

router.post('/api/v1/onboarding/upload', async (req: Request, res: Response) => {
  const onbReq = req as OnboardingRequest;
  const traceId = onbReq.traceId;
  const idempotencyKey = generateIdempotencyKey('upload');

  try {
    const validated = uploadSchema.parse(req.body);

    const [createdUpload] = await db.insert(uploads).values({
      ownerId: validated.userId,
      ownerType: 'user',
      filename: validated.filename,
      mimeType: validated.mimeType,
      sizeBytes: validated.sizeBytes,
      storageKey: validated.storageKey || null,
      status: 'pending',
      traceId: traceId,
      idempotencyKey: idempotencyKey,
      createdAt: new Date(),
    }).returning();

    const a8Result = await emitA8Event(
      'DocumentUploaded',
      {
        upload_id: createdUpload.id,
        user_id: validated.userId,
        document_type: validated.documentType,
        filename: validated.filename,
        mime_type: validated.mimeType,
        size_bytes: validated.sizeBytes,
      },
      traceId,
      idempotencyKey
    );

    console.log(`[ONBOARDING] Document uploaded: ${createdUpload.id} for user ${validated.userId}`);

    res.status(201).json({
      success: true,
      data: {
        upload_id: createdUpload.id,
        status: createdUpload.status,
        created_at: createdUpload.createdAt,
      },
      meta: {
        trace_id: traceId,
        idempotency_key: idempotencyKey,
        a8_event_sent: a8Result.success,
        a8_attempts: a8Result.attempts,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.errors,
        trace_id: traceId,
      });
    }
    if ((error as any)?.code === '23505') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Duplicate idempotency key',
        trace_id: traceId,
      });
    }
    console.error('[ONBOARDING] Upload creation failed:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create upload record',
      trace_id: traceId,
    });
  }
});

const scoreSchema = z.object({
  userId: z.string(),
  uploadId: z.string(),
});

router.post('/api/v1/onboarding/score', async (req: Request, res: Response) => {
  const onbReq = req as OnboardingRequest;
  const traceId = onbReq.traceId;
  const idempotencyKey = generateIdempotencyKey('score');

  try {
    const validated = scoreSchema.parse(req.body);

    const implicitFitScore = Math.floor(Math.random() * 101);

    await db.update(uploads)
      .set({
        status: 'scored',
        implicitFitScore: implicitFitScore,
        processedAt: new Date(),
      })
      .where(eq(uploads.id, validated.uploadId));

    await db.update(users)
      .set({
        implicitFitScore: implicitFitScore,
        onboardingStatus: 'registered',
        updatedAt: new Date(),
      })
      .where(eq(users.id, validated.userId));

    const a8Result = await emitA8Event(
      'DocumentScored',
      {
        user_id: validated.userId,
        upload_id: validated.uploadId,
        implicit_fit_score: implicitFitScore,
        scoring_model: 'v1-stub',
        confidence: 0.0,
      },
      traceId,
      idempotencyKey
    );

    console.log(`[ONBOARDING] Document scored: upload=${validated.uploadId}, score=${implicitFitScore}`);

    res.status(200).json({
      success: true,
      data: {
        user_id: validated.userId,
        upload_id: validated.uploadId,
        implicit_fit_score: implicitFitScore,
        scoring_model: 'v1-stub',
      },
      meta: {
        trace_id: traceId,
        idempotency_key: idempotencyKey,
        a8_event_sent: a8Result.success,
        a8_attempts: a8Result.attempts,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.errors,
        trace_id: traceId,
      });
    }
    console.error('[ONBOARDING] Scoring failed:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to score document',
      trace_id: traceId,
    });
  }
});

const nlpScoreSchema = z.object({
  text: z.string().optional(),
  documentType: z.enum(['transcript', 'essay', 'resume', 'other']).default('other'),
});

router.post('/nlp/score', async (req: Request, res: Response) => {
  const onbReq = req as OnboardingRequest;
  const traceId = onbReq.traceId;

  try {
    const validated = nlpScoreSchema.parse(req.body);

    const score = Math.floor(Math.random() * 101);
    
    const mockSignals = {
      gpa_inferred: parseFloat((2.0 + Math.random() * 2.0).toFixed(2)),
      major_inferred: ['computer_science', 'engineering', 'business', 'biology', 'psychology'][Math.floor(Math.random() * 5)],
      writing_quality: parseFloat(Math.random().toFixed(2)),
      fit_confidence: parseFloat((0.3 + Math.random() * 0.5).toFixed(2)),
    };

    console.log(`[ONBOARDING] NLP stub scored document: score=${score}, type=${validated.documentType}`);

    res.status(200).json({
      success: true,
      data: {
        score: score,
        signals: mockSignals,
        model_version: 'v1-stub',
        processing_time_ms: Math.floor(50 + Math.random() * 150),
      },
      meta: {
        trace_id: traceId,
        is_stub: true,
        note: 'This is a stub endpoint. Real NLP scoring will be implemented in Gate 1.',
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.errors,
        trace_id: traceId,
      });
    }
    console.error('[ONBOARDING] NLP scoring failed:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'NLP scoring failed',
      trace_id: traceId,
    });
  }
});

export default router;
