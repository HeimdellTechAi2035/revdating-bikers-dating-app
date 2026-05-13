import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isDevBypassEnabled } from '@/lib/dev-bypass';

async function getRevCount(receiverId: string): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from('engine_revs')
    .select('*', { count: 'exact', head: true })
    .eq('receiver_id', receiverId);
  return count ?? 0;
}

export async function POST(request: NextRequest) {
  if (isDevBypassEnabled()) {
    return NextResponse.json({ revved: true, count: 1 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const receiverId = (body as Record<string, unknown>)?.receiverId;
  if (typeof receiverId !== 'string' || !receiverId) {
    return NextResponse.json({ error: 'receiverId is required' }, { status: 400 });
  }
  if (receiverId === user.id) {
    return NextResponse.json({ error: 'Cannot rev your own profile' }, { status: 400 });
  }

  // The hand-maintained Database type collapses all Insert types to `never` in
  // supabase-js v2.45.4 (pre-existing project-wide issue). Cast to bypass.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (supabase.from('engine_revs') as any)
    .insert({ giver_id: user.id, receiver_id: receiverId }) as
    { error: { code: string; message: string } | null };
  // code 23505 = unique_violation — row already exists, that's fine
  if (insertError && insertError.code !== '23505') {
    console.error('[POST /api/revs]', insertError.message);
  }

  const count = await getRevCount(receiverId);
  return NextResponse.json({ revved: true, count });
}

export async function DELETE(request: NextRequest) {
  if (isDevBypassEnabled()) {
    return NextResponse.json({ revved: false, count: 0 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const receiverId = (body as Record<string, unknown>)?.receiverId;
  if (typeof receiverId !== 'string' || !receiverId) {
    return NextResponse.json({ error: 'receiverId is required' }, { status: 400 });
  }
  if (receiverId === user.id) {
    return NextResponse.json({ error: 'Cannot rev your own profile' }, { status: 400 });
  }

  await supabase
    .from('engine_revs')
    .delete()
    .eq('giver_id', user.id)
    .eq('receiver_id', receiverId);

  const count = await getRevCount(receiverId);
  return NextResponse.json({ revved: false, count });
}
