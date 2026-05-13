import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Crown, Check } from 'lucide-react';
import { STRIPE_PRICES } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

const FEATURES_FREE = [
  '20 swipes per day',
  '3 superlikes per week',
  'Real-time chat',
  'Basic discovery',
];

const FEATURES_PREMIUM = [
  'Unlimited swipes',
  'See who liked you',
  '10 Ride With actions per week',
  'Profile boost for 1 hour',
  'Priority in discovery',
  'Filter by bike type',
  'Filter by riding style',
  'Filter by dating intent',
  'Verified riders only filter',
  'Read receipts',
];

export default async function PremiumPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_premium')
    .eq('id', user.id)
    .single();

  if (profile?.is_premium) {
    return (
      <div className="px-5 py-8 flex flex-col items-center text-center">
        <Crown className="w-16 h-16 text-brand-orange mb-4" />
        <h1 className="text-2xl font-bold mb-2">You're Premium</h1>
        <p className="text-brand-chrome mb-6">All premium features are unlocked for you.</p>
        <Link href="/settings" className="text-brand-orange hover:underline">Manage subscription</Link>
      </div>
    );
  }

  return (
    <div className="px-5 py-6 space-y-6">
      <div className="text-center">
        <Crown className="w-12 h-12 text-brand-orange mx-auto mb-3" />
        <h1 className="text-2xl font-bold">REVdating Premium</h1>
        <p className="text-brand-chrome mt-1 text-sm">Unlock the full biker dating experience</p>
      </div>

      {/* Plan cards */}
      <div className="space-y-3">
        {/* Monthly */}
        <form action="/api/stripe/checkout" method="POST">
          <input type="hidden" name="price_id" value={STRIPE_PRICES.rider_plus_monthly} />
          <button type="submit" className="w-full p-5 rounded-2xl bg-brand-dark-3 border border-brand-dark-4 hover:border-brand-orange/50 transition-all text-left">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="font-bold text-lg">Monthly</p>
                <p className="text-brand-chrome text-sm">Cancel anytime</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-brand-orange">£9.99</p>
                <p className="text-brand-chrome text-xs">per month</p>
              </div>
            </div>
            <div className="space-y-2">
              {FEATURES_PREMIUM.map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-brand-orange flex-shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </button>
        </form>

        {/* Yearly — best value */}
        <form action="/api/stripe/checkout" method="POST">
          <input type="hidden" name="price_id" value={STRIPE_PRICES.rider_plus_yearly} />
          <button type="submit" className="w-full p-5 rounded-2xl bg-gradient-brand border border-brand-orange/30 hover:opacity-90 transition-all text-left relative overflow-hidden">
            <div className="absolute top-3 right-3 bg-white text-brand-orange text-xs font-bold px-2 py-0.5 rounded-full">
              Best value
            </div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="font-bold text-lg text-white">Yearly</p>
                <p className="text-white/70 text-sm">Save 40%</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">£71.99</p>
                <p className="text-white/70 text-xs">£6/month</p>
              </div>
            </div>
            <div className="space-y-2">
              {FEATURES_PREMIUM.map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm text-white">
                  <Check className="w-4 h-4 text-white flex-shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </button>
        </form>
      </div>

      {/* Free tier comparison */}
      <div className="p-4 rounded-2xl bg-brand-dark-3 border border-brand-dark-4">
        <p className="text-sm font-semibold text-brand-chrome mb-3">Free plan includes:</p>
        <div className="space-y-1.5">
          {FEATURES_FREE.map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm text-brand-chrome">
              <Check className="w-3.5 h-3.5 text-brand-chrome-dark flex-shrink-0" />
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-brand-chrome-dark">
        Subscriptions auto-renew. Cancel anytime from Settings. UK prices include VAT.
      </p>
    </div>
  );
}
