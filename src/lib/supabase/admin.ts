import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';
import { isDevBypassEnabled } from '@/lib/dev-bypass';
import { createStubClient } from '@/lib/supabase/stub';
import { isNextProductionBuild, validateProductionEnv } from '@/lib/env';

// Service-role client — bypasses RLS.
// ONLY use in server-side code (API routes, server actions).
// NEVER expose to the browser.
export function createAdminClient() {
  if (isDevBypassEnabled()) return createStubClient();

  validateProductionEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    if (isNextProductionBuild()) return createStubClient();
    throw new Error('Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  return createClient<Database>(
    url,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
