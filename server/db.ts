import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;
neonConfig.pipelineConnect = 'password'; // Enable connection pipelining

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Optimized connection pool for single Node worker + Neon serverless
// Tuned for P95 <120ms: minimize cold connections, maximize reuse
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 6, // Reduced from default ~10 for single-threaded Node (avoid saturation)
  idleTimeoutMillis: 30000, // 30s - balance between reuse and resource cleanup
  connectionTimeoutMillis: 2000, // 2s - fail fast on connection issues
  maxUses: 500, // Rotate connections after 500 queries to prevent memory leaks
  allowExitOnIdle: false // Keep pool alive for consistent performance
});

export const db = drizzle({ client: pool, schema });
