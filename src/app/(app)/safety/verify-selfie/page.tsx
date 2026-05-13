import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import VerifySelfieClient from '@/components/safety/VerifySelfieClient';

export const dynamic = 'force-dynamic';

export default async function VerifySelfiePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Redirect if already pending or approved
  const { data: existing } = await supabase
    .from('verifications')
    .select('status')
    .eq('user_id', user.id)
    .eq('verification_type', 'face_selfie')
    .in('status', ['pending', 'approved'])
    .maybeSingle();

  if (existing?.status === 'approved') redirect('/safety');
  if (existing?.status === 'pending')  redirect('/safety');

  return <VerifySelfieClient />;
}
