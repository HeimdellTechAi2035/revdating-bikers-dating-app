// =============================================================
// REVdating — Server-side premium entitlement system
//
// SECURITY: All plan and entitlement checks read directly from the
// `subscriptions` table via the admin client.
//
// NEVER trust:
//   • profiles.is_premium   — display-only cache updated by webhook
//   • any value sent from the frontend
//
// Three plan tiers:
//   free            — basic discovery, 3 revs per week
//   rider_plus      — see who liked you, advanced filters, unlimited revs
//   rider_premium   — all rider_plus + profile boost + priority discovery
//
// Stripe webhook (api/stripe/webhook) writes plan_name to subscriptions.
// =============================================================

import { createAdminClient } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Plan type
// ---------------------------------------------------------------------------

export type PlanName = 'free' | 'rider_plus' | 'rider_premium';

// ---------------------------------------------------------------------------
// Entitlement type — exhaustive union of all premium-gated feature keys
// ---------------------------------------------------------------------------

export type Entitlement =
  | 'see_who_liked_you'       // View users who liked/revved you before matching
  | 'advanced_filters'        // Umbrella: all filter-by-* flags below
  | 'filter_by_bike_type'     // Filter discovery by bike type
  | 'filter_by_riding_style'  // Filter discovery by riding style
  | 'filter_by_dating_intent' // Filter discovery by dating intent
  | 'unlimited_revs'          // Unlimited Rev (super-like) actions per week
  | 'profile_boost'           // Boost profile to top of discovery for 1 h
  | 'priority_discovery';     // Appear higher in other users' discovery feeds

// ---------------------------------------------------------------------------
// Per-plan entitlement matrix
// ---------------------------------------------------------------------------

// All entitlements granted to every plan — paywall disabled during launch phase
const ALL_ENTITLEMENTS = new Set<Entitlement>([
  'see_who_liked_you',
  'advanced_filters',
  'filter_by_bike_type',
  'filter_by_riding_style',
  'filter_by_dating_intent',
  'unlimited_revs',
  'profile_boost',
  'priority_discovery',
]);

const PLAN_ENTITLEMENTS: Record<PlanName, Set<Entitlement>> = {
  free:           ALL_ENTITLEMENTS,
  rider_plus:     ALL_ENTITLEMENTS,
  rider_premium:  ALL_ENTITLEMENTS,
};

// Rev credits per week per plan
export const REV_CREDITS: Record<PlanName, number | 'unlimited'> = {
  free:           'unlimited',
  rider_plus:     'unlimited',
  rider_premium:  'unlimited',
};

// ---------------------------------------------------------------------------
// getUserPlan — primary plan resolver
// ---------------------------------------------------------------------------

/**
 * Returns the user's current plan by querying the subscriptions table.
 *
 * Reads plan_name directly — Stripe webhook keeps this in sync.
 * Falls back to 'free' for any lapsed, cancelled, or missing subscription.
 *
 * NEVER call from client components — admin client only.
 */
export async function getUserPlan(userId: string): Promise<PlanName> {
  const admin = createAdminClient();

  const { data } = await admin
    .from('subscriptions')
    .select('plan_name, status, current_period_end')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .gt('current_period_end', new Date().toISOString())
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.plan_name) return 'free';

  const name = data.plan_name as string;
  if (name.startsWith('rider_premium')) return 'rider_premium';
  if (name.startsWith('rider_plus'))    return 'rider_plus';
  // Legacy plan names from before tiered pricing
  if (name.startsWith('premium'))       return 'rider_premium';

  return 'free';
}

// ---------------------------------------------------------------------------
// hasEntitlement — single-feature gate
// ---------------------------------------------------------------------------

/**
 * Returns true if the user's current plan includes the given entitlement.
 *
 * Usage in API routes:
 *   if (!(await hasEntitlement(user.id, 'profile_boost'))) {
 *     return NextResponse.json({ error: 'Premium required' }, { status: 403 });
 *   }
 */
