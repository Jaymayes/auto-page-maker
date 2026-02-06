import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Optimized connection pool for single Node worker + standard PostgreSQL
// Tuned for P95 <120ms: minimize cold connections, maximize reuse
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 6, // Reduced from default ~10 for single-threaded Node (avoid saturation)
  idleTimeoutMillis: 30000, // 30s - balance between reuse and resource cleanup
  connectionTimeoutMillis: 2000, // 2s - fail fast on connection issues
  // Note: maxUses and allowExitOnIdle are not standard pg options
});

export const db = drizzle(pool, { schema });
