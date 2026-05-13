/**
 * lib/matching.ts
 *
 * Thin wrappers that delegate to the full compatibility engine in
 * lib/compatibility.ts. Kept for backwards compatibility with
 * any callers using the old flat-argument API.
 */

import type { DiscoveryCandidate } from '@/types/database.types';
import { computeCompatibility, toViewerProfile, type ViewerProfile } from '@/lib/compatibility';

// Re-export the primary types so callers only need one import.
export type { ViewerProfile };
export { computeCompatibility, toViewerProfile };

// ---------------------------------------------------------------------------
// Backwards-compatible flat-argument wrapper
// ---------------------------------------------------------------------------

/**
 * @deprecated Use computeCompatibility(viewer, candidate) from lib/compatibility.ts
 * instead -- it returns labels and a breakdown in addition to the score.
 *
 * Kept so existing call sites (e.g. SwipeDeck) do not break until updated.
 */
export function computeCompatibilityScore(
  candidate: DiscoveryCandidate,
  viewerRidingStyle: string | null,
  viewerDatingIntent: string | null,
  viewerMaxDistanceMiles: number,
): number {
  const viewer = toViewerProfile({
    riding_style:       viewerRidingStyle,
    dating_intent:      viewerDatingIntent,
    max_distance_miles: viewerMaxDistanceMiles,
  });
  return computeCompatibility(viewer, candidate).score;
}

// ---------------------------------------------------------------------------
// Candidate sorting
// ---------------------------------------------------------------------------

/**
 * Sort discovery candidates by compatibility score descending.
 * Premium users always appear first regardless of score.
 */
export function sortCandidates(
  candidates: DiscoveryCandidate[],
  viewer: ViewerProfile,
): DiscoveryCandidate[] {
  return [...candidates].sort((a, b) => {
    if (a.is_premium && !b.is_premium) return -1;
    if (!a.is_premium && b.is_premium) return 1;
    return computeCompatibility(viewer, b).score - computeCompatibility(viewer, a).score;
  });
}

// ---------------------------------------------------------------------------
// Daily swipe limit helpers
// ---------------------------------------------------------------------------

export const FREE_DAILY_SWIPE_LIMIT = 20;
export const FREE_WEEKLY_REV_IT_CREDITS = 3;
export const PREMIUM_WEEKLY_REV_IT_CREDITS = 5;

export function getDailySwipeLimit(isPremium: boolean): number {
  return isPremium ? Infinity : FREE_DAILY_SWIPE_LIMIT;
}

export function getWeeklyRevItLimit(isPremium: boolean): number {
  return isPremium ? PREMIUM_WEEKLY_REV_IT_CREDITS : FREE_WEEKLY_REV_IT_CREDITS;
}

// ---------------------------------------------------------------------------
// Match detection helper
// ---------------------------------------------------------------------------

/**
 * Returns true if a like/superlike from userA on userB should create a match.
 * The DB trigger handles this authoritatively; this is a pre-flight helper.
 */
export function wouldCreateMatch(
  targetPreviousSwipeAction: 'like' | 'superlike' | 'rev' | 'pass' | null,
): boolean {
  return targetPreviousSwipeAction === 'like'
    || targetPreviousSwipeAction === 'superlike'
    || targetPreviousSwipeAction === 'rev';
}