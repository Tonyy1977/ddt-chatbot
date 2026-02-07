// scripts/seed-admin.ts - One-time script to create admin user
// Usage: npx tsx scripts/seed-admin.ts
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../db/schema';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@ddt-enterprise.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

async function main() {
  if (!ADMIN_PASSWORD) {
    console.error('Set ADMIN_PASSWORD in .env.local before running this script');
    process.exit(1);
  }

  // Supabase Admin client (service role)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Create auth user
  console.log(`Creating admin user: ${ADMIN_EMAIL}`);
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
  });

  if (authError) {
    console.error('Auth error:', authError.message);
    process.exit(1);
  }

  console.log(`Auth user created: ${authData.user.id}`);

  // Insert into users table
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: false },
  });
  const db = drizzle(pool, { schema });

  await db.insert(schema.users).values({
    id: authData.user.id,
    email: ADMIN_EMAIL,
    name: 'Admin',
    role: 'admin',
  });

  console.log('Admin user inserted into users table');

  await pool.end();
  console.log('Done!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