export async function hasEntitlement(
  userId: string,
  entitlement: Entitlement,
): Promise<boolean> {
  const plan = await getUserPlan(userId);
  return PLAN_ENTITLEMENTS[plan].has(entitlement);
}

// ---------------------------------------------------------------------------
// PremiumEntitlements — structured object for client consumption
// ---------------------------------------------------------------------------

/**
 * Structured entitlement object returned to the client via
 * GET /api/premium/entitlements. Derived from the user's plan server-side.
 *
 * Backward-compatible shape — existing callers (boost, filters, likes) all
 * continue to work because the same field names are preserved.
 */
export interface PremiumEntitlements {
  /** The resolved plan name — do not use for gating, use individual flags. */
  plan: PlanName;

  // ── Feature flags ──────────────────────────────────────────
  canSeeWhoLiked:        boolean;  // 'see_who_liked_you'
  advancedFilters:       boolean;  // 'advanced_filters'
  filterByBikeType:      boolean;  // 'filter_by_bike_type'
  filterByRidingStyle:   boolean;  // 'filter_by_riding_style'
  filterByDatingIntent:  boolean;  // 'filter_by_dating_intent'
  unlimitedRevs:         boolean;  // 'unlimited_revs'
  boostProfile:          boolean;  // 'profile_boost'
  priorityDiscovery:     boolean;  // 'priority_discovery'

  /** Numeric weekly Rev cap. Use Infinity client-side when unlimited. */
  revCreditsPerWeek: number;
}

// ---------------------------------------------------------------------------
// getUserEntitlements — returns full structured object
// ---------------------------------------------------------------------------

/**
 * Returns the user's full entitlement object.
 * Used by the entitlements API route and in-process checks that need
 * multiple flags at once (avoids multiple DB round-trips).
 *
 * For single-flag checks prefer hasEntitlement().
 */
export async function getUserEntitlements(userId: string): Promise<PremiumEntitlements> {
  const plan = await getUserPlan(userId);
  const granted = PLAN_ENTITLEMENTS[plan];
  const credits = REV_CREDITS[plan];

  return {
    plan,
    canSeeWhoLiked:        granted.has('see_who_liked_you'),
    advancedFilters:       granted.has('advanced_filters'),
    filterByBikeType:      granted.has('filter_by_bike_type'),
    filterByRidingStyle:   granted.has('filter_by_riding_style'),
    filterByDatingIntent:  granted.has('filter_by_dating_intent'),
    unlimitedRevs:         granted.has('unlimited_revs'),
    boostProfile:          granted.has('profile_boost'),
    priorityDiscovery:     granted.has('priority_discovery'),
    revCreditsPerWeek:     credits === 'unlimited' ? Infinity : credits,
  };
}

// ---------------------------------------------------------------------------
// requireEntitlement — throw-on-fail helper for API routes
// ---------------------------------------------------------------------------

/**
 * Throws a PremiumRequiredError if the user does not have the entitlement.
 * Use in API routes for a concise one-liner gate.
 */
export async function requireEntitlement(
  userId: string,
  entitlement: Entitlement,
): Promise<void> {
  if (!(await hasEntitlement(userId, entitlement))) {
    throw new PremiumRequiredError(entitlement);
  }
}

/**
 * Deprecated — prefer requireEntitlement(userId, specific_entitlement).
 * Kept for backward compatibility with existing routes that call requirePremium().
 * Grants access on rider_plus or rider_premium (any paid plan).
 */
export async function requirePremium(userId: string): Promise<PremiumEntitlements> {
  const ent = await getUserEntitlements(userId);
  if (ent.plan === 'free') throw new PremiumRequiredError('advanced_filters');
  return ent;
}

// ---------------------------------------------------------------------------
// PremiumRequiredError
// ---------------------------------------------------------------------------

export class PremiumRequiredError extends Error {
  readonly status = 403;
  readonly entitlement?: Entitlement;

  constructor(entitlement?: Entitlement) {
    super('Premium subscription required');
    this.name    = 'PremiumRequiredError';
    this.entitlement = entitlement;
  }
}

