import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, and, sql, sum } from 'drizzle-orm';
import { db, pool } from '../../db.js';
import {
  users,
  providers,
  scholarships,
  uploads,
  ledgers,
  auditEvents,
  insertUserSchema,
  insertProviderSchema,
  insertScholarshipSchema,
  insertUploadSchema,
  insertLedgerSchema,
  insertAuditEventSchema,
  type User,
  type Provider,
  type Scholarship,
  type Upload,
  type Ledger,
} from '@shared/schema';

const router = Router();

type ViewerRole = 'consumer' | 'school_official' | 'admin' | 'system';

interface DataServiceRequest extends Request {
  traceId: string;
  idempotencyKey?: string;
  viewerRole: ViewerRole;
  actorId?: string;
}

const FERPA_SENSITIVE_USER_FIELDS = ['dateOfBirth', 'email', 'firstName', 'lastName', 'implicitFitScore'] as const;
const FERPA_SENSITIVE_UPLOAD_FIELDS = ['nlpMetadata', 'implicitFitScore'] as const;

function redactFerpaSensitiveFields<T extends Record<string, any>>(
  data: T,
  sensitiveFields: readonly string[],
  viewerRole: ViewerRole,
  isFerpaCovered: boolean
): T {
  if (!isFerpaCovered) return data;
  if (viewerRole === 'school_official' || viewerRole === 'admin' || viewerRole === 'system') {
    return data;
  }
  const redacted = { ...data };
  for (const field of sensitiveFields) {
    if (field in redacted) {
      if (field === 'email') {
        redacted[field] = '[REDACTED]';
      } else if (field === 'firstName' || field === 'lastName') {
        redacted[field] = redacted[field]?.charAt(0) + '***';
      } else if (field === 'dateOfBirth') {
        redacted[field] = null;
      } else {
        redacted[field] = '[REDACTED]';
      }
    }
  }
  return redacted;
}

function requireTraceId(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/health' || req.path === '/readyz') {
    return next();
  }
  const traceId = req.headers['x-trace-id'] as string;
  if (!traceId) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'X-Trace-Id header is required',
    });
  }
  (req as DataServiceRequest).traceId = traceId;
  next();
}

function requireIdempotencyKey(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/health' || req.path === '/readyz') {
    return next();
  }
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    const idempotencyKey = req.headers['x-idempotency-key'] as string;
    if (!idempotencyKey) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'X-Idempotency-Key header is required for POST/PUT/DELETE requests',
      });
    }
    (req as DataServiceRequest).idempotencyKey = idempotencyKey;
  }
  next();
}

function extractViewerRole(req: Request, res: Response, next: NextFunction) {
  const roleHeader = req.headers['x-viewer-role'] as string;
  const validRoles: ViewerRole[] = ['consumer', 'school_official', 'admin', 'system'];
  const role = validRoles.includes(roleHeader as ViewerRole) ? (roleHeader as ViewerRole) : 'consumer';
  (req as DataServiceRequest).viewerRole = role;
  (req as DataServiceRequest).actorId = req.headers['x-actor-id'] as string;
  next();
}

async function logAuditEvent(
  traceId: string,
  actorId: string | undefined,
  actorType: string,
  action: string,
  resourceType: string,
  resourceId: string | undefined,
  req: Request,
  changes: Record<string, any> = {},
  isFerpaAccess = false
) {
  try {
    await db.insert(auditEvents).values({
      traceId,
      actorId: actorId ?? null,
      actorType,
      action,
      resourceType,
      resourceId: resourceId ?? null,
      ipAddress: (req.ip || req.headers['x-forwarded-for'] as string || 'unknown').slice(0, 45),
      userAgent: (req.headers['user-agent'] || 'unknown').slice(0, 500),
      changes,
      isFerpaAccess,
      isPrivacySensitive: isFerpaAccess,
    });
  } catch (error) {
    console.error('[AUDIT] Failed to log audit event:', error);
  }
}

router.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'dataservice',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  });
});

router.get('/readyz', async (_req, res) => {
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    const latencyMs = Date.now() - start;
    res.status(200).json({
      status: 'ready',
      database: 'connected',
      latencyMs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[READYZ] Database ping failed:', error);
    res.status(503).json({
      status: 'not_ready',
      database: 'disconnected',
      error: 'Database connection failed',
      timestamp: new Date().toISOString(),
    });
  }
});

router.use(requireTraceId);
router.use(requireIdempotencyKey);
router.use(extractViewerRole);

router.get('/api/v1/users', async (req: Request, res: Response) => {
  const dsReq = req as DataServiceRequest;
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await db.select().from(users).limit(limit).offset(offset);
    const filtered = result.map((user) =>
      redactFerpaSensitiveFields(user, FERPA_SENSITIVE_USER_FIELDS, dsReq.viewerRole, user.isFerpaCovered ?? false)
    );
    await logAuditEvent(dsReq.traceId, dsReq.actorId, dsReq.viewerRole, 'read', 'user', undefined, req, { count: result.length });
    res.json({ data: filtered, meta: { limit, offset, total: result.length } });
  } catch (error) {
    console.error('[USERS] List failed:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch users' });
  }
});

