import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { computeCompatibility, toViewerProfile } from '@/lib/compatibility';
import type { DiscoveryCandidate } from '@/types/database.types';

const bodySchema = z.object({
  /**
   * IDs to score. Uses the same RPC as the discover page so only real
   * discovery candidates (not blocked, banned, etc.) are scored.
   * Max 20 to avoid long RPC calls.
   */
  candidate_ids: z.array(z.string().uuid()).min(1).max(20),
});

/**
 * POST /api/compatibility
 *
 * Body:  { candidate_ids: string[] }
 * Returns: { results: Record<candidateId, CompatibilityResult> }
 *
 * Server-side compatibility scoring for a batch of candidates.
 * Fetches the authenticated viewer's full profile + primary bike, then
 * runs the compatibility engine for each requested candidate.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { candidate_ids } = parsed.data;

  // Fetch viewer data in parallel
  const [{ data: viewerRow }, { data: viewerBike }] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'riding_style, dating_intent, max_distance_miles, music_taste, ' +
        'attends_rallies, smoker, drinker, has_passenger_helmet',
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
  ]);

  if (!viewerRow) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewer = toViewerProfile(viewerRow as any, viewerBike?.bike_type ?? null);

  // Fetch candidates via the same RPC used by the discover page.
  // This ensures blocked/banned users are never scored.
  const { data: allCandidates, error: rpcError } = await supabase.rpc(
    'get_discovery_candidates',
    { p_limit: 20 },
  );

  if (rpcError) {
    console.error('get_discovery_candidates error:', rpcError);
    return NextResponse.json({ error: 'Failed to fetch candidates' }, { status: 500 });
  }

  // Build a lookup map; only score IDs that are valid discovery candidates
  const candidateMap = new Map<string, DiscoveryCandidate>(
    (allCandidates ?? []).map((c: DiscoveryCandidate) => [c.id, c]),
  );

  const results: Record<string, ReturnType<typeof computeCompatibility>> = {};
  for (const id of candidate_ids) {
    const candidate = candidateMap.get(id);
    if (candidate) {
      results[id] = computeCompatibility(viewer, candidate);
    }
  }

  return NextResponse.json({ results });
}
