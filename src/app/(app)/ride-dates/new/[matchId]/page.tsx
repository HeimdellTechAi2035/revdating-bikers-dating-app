import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import NewRideDateForm from '@/components/ride-dates/NewRideDateForm';

export const dynamic = 'force-dynamic';

interface Props {
  params: { matchId: string };
}

export default async function NewRideDatePage({ params }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Verify the user is a participant in this match
  const { data: match } = await supabase
    .from('matches')
    .select('id, user1_id, user2_id, is_active')
    .eq('id', params.matchId)
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .single();

  if (!match) notFound();
  if (!match.is_active) redirect(`/chat/${params.matchId}`);

  const otherId = match.user1_id === user.id ? match.user2_id : match.user1_id;

  const { data: otherProfile } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('id', otherId)
    .single();

  // Check if a pending invite already exists for this match
  const { data: existing } = await supabase
    .from('ride_dates')
    .select('id, status')
    .eq('match_id', params.matchId)
    .eq('status', 'pending')
    .maybeSingle();

  return (
    <NewRideDateForm
      matchId={params.matchId}
      otherUserName={otherProfile?.display_name ?? 'your match'}
      existingPendingId={existing?.id ?? null}
    />
  );
}
