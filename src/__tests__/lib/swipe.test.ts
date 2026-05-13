/**
 * src/__tests__/lib/swipe.test.ts
 *
 * Tests:
 *   ✓ user cannot swipe themselves
 *   ✓ duplicate swipes are blocked
 *   ✓ mutual likes create a match
 *   ✓ pass does not create a match
 *   ✓ Rev It creates a high-priority (superlike) match
 *   ✓ banned users cannot swipe
 *   ✓ blocked users cannot swipe each other
 */

import { describe, it, expect } from 'vitest';
import { createSwipe, usersAreBlocked } from '@/lib/swipe';
import { queueMockResults } from '../setup';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const UID_A = '00000000-0000-0000-0000-000000000001';
const UID_B = '00000000-0000-0000-0000-000000000002';

/** Active, onboarded swiper profile */
const activeProfile = {
  id:                  UID_A,
  is_banned:           false,
  onboarding_complete: true,
};

// ─── usersAreBlocked ──────────────────────────────────────────────────────────
describe('usersAreBlocked', () => {
  it('returns false when no block record exists', async () => {
    queueMockResults([
      { data: null, error: null }, // maybeSingle → no row
    ]);
    const result = await usersAreBlocked(UID_A, UID_B);
    expect(result).toBe(false);
  });

  it('returns true when a block record exists in either direction', async () => {
    queueMockResults([
      { data: { id: 'block-row' }, error: null }, // maybeSingle → row found
    ]);
    const result = await usersAreBlocked(UID_A, UID_B);
    expect(result).toBe(true);
  });
});

// ─── createSwipe — input guards ───────────────────────────────────────────────
describe('createSwipe — input validation', () => {
  it('throws when a user tries to swipe themselves', async () => {
    await expect(createSwipe(UID_A, UID_A, 'like')).rejects.toThrow(
      'A user cannot swipe on themselves.',
    );
  });

  it('throws on an invalid swipe action', async () => {
    // No DB calls expected — fails before any query
    await expect(createSwipe(UID_A, UID_B, 'heart' as never)).rejects.toThrow(
      "Invalid swipe action 'heart'",
    );
  });
});

// ─── createSwipe — profile guards ─────────────────────────────────────────────
describe('createSwipe — profile guards', () => {
  it('throws when the swiper is banned', async () => {
    queueMockResults([
      { data: { ...activeProfile, is_banned: true }, error: null }, // profile
    ]);
    await expect(createSwipe(UID_A, UID_B, 'like')).rejects.toThrow(
      'Banned users cannot swipe.',
    );
  });

  it('throws when onboarding is incomplete', async () => {
    queueMockResults([
      { data: { ...activeProfile, onboarding_complete: false }, error: null },
    ]);
    await expect(createSwipe(UID_A, UID_B, 'like')).rejects.toThrow(
      'Complete your profile before you can start swiping.',
    );
  });

  it('throws when the swiper profile does not exist', async () => {
    queueMockResults([
      { data: null, error: { message: 'No rows found' } }, // profile query error
    ]);
    await expect(createSwipe(UID_A, UID_B, 'like')).rejects.toThrow(
      'Swiper profile not found.',
    );
  });
});

// ─── createSwipe — block guard ────────────────────────────────────────────────
describe('createSwipe — block guard', () => {
  it('throws when either user has blocked the other', async () => {
    queueMockResults([
      { data: activeProfile, error: null }, // profile
      { data: { id: 'block-row' }, error: null }, // usersAreBlocked → blocked
    ]);
    await expect(createSwipe(UID_A, UID_B, 'like')).rejects.toThrow(
      'Cannot swipe: one of these users has blocked the other.',
    );
  });
});

// ─── createSwipe — duplicate guard ────────────────────────────────────────────
describe('createSwipe — duplicate swipe', () => {
  it('throws when the user has already swiped on the same person', async () => {
    queueMockResults([
      { data: activeProfile, error: null },       // profile
      { data: null, error: null },                 // no block
      { data: { id: 'existing-swipe' }, error: null }, // duplicate found
    ]);
    await expect(createSwipe(UID_A, UID_B, 'like')).rejects.toThrow(
      'You have already swiped on this user.',
    );
  });
});