router.get('/api/v1/users/:id', async (req: Request, res: Response) => {
  const dsReq = req as DataServiceRequest;
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.params.id));
    if (!user) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }
    const isFerpaAccess = user.isFerpaCovered ?? false;
    await logAuditEvent(dsReq.traceId, dsReq.actorId, dsReq.viewerRole, 'read', 'user', user.id, req, {}, isFerpaAccess);
    const filtered = redactFerpaSensitiveFields(user, FERPA_SENSITIVE_USER_FIELDS, dsReq.viewerRole, isFerpaAccess);
    res.json({ data: filtered });
  } catch (error) {
    console.error('[USERS] Get failed:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch user' });
  }
});

router.post('/api/v1/users', async (req: Request, res: Response) => {
  const dsReq = req as DataServiceRequest;
  try {
    const validated = insertUserSchema.parse(req.body);
    const [created] = await db.insert(users).values(validated).returning();
    await logAuditEvent(dsReq.traceId, dsReq.actorId, dsReq.viewerRole, 'create', 'user', created.id, req, { fields: Object.keys(validated) });
    res.status(201).json({ data: created });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation Error', details: error.errors });
    }
    console.error('[USERS] Create failed:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create user' });
  }
});

router.put('/api/v1/users/:id', async (req: Request, res: Response) => {
  const dsReq = req as DataServiceRequest;
  try {
    const validated = insertUserSchema.partial().parse(req.body);
    const [existing] = await db.select().from(users).where(eq(users.id, req.params.id));
    if (!existing) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }
    const [updated] = await db
      .update(users)
      .set({ ...validated, updatedAt: new Date() })
      .where(eq(users.id, req.params.id))
      .returning();
    await logAuditEvent(dsReq.traceId, dsReq.actorId, dsReq.viewerRole, 'update', 'user', updated.id, req, {
      before: existing,
      after: updated,
    });
    res.json({ data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation Error', details: error.errors });
    }
    console.error('[USERS] Update failed:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update user' });
  }
});

router.delete('/api/v1/users/:id', async (req: Request, res: Response) => {
  const dsReq = req as DataServiceRequest;
  try {
    const [existing] = await db.select().from(users).where(eq(users.id, req.params.id));
    if (!existing) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }
    await db.delete(users).where(eq(users.id, req.params.id));
    await logAuditEvent(dsReq.traceId, dsReq.actorId, dsReq.viewerRole, 'delete', 'user', req.params.id, req, { deleted: existing });
    res.status(204).send();
  } catch (error) {
    console.error('[USERS] Delete failed:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete user' });
  }
});

router.get('/api/v1/providers', async (req: Request, res: Response) => {
  const dsReq = req as DataServiceRequest;
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = parseInt(req.query.offset as string) || 0;
    const isActive = req.query.is_active !== 'false';
    const result = await db.select().from(providers).where(eq(providers.isActive, isActive)).limit(limit).offset(offset);
    await logAuditEvent(dsReq.traceId, dsReq.actorId, dsReq.viewerRole, 'read', 'provider', undefined, req, { count: result.length });
    res.json({ data: result, meta: { limit, offset, total: result.length } });
  } catch (error) {
    console.error('[PROVIDERS] List failed:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch providers' });
  }
});

router.get('/api/v1/providers/:id', async (req: Request, res: Response) => {
  const dsReq = req as DataServiceRequest;
  try {
    const [provider] = await db.select().from(providers).where(eq(providers.id, req.params.id));
    if (!provider) {
      return res.status(404).json({ error: 'Not Found', message: 'Provider not found' });
    }
    await logAuditEvent(dsReq.traceId, dsReq.actorId, dsReq.viewerRole, 'read', 'provider', provider.id, req);
    res.json({ data: provider });
  } catch (error) {
    console.error('[PROVIDERS] Get failed:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch provider' });
  }
});

router.post('/api/v1/providers', async (req: Request, res: Response) => {
  const dsReq = req as DataServiceRequest;
  try {
    const validated = insertProviderSchema.parse(req.body);
    const [created] = await db.insert(providers).values(validated).returning();
    await logAuditEvent(dsReq.traceId, dsReq.actorId, dsReq.viewerRole, 'create', 'provider', created.id, req, { fields: Object.keys(validated) });
    res.status(201).json({ data: created });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation Error', details: error.errors });
    }
    console.error('[PROVIDERS] Create failed:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create provider' });
  }
});

