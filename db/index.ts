// db/index.ts - Database client with connection pooling
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Use Transaction mode (port 6543) for Supabase pooler — handles connection limits
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

export const db = drizzle(pool, { schema });

// Re-export schema for convenience
export * from './schema';

// Type exports
export type Database = typeof db;
