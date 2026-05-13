import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BottomNav } from '@/components/layout/BottomNav';
import { isDevBypassEnabled } from '@/lib/dev-bypass';
import OnlineHeartbeat from '@/components/shared/OnlineHeartbeat';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Explicit DEV_BYPASS_AUTH preview: skip app auth checks outside production.
  if (!isDevBypassEnabled()) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_complete, is_banned')
      .eq('id', user.id)
      .single();

    if (profile?.is_banned) redirect('/banned');
    if (!profile?.onboarding_complete) redirect('/onboarding');
  }

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col max-w-lg mx-auto">
      <OnlineHeartbeat />
      <main className="flex-1 overflow-y-auto pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}
