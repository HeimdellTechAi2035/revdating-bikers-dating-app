import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
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
});

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
  }

  const { reported_id, reason, description } = parsed.data;

  if (reported_id === user.id) {
    return NextResponse.json({ error: 'Cannot report yourself' }, { status: 400 });
  }

  // Verify target user exists
  const { data: target } = await admin
    .from('profiles')
    .select('id')
    .eq('id', reported_id)
    .single();

  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Check for duplicate report (within 7 days)
  const { data: existing } = await admin
    .from('reports')
    .select('id')
    .eq('reporter_id', user.id)
    .eq('reported_id', reported_id)
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .single();

  if (existing) {
    return NextResponse.json(
      { error: 'You have already reported this user recently' },
      { status: 409 }
    );
  }

  const { error } = await admin.from('reports').insert({
    reporter_id: user.id,
    reported_id,
    reason,
    description: description ?? null,
  });

  if (error) {
    console.error('Report insert error:', error);
    return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 });
  }

  // Auto-action: if user receives 5+ pending reports, flag for priority review
  const { count } = await admin
    .from('reports')
    .select('*', { count: 'exact', head: true })
    .eq('reported_id', reported_id)
    .eq('status', 'pending');

  if ((count ?? 0) >= 5) {
    console.warn(`User ${reported_id} has ${count} pending reports — priority review needed`);
    // In production: send alert to admin team (email/Slack)
  }

  return NextResponse.json({ success: true });
}
