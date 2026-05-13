import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deleteAccount } from '@/lib/gdpr';
import { z } from 'zod';

const schema = z.object({
  password:     z.string().min(1, 'Password is required'),
  confirmation: z.literal('DELETE MY ACCOUNT'),
  reason:       z.string().max(1000).optional(),
});

/**
 * POST /api/gdpr/delete
 *
 * Permanently deletes the authenticated user's account under GDPR Art. 17.
 *
 * Security gates:
 *   • Must be authenticated (valid session cookie)
 *   • Must re-authenticate with current password (prevents CSRF)
 *   • Must type "DELETE MY ACCOUNT" as confirmation phrase
 *
 * Delegation: all destructive work is handled by lib/gdpr deleteAccount(),
 * which cancels Stripe, removes storage objects, and cascades the DB delete
 * while preserving anonymised moderation records.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'You must type DELETE MY ACCOUNT to confirm.' },
      { status: 400 },
    );
  }

  // Re-authenticate to prevent session hijack / CSRF
  const { error: authError } = await supabase.auth.signInWithPassword({
    email:    user.email!,
    password: parsed.data.password,
  });
  if (authError) {
    return NextResponse.json(
      { error: 'Incorrect password. Please try again.' },
      { status: 403 },
    );
  }

  try {
    const result = await deleteAccount(user.id, user.email!, parsed.data.reason);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Account deletion failed.';
    console.error('[POST /api/gdpr/delete]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
