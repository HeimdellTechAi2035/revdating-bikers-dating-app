'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, X, Bike, RefreshCw, Zap, SlidersHorizontal, Loader2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { SwipeCard } from './SwipeCard';
import { RevItButton } from './RevItButton';
import { computeCompatibility, type ViewerProfile, type CompatibilityResult } from '@/lib/compatibility';
import type { DiscoveryCandidate } from '@/types/database.types';
import BlockReportSheet from '@/components/shared/BlockReportSheet';
import DiscoverFilters, {
  type ActiveFilters,
  hasActiveFilters,
} from './DiscoverFilters';
import BoostButton from '@/components/premium/BoostButton';
import type { PremiumEntitlements } from '@/lib/premium';
import { analytics } from '@/lib/analytics';

// -- Types -------------------------------------------------------------------

type SwipeAction = 'like' | 'pass' | 'rev_it';

interface SwipeDeckProps {
  initialCandidates: DiscoveryCandidate[];
  viewerProfile: ViewerProfile;
  superlikesRemaining: number;
  swipesRemaining: number | null; // null = unlimited (premium)
  /** @deprecated use entitlements.isPremium */
  isPremium?: boolean;
  entitlements: PremiumEntitlements;
  initialFilters?: ActiveFilters;
  activeBoostedUntil?: string | null;
}

interface MatchInfo {
  matchId: string;
  displayName: string;
  photoUrl: string | null;
}

const EMPTY_FILTERS: ActiveFilters = {
  bike_types:     [],
  riding_styles:  [],
  dating_intents: [],
  verified_only:  false,
  club_types:     [],
};

const REVIT_TOOLTIP_KEY = 'REVdating_revit_tooltip_seen';

// -- Component ----------------------------------------------------------------

