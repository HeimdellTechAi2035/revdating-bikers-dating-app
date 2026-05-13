import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';
import { isDevBypassEnabled } from '@/lib/dev-bypass';
import { createStubClient } from '@/lib/supabase/stub';

export function createClient(): SupabaseClient<Database> {
  if (isDevBypassEnabled()) return createStubClient();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return createStubClient();

  return createBrowserClient<Database>(url, key) as unknown as SupabaseClient<Database>;
}
