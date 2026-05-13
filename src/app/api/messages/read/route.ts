import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { markMessagesAsRead } from '@/lib/chat';
import { z } from 'zod';

const schema = z.object({
  match_id: z.string().uuid(),
});

/**
 * POST /api/messages/read
 * Marks all unread messages from the other participant as read (sets
 * is_read = true and read_at = now()).
 *
 * Supabase Realtime broadcasts the UPDATE events automatically, so the
 * sender's client sees the read receipt in real time.
 *
 * Returns the number of messages updated.
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

  const { match_id } = parsed.data;

  try {
    const count = await markMessagesAsRead(match_id, user.id);
    return NextResponse.json({ success: true, marked_read: count });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to mark messages as read';
    if (msg.includes('not found') || msg.includes('not a participant')) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    console.error('[POST /api/messages/read]', msg);
    return NextResponse.json({ error: 'Failed to mark messages as read' }, { status: 500 });
  }
}
