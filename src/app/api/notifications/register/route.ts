import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

const schema = z.object({
  token: z.string().min(1).max(1000),
  platform: z.enum(['web', 'ios', 'android']),
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
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { token, platform } = parsed.data;

  await admin.from('push_tokens').upsert(
    { user_id: user.id, token, platform },
    { onConflict: 'user_id,token' }
  );

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  await admin
    .from('push_tokens')
    .delete()
    .eq('user_id', user.id)
    .eq('token', token);

  return NextResponse.json({ success: true });
}
