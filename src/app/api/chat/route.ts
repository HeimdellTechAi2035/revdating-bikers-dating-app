import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getChatList } from '@/lib/chat';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chat
 * Returns the current user's active match/chat list, sorted by most recent
 * message. Each item includes the other user's profile, last message preview,
 * unread count, and superlike flags.
 *
 * Used by the matches/chat list page and the unread badge in the nav.
 */
export async function GET() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const chats = await getChatList(user.id);
    return NextResponse.json({ chats });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch chat list';
    console.error('[GET /api/chat]', msg);
    return NextResponse.json({ error: 'Failed to fetch chat list' }, { status: 500 });
  }
}
