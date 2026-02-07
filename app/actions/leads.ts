'use server';

import { requireAuth } from '@/lib/supabase/server';
import { LeadOperations } from '@/db/operations';

export async function getLeads() {
  await requireAuth();
  return LeadOperations.getAll();
}