router.put('/api/v1/providers/:id', async (req: Request, res: Response) => {
  const dsReq = req as DataServiceRequest;
  try {
    const validated = insertProviderSchema.partial().parse(req.body);
    const [existing] = await db.select().from(providers).where(eq(providers.id, req.params.id));
    if (!existing) {
      return res.status(404).json({ error: 'Not Found', message: 'Provider not found' });
    }
    const [updated] = await db
      .update(providers)
      .set({ ...validated, updatedAt: new Date() })
      .where(eq(providers.id, req.params.id))
      .returning();
    await logAuditEvent(dsReq.traceId, dsReq.actorId, dsReq.viewerRole, 'update', 'provider', updated.id, req, { before: existing, after: updated });
    res.json({ data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation Error', details: error.errors });
    }
    console.error('[PROVIDERS] Update failed:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update provider' });
  }
});

router.delete('/api/v1/providers/:id', async (req: Request, res: Response) => {
  const dsReq = req as DataServiceRequest;
  try {
    const [existing] = await db.select().from(providers).where(eq(providers.id, req.params.id));
    if (!existing) {
      return res.status(404).json({ error: 'Not Found', message: 'Provider not found' });
    }
    await db.delete(providers).where(eq(providers.id, req.params.id));
    await logAuditEvent(dsReq.traceId, dsReq.actorId, dsReq.viewerRole, 'delete', 'provider', req.params.id, req, { deleted: existing });
    res.status(204).send();
  } catch (error) {
    console.error('[PROVIDERS] Delete failed:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete provider' });
  }
});

router.get('/api/v1/scholarships', async (req: Request, res: Response) => {
  const dsReq = req as DataServiceRequest;
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await db.select().from(scholarships).where(eq(scholarships.isActive, true)).limit(limit).offset(offset);
    await logAuditEvent(dsReq.traceId, dsReq.actorId, dsReq.viewerRole, 'read', 'scholarship', undefined, req, { count: result.length });
    res.json({ data: result, meta: { limit, offset, total: result.length } });
  } catch (error) {
    console.error('[SCHOLARSHIPS] List failed:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch scholarships' });
  }
});

router.get('/api/v1/scholarships/:id', async (req: Request, res: Response) => {
  const dsReq = req as DataServiceRequest;
  try {
    const [scholarship] = await db.select().from(scholarships).where(eq(scholarships.id, req.params.id));
    if (!scholarship) {
      return res.status(404).json({ error: 'Not Found', message: 'Scholarship not found' });
    }
    await logAuditEvent(dsReq.traceId, dsReq.actorId, dsReq.viewerRole, 'read', 'scholarship', scholarship.id, req);
    res.json({ data: scholarship });
  } catch (error) {
    console.error('[SCHOLARSHIPS] Get failed:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch scholarship' });
  }
});

router.post('/api/v1/scholarships', async (req: Request, res: Response) => {
  const dsReq = req as DataServiceRequest;
  try {
    const validated = insertScholarshipSchema.parse(req.body);
    const [created] = await db.insert(scholarships).values(validated).returning();
    await logAuditEvent(dsReq.traceId, dsReq.actorId, dsReq.viewerRole, 'create', 'scholarship', created.id, req, { fields: Object.keys(validated) });
    res.status(201).json({ data: created });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation Error', details: error.errors });
    }
    console.error('[SCHOLARSHIPS] Create failed:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create scholarship' });
  }
});

router.put('/api/v1/scholarships/:id', async (req: Request, res: Response) => {
  const dsReq = req as DataServiceRequest;
  try {
    const validated = insertScholarshipSchema.partial().parse(req.body);
    const [existing] = await db.select().from(scholarships).where(eq(scholarships.id, req.params.id));
    if (!existing) {
      return res.status(404).json({ error: 'Not Found', message: 'Scholarship not found' });
    }
    const [updated] = await db
      .update(scholarships)
      .set({ ...validated, updatedAt: new Date() })
      .where(eq(scholarships.id, req.params.id))
      .returning();
    await logAuditEvent(dsReq.traceId, dsReq.actorId, dsReq.viewerRole, 'update', 'scholarship', updated.id, req, { before: existing, after: updated });
    res.json({ data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation Error', details: error.errors });
    }
    console.error('[SCHOLARSHIPS] Update failed:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update scholarship' });
  }
});

router.delete('/api/v1/scholarships/:id', async (req: Request, res: Response) => {
  const dsReq = req as DataServiceRequest;
  try {
    const [existing] = await db.select().from(scholarships).where(eq(scholarships.id, req.params.id));
    if (!existing) {
      return res.status(404).json({ error: 'Not Found', message: 'Scholarship not found' });
    }
    await db.delete(scholarships).where(eq(scholarships.id, req.params.id));
    await logAuditEvent(dsReq.traceId, dsReq.actorId, dsReq.viewerRole, 'delete', 'scholarship', req.params.id, req, { deleted: existing });
    res.status(204).send();
  } catch (error) {
    console.error('[SCHOLARSHIPS] Delete failed:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete scholarship' });
  }
});

