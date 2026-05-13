import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserBadges, BADGE_META } from '@/lib/badges';

export const dynamic = 'force-dynamic';

/**
 * GET /api/badges
 * Returns badges for the authenticated user (own profile) or for
 * another user via ?userId=<uuid> (public — badges are always visible).
 *
 * Response shape:
 * {
 *   badges: Array<{
 *     id, user_id, badge_name, badge_type, earned_at,
 *     label, description        ← enriched from BADGE_META
 *   }>
 * }
 */
export async function GET(request: NextRequest) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get('userId') ?? user.id;

  try {
    const rows = await getUserBadges(targetUserId);

    // Enrich with display metadata
    const badges = rows.map((row) => ({
      ...row,
      label:       BADGE_META[row.badge_name]?.label       ?? row.badge_name,
      description: BADGE_META[row.badge_name]?.description ?? '',
    }));

    return NextResponse.json({ badges });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch badges';
    console.error('[GET /api/badges]', msg);
    return NextResponse.json({ error: 'Failed to fetch badges' }, { status: 500 });
  }
}