export function SwipeDeck({
  initialCandidates,
  viewerProfile,
  superlikesRemaining: initialSuperlikes,
  swipesRemaining: initialSwipesLeft,
  entitlements,
  initialFilters,
  activeBoostedUntil = null,
}: SwipeDeckProps) {
  const [candidates, setCandidates]       = useState<DiscoveryCandidate[]>(initialCandidates);
  const [superlikes, setSuperlikes]       = useState(initialSuperlikes);
  const [swipesLeft, setSwipesLeft]       = useState(initialSwipesLeft);
  const [swipingAction, setSwipingAction] = useState<SwipeAction | null>(null);
  const [matchInfo, setMatchInfo]         = useState<MatchInfo | null>(null);
  const [loadingMore, setLoadingMore]     = useState(false);
  const [blockReportOpen, setBlockReportOpen] = useState(false);
  const [filtersOpen, setFiltersOpen]     = useState(false);
  const [filters, setFilters]             = useState<ActiveFilters>(initialFilters ?? EMPTY_FILTERS);
  const [showRevItTooltip, setShowRevItTooltip] = useState(false);
  const loadMoreCalledFor = useRef<number>(0);
  const tooltipTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPremium    = entitlements.plan !== 'free';
  const topCandidate = candidates[0];
  const swiping      = swipingAction !== null;

  // Show Rev It tooltip once per device
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem(REVIT_TOOLTIP_KEY)) {
      // Small delay so it doesn't fight the initial render
      tooltipTimer.current = setTimeout(() => setShowRevItTooltip(true), 1500);
    }
    return () => { if (tooltipTimer.current) clearTimeout(tooltipTimer.current); };
  }, []);

  function dismissRevItTooltip() {
    setShowRevItTooltip(false);
    localStorage.setItem(REVIT_TOOLTIP_KEY, '1');
  }

  // -- Load more when deck runs low -------------------------------------------
  useEffect(() => {
    if (candidates.length < 3 && candidates.length !== loadMoreCalledFor.current && !loadingMore) {
      loadMoreCalledFor.current = candidates.length;
      setLoadingMore(true);

      const excludeParam = candidates.map((c) => c.id).join(',');

      const params = new URLSearchParams();
      params.set('limit', '10');
      if (excludeParam) params.set('exclude', excludeParam);
      if (entitlements.advancedFilters && hasActiveFilters(filters)) {
        if (filters.bike_types.length)     params.set('bike_types',     filters.bike_types.join(','));
        if (filters.riding_styles.length)  params.set('riding_styles',  filters.riding_styles.join(','));
        if (filters.dating_intents.length) params.set('dating_intents', filters.dating_intents.join(','));
        if (filters.verified_only)         params.set('verified_only',  'true');
        if (filters.club_types.length)     params.set('club_types',     filters.club_types.join(','));
      }

      fetch(`/api/discover/candidates?${params.toString()}`)
        .then((r) => r.json())
        .then((data) => {
          const incoming: DiscoveryCandidate[] = data.candidates ?? [];
          if (incoming.length > 0) {
            setCandidates((prev) => {
              const existingIds = new Set(prev.map((c) => c.id));
              return [...prev, ...incoming.filter((c) => !existingIds.has(c.id))];
            });
          }
        })
        .catch(() => {})
        .finally(() => setLoadingMore(false));
    }
  }, [candidates, loadingMore, filters, entitlements.advancedFilters]);

  // -- Swipe handler ----------------------------------------------------------

  const swipe = useCallback(async (action: SwipeAction) => {
    if (!topCandidate || swiping) return;

    if (action === 'rev_it' && superlikes <= 0) {
      toast.error('No Rev It credits remaining');
      return;
    }
    if (!isPremium && swipesLeft !== null && swipesLeft <= 0) {
      toast.error('Daily swipe limit reached - upgrade to Premium for unlimited swipes!');
      return;
    }

    setSwipingAction(action);

    const swipedCandidate = topCandidate;
    setCandidates((prev) => prev.slice(1));

    try {
      const res = await fetch('/api/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ swiped_id: swipedCandidate.id, action }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          toast.error(data.error ?? 'Daily limit reached');
        } else {
          toast.error(data.error ?? 'Swipe failed');
        }
        setCandidates((prev) => [swipedCandidate, ...prev]);
        return;
      }

      if (typeof data.swipes_remaining === 'number' || data.swipes_remaining === null) {
        setSwipesLeft(data.swipes_remaining);
      }
      if (typeof data.credits_remaining === 'number') {
        setSuperlikes(data.credits_remaining);
      } else if (action === 'rev_it') {
        setSuperlikes((s) => Math.max(0, s - 1));
      }

      analytics.firstSwipe(action);
      if (action === 'like' || action === 'rev_it') analytics.firstLike();

      if (data.is_match && data.match) {
        analytics.firstMatch();
        setMatchInfo({
          matchId: data.match.match_id,
          displayName: data.match.display_name,
          photoUrl: data.match.photo_url,
        });
      }
    } catch {
      toast.error('Connection error - try again');
      setCandidates((prev) => [swipedCandidate, ...prev]);
    } finally {
      setSwipingAction(null);
    }
  }, [topCandidate, swiping, superlikes, swipesLeft, isPremium]);

  // -- Filter apply handler ---------------------------------------------------
  function handleFiltersApply(newFilters: ActiveFilters) {
    setFilters(newFilters);
    setCandidates([]);
    loadMoreCalledFor.current = -1;
  }

  // -- Empty / limit states ---------------------------------------------------

  if (!isPremium && swipesLeft !== null && swipesLeft <= 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-8 pb-16">
        <div className="w-20 h-20 rounded-full bg-brand-orange/10 flex items-center justify-center">
          <Zap size={32} className="text-brand-orange" />
        </div>
        <h2 className="text-xl font-bold">Daily limit reached</h2>
        <p className="text-brand-chrome">Upgrade to REVdating Premium for unlimited swipes and more Rev It credits.</p>
        <Link href="/premium" className="px-6 py-3 rounded-2xl bg-brand-orange text-white font-semibold hover:bg-brand-orange/90 transition-colors">
          Go Premium
        </Link>
      </div>
    );
  }

  // Zero results with active filters → offer to broaden search
  if (!topCandidate && !loadingMore && hasActiveFilters(filters)) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-8 pb-16">
        <div className="w-20 h-20 rounded-full bg-brand-dark-3 flex items-center justify-center">
          <SlidersHorizontal size={32} className="text-brand-chrome/60" />
        </div>
        <h2 className="text-xl font-bold">No matches with these filters</h2>
        <p className="text-brand-chrome text-sm">
          Your current filters are limiting results. Broadening your search will show more riders nearby.
        </p>
        <button
          onClick={() => handleFiltersApply(EMPTY_FILTERS)}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-brand-orange text-white font-semibold hover:bg-brand-orange/90 transition-colors"
        >
          <SlidersHorizontal size={16} /> Broaden Search
        </button>
        <button
          onClick={() => setFiltersOpen(true)}
          className="text-brand-chrome text-sm underline"
        >
          Adjust filters instead
        </button>
      </div>
    );
  }

  if (!topCandidate && !loadingMore) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-8 pb-16">
        <div className="w-20 h-20 rounded-full bg-brand-dark-3 flex items-center justify-center">
          <Bike size={32} className="text-brand-chrome/60" />
        </div>
        <h2 className="text-xl font-bold">{"You've seen everyone nearby!"}</h2>
        <p className="text-brand-chrome text-sm">Expand your distance in settings, or check back later as new riders join.</p>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-brand-dark-3 text-brand-chrome text-sm hover:bg-brand-dark-4 transition-colors"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>
    );
  }

  // -- Main deck --------------------------------------------------------------

  const activeFilterCount =
    filters.bike_types.length +
    filters.riding_styles.length +
    filters.dating_intents.length +
    (filters.verified_only ? 1 : 0) +
    filters.club_types.length;

  return (
    <div className="flex flex-col h-full">
      {/* Filter + boost header bar */}
      {(entitlements.advancedFilters || entitlements.boostProfile) && (
        <div className="flex items-center justify-between px-4 py-2 gap-2">
          {entitlements.advancedFilters ? (
            <button
              onClick={() => setFiltersOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-dark-3 border border-brand-dark-4 text-brand-chrome text-xs font-semibold hover:border-brand-orange/50 hover:text-brand-orange transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-brand-orange text-white text-xs font-bold px-1 py-px rounded-full leading-none">
                  {activeFilterCount}
                </span>
              )}
            </button>
          ) : (
            <div />
          )}

          {entitlements.boostProfile && (
            <BoostButton
              initiallyActive={!!activeBoostedUntil && new Date(activeBoostedUntil) > new Date()}
              expiresAt={activeBoostedUntil ?? null}
            />
          )}
        </div>
      )}

      <div className="relative flex-1 mx-4 mt-2">
        {loadingMore && candidates.length <= 1 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-brand-orange border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        <AnimatePresence>
          {candidates.slice(0, 3).reverse().map((candidate, i, arr) => {
            const isTop   = i === arr.length - 1;
            const depth   = arr.length - 1 - i;
            const scale   = 1 - depth * 0.04;
            const yOffset = depth * 10;

            const compatibility: CompatibilityResult | undefined = isTop
              ? computeCompatibility(viewerProfile, candidate)
              : undefined;

            return (
              <div
                key={candidate.id}
                style={{
                  transform: `scale(${scale}) translateY(${yOffset}px)`,
                  zIndex: i,
                  transformOrigin: 'bottom center',
                }}
                className="absolute inset-0"
              >
                <SwipeCard
                  candidate={candidate}
                  onSwipe={swipe}
                  isTop={isTop}
                  compatibility={compatibility}
                  onMoreOptions={isTop ? () => setBlockReportOpen(true) : undefined}
                />
              </div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-5 py-5 relative">
        {/* Pass */}
        <button
          onClick={() => swipe('pass')}
          disabled={swiping || !topCandidate}
          className="w-14 h-14 rounded-full bg-brand-dark-3 border-2 border-red-400/40 flex items-center justify-center shadow-lg hover:border-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
          aria-label="Pass"
        >
          {swipingAction === 'pass'
            ? <Loader2 size={22} className="text-red-400 animate-spin" />
            : <X size={24} className="text-red-400" />}
        </button>

        {/* Rev It — with one-time tooltip */}
        <div className="relative flex flex-col items-center">
          <AnimatePresence>
            {showRevItTooltip && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute bottom-full mb-3 w-52 bg-brand-dark-2 border border-brand-orange/40 rounded-2xl p-3 shadow-xl z-10"
              >
                <p className="text-xs font-bold text-brand-orange mb-0.5">Rev It = Super Like 🏍️</p>
                <p className="text-xs text-brand-chrome leading-relaxed">
                  Tap Rev It to send a strong signal of interest — they&apos;ll see you revved them before they swipe.
                </p>
                {/* Arrow */}
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-brand-dark-2 border-r border-b border-brand-orange/40" />
                <button
                  onClick={dismissRevItTooltip}
                  className="absolute top-2 right-2 text-brand-chrome/50 hover:text-brand-chrome text-xs"
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <RevItButton
            onClick={() => { dismissRevItTooltip(); swipe('rev_it'); }}
            disabled={swiping || superlikes <= 0 || !topCandidate}
            creditsRemaining={superlikes}
            loading={swipingAction === 'rev_it'}
          />
        </div>

        {/* Like */}
        <button
          onClick={() => swipe('like')}
          disabled={swiping || !topCandidate}
          className="w-14 h-14 rounded-full bg-brand-dark-3 border-2 border-green-400/40 flex items-center justify-center shadow-lg hover:border-green-400 hover:bg-green-500/10 transition-colors disabled:opacity-40"
          aria-label="Like"
        >
          {swipingAction === 'like'
            ? <Loader2 size={22} className="text-green-400 animate-spin" />
            : <Heart size={24} className="text-green-400" />}
        </button>
      </div>

      {/* Counters */}
      <div className="flex justify-between px-6 pb-3 text-xs text-brand-chrome">
        <span className="flex items-center gap-1">
          <Bike size={12} className="text-brand-orange" /> {superlikes} rev it
        </span>
        {swipesLeft !== null && (
          <span className={swipesLeft < 5 ? 'text-red-400' : ''}>
            {swipesLeft} swipes left today
          </span>
        )}
      </div>

      {/* Match modal */}
      {matchInfo && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center gap-6 p-8">
          <div className="flex items-center gap-4">
            {matchInfo.photoUrl && (
              <div className="relative w-32 h-32 rounded-3xl overflow-hidden border-4 border-brand-orange shadow-2xl">
                <Image
                  src={matchInfo.photoUrl}
                  alt={matchInfo.displayName}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            )}
          </div>

          <div className="text-center space-y-2">
            <p className="text-brand-chrome text-sm uppercase tracking-widest font-semibold">{"It's a match!"}</p>
            <h2 className="text-3xl font-black text-white">
              You &amp; <span className="text-brand-orange">{matchInfo.displayName}</span>
            </h2>
            <p className="text-brand-chrome text-sm">liked each other. Start the conversation!</p>
          </div>

          <div className="flex flex-col gap-3 w-full max-w-xs">
            <Link
              href={`/chat/${matchInfo.matchId}`}
              className="w-full py-3.5 rounded-2xl bg-brand-orange text-white font-bold text-center hover:bg-brand-orange/90 transition-colors"
            >
              Send a message
            </Link>
            <button
              onClick={() => setMatchInfo(null)}
              className="w-full py-3.5 rounded-2xl bg-brand-dark-3 text-white font-semibold hover:bg-brand-dark-4 transition-colors"
            >
              Keep swiping
            </button>
          </div>
        </div>
      )}

      {/* Block / Report sheet */}
      {blockReportOpen && topCandidate && (
        <BlockReportSheet
          userId={topCandidate.id}
          displayName={topCandidate.display_name}
          onClose={() => setBlockReportOpen(false)}
          onBlocked={() => {
            setCandidates((prev) => prev.filter((c) => c.id !== topCandidate.id));
            setBlockReportOpen(false);
          }}
        />
      )}

      {/* Advanced filters sheet (premium only) */}
      {filtersOpen && entitlements.advancedFilters && (
        <DiscoverFilters
          initialFilters={filters}
          onApply={handleFiltersApply}
          onClose={() => setFiltersOpen(false)}
        />
      )}
    </div>
  );
}