router.post('/api/v1/uploads', async (req: Request, res: Response) => {
  const dsReq = req as DataServiceRequest;
  try {
    const validated = insertUploadSchema.parse({
      ...req.body,
      traceId: dsReq.traceId,
      idempotencyKey: dsReq.idempotencyKey,
    });
    const [created] = await db.insert(uploads).values(validated).returning();
    await logAuditEvent(
      dsReq.traceId,
      dsReq.actorId,
      dsReq.viewerRole,
      'create',
      'upload',
      created.id,
      req,
      { filename: validated.filename, mimeType: validated.mimeType },
      validated.isFerpaCovered ?? false
    );
    res.status(201).json({ data: { upload_id: created.id, status: created.status } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation Error', details: error.errors });
    }
    if ((error as any)?.code === '23505') {
      return res.status(409).json({ error: 'Conflict', message: 'Duplicate idempotency key' });
    }
    console.error('[UPLOADS] Create failed:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create upload' });
  }
});

const ledgerEntrySchema = insertLedgerSchema.extend({
  entryType: z.enum(['debit', 'credit']),
  accountType: z.enum(['revenue', 'expense', 'asset', 'liability', 'fee']),
});

const createLedgerEntriesSchema = z.object({
  entries: z.array(ledgerEntrySchema).min(1),
});

router.post('/api/v1/ledgers', async (req: Request, res: Response) => {
  const dsReq = req as DataServiceRequest;
  try {
    const { entries } = createLedgerEntriesSchema.parse(req.body);
    const traceIds = new Set(entries.map((e) => e.traceId));
    if (traceIds.size > 1) {
      return res.status(400).json({ error: 'Validation Error', message: 'All entries must have the same trace_id' });
    }
    let balance = 0;
    for (const entry of entries) {
      if (entry.entryType === 'debit') {
        balance += entry.amountCents;
      } else {
        balance -= entry.amountCents;
      }
    }
    if (balance !== 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Ledger entries must sum to zero. Current balance: ${balance} cents`,
      });
    }
    const entriesWithIdempotency = entries.map((entry, index) => ({
      ...entry,
      idempotencyKey: `${dsReq.idempotencyKey}-${index}`,
    }));
    const created = await db.insert(ledgers).values(entriesWithIdempotency).returning();
    await logAuditEvent(dsReq.traceId, dsReq.actorId, dsReq.viewerRole, 'create', 'ledger', created[0]?.id, req, {
      entryCount: created.length,
      totalDebits: entries.filter((e) => e.entryType === 'debit').reduce((sum, e) => sum + e.amountCents, 0),
      totalCredits: entries.filter((e) => e.entryType === 'credit').reduce((sum, e) => sum + e.amountCents, 0),
    });
    res.status(201).json({ data: created, meta: { entryCount: created.length, balanced: true } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation Error', details: error.errors });
    }
    if ((error as any)?.code === '23505') {
      return res.status(409).json({ error: 'Conflict', message: 'Duplicate idempotency key for one or more entries' });
    }
    console.error('[LEDGERS] Create failed:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create ledger entries' });
  }
});

router.get('/api/v1/ledgers/reconcile', async (req: Request, res: Response) => {
  const dsReq = req as DataServiceRequest;
  try {
    const traceId = req.query.trace_id as string;
    if (!traceId) {
      return res.status(400).json({ error: 'Bad Request', message: 'trace_id query parameter is required' });
    }
    const entries = await db.select().from(ledgers).where(eq(ledgers.traceId, traceId));
    if (entries.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'No ledger entries found for trace_id' });
    }
    let balance = 0;
    for (const entry of entries) {
      if (entry.entryType === 'debit') {
        balance += entry.amountCents;
      } else {
        balance -= entry.amountCents;
      }
    }
    const isBalanced = balance === 0;
    const allReconciled = entries.every((e) => e.isReconciled);
    await logAuditEvent(dsReq.traceId, dsReq.actorId, dsReq.viewerRole, 'read', 'ledger', undefined, req, {
      reconcileTraceId: traceId,
      entryCount: entries.length,
      isBalanced,
    });
    res.json({
      data: {
        trace_id: traceId,
        entry_count: entries.length,
        is_balanced: isBalanced,
        balance_cents: balance,
        all_reconciled: allReconciled,
        entries: entries.map((e) => ({
          id: e.id,
          entry_type: e.entryType,
          account_type: e.accountType,
          account_id: e.accountId,
          amount_cents: e.amountCents,
          is_reconciled: e.isReconciled,
        })),
      },
    });
  } catch (error) {
    console.error('[LEDGERS] Reconcile failed:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to reconcile ledger' });
  }
});

export default router;
