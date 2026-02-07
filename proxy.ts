// proxy.ts - Next.js proxy for Supabase Auth (renamed from middleware in Next.js 16)
import { type NextRequest } from 'next/server';
import { updateSession } from './lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match dashboard and auth routes only.
     * Exclude: static files, images, public API routes (chat widget uses these).
     */
    '/(dashboard|login|auth)(.*)',
  ],
};
