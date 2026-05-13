/**
 * lib/discovery/index.ts
 *
 * Server-side discovery query — builds the swipe card deck entirely on the
 * server before hydration, including filtering, enrichment, compatibility
 * scoring, and multi-factor sorting.
 *
 * Only for use in server components and API routes (uses admin client).
 *
 * Filtering guarantees (all enforced server-side or in JS post-filter):
 *   ✓ Not the current user
 *   ✓ onboarding_complete = true
 *   ✓ is_banned = false, is_active = true
 *   ✓ At least one approved primary photo
 *   ✓ Gender matches viewer's interested_in (bidirectional)
 *   ✓ Not already swiped by current user
 *   ✓ Not blocked either direction
 *   ✓ Within viewer's max_distance_miles (where lat/lng is available)
 *
 * Enrichment per profile:
 *   • Primary photo URL (guaranteed present)
 *   • All bikes (brand, model, type, year, engine, photos)
 *   • Approved bike photo URLs (from bikes.photo_url)
 *   • Distance in miles (null if either user has no coordinates)
 *   • Compatibility result (score + tier + labels + breakdown)
 *
 * Sort order:
 *   1. Premium users first (key business incentive)
 *   2. Compatibility score descending
 *   3. Distance ascending (closest first; nulls sorted last)
 *   4. last_active descending (most recently active; nulls sorted last)
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { signPhotoUrls } from '@/lib/photos/sign';
import { computeCompatibility, toViewerProfile } from '@/lib/compatibility';
import type { CompatibilityResult } from '@/lib/compatibility';
import type {
  GenderType,
  BikeTypeType,
  DatingIntentType,
  RidingStyleType,
  ClubTypeType,
  TrustStatusType,
  OwnedOrDreamType,
  ProfileRow,
  BikeRow,
} from '@/types/database.types';

// Bike fields used in discovery enrichment
type DiscoveryBikeData = Pick<BikeRow,
  | 'id' | 'user_id' | 'bike_type' | 'bike_brand' | 'bike_model' | 'bike_year'
  | 'engine_size_cc' | 'owned_or_dream' | 'primary_bike' | 'photo_url' | 'notes'
>;

// Viewer profile fields extracted from ProfileRow
type ViewerProfileData = Pick<ProfileRow,
  | 'gender' | 'interested_in' | 'latitude' | 'longitude' | 'max_distance_miles'
  | 'riding_style' | 'dating_intent' | 'music_taste' | 'attends_rallies'
  | 'smoker' | 'drinker' | 'has_passenger_helmet'
>;

// Candidate profile fields extracted from ProfileRow
type CandidateProfileData = Pick<ProfileRow,
  | 'id' | 'display_name' | 'age' | 'gender' | 'bio' | 'city' | 'country'
  | 'riding_style' | 'years_riding' | 'club_status' | 'club_type' | 'trust_status'
  | 'attends_rallies' | 'music_taste' | 'smoker' | 'drinker' | 'has_passenger_helmet'
  | 'is_verified' | 'is_premium' | 'dating_intent'
  | 'latitude' | 'longitude' | 'hide_exact_location' | 'last_active' | 'interested_in'
>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BikeDetail {
  id: string;
  bike_type: BikeTypeType;
  bike_brand: string;
  bike_model: string;
  bike_year: number | null;
  engine_size_cc: number | null;
  owned_or_dream: OwnedOrDreamType;
  primary_bike: boolean;
  photo_url: string | null;
  notes: string | null;
}

/**
 * A discovery candidate fully enriched for the swipe deck.
 * Structurally compatible with `DiscoveryCandidate` (strict superset) so
 * it can be passed to any component that accepts `DiscoveryCandidate`.
 */
export interface DiscoveryProfile {
  // Core identity (matches DiscoveryCandidate)
  id: string;
  display_name: string;
  age: number | null;
  gender: GenderType;
  bio: string | null;
  city: string | null;           // null when hide_exact_location = true
  country: string;
  riding_style: RidingStyleType | null;
  years_riding: number | null;
  club_status: string | null;
  club_type: ClubTypeType | null;
  trust_status: TrustStatusType;
  attends_rallies: boolean | null;
  music_taste: string[] | null;
  smoker: boolean | null;
  drinker: boolean | null;
  has_passenger_helmet: boolean | null;
  is_verified: boolean;
  is_premium: boolean;
  dating_intent: DatingIntentType | null;
  distance_miles: number | null;
  // Photos
  primary_photo_url: string;     // guaranteed non-null (required to pass filter)
  // Primary bike summary (matches DiscoveryCandidate)
  primary_bike_brand: string | null;
  primary_bike_model: string | null;
  primary_bike_type: BikeTypeType | null;
  // Additional enriched data
  last_active: string | null;
  approved_bike_photo_urls: string[];
  bikes: BikeDetail[];
  mood: string | null;
  // Server-computed compatibility
  compatibility: CompatibilityResult;
}

