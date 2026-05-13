import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { reportPhoto } from '@/lib/moderation/index';
import { z } from 'zod';

const schema = z.object({
  reason: z.enum(['inappropriate_photos', 'underage', 'fake_profile', 'other']),
  description: z.string().max(500).optional(),
});

/**
 * POST /api/photos/[photoId]/report
 * Reports a profile photo. The photo owner is not notified.
 * Status is always 'pending' for admin review.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { photoId: string } },
) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { photoId } = params;
  if (!photoId) {
    return NextResponse.json({ error: 'Missing photoId' }, { status: 400 });
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
    await reportPhoto(photoId, user.id, reason, description);
    // Generic success — never reveal moderation outcome to reporter
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to submit report';
    if (message.includes('not found')) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }
    if (message.includes('own photo')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('[POST /api/photos/report]', message);
    return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 });
  }
}
