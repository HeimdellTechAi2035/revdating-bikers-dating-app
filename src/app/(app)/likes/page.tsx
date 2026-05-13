import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getUserEntitlements } from '@/lib/premium';
import LikesReceivedClient from '@/components/premium/LikesReceivedClient';
import LikesSentClient from '@/components/likes/LikesSentClient';
import Link from 'next/link';
import { Crown, Heart } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: { tab?: string };
}

export default async function LikesPage({ searchParams }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const tab = searchParams.tab === 'received' ? 'received' : 'sent';

  // Server-side entitlement check — only needed for the received tab
  const entitlements = await getUserEntitlements(user.id);

  return (
    <div className="min-h-screen">
      {/* Tab bar */}
      <div className="flex border-b border-brand-dark-4 px-5">
        <Link
          href="/likes"
          className={`flex-1 pb-3 text-sm font-semibold text-center transition-colors ${
            tab === 'sent'
              ? 'text-brand-orange border-b-2 border-brand-orange'
              : 'text-brand-chrome'
          }`}
        >
          You Liked
        </Link>
        <Link
          href="/likes?tab=received"
          className={`flex-1 pb-3 text-sm font-semibold text-center transition-colors ${
            tab === 'received'
              ? 'text-brand-orange border-b-2 border-brand-orange'
              : 'text-brand-chrome'
          }`}
        >
          Liked You
        </Link>
      </div>

      {tab === 'sent' ? (
        <LikesSentClient />
      ) : !entitlements.canSeeWhoLiked ? (
        <div className="px-5 py-8 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-brand-orange/10 flex items-center justify-center mb-5">
            <Heart className="w-10 h-10 text-brand-orange" />
          </div>
          <h1 className="text-2xl font-bold mb-2">See Who Liked You</h1>
          <p className="text-brand-chrome text-sm max-w-xs mb-6 leading-relaxed">
            Upgrade to REVdating Premium to see every rider who has liked your profile — and match instantly.
          </p>
          <Link
            href="/premium"
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-brand-orange text-white font-bold hover:bg-brand-orange/90 transition-colors"
          >
            <Crown className="w-5 h-5" />
            Unlock with Premium
          </Link>
          <p className="text-brand-chrome text-xs mt-4">
            Or keep swiping and match by chance.
          </p>
        </div>
      ) : (
        <LikesReceivedClient />
      )}
    </div>
  );
}
