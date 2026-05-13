import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: existing } = await supabase
    .from('safety_checkins')
    .select('id, user_id, status')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (!existing) return NextResponse.json({ error: 'Check-in not found' }, { status: 404 });
  if (existing.status === 'resolved') {
    return NextResponse.json({ error: 'Already resolved' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('safety_checkins')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Failed to resolve check-in' }, { status: 500 });
  return NextResponse.json({ checkin: data });
}
