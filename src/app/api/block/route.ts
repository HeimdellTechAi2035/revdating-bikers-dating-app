import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { blockUser } from '@/lib/moderation/index';
import { z } from 'zod';

const schema = z.object({
  blocked_id: z.string().uuid(),
  reason: z.string().max(300).optional(),
});

/**
 * POST /api/block
 * Blocks a user.
 * Side effects via blockUser():
 *   - Inserts into blocked_users (idempotent)
 *   - Immediately deactivates any shared active match
 *   - Blocked pair is hidden from discovery, chat, and swipe stack
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { blocked_id, reason } = parsed.data;

  try {
    const result = await blockUser(user.id, blocked_id, reason);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to block user';
    if (message.includes('yourself')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('[POST /api/block]', message);
    return NextResponse.json({ error: 'Failed to block user' }, { status: 500 });
  }
}

/**
 * DELETE /api/block?blocked_id=<uuid>
 * Unblocks a user.
 */
export async function DELETE(request: NextRequest) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const blocked_id = new URL(request.url).searchParams.get('blocked_id');
  if (!blocked_id) {
    return NextResponse.json({ error: 'Missing blocked_id' }, { status: 400 });
  }

  await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', blocked_id);

  return NextResponse.json({ success: true });
}

/**
 * GET /api/block
 * Returns the list of user IDs the current user has blocked.
 */
export async function GET() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('blocked_users')
    .select('blocked_id, created_at')
    .eq('blocker_id', user.id)
    .order('created_at', { ascending: false });

  return NextResponse.json({ blocked: data ?? [] });
}
