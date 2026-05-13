import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendMessage, getMessages } from '@/lib/chat';
import { checkRateLimit, tooManyRequestsResponse } from '@/lib/rate-limit';
import { z } from 'zod';

// ── POST /api/messages ─────────────────────────────────────────
// Send a message in a match.
// Enforces: active match, participant, not banned, not blocked, non-empty.
// Supabase Realtime broadcasts the INSERT automatically (migration 016).

const postSchema = z.object({
  match_id: z.string().uuid(),
  content:  z.string().min(1).max(2000).trim(),
});

export async function POST(request: NextRequest) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 60 messages per minute per user
  const rl = checkRateLimit(`msg:${user.id}`, 60, 60_000);
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetAt);

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { match_id, content } = parsed.data;

  try {
    const message = await sendMessage(match_id, user.id, content);
    return NextResponse.json({ success: true, message });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to send message';
    if (msg.includes('not found') || msg.includes('not a participant')) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (msg.includes('active') || msg.includes('blocked') || msg.includes('suspended')) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    if (msg.includes('empty') || msg.includes('limit')) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error('[POST /api/messages]', msg);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

// ── GET /api/messages?match_id=<uuid>&limit=<n>&before=<iso> ──
// Fetch messages for a match (paginated, oldest-first).
// Validates the requesting user is a participant.

export async function GET(request: NextRequest) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const matchId = url.searchParams.get('match_id');
  const limit   = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '50')));
  const before  = url.searchParams.get('before') ?? undefined;

  if (!matchId) {
    return NextResponse.json({ error: 'Missing match_id' }, { status: 400 });
  }

  try {
    const messages = await getMessages(matchId, user.id, { limit, before });
    return NextResponse.json({ messages });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch messages';
    if (msg.includes('not found') || msg.includes('not a participant')) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    console.error('[GET /api/messages]', msg);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}
