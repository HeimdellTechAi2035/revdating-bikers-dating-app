import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * DELETE /api/matches/[matchId]
 * Unmatches the current user from the given match.
 * Sets is_active = false. Both participants can trigger this.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { matchId: string } }
) {
  const { matchId } = params;
  if (!matchId) {
    return NextResponse.json({ error: 'Missing matchId' }, { status: 400 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify the current user is a participant before updating
  const { data: match } = await supabase
    .from('matches')
    .select('id, user1_id, user2_id, is_active')
    .eq('id', matchId)
    .single();

  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }

  if (match.user1_id !== user.id && match.user2_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!match.is_active) {
    // Already unmatched — idempotent success
    return NextResponse.json({ success: true });
  }

  const { error } = await supabase
    .from('matches')
    .update({ is_active: false })
    .eq('id', matchId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