export interface GetDiscoveryProfilesOptions {
  /** Maximum profiles to return. Default: 20 */
  limit?: number;
  /** Profile IDs already loaded in the client deck — excluded from results */
  excludeIds?: string[];
  // Premium filters
  bikeTypes?: string[];
  ridingStyles?: string[];
  datingIntents?: string[];
  verifiedOnly?: boolean;
  clubTypes?: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Haversine great-circle distance in miles */
function haversineDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3958.8;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const dφ = ((lat2 - lat1) * Math.PI) / 180;
  const dλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Returns true if the candidate's gender matches what the viewer is looking for.
 * 'everyone' on viewer side: always true.
 */
function viewerWantsCandidateGender(
  candidateGender: GenderType,
  viewerInterestedIn: string,
): boolean {
  if (viewerInterestedIn === 'everyone') return true;
  if (viewerInterestedIn === 'men') return candidateGender === 'man';
  if (viewerInterestedIn === 'women') return candidateGender === 'woman';
  return true;
}

/**
 * Returns true if the candidate is open to the viewer's gender.
 * 'everyone' on candidate side: always true.
 */
function candidateWantsViewerGender(
  viewerGender: GenderType,
  candidateInterestedIn: string,
): boolean {
  if (candidateInterestedIn === 'everyone') return true;
  if (candidateInterestedIn === 'men') return viewerGender === 'man';
  if (candidateInterestedIn === 'women') return viewerGender === 'woman';
  return true;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export async function getDiscoveryProfiles(
  currentUserId: string,
  options: GetDiscoveryProfilesOptions = {},
): Promise<DiscoveryProfile[]> {
  const {
    limit = 20,
    excludeIds = [],
    bikeTypes,
    ridingStyles,
    datingIntents,
    verifiedOnly = false,
    clubTypes,
  } = options;

  const admin = createAdminClient();

  // ── Step 1: Viewer profile + primary bike (parallel) ──────────────────────
  // Needed for gender preference matching, distance filtering, and scoring.

  const [viewerResult, { data: viewerBike }] =
    await Promise.all([
      admin
        .from('profiles')
        .select(
          'gender, interested_in, latitude, longitude, max_distance_miles, ' +
          'riding_style, dating_intent, music_taste, attends_rallies, ' +
          'smoker, drinker, has_passenger_helmet',
        )
        .eq('id', currentUserId)
        .single() as unknown as Promise<{ data: ViewerProfileData | null; error: { message: string } | null }>,
      admin
        .from('bikes')
        .select('bike_type')
        .eq('user_id', currentUserId)
        .eq('primary_bike', true)
        .limit(1)
        .maybeSingle(),
    ]);
  const { data: viewerRow, error: viewerError } = viewerResult;

  if (viewerError || !viewerRow) {
    throw new Error(
      `getDiscoveryProfiles: viewer profile not found — ${viewerError?.message ?? 'unknown error'}`,
    );
  }

  const viewerProfile = toViewerProfile(viewerRow, viewerBike?.bike_type ?? null);
  const viewerGender    = viewerRow.gender as GenderType;
  const viewerInterest  = viewerRow.interested_in as string;
  const viewerLat       = viewerRow.latitude as number | null;
  const viewerLon       = viewerRow.longitude as number | null;
  const maxDistMiles    = viewerProfile.max_distance_miles;

  // ── Step 2: Exclusion sets — already swiped + blocked (parallel) ──────────

  const [{ data: swipeRows }, { data: blockRows }] = await Promise.all([
    admin.from('swipes').select('swiped_id').eq('swiper_id', currentUserId),
    admin
      .from('blocked_users')
      .select('blocker_id, blocked_id')
      .or(`blocker_id.eq.${currentUserId},blocked_id.eq.${currentUserId}`),
  ]);

  const excludedIds = new Set<string>([
    currentUserId,
    ...excludeIds,
    ...(swipeRows ?? []).map((r) => r.swiped_id),
  ]);

  const blockedIds = new Set<string>(
    (blockRows ?? [])
      .flatMap((r) => [r.blocker_id, r.blocked_id])
      .filter((id) => id !== currentUserId),
  );

  // ── Step 3: Candidate profiles ────────────────────────────────────────────
  // Apply hard DB filters first. Then JS-side filters for distance and
  // bidirectional gender preference (which require comparing two rows).
  //
  // Fetch more than `limit` to survive JS-side filtering — capped at 500
  // to prevent runaway queries on large datasets.

  let candidateQuery = admin
    .from('profiles')
    .select(
      'id, display_name, age, gender, bio, city, country, ' +
      'riding_style, years_riding, club_status, club_type, trust_status, ' +
      'attends_rallies, music_taste, smoker, drinker, has_passenger_helmet, ' +
      'is_verified, is_premium, dating_intent, ' +
      'latitude, longitude, hide_exact_location, last_active, interested_in',
    )
    .eq('onboarding_complete', true)
    .eq('is_banned', false)
    .eq('is_active', true);

  // Apply viewer's gender preference server-side when unambiguous
  if (viewerInterest === 'men')   candidateQuery = candidateQuery.eq('gender', 'man');
  if (viewerInterest === 'women') candidateQuery = candidateQuery.eq('gender', 'woman');
  // 'everyone' → no DB filter; JS filter handles bidirectional check

  // Optional premium filters
  if (verifiedOnly)           candidateQuery = candidateQuery.eq('is_verified', true);
  if (ridingStyles?.length)   candidateQuery = candidateQuery.in('riding_style', ridingStyles as RidingStyleType[]);
  if (datingIntents?.length)  candidateQuery = candidateQuery.in('dating_intent', datingIntents as DatingIntentType[]);
  if (clubTypes?.length)      candidateQuery = candidateQuery.in('club_type', clubTypes as ClubTypeType[]);

  const fetchCap = Math.min(limit * 10, 500);
  const rawResult = await candidateQuery.limit(fetchCap);
  const candidatesError = rawResult.error;
  const rawCandidates = rawResult.data as unknown as CandidateProfileData[] | null;

  if (candidatesError) {
    throw new Error(`Discovery query failed: ${(candidatesError as { message: string }).message}`);
  }
  if (!rawCandidates?.length) return [];

  // ── Step 4: JS-side filtering ─────────────────────────────────────────────
  // Applies exclusions, bidirectional gender preference, and distance cap.

  type RawCandidate = CandidateProfileData & { _dist: number | null };
  const passedCandidates: RawCandidate[] = [];

  for (const c of rawCandidates) {
    // Already swiped / blocked / explicitly excluded
    if (excludedIds.has(c.id)) continue;
    if (blockedIds.has(c.id))  continue;

    // Bidirectional gender preference
    if (!viewerWantsCandidateGender(c.gender as GenderType, viewerInterest)) continue;
    if (!candidateWantsViewerGender(viewerGender, c.interested_in as string)) continue;

    // Distance gate — only applied when both users have coordinates
    let dist: number | null = null;
    if (
      viewerLat != null && viewerLon != null &&
      c.latitude != null && c.longitude != null
    ) {
      dist = haversineDistanceMiles(
        viewerLat, viewerLon,
        c.latitude as number, c.longitude as number,
      );
      if (dist > maxDistMiles) continue;
    }

    passedCandidates.push({ ...c, _dist: dist });
  }

  if (!passedCandidates.length) return [];

  // ── Step 5: Fetch photos and bikes in parallel ─────────────────────────────

  const candidateIds = passedCandidates.map((c) => c.id);

  const [{ data: primaryPhotos }, bikeResult] = await Promise.all([
    admin
      .from('profile_photos')
      .select('user_id, storage_path, public_url')
      .in('user_id', candidateIds)
      .eq('is_primary', true)
      .eq('moderation_status', 'approved'),
    admin
      .from('bikes')
      .select(
        'id, user_id, bike_type, bike_brand, bike_model, bike_year, ' +
        'engine_size_cc, owned_or_dream, primary_bike, photo_url, notes',
      )
      .in('user_id', candidateIds)
      .order('primary_bike', { ascending: false }),
  ]);
  const bikeRows = bikeResult.data as unknown as DiscoveryBikeData[] | null;

  // Sign primary photo URLs and build lookup map
  const signedPrimaryPhotos = await signPhotoUrls(
    (primaryPhotos ?? []) as { user_id: string; storage_path: string }[],
    'profile-photos',
  );
  const primaryPhotoMap = new Map<string, string>(
    signedPrimaryPhotos.map((p) => [p.user_id, p.public_url]),
  );

  type RawBike = DiscoveryBikeData;
  const bikesMap = new Map<string, RawBike[]>();
  for (const bike of bikeRows ?? []) {
    const list = bikesMap.get(bike.user_id) ?? [];
    list.push(bike);
    bikesMap.set(bike.user_id, list);
  }

  // ── Step 6: Enrich — filter to those with approved photo; apply bikeTypes ──

  const enriched: DiscoveryProfile[] = [];

  for (const c of passedCandidates) {
    // Require at least one approved primary photo
    const primaryPhotoUrl = primaryPhotoMap.get(c.id);
    if (!primaryPhotoUrl) {
      console.warn(`[discovery] Dropping candidate ${c.id} (${(c as any).display_name}) — approved primary photo missing or signing failed`);
      continue;
    }

    const candidateBikes = bikesMap.get(c.id) ?? [];
    const primaryBike = candidateBikes.find((b) => b.primary_bike) ?? null;

    // bikeTypes filter applied against primary bike (JS-side, same as RPC)
    if (bikeTypes?.length) {
      if (!primaryBike || !bikeTypes.includes(primaryBike.bike_type)) continue;
    }

    // Approved bike photo URLs from bikes.photo_url
    const approvedBikePhotoUrls = candidateBikes
      .map((b) => b.photo_url)
      .filter((url): url is string => url != null);

    // Build a DiscoveryCandidate-compatible shape for the scoring engine
    const forScoring = {
      id:                   c.id,
      display_name:         c.display_name,
      age:                  c.age,
      gender:               c.gender as GenderType,
      bio:                  c.bio,
      city:                 c.hide_exact_location ? null : (c.city as string | null),
      country:              c.country,
      riding_style:         c.riding_style as RidingStyleType | null,
      years_riding:         c.years_riding,
      club_status:          c.club_status,
      club_type:            c.club_type as ClubTypeType | null,
      trust_status:         (c.trust_status ?? 'new_rider') as TrustStatusType,
      attends_rallies:      c.attends_rallies,
      music_taste:          c.music_taste as string[] | null,
      smoker:               c.smoker,
      drinker:              c.drinker,
      has_passenger_helmet: c.has_passenger_helmet,
      is_verified:          c.is_verified,
      is_premium:           c.is_premium,
      dating_intent:        c.dating_intent as DatingIntentType | null,
      distance_miles:       c._dist,
      primary_photo_url:    primaryPhotoUrl,
      primary_bike_brand:   primaryBike?.bike_brand ?? null,
      primary_bike_model:   primaryBike?.bike_model ?? null,
      primary_bike_type:    (primaryBike?.bike_type ?? null) as BikeTypeType | null,
    };

    const compatibility = computeCompatibility(viewerProfile, forScoring);

    enriched.push({
      ...forScoring,
      mood:                    (c as any).mood as string | null ?? null,
      last_active:             c.last_active as string | null,
      approved_bike_photo_urls: approvedBikePhotoUrls,
      bikes: candidateBikes.map((b) => ({
        id:             b.id,
        bike_type:      b.bike_type as BikeTypeType,
        bike_brand:     b.bike_brand,
        bike_model:     b.bike_model,
        bike_year:      b.bike_year,
        engine_size_cc: b.engine_size_cc,
        owned_or_dream: b.owned_or_dream as OwnedOrDreamType,
        primary_bike:   b.primary_bike,
        photo_url:      b.photo_url,
        notes:          b.notes,
      })),
      compatibility,
    });
  }

  if (!enriched.length) return [];

  // ── Step 7: Sort ───────────────────────────────────────────────────────────
  // 1. Premium first (key business incentive — mirrors existing RPC behaviour)
  // 2. Compatibility score descending
  // 3. Distance ascending (nulls last)
  // 4. last_active descending (nulls last)

  enriched.sort((a, b) => {
    if (a.is_premium && !b.is_premium) return -1;
    if (!a.is_premium && b.is_premium) return 1;

    const scoreDiff = b.compatibility.score - a.compatibility.score;
    if (scoreDiff !== 0) return scoreDiff;

    if (a.distance_miles != null && b.distance_miles != null) {
      const distDiff = a.distance_miles - b.distance_miles;
      if (distDiff !== 0) return distDiff;
    } else if (a.distance_miles != null) {
      return -1; // a has distance, b doesn't → a first
    } else if (b.distance_miles != null) {
      return 1;
    }

    if (a.last_active && b.last_active) {
      return (
        new Date(b.last_active).getTime() - new Date(a.last_active).getTime()
      );
    }
    if (a.last_active) return -1;
    if (b.last_active) return 1;

    return 0;
  });

  return enriched.slice(0, limit);
}
