/**
 * lib/swipe/index.ts
 *
 * Server-side swipe and matching logic for REVdating.
 *
 * All functions in this module run ONLY on the server (API routes /
 * server actions). They use the admin client so match creation and
 * badge awarding can bypass RLS while swipe validation remains strict.
 *
 * Canonical column note:
 *   matches.user1_id is always the lexicographically smaller UUID —
 *   enforced by CHECK (user1_id < user2_id). createMatch() handles
 *   the ordering automatically.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import {
  awardBadge,
  checkAndAwardMatchBadges,
  checkAndAwardRevvedUp,
} from '@/lib/badges';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SwipeAction = 'pass' | 'like' | 'rev';

export interface SwipeResult {
  /** The UUID of the newly created swipe row. */
  swipe_id: string;
  /** Whether a match was created as a result of this swipe. */
  match_created: boolean;
  /** The UUID of the newly created match, if one was created. */
  match_id: string | null;
}

// ---------------------------------------------------------------------------
// Helper: usersAreBlocked
// ---------------------------------------------------------------------------

/**
 * Returns true if either user has blocked the other.
 * Checks both directions (A→B and B→A) in a single query.
 */
export async function usersAreBlocked(
  userA: string,
  userB: string,
): Promise<boolean> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('blocked_users')
    .select('id')
    .or(
      `and(blocker_id.eq.${userA},blocked_id.eq.${userB}),` +
      `and(blocker_id.eq.${userB},blocked_id.eq.${userA})`,
    )
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`usersAreBlocked query failed: ${error.message}`);
  return data !== null;
}

// ---------------------------------------------------------------------------
// Helper: createMatch
// ---------------------------------------------------------------------------

/**
 * Inserts a match row for (userA, userB), respecting the canonical
 * ordering constraint user1_id < user2_id.
 *
 * If the match already exists (duplicate swipe race), returns the
 * existing match id rather than throwing.
 *
 * @returns The UUID of the match (existing or newly created).
 */
export async function createMatch(
  userA: string,
  userB: string,
): Promise<string> {
  const admin = createAdminClient();

  // Enforce canonical ordering
  const [user1_id, user2_id] = userA < userB ? [userA, userB] : [userB, userA];

  // Detect superlike flags from each side's swipe record
  const { data: swipes } = await admin
    .from('swipes')
    .select('swiper_id, swipe_action')
    .in('swiper_id', [userA, userB])
    .in('swiped_id', [userA, userB]);

  const swipeMap = new Map(swipes?.map((s) => [s.swiper_id, s.swipe_action]) ?? []);
  const user1Superliked = swipeMap.get(user1_id) === 'rev';
  const user2Superliked = swipeMap.get(user2_id) === 'rev';

  // Upsert: on conflict (user1_id, user2_id) do nothing, then return the row
  const { data: inserted, error: insertError } = await admin
    .from('matches')
    .insert({
      user1_id,
      user2_id,
      user1_superliked: user1Superliked,
      user2_superliked: user2Superliked,
      is_active: true,
    })
    .select('id')
    .single();

  if (insertError) {
    // Unique constraint violation means a match already exists (possibly inactive).
    // Re-activate it so the pair can message each other again.
    if (insertError.code === '23505') {
      const { data: existing, error: fetchError } = await admin
        .from('matches')
        .update({ is_active: true, user1_superliked: user1Superliked, user2_superliked: user2Superliked })
        .eq('user1_id', user1_id)
        .eq('user2_id', user2_id)
        .select('id')
        .single();

      if (fetchError || !existing) {
        throw new Error(`createMatch: could not reactivate existing match — ${fetchError?.message}`);
      }
      return existing.id;
    }

    throw new Error(`createMatch: insert failed — ${insertError.message}`);
  }

  return inserted.id;
}

// ---------------------------------------------------------------------------
// Core: createSwipe
// ---------------------------------------------------------------------------

/**
 * Records a swipe, creating a match when both users have expressed
 * mutual interest (like ↔ like, like ↔ rev, rev ↔ rev).
 *
 * Validation rules enforced:
 *   • action must be 'pass', 'like', or 'rev'
 *   • user cannot swipe themselves
 *   • swiper must not be banned
 *   • swiper must have completed onboarding
 *   • neither user may have blocked the other
 *   • duplicate swipes are rejected (unique constraint + pre-flight check)
 *
 * Match logic:
 *   • checked only when action is 'like' or 'rev'
 *   • a match is created when the swiped user has an existing 'like' or 'rev' on the swiper
 *   • duplicate matches are prevented via the DB unique constraint with graceful fallback
 *
 * Badge logic:
 *   • "First Match" badge is awarded to the swiper if they have no prior matches
 *
 * @throws {Error} with a human-readable message on validation failure.
 */
