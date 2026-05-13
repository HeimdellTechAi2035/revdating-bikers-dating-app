import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';
import { isDevBypassEnabled } from '@/lib/dev-bypass';
import { createStubClient } from '@/lib/supabase/stub';

export function createClient(): SupabaseClient<Database> {
  if (isDevBypassEnabled()) return createStubClient();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return createStubClient();

  const cookieStore = cookies();

  return createServerClient<Database>(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
            );
          } catch {
            // Silently fail in Server Components (cookies are read-only there)
          }
        },
      },
    }
  ) as unknown as SupabaseClient<Database>;
}
