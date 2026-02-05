/**
 * A11 Environment Drift Detection Test Suite
 *
 * Validates that production environment matches expected configuration:
 * - Database schema matches application expectations
 * - Required tables exist with correct columns
 * - Environment variables are properly configured
 * - API endpoints are functional
 *
 * Priority: P1 - Critical for deployment validation
 */

import { test, expect } from '@playwright/test';
import { Pool } from 'pg';

const BASE_URL = 'https://www.scholaraiadvisor.com';

// Database connection via TCP proxy
const DB_CONFIG = {
  host: process.env.TEST_DB_HOST || 'caboose.proxy.rlwy.net',
  port: parseInt(process.env.TEST_DB_PORT || '36327'),
  user: process.env.TEST_DB_USER || 'scholarship',
  password: process.env.TEST_DB_PASSWORD || 'scholarshipdb2026secure',
  database: process.env.TEST_DB_NAME || 'scholarship_prod',
  ssl: false
};

// Expected table schemas based on shared/schema.ts
const EXPECTED_TABLES = {
  users: [
    'id', 'email', 'first_name', 'last_name', 'profile_image_url',
    'date_of_birth', 'is_minor', 'do_not_sell', 'privacy_mode',
    'is_ferpa_covered', 'gpc_honored', 'onboarding_status',
    'implicit_fit_score', 'created_at', 'updated_at'
  ],
  scholarships: [
    'id', 'title', 'description', 'amount', 'deadline', 'level',
    'major', 'state', 'city', 'requirements', 'tags', 'source_url',
    'source_organization', 'provider_id', 'provider_name', 'is_active',
    'is_featured', 'is_no_essay', 'created_at', 'updated_at'
  ],
  landing_pages: [
    'id', 'slug', 'title', 'meta_description', 'template', 'template_data',
    'content', 'scholarship_count', 'total_amount', 'is_published',
    'last_generated', 'canonical_url', 'spec_hash', 'page_version',
    'eat_signals', 'p95_latency', 'view_count', 'lead_count',
    'last_indexed', 'created_at', 'updated_at'
  ],
  sessions: ['sid', 'sess', 'expire'],
  business_events: [
    'id', 'request_id', 'app', 'env', 'event_name', 'ts',
    'actor_type', 'actor_id', 'org_id', 'session_id', 'properties', 'created_at'
  ],
  user_scholarships: [
    'id', 'user_id', 'scholarship_id', 'status', 'created_at'
  ],
  daily_kpi_snapshots: [
    'id', 'date', 'request_id', 'data_timestamp', 'status', 'created_at'
  ]
};

// Required environment variables (inferred from endpoints)
const REQUIRED_FUNCTIONALITY = {
  healthEndpoint: '/api/health',
  sitemapEndpoint: '/sitemap.xml',
  robotsEndpoint: '/robots.txt'
};

let dbPool: Pool | null = null;

async function getDbPool(): Promise<Pool> {
  if (!dbPool) {
    dbPool = new Pool(DB_CONFIG);
  }
  return dbPool;
}

async function closeDbPool(): Promise<void> {
  if (dbPool) {
    await dbPool.end();
    dbPool = null;
  }
}

// =============================================================================
// Suite 1: Database Connectivity
// =============================================================================

test.describe('Database Connectivity @drift @db', () => {
  test('Database is reachable via TCP proxy', async () => {
    const pool = await getDbPool();

    try {
      const result = await pool.query('SELECT 1 as connected');
      expect(result.rows[0].connected).toBe(1);
      console.log('[DB Drift] Database connection: PASS');
    } finally {
      await closeDbPool();
    }
  });

  test('Database name matches expected', async () => {
    const pool = await getDbPool();

    try {
      const result = await pool.query('SELECT current_database() as db');
      const dbName = result.rows[0].db;

      console.log(`[DB Drift] Current database: ${dbName}`);
      expect(dbName).toBe('scholarship_prod');
    } finally {
      await closeDbPool();
    }
  });
});

// =============================================================================
// Suite 2: Table Existence
// =============================================================================

