import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { reportMessage } from '@/lib/moderation/index';
import { z } from 'zod';

const schema = z.object({
  reason: z.enum(['harassment', 'spam', 'hate_speech', 'other']),
  description: z.string().max(500).optional(),
});

/**
 * POST /api/messages/[messageId]/report
 * Reports the sender of a message.
 * The reported user is never notified of the report.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { messageId: string } },
) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { messageId } = params;
  if (!messageId) {
    return NextResponse.json({ error: 'Missing messageId' }, { status: 400 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { reason, description } = parsed.data;

  try {
    await reportMessage(messageId, user.id, reason, description);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to submit report';
    if (message.includes('not found')) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }
    if (message.includes('own message') || message.includes('Not authorized')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('[POST /api/messages/report]', message);
    return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 });
  }
}
