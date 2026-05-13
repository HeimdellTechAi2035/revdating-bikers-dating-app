import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

const schema = z.object({
  blocked_id: z.string().uuid(),
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

  const { blocked_id } = parsed.data;

  if (blocked_id === user.id) {
    return NextResponse.json({ error: 'Cannot block yourself' }, { status: 400 });
  }

  // Insert block (trigger will deactivate existing matches)
  const { error } = await admin.from('blocked_users').insert({
    blocker_id: user.id,
    blocked_id,
  });

  if (error) {
    if (error.code === '23505') {
      // Already blocked — idempotent
      return NextResponse.json({ success: true });
    }
    console.error('Block insert error:', error);
    return NextResponse.json({ error: 'Failed to block user' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const blocked_id = url.searchParams.get('blocked_id');

  if (!blocked_id) {
    return NextResponse.json({ error: 'Missing blocked_id' }, { status: 400 });
  }

  await admin
    .from('blocked_users')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', blocked_id);

  return NextResponse.json({ success: true });
}

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: blocks } = await admin
    .from('blocked_users')
    .select('blocked_id, created_at')
    .eq('blocker_id', user.id)
    .order('created_at', { ascending: false });

  if (!blocks?.length) return NextResponse.json({ blocks: [] });

  // Fetch blocked user display names
  const ids = blocks.map((b) => b.blocked_id);
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, display_name')
    .in('id', ids);

  const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);

  return NextResponse.json({
    blocks: blocks.map((b) => ({
      blocked_id: b.blocked_id,
      display_name: profileMap.get(b.blocked_id)?.display_name ?? 'Unknown',
      blocked_at: b.created_at,
    })),
  });
}
