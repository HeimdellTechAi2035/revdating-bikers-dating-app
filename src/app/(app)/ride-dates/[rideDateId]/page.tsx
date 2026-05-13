import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import RideDateView from '@/components/ride-dates/RideDateView';

export const dynamic = 'force-dynamic';

interface Props {
  params: { rideDateId: string };
}

export default async function RideDatePage({ params }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: rideDate } = await supabase
    .from('ride_dates')
    .select('*')
    .eq('id', params.rideDateId)
    .or(`user_one.eq.${user.id},user_two.eq.${user.id}`)
    .single();

  if (!rideDate) notFound();

  // Fetch both participants' display names
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', [rideDate.user_one, rideDate.user_two]);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  return (
    <RideDateView
      rideDate={rideDate}
      currentUserId={user.id}
      userOneName={profileMap.get(rideDate.user_one) ?? 'Rider'}
      userTwoName={profileMap.get(rideDate.user_two) ?? 'Rider'}
    />
  );
}
