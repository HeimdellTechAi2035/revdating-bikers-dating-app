/**
 * lib/badges/index.ts
 *
 * Canonical server-side badge awarding logic for REVdating.
 *
 * All functions use the admin client and are intended for API routes /
 * server actions only — never import this in client components.
 *
 * Badge catalogue:
 *   first_match      (social)        — earned their first mutual match
 *   five_matches     (social)        — earned 5 mutual matches
 *   first_message    (communication) — sent their first message
 *   first_ride_date  (activity)      — planned their first ride date
 *   verified_rider   (trust)         — profile became verified
 *   trusted_rider    (trust)         — verified + 5+ active matches
 *   revved_up        (activity)      — sent their first Rev (super-like)
 *
 * Rules enforced:
 *   • Awarding is idempotent — no duplicate badges ever written
 *   • All writes go through the admin client (bypasses RLS)
 *   • No badge logic runs on the client — every export is server-only
 *   • Badge failures are non-fatal: callers catch and log, never surface to users
 *
 * DB triggers in 010_badges.sql and 018_revved_up_badge.sql provide a
 * secondary guarantee at the database layer. These JS functions are the
 * primary path for badges triggered by complex server-side business logic
 * (e.g. match creation via createSwipe).
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { BadgeNameType, BadgeTypeCategory, UserBadgeRow } from '@/types/database.types';

// ---------------------------------------------------------------------------
// Badge metadata — single source of truth for name → type mapping
// ---------------------------------------------------------------------------

export const BADGE_META: Record<BadgeNameType, { type: BadgeTypeCategory; label: string; description: string }> = {
  first_match:     { type: 'social',        label: 'First Match',          description: 'Earned your first mutual match' },
  five_matches:    { type: 'social',        label: 'Five Matches',         description: 'Earned 5 mutual matches' },
  first_message:   { type: 'communication', label: 'First Message',        description: 'Sent your first message' },
  first_ride_date: { type: 'activity',      label: 'Ride Date Planner',    description: 'Planned your first ride date' },
  verified_rider:  { type: 'trust',         label: 'Verified Rider',       description: 'Identity verified by REVdating' },
  trusted_rider:   { type: 'trust',         label: 'Trusted Rider',        description: 'Verified and established in the community' },
  revved_up:       { type: 'activity',      label: 'Revved Up',            description: 'Sent your first Rev (super-like)' },
};

// ---------------------------------------------------------------------------
// awardBadge — core idempotent helper
// ---------------------------------------------------------------------------

/**
 * Awards a badge to a user if they do not already hold it.
 *
 * Silently no-ops on duplicate (idempotent). Safe to call multiple times.
 * Throws on unexpected database errors.
 *
 * @returns true  — badge newly awarded
 * @returns false — user already held this badge
 */
export async function awardBadge(
  userId:    string,
  badgeName: BadgeNameType,
  badgeType: BadgeTypeCategory,
): Promise<boolean> {
  const admin = createAdminClient();

  const { error } = await admin
    .from('user_badges')
    .insert({ user_id: userId, badge_name: badgeName, badge_type: badgeType });

  if (error) {
    if (error.code === '23505') return false; // unique violation — already held
    throw new Error(`awardBadge: failed to award '${badgeName}' to ${userId} — ${error.message}`);
  }

  return true;
}

// ---------------------------------------------------------------------------
// getUserBadges — for profile display
// ---------------------------------------------------------------------------

/**
 * Returns all badges earned by a user, ordered by earned_at ascending.
 * Intended for profile display (works for own profile and other users' profiles,
 * since badges are publicly visible).
 */
export async function getUserBadges(userId: string): Promise<UserBadgeRow[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('user_badges')
    .select('*')
    .eq('user_id', userId)
    .order('earned_at', { ascending: true });

  if (error) throw new Error(`getUserBadges: ${error.message}`);

  return (data ?? []) as UserBadgeRow[];
}

// ---------------------------------------------------------------------------
// checkAndAwardMatchBadges
// ---------------------------------------------------------------------------

/**
 * Checks the user's active match count and awards:
 *   • first_match   — on their first ever match
 *   • five_matches  — when they reach 5 active matches
 *   • trusted_rider — when verified + 5+ active matches
 *
 * Call this immediately after a match row is created (e.g. in createSwipe).
 * The DB trigger in 010_badges.sql is a secondary safety net.
 */
export async function checkAndAwardMatchBadges(userId: string): Promise<void> {
  const admin = createAdminClient();

  const [{ count: matchCount }, { data: profile }] = await Promise.all([
    admin
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .eq('is_active', true),
    admin
      .from('profiles')
      .select('is_verified')
      .eq('id', userId)
      .single(),
  ]);

  const count = matchCount ?? 0;

  if (count >= 1) await awardBadge(userId, 'first_match', 'social');
  if (count >= 5) await awardBadge(userId, 'five_matches', 'social');
  if (count >= 5 && profile?.is_verified) {
    await awardBadge(userId, 'trusted_rider', 'trust');
  }
}

// ---------------------------------------------------------------------------
// checkAndAwardRevvedUp
// ---------------------------------------------------------------------------

/**
 * Awards the 'revved_up' badge the first time a user sends a Rev swipe.
 * Call this after inserting a swipe with action = 'rev'.
 */
export async function checkAndAwardRevvedUp(userId: string): Promise<void> {
  await awardBadge(userId, 'revved_up', 'activity');
}

// ---------------------------------------------------------------------------
// checkAndAwardMessageBadge
// ---------------------------------------------------------------------------

/**
 * Awards the 'first_message' badge on the sender's first message.
 * Call this after successfully inserting a message row.
 */
export async function checkAndAwardMessageBadge(senderId: string): Promise<void> {
  await awardBadge(senderId, 'first_message', 'communication');
}

// ---------------------------------------------------------------------------
// checkAndAwardRideDateBadge
// ---------------------------------------------------------------------------

/**
 * Awards the 'first_ride_date' badge when a user's ride date is accepted
 * (i.e. a safety_checkin has been created for them).
 * Call this after acceptRideDate() creates safety_checkins.
 */
export async function checkAndAwardRideDateBadge(userId: string): Promise<void> {
  await awardBadge(userId, 'first_ride_date', 'activity');
}

// ---------------------------------------------------------------------------
// checkAndAwardVerificationBadges
// ---------------------------------------------------------------------------

/**
 * Awards trust badges when a user's profile is marked verified.
 *   • verified_rider — always awarded on verification
 *   • trusted_rider  — awarded if they also have 5+ active matches
 *
 * Call this after setting is_verified = true on a profile.
 */
export async function checkAndAwardVerificationBadges(userId: string): Promise<void> {
  const admin = createAdminClient();

  await awardBadge(userId, 'verified_rider', 'trust');

  const { count } = await admin
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .eq('is_active', true);

  if ((count ?? 0) >= 5) {
    await awardBadge(userId, 'trusted_rider', 'trust');
  }
}
