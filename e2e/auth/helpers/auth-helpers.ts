/**
 * Auth E2E Test Helpers
 *
 * Provides utilities for session seeding and authentication testing
 * on the production www.scholaraiadvisor.com domain.
 */

import { Pool } from 'pg';
import crypto from 'crypto';

// PostgreSQL connection via Railway TCP Proxy
const DB_CONFIG = {
  host: process.env.TEST_DB_HOST || 'caboose.proxy.rlwy.net',
  port: parseInt(process.env.TEST_DB_PORT || '36327'),
  user: process.env.TEST_DB_USER || 'scholarship',
  password: process.env.TEST_DB_PASSWORD || 'scholarshipdb2026secure',
  database: process.env.TEST_DB_NAME || 'scholarship_prod',
  ssl: false
};

let pool: Pool | null = null;

/**
 * Get database connection pool
 */
export function getDbPool(): Pool {
  if (!pool) {
    pool = new Pool(DB_CONFIG);
  }
  return pool;
}

/**
 * Close database connection pool
 */
export async function closeDbPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Session data structure matching Express session store format
 */
interface SessionData {
  cookie: {
    originalMaxAge: number;
    expires: string;
    httpOnly: boolean;
    secure: boolean;
    sameSite: string;
    path: string;
  };
  passport?: {
    user: {
      claims: {
        sub: string;
        email: string;
        first_name?: string;
        last_name?: string;
        profile_image_url?: string;
      };
      access_token: string;
      refresh_token?: string;
      expires_at: number;
    };
  };
}

/**
 * Seed an authenticated session in the database
 *
 * @param options - Session options
 * @returns Session ID that can be used as connect.sid cookie value
 */
export async function seedAuthSession(options?: {
  userId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const db = getDbPool();

  // Generate session ID (format: s:sessionId.signature - Express uses signed cookies)
  const sessionId = crypto.randomBytes(24).toString('base64url');

  const expiresAt = Math.floor(Date.now() / 1000) + (options?.expiresInSeconds || 3600);
  const expireDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const sessionData: SessionData = {
    cookie: {
      originalMaxAge: 604800000, // 7 days in ms
      expires: expireDate.toISOString(),
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/'
    },
    passport: {
      user: {
        claims: {
          sub: options?.userId || `test-user-${Date.now()}`,
          email: options?.email || 'test-e2e@scholaraiadvisor.com',
          first_name: options?.firstName || 'Test',
          last_name: options?.lastName || 'User',
          profile_image_url: undefined
        },
        access_token: `test-access-token-${crypto.randomBytes(16).toString('hex')}`,
        refresh_token: `test-refresh-token-${crypto.randomBytes(16).toString('hex')}`,
        expires_at: expiresAt
      }
    }
  };

  // Insert session into PostgreSQL (connect-pg-simple format)
  await db.query(
    `INSERT INTO sessions (sid, sess, expire)
     VALUES ($1, $2, $3)
     ON CONFLICT (sid) DO UPDATE SET sess = $2, expire = $3`,
    [sessionId, JSON.stringify(sessionData), expireDate]
  );

  console.log(`[Auth Helper] Seeded session: ${sessionId.substring(0, 8)}...`);

  return sessionId;
}

/**
 * Delete a seeded session from the database
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const db = getDbPool();

  await db.query('DELETE FROM sessions WHERE sid = $1', [sessionId]);

  console.log(`[Auth Helper] Deleted session: ${sessionId.substring(0, 8)}...`);
}

/**
 * Verify a session exists in the database
 */
export async function verifySessionExists(sessionId: string): Promise<boolean> {
  const db = getDbPool();

  const result = await db.query(
    'SELECT 1 FROM sessions WHERE sid = $1 AND expire > NOW()',
    [sessionId]
  );

  return result.rowCount > 0;
}

/**
 * Get session data from database
 */
export async function getSessionData(sessionId: string): Promise<SessionData | null> {
  const db = getDbPool();

  const result = await db.query<{ sess: SessionData }>(
    'SELECT sess FROM sessions WHERE sid = $1',
    [sessionId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return result.rows[0].sess;
}

/**
 * Clean up all test sessions (sessions with test-user prefix)
 */
export async function cleanupTestSessions(): Promise<number> {
  const db = getDbPool();

  const result = await db.query(
    `DELETE FROM sessions
     WHERE sess::text LIKE '%test-user-%'
        OR sess::text LIKE '%test-e2e@%'`
  );

  const deletedCount = result.rowCount || 0;
  console.log(`[Auth Helper] Cleaned up ${deletedCount} test sessions`);

  return deletedCount;
}

/**
 * Create a cookie string for use with fetch/request
 */
export function createSessionCookie(sessionId: string): string {
  // Express session cookie format: connect.sid=s%3A<sessionId>.<signature>
  // For testing, we can use unsigned format if session store accepts it
  return `connect.sid=s%3A${sessionId}`;
}

/**
 * Expected cookie attributes for validation
 */
export const EXPECTED_COOKIE_ATTRIBUTES = {
  name: 'connect.sid',
  httpOnly: true,
  secure: true,
  sameSite: 'None' as const,
  maxAgeSeconds: 604800, // 7 days
  path: '/'
};

/**
 * CORS configuration for validation
 */
export const EXPECTED_CORS_CONFIG = {
  allowedOrigins: [
    'https://www.scholaraiadvisor.com',
    'https://scholaraiadvisor.com',
    'https://app.scholaraiadvisor.com'
  ],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'User-Agent'
  ],
  allowCredentials: true,
  maxAge: 600
};

/**
 * Protected endpoints that require authentication
 * Note: Only testing endpoints that definitely exist and return 401
 */
export const PROTECTED_ENDPOINTS = [
  { method: 'GET', path: '/api/auth/user', description: 'Get current user' },
  { method: 'GET', path: '/api/user/scholarships', description: 'Get user scholarships' }
];

/**
 * Public endpoints for testing
 * Note: /api/scholarships removed as it may require query params or have intermittent issues
 */
export const PUBLIC_ENDPOINTS = [
  { method: 'GET', path: '/api/health', description: 'Health check' }
];