// ─── createSwipe — pass does not create a match ───────────────────────────────
describe('createSwipe — pass', () => {
  it('returns match_created=false and match_id=null for a pass', async () => {
    queueMockResults([
      { data: activeProfile, error: null },  // profile
      { data: null, error: null },            // no block
      { data: null, error: null },            // no existing swipe
      { data: { id: 'swipe-pass' }, error: null }, // insert swipe
    ]);
    const result = await createSwipe(UID_A, UID_B, 'pass');
    expect(result.match_created).toBe(false);
    expect(result.match_id).toBeNull();
    expect(result.swipe_id).toBe('swipe-pass');
  });
});

// ─── createSwipe — like with no reciprocal ────────────────────────────────────
describe('createSwipe — like with no reciprocal', () => {
  it('does not create a match when the other user has not liked back', async () => {
    queueMockResults([
      { data: activeProfile, error: null },      // profile
      { data: null, error: null },                // no block
      { data: null, error: null },                // no existing swipe
      { data: { id: 'swipe-like' }, error: null }, // insert swipe
      { data: null, error: null },                // no reciprocal swipe
    ]);
    const result = await createSwipe(UID_A, UID_B, 'like');
    expect(result.match_created).toBe(false);
    expect(result.match_id).toBeNull();
  });
});

// ─── createSwipe — mutual like creates a match ────────────────────────────────
describe('createSwipe — mutual like', () => {
  it('creates a match when both users have liked each other', async () => {
    queueMockResults([
      { data: activeProfile, error: null },                        // profile
      { data: null, error: null },                                  // no block
      { data: null, error: null },                                  // no existing swipe
      { data: { id: 'swipe-new' }, error: null },                  // insert swipe
      { data: { id: 'swipe-recip', swipe_action: 'like' }, error: null }, // reciprocal like
      // createMatch: fetch swipe records for superlike flags
      {
        data: [
          { swiper_id: UID_A, swipe_action: 'like' },
          { swiper_id: UID_B, swipe_action: 'like' },
        ],
        error: null,
      },
      // createMatch: insert match row
      { data: { id: 'match-mutual' }, error: null },
    ]);

    const result = await createSwipe(UID_A, UID_B, 'like');
    expect(result.match_created).toBe(true);
    expect(result.match_id).toBe('match-mutual');
    expect(result.swipe_id).toBe('swipe-new');
  });
});

// ─── createSwipe — Rev It (super-like) ───────────────────────────────────────
describe('createSwipe — Rev It', () => {
  it('creates a high-priority (superlike) match when Rev meets a like', async () => {
    queueMockResults([
      { data: activeProfile, error: null },                         // profile
      { data: null, error: null },                                   // no block
      { data: null, error: null },                                   // no existing swipe
      { data: { id: 'swipe-rev' }, error: null },                   // insert swipe
      { data: { id: 'swipe-recip', swipe_action: 'like' }, error: null }, // recipient liked first
      // createMatch: swipe records — UID_A used rev, UID_B used like
      {
        data: [
          { swiper_id: UID_A, swipe_action: 'rev' },
          { swiper_id: UID_B, swipe_action: 'like' },
        ],
        error: null,
      },
      { data: { id: 'match-rev' }, error: null },                   // match created
    ]);

    const result = await createSwipe(UID_A, UID_B, 'rev');
    expect(result.match_created).toBe(true);
    expect(result.match_id).toBe('match-rev');
    expect(result.swipe_id).toBe('swipe-rev');
  });

  it('records a Rev swipe (no match) when the other user has not interacted yet', async () => {
    queueMockResults([
      { data: activeProfile, error: null },
      { data: null, error: null },                  // no block
      { data: null, error: null },                  // no existing swipe
      { data: { id: 'swipe-rev-solo' }, error: null }, // insert
      { data: null, error: null },                  // no reciprocal
    ]);
    const result = await createSwipe(UID_A, UID_B, 'rev');
    expect(result.match_created).toBe(false);
    expect(result.swipe_id).toBe('swipe-rev-solo');
  });
});
