import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

const schema = z.object({
  reported_user_id: z.string().uuid().optional(),
  content_type:     z.enum(['profile', 'photo', 'message', 'chat', 'other']),
  content_id:       z.string().max(200).optional(),
  category:         z.enum([
    'csam',
    'terrorism',
    'violence',
    'trafficking',
    'extremism',
    'other_illegal',
  ]),
  description: z.string().min(10, 'Please provide more detail').max(2000),
});

export async function POST(request: NextRequest) {
  const supabase = createClient();
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
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const admin = createAdminClient();

  const { error } = await admin.from('illegal_content_reports').insert({
    reporter_id:      user.id,
    reported_user_id: parsed.data.reported_user_id ?? null,
    content_type:     parsed.data.content_type,
    content_id:       parsed.data.content_id ?? null,
    category:         parsed.data.category,
    description:      parsed.data.description,
    status:           'open',
  });

  if (error) {
    console.error('[illegal_content_reports] insert error:', error);
    return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 });
  }

  // For CSAM — log explicitly for audit (would also trigger admin notification in production)
  if (parsed.data.category === 'csam') {
    console.error(
      `[CSAM REPORT] reporter=${user.id} reported_user=${parsed.data.reported_user_id ?? 'unknown'} — REQUIRES IMMEDIATE REVIEW`,
    );
  }

  return NextResponse.json({ ok: true });
}
