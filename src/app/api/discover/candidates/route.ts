import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserEntitlements } from '@/lib/premium';
import { getDiscoveryProfiles } from '@/lib/discovery';

export async function GET(request: NextRequest) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const limit = Math.min(20, Math.max(1, parseInt(url.searchParams.get('limit') ?? '10')));

  // Comma-separated IDs currently loaded in the client deck — pass to function
  // so they are excluded without a separate client-side filter step.
  const excludeParam = url.searchParams.get('exclude') ?? '';
  const excludeIds = excludeParam ? excludeParam.split(',').filter(Boolean) : [];

  // Server-side entitlement check — advanced filters are premium-only
  const entitlements = await getUserEntitlements(user.id);

  // Parse filter params — only honoured when user has advancedFilters entitlement
  let bikeTypes:     string[] | undefined;
  let ridingStyles:  string[] | undefined;
  let datingIntents: string[] | undefined;
  let verifiedOnly                  = false;
  let clubTypes:     string[] | undefined;

  if (entitlements.advancedFilters) {
    const bt = url.searchParams.get('bike_types');
    const rs = url.searchParams.get('riding_styles');
    const di = url.searchParams.get('dating_intents');
    const vo = url.searchParams.get('verified_only');
    const ct = url.searchParams.get('club_types');

    bikeTypes     = bt ? bt.split(',').filter(Boolean) : undefined;
    ridingStyles  = rs ? rs.split(',').filter(Boolean) : undefined;
    datingIntents = di ? di.split(',').filter(Boolean) : undefined;
    verifiedOnly  = vo === 'true';
    clubTypes     = ct ? ct.split(',').filter(Boolean) : undefined;
  }

  try {
    const candidates = await getDiscoveryProfiles(user.id, {
      limit,
      excludeIds,
      bikeTypes,
      ridingStyles,
      datingIntents,
      verifiedOnly,
      clubTypes,
    });

    return NextResponse.json({
      candidates,
      filters_applied:
        entitlements.advancedFilters &&
        !!(bikeTypes?.length || ridingStyles?.length || datingIntents?.length || verifiedOnly || clubTypes?.length),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch candidates';
    console.error('[GET /api/discover/candidates]', message);
    return NextResponse.json({ error: 'Failed to fetch candidates' }, { status: 500 });
  }
}

