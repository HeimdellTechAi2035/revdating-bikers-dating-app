import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { reportUser } from '@/lib/moderation/index';
import { z } from 'zod';

const schema = z.object({
  reported_id: z.string().uuid(),
  reason: z.enum([
    'inappropriate_photos',
    'harassment',
    'fake_profile',
    'underage',
    'spam',
    'hate_speech',
    'other',
  ]),
  description: z.string().max(1000).optional(),
  /** Optional — when reporting a specific photo */
  photo_id: z.string().uuid().optional(),
});

/**
 * POST /api/report
 * Reports a user (and optionally a specific photo).
 * Status is always 'pending' — the reported user is never notified.
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

  const { reported_id, reason, description, photo_id } = parsed.data;

  try {
    const result = await reportUser(user.id, reported_id, reason, description, photo_id);
    // Always return the same success response — never indicate whether the user
    // was already reported or what happens next (privacy requirement)
    return NextResponse.json({ success: true, already_reported: result.already_reported });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to submit report';
    if (message.includes('yourself')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (message.includes('not found')) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    console.error('[POST /api/report]', message);
    return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 });
  }
}