export async function createSwipe(
  swiperId: string,
  swipedId: string,
  action: SwipeAction,
): Promise<SwipeResult> {
  // ── 1. Input validation ─────────────────────────────────────

  const validActions: SwipeAction[] = ['pass', 'like', 'rev'];
  if (!validActions.includes(action)) {
    throw new Error(`Invalid swipe action '${action}'. Must be one of: pass, like, rev.`);
  }

  if (swiperId === swipedId) {
    throw new Error('A user cannot swipe on themselves.');
  }

  const admin = createAdminClient();

  // ── 2. Load swiper profile ───────────────────────────────────
  // Use admin client so we can read the row even if the caller
  // hasn't established a user session context (e.g. internal calls).

  const { data: swiperProfile, error: profileError } = await admin
    .from('profiles')
    .select('id, is_banned, onboarding_complete')
    .eq('id', swiperId)
    .single();

  if (profileError || !swiperProfile) {
    throw new Error('Swiper profile not found.');
  }
  if (swiperProfile.is_banned) {
    throw new Error('Banned users cannot swipe.');
  }
  if (!swiperProfile.onboarding_complete) {
    throw new Error('Complete your profile before you can start swiping.');
  }

  // ── 3. Block check ───────────────────────────────────────────

  const blocked = await usersAreBlocked(swiperId, swipedId);
  if (blocked) {
    throw new Error('Cannot swipe: one of these users has blocked the other.');
  }

  // ── 4. Duplicate swipe guard ─────────────────────────────────
  // Pre-flight check avoids hitting the DB unique constraint in the
  // common path. The constraint still provides the hard guarantee.

  const { data: existingSwipe } = await admin
    .from('swipes')
    .select('id')
    .eq('swiper_id', swiperId)
    .eq('swiped_id', swipedId)
    .maybeSingle();

  if (existingSwipe) {
    throw new Error('You have already swiped on this user.');
  }

  // ── 5. Insert swipe ──────────────────────────────────────────

  const { data: newSwipe, error: swipeError } = await admin
    .from('swipes')
    .insert({
      swiper_id:    swiperId,
      swiped_id:    swipedId,
      swipe_action: action as 'like' | 'pass', // DB enum: pass | like | rev; cast silences TS SwipeActionType mismatch
    })
    .select('id')
    .single();

  if (swipeError || !newSwipe) {
    // Surface unique violation with a friendlier message
    if (swipeError?.code === '23505') {
      throw new Error('You have already swiped on this user.');
    }
    throw new Error(`Failed to record swipe: ${swipeError?.message ?? 'unknown error'}`);
  }

  // ── 6. Match detection ───────────────────────────────────────
  // Only relevant for positive swipe actions.

  if (action === 'pass') {
    return { swipe_id: newSwipe.id, match_created: false, match_id: null };
  }

  // Award 'revved_up' badge on first-ever Rev swipe (fire-and-forget)
  if (action === 'rev') {
    checkAndAwardRevvedUp(swiperId).catch((err) => {
      console.warn('[swipe] revved_up badge award failed:', err);
    });
  }

  // Check if the swiped user has already liked or revved the swiper.
  const { data: reciprocalSwipe } = await admin
    .from('swipes')
    .select('id, swipe_action')
    .eq('swiper_id', swipedId)
    .eq('swiped_id', swiperId)
    .in('swipe_action', ['like', 'rev'])
    .maybeSingle();

  if (!reciprocalSwipe) {
    // No mutual interest yet — swipe recorded, no match
    return { swipe_id: newSwipe.id, match_created: false, match_id: null };
  }

  // ── 7. Create match ──────────────────────────────────────────

  const matchId = await createMatch(swiperId, swipedId);

  // ── 8. Badges ─────────────────────────────────────────────────
  // Award match badges (first_match, five_matches, trusted_rider) to the
  // swiper. The swiped user's badges are handled by the DB trigger in
  // 010_badges.sql which fires on the matches INSERT.

  checkAndAwardMatchBadges(swiperId).catch((err) => {
    console.warn('[swipe] match badge award failed:', err);
  });

  return { swipe_id: newSwipe.id, match_created: true, match_id: matchId };
}
