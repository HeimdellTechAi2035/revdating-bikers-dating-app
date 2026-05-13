import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import CheckInForm from '@/components/safety/CheckInForm';

export const dynamic = 'force-dynamic';

export default async function CheckInPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('emergency_contact_name, emergency_contact_phone')
    .eq('id', user.id)
    .single();

  return (
    <CheckInForm
      savedContactName={profile?.emergency_contact_name ?? null}
      savedContactPhone={profile?.emergency_contact_phone ?? null}
    />
  );
}
