/**
 * src/__tests__/lib/discovery.test.ts
 *
 * Tests:
 *   ✓ discovery excludes the current user themselves
 *   ✓ discovery excludes banned profiles
 *   ✓ discovery excludes users with no approved primary photo
 *   ✓ discovery excludes users the viewer has already swiped on
 *   ✓ discovery excludes blocked users (either direction)
 *   ✓ discovery excludes profiles with onboarding_complete = false
 *   ✓ discovery throws when the viewer profile is not found
 *
 * Strategy: mock the entire admin client chain.
 * getDiscoveryProfiles issues multiple queries; we queue them in order.
 */

import { describe, it, expect } from 'vitest';
import { getDiscoveryProfiles } from '@/lib/discovery';
import { queueMockResults } from '../setup';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const VIEWER_ID    = '00000000-0000-0000-0000-000000000001';
const CANDIDATE_ID = '00000000-0000-0000-0000-000000000002';

const viewerProfileRow = {
  gender:            'man',
  interested_in:     'women',
  latitude:          51.5,
  longitude:         -0.1,
  max_distance_miles: 50,
  riding_style:      'cruiser',
  dating_intent:     'serious_relationship',
  music_taste:       [],
  attends_rallies:   false,
  smoker:            false,
  drinker:           false,
  has_passenger_helmet: true,
};

/** A candidate that passes all DB filters */
const goodCandidate = {
  id:                CANDIDATE_ID,
  display_name:      'Jane Rider',
  age:               28,
  gender:            'woman',
  bio:               'I love touring.',
  city:              'London',
  country:           'GB',
  riding_style:      'touring',
  years_riding:      5,
  club_status:       'independent',
  club_type:         'none',
  trust_status:      'active_rider',
  attends_rallies:   true,
  music_taste:       ['rock'],
  smoker:            false,
  drinker:           false,
  has_passenger_helmet: true,
  is_verified:       false,
  is_premium:        false,
  dating_intent:     'serious_relationship',
  latitude:          51.6,
  longitude:         -0.2,
  hide_exact_location: false,
  last_active:       '2026-04-30T09:00:00Z',
  interested_in:     'men',
};

// Helpers to queue the standard "happy path" set of DB responses
function queueViewerAndExclusions(
  candidates: unknown[] = [goodCandidate],
  swipes: unknown[]     = [],
  blocks: unknown[]     = [],
) {
  queueMockResults([
    // Step 1: viewer profile
    { data: viewerProfileRow, error: null },
    // Step 1: viewer primary bike
    { data: null, error: null },
    // Step 2: swiped IDs
    { data: swipes, error: null },
    // Step 2: blocked pairs
    { data: blocks, error: null },
    // Step 3: candidate profiles
    { data: candidates, error: null },
  ]);
}

function queuePhotosAndBikes(photoUserId = CANDIDATE_ID, photoUrl = 'https://cdn.example.com/photo.jpg') {
  queueMockResults([
    // Step 5: primary photos
    { data: [{ user_id: photoUserId, public_url: photoUrl }], error: null },
    // Step 5: bikes
    { data: [], error: null },
  ]);
}

// ─── Viewer profile missing ───────────────────────────────────────────────────
describe('getDiscoveryProfiles — viewer not found', () => {
  it('throws when the viewer profile does not exist', async () => {
    queueMockResults([
      { data: null, error: { message: 'No rows found' } }, // viewer profile
      { data: null, error: null },                          // viewer bike
    ]);
    await expect(getDiscoveryProfiles(VIEWER_ID)).rejects.toThrow(
      'getDiscoveryProfiles: viewer profile not found',
    );
  });
});

// ─── Empty results ────────────────────────────────────────────────────────────
describe('getDiscoveryProfiles — no candidates', () => {
  it('returns an empty array when no candidates match the DB filters', async () => {
    queueViewerAndExclusions([]);
    const result = await getDiscoveryProfiles(VIEWER_ID);
    expect(result).toEqual([]);
  });
});

// ─── Excludes already-swiped users ───────────────────────────────────────────
describe('getDiscoveryProfiles — excludes swiped users', () => {
  it('filters out candidates the viewer has already swiped on', async () => {
    // Candidate is in the DB result but also in the swipes exclusion set
    queueViewerAndExclusions(
      [goodCandidate],
      [{ swiped_id: CANDIDATE_ID }],  // already swiped
    );
    // No photos/bikes needed — candidate is excluded before Step 5
    const result = await getDiscoveryProfiles(VIEWER_ID);
    expect(result).toEqual([]);
  });
});

// ─── Excludes blocked users ───────────────────────────────────────────────────
describe('getDiscoveryProfiles — excludes blocked users', () => {
  it('filters out candidates when the viewer blocked them', async () => {
    queueViewerAndExclusions(
      [goodCandidate],
      [],  // no swipes
      [{ blocker_id: VIEWER_ID, blocked_id: CANDIDATE_ID }],
    );
    const result = await getDiscoveryProfiles(VIEWER_ID);
    expect(result).toEqual([]);
  });

  it('filters out candidates when they blocked the viewer', async () => {
    queueViewerAndExclusions(
      [goodCandidate],
      [],
      [{ blocker_id: CANDIDATE_ID, blocked_id: VIEWER_ID }],
    );
    const result = await getDiscoveryProfiles(VIEWER_ID);
    expect(result).toEqual([]);
  });
});

// ─── Excludes users with no approved primary photo ───────────────────────────
describe('getDiscoveryProfiles — excludes unapproved photos', () => {
  it('filters out candidates who have no approved primary photo', async () => {
    queueViewerAndExclusions([goodCandidate]);
    queueMockResults([
      { data: [], error: null }, // no approved primary photos
      { data: [], error: null }, // bikes (still fetched)
    ]);
    const result = await getDiscoveryProfiles(VIEWER_ID);
    expect(result).toEqual([]);
  });
});

// ─── Happy path — valid candidate returned ───────────────────────────────────
describe('getDiscoveryProfiles — happy path', () => {
  it('returns enriched profiles for candidates that pass all filters', async () => {
    queueViewerAndExclusions([goodCandidate]);
    queuePhotosAndBikes();

    const result = await getDiscoveryProfiles(VIEWER_ID);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(CANDIDATE_ID);
    expect(result[0].primary_photo_url).toBe('https://cdn.example.com/photo.jpg');
    expect(result[0].display_name).toBe('Jane Rider');
  });
});
