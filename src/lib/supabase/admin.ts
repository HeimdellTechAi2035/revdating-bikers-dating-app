import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';
import { isDevBypassEnabled } from '@/lib/dev-bypass';
import { createStubClient } from '@/lib/supabase/stub';

// Service-role client — bypasses RLS.
// ONLY use in server-side code (API routes, server actions).
// NEVER expose to the browser.
export function createAdminClient() {
  if (isDevBypassEnabled()) return createStubClient();

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
