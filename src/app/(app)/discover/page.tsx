import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { isDevBypassEnabled } from '@/lib/dev-bypass';
import { SwipeDeck } from '@/components/discover/SwipeDeck';
import { toViewerProfile } from '@/lib/compatibility';
import { getUserEntitlements } from '@/lib/premium';
import { getDiscoveryProfiles } from '@/lib/discovery';
import type { ActiveFilters } from '@/components/discover/DiscoverFilters';
import type { DiscoveryCandidate } from '@/types/database.types';
import type { PremiumEntitlements } from '@/lib/premium';

export const dynamic = 'force-dynamic';

export default async function DiscoverPage() {
  // Explicit DEV_BYPASS_AUTH preview: skip Supabase and render an empty deck.
  if (isDevBypassEnabled()) {
    const devEntitlements: PremiumEntitlements = {
      plan: 'free',
      canSeeWhoLiked: false,
      advancedFilters: false,
      filterByBikeType: false,
      filterByRidingStyle: false,
      filterByDatingIntent: false,
      unlimitedRevs: false,
      boostProfile: false,
      priorityDiscovery: false,
      revCreditsPerWeek: 3,
    };
    return (
      <div className="flex flex-col h-[calc(100vh-80px)]">
        <div className="flex items-center justify-between px-5 py-4">
          <span className="font-display text-2xl text-brand-orange tracking-wider">REVdating</span>
          <div className="flex items-center gap-3 text-sm text-brand-chrome">
            <span>20 swipes left</span>
            <span className="text-brand-orange font-medium">⭐ 0</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-medium">DEV</span>
          </div>
        </div>
        <div className="flex-1 relative">
          <SwipeDeck
            initialCandidates={[] as DiscoveryCandidate[]}
            viewerProfile={toViewerProfile({}, null)}
            superlikesRemaining={0}
            swipesRemaining={20}
            entitlements={devEntitlements}
            initialFilters={undefined}
            activeBoostedUntil={null}
          />
        </div>
      </div>
    );
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Server-side entitlements — source of truth (reads subscriptions table)
  const entitlements = await getUserEntitlements(user.id);

  // Fetch discovery candidates (fully enriched, sorted) + session data in parallel.
  // getDiscoveryProfiles uses the admin client internally and handles all filtering.
  const [
    candidates,
    { data: viewerRow },
    { data: viewerBike },
    { data: credits },
    { data: swipeCount },
    { data: savedFilters },
    { data: activeBoost },
  ] = await Promise.all([
    getDiscoveryProfiles(user.id, { limit: 10 }).catch((err) => {
      console.error('[discover] getDiscoveryProfiles failed:', err instanceof Error ? err.message : err);
      return [];
    }),
    supabase
      .from('profiles')
      .select(
        'riding_style, dating_intent, max_distance_miles, ' +
        'music_taste, attends_rallies, smoker, drinker, has_passenger_helmet',
      )
      .eq('id', user.id)
      .single(),
    supabase
      .from('bikes')
      .select('bike_type')
      .eq('user_id', user.id)
      .eq('primary_bike', true)
      .limit(1)
      .single(),
    supabase
      .from('superlike_credits')
      .select('credits')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('daily_swipe_counts')
      .select('count, reset_date')
      .eq('user_id', user.id)
      .single(),
    // Saved discovery filters (premium feature)
    entitlements.advancedFilters
      ? supabase
          .from('discovery_filters')
          .select('bike_types, riding_styles, dating_intents, verified_only, club_types')
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    // Active profile boost
    entitlements.boostProfile
      ? supabase
          .from('profile_boosts')
          .select('expires_at')
          .eq('user_id', user.id)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const today = new Date().toISOString().split('T')[0];
  const dailySwipesUsed =
    swipeCount?.reset_date === today ? (swipeCount?.count ?? 0) : 0;

  const FREE_DAILY_LIMIT = 20;
  const swipesRemaining = entitlements.unlimitedRevs
    ? null // unlimited
    : Math.max(0, FREE_DAILY_LIMIT - dailySwipesUsed);

  // viewerProfile is still needed as a SwipeDeck prop for client-side re-scoring
  // when the deck refills via the API route.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerProfile = toViewerProfile((viewerRow ?? {}) as any, viewerBike?.bike_type ?? null);

  // Map saved filters to component format
  const initialFilters: ActiveFilters | undefined = savedFilters
    ? {
        bike_types:     (savedFilters.bike_types     as string[] | null) ?? [],
        riding_styles:  (savedFilters.riding_styles  as string[] | null) ?? [],
        dating_intents: (savedFilters.dating_intents as string[] | null) ?? [],
        verified_only:  savedFilters.verified_only ?? false,
        club_types:     (savedFilters.club_types     as string[] | null) ?? [],
      }
    : undefined;

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <span className="font-display text-2xl text-brand-orange tracking-wider">REVdating</span>
        <div className="flex items-center gap-3 text-sm text-brand-chrome">
          {swipesRemaining !== null && (
            <span className={swipesRemaining < 5 ? 'text-red-400' : ''}>
              {swipesRemaining} swipes left
            </span>
          )}
          <span className="text-brand-orange font-medium">
            ⭐ {credits?.credits ?? 0}
          </span>
        </div>
      </div>

      {/* Swipe deck */}
      <div className="flex-1 relative">
        <SwipeDeck
          initialCandidates={candidates as DiscoveryCandidate[]}
          viewerProfile={viewerProfile}
          superlikesRemaining={credits?.credits ?? 0}
          swipesRemaining={swipesRemaining}
          entitlements={entitlements}
          initialFilters={initialFilters}
          activeBoostedUntil={activeBoost?.expires_at ?? null}
        />
      </div>
    </div>
  );
}