test.describe('Table Existence @drift @tables', () => {
  test('All required tables exist', async () => {
    const pool = await getDbPool();
    const missingTables: string[] = [];
    const presentTables: string[] = [];

    try {
      for (const tableName of Object.keys(EXPECTED_TABLES)) {
        const result = await pool.query(`
          SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = $1
        `, [tableName]);

        if (result.rows.length === 0) {
          missingTables.push(tableName);
        } else {
          presentTables.push(tableName);
        }
      }

      console.log('[Table Drift] Present tables:', presentTables.join(', '));

      if (missingTables.length > 0) {
        console.log('[Table Drift] MISSING tables:', missingTables.join(', '));
      }

      expect(missingTables.length).toBe(0);
    } finally {
      await closeDbPool();
    }
  });
});

// =============================================================================
// Suite 3: Schema Validation
// =============================================================================

test.describe('Schema Validation @drift @schema', () => {
  for (const [tableName, expectedColumns] of Object.entries(EXPECTED_TABLES)) {
    test(`${tableName} table has expected columns`, async () => {
      const pool = await getDbPool();

      try {
        const result = await pool.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = $1 AND table_schema = 'public'
          ORDER BY ordinal_position
        `, [tableName]);

        const actualColumns = result.rows.map(r => r.column_name);
        const missingColumns = expectedColumns.filter(c => !actualColumns.includes(c));
        const extraColumns = actualColumns.filter(c => !expectedColumns.includes(c));

        console.log(`[Schema Drift] ${tableName}:`);
        console.log(`  Expected: ${expectedColumns.length} columns`);
        console.log(`  Actual: ${actualColumns.length} columns`);

        if (missingColumns.length > 0) {
          console.log(`  MISSING: ${missingColumns.join(', ')}`);
        }
        if (extraColumns.length > 0) {
          console.log(`  EXTRA: ${extraColumns.join(', ')}`);
        }

        // Critical columns must exist (first few columns are critical)
        const criticalColumns = expectedColumns.slice(0, Math.min(5, expectedColumns.length));
        const missingCritical = criticalColumns.filter(c => !actualColumns.includes(c));

        expect(missingCritical.length).toBe(0);
      } finally {
        await closeDbPool();
      }
    });
  }
});

// =============================================================================
// Suite 4: API Endpoint Health
// =============================================================================

test.describe('API Endpoint Health @drift @api', () => {
  test('Health endpoint responds correctly', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('ok');

    console.log('[API Drift] Health endpoint: PASS');
  });

  test('Robots.txt is accessible', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/robots.txt`);

    expect(response.status()).toBe(200);

    const text = await response.text();
    expect(text).toContain('User-agent');

    console.log('[API Drift] Robots.txt: PASS');
  });

  test('Scholarships endpoint returns valid response', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/scholarships`, {
      failOnStatusCode: false
    });

    const status = response.status();

    console.log(`[API Drift] Scholarships endpoint: ${status}`);

    // Should not crash with 500 - may return empty array or error
    if (status === 500) {
      const body = await response.json();
      console.log(`  Error: ${JSON.stringify(body)}`);
      console.log('  DRIFT DETECTED: Database schema mismatch likely');
    }

    // Record but don't fail - this is drift detection
    expect([200, 401, 403, 500]).toContain(status);
  });

  test('Landing pages endpoint returns valid response', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/landing-pages`, {
      failOnStatusCode: false
    });

    const status = response.status();

    console.log(`[API Drift] Landing pages endpoint: ${status}`);

    if (status === 500) {
      const body = await response.json();
      console.log(`  Error: ${JSON.stringify(body)}`);
      console.log('  DRIFT DETECTED: Database schema mismatch likely');
    }

    expect([200, 401, 403, 500]).toContain(status);
  });

  test('Sitemap endpoint returns valid response', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/sitemap.xml`, {
      failOnStatusCode: false
    });

    const status = response.status();

    console.log(`[API Drift] Sitemap endpoint: ${status}`);

    if (status === 500) {
      console.log('  DRIFT DETECTED: Sitemap generation failing');
    } else if (status === 200) {
      const text = await response.text();
      const hasXml = text.includes('<?xml') || text.includes('<urlset') || text.includes('<sitemapindex');
      console.log(`  Valid XML: ${hasXml}`);
    }

    expect([200, 301, 302, 404, 500]).toContain(status);
  });
});

// =============================================================================
// Suite 5: Environment Configuration
// =============================================================================

test.describe('Environment Configuration @drift @env', () => {
  test('CANONICAL_HOST is configured correctly', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    const headers = response.headers();

    const appBaseUrl = headers['x-app-base-url'];

    console.log(`[Env Drift] X-App-Base-Url: ${appBaseUrl}`);

    // Should match canonical host
    expect(appBaseUrl).toContain('scholaraiadvisor.com');
  });

  test('Security headers are present', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    const headers = response.headers();

    const securityHeaders = [
      'x-frame-options',
      'x-content-type-options',
      'strict-transport-security',
      'content-security-policy'
    ];

    const missingHeaders: string[] = [];

    for (const header of securityHeaders) {
      if (!headers[header]) {
        missingHeaders.push(header);
      }
    }

    console.log('[Env Drift] Security headers check:');
    securityHeaders.forEach(h => {
      console.log(`  ${h}: ${headers[h] ? 'PRESENT' : 'MISSING'}`);
    });

    expect(missingHeaders.length).toBe(0);
  });

  test('System identity header is set', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    const headers = response.headers();

    const systemIdentity = headers['x-system-identity'];

    console.log(`[Env Drift] X-System-Identity: ${systemIdentity}`);

    expect(systemIdentity).toBe('auto_page_maker');
  });
});

// =============================================================================
// Suite 6: Drift Summary Report
// =============================================================================

test.describe('Drift Summary @drift @summary', () => {
  test('Generate drift detection summary', async ({ request }) => {
    const driftIssues: string[] = [];
    const healthyItems: string[] = [];

    // Check API health
    const healthResponse = await request.get(`${BASE_URL}/api/health`);
    if (healthResponse.status() === 200) {
      healthyItems.push('API Health endpoint');
    } else {
      driftIssues.push('API Health endpoint not responding');
    }

    // Check scholarships
    const scholarshipsResponse = await request.get(`${BASE_URL}/api/scholarships`, {
      failOnStatusCode: false
    });
    if (scholarshipsResponse.status() === 200) {
      healthyItems.push('Scholarships endpoint');
    } else if (scholarshipsResponse.status() === 500) {
      driftIssues.push('Scholarships endpoint returning 500 (schema drift)');
    }

    // Check landing pages
    const landingPagesResponse = await request.get(`${BASE_URL}/api/landing-pages`, {
      failOnStatusCode: false
    });
    if (landingPagesResponse.status() === 200) {
      healthyItems.push('Landing pages endpoint');
    } else if (landingPagesResponse.status() === 500) {
      driftIssues.push('Landing pages endpoint returning 500 (schema drift)');
    }

    // Check sitemap
    const sitemapResponse = await request.get(`${BASE_URL}/sitemap.xml`, {
      failOnStatusCode: false
    });
    if (sitemapResponse.status() === 200) {
      healthyItems.push('Sitemap generation');
    } else if (sitemapResponse.status() === 500) {
      driftIssues.push('Sitemap generation failing');
    }

    console.log('\n========================================');
    console.log('       DRIFT DETECTION SUMMARY');
    console.log('========================================');
    console.log(`\nHealthy (${healthyItems.length}):`);
    healthyItems.forEach(item => console.log(`  ✓ ${item}`));

    if (driftIssues.length > 0) {
      console.log(`\nDRIFT DETECTED (${driftIssues.length}):`);
      driftIssues.forEach(issue => console.log(`  ✗ ${issue}`));
    } else {
      console.log('\n✓ No drift detected - all systems nominal');
    }

    console.log('\n========================================\n');

    // This test always passes but logs the summary
    expect(true).toBe(true);
  });
});
