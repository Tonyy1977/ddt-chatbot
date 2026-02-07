// db/index.ts - Database client with connection pooling
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// For Supabase: Use Session mode (port 5432) for better ORM compatibility
let connectionString = process.env.DATABASE_URL!;
if (connectionString?.includes('pooler.supabase.com') && connectionString.includes(':6543')) {
  connectionString = connectionString.replace(':6543', ':5432');
}

// Singleton pool for connection reuse
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });

// Re-export schema for convenience
export * from './schema';

// Type exports
export type Database = typeof db;
