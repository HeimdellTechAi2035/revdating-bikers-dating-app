import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserPlan, getUserEntitlements } from '@/lib/premium';

export const dynamic = 'force-dynamic';

/**
 * GET /api/premium/entitlements
 * Returns the authenticated user's current plan and all feature flags.
 *
 * Never derive premium status from this response on the server — this endpoint
 * is for UI display only. All server-side gates call getUserPlan() / hasEntitlement()
 * directly from lib/premium.
 *
 * Response shape:
 * {
 *   plan: 'free' | 'rider_plus' | 'rider_premium',
 *   entitlements: {
 *     canSeeWhoLiked, advancedFilters, filterByBikeType, filterByRidingStyle,
 *     filterByDatingIntent, unlimitedRevs, boostProfile, priorityDiscovery,
 *     revCreditsPerWeek
 *   }
 * }
 */
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [plan, entitlements] = await Promise.all([
    getUserPlan(user.id),
    getUserEntitlements(user.id),
  ]);

  return NextResponse.json({ plan, entitlements });
}
