/**
 * src/__tests__/lib/premium.test.ts
 *
 * Tests:
 *   ✓ getUserPlan returns 'free' when no active subscription exists
 *   ✓ getUserPlan returns correct plan name from subscriptions table
 *   ✓ hasEntitlement returns false for free users on premium features
 *   ✓ hasEntitlement returns true for rider_plus users
 *   ✓ hasEntitlement returns true for rider_premium users (superset)
 *   ✓ requireEntitlement throws PremiumRequiredError for free users
 *   ✓ requireEntitlement does not throw for entitled users
 *   ✓ premium features require server-side entitlement check
 */

import { describe, it, expect } from 'vitest';
import {
  getUserPlan,
  hasEntitlement,
  requireEntitlement,
  PremiumRequiredError,
  getUserEntitlements,
} from '@/lib/premium';
import { queueMockResults } from '../setup';

const UID = '00000000-0000-0000-0000-000000000001';

// ─── getUserPlan ──────────────────────────────────────────────────────────────
describe('getUserPlan', () => {
  it('returns "free" when no subscription row exists', async () => {
    queueMockResults([{ data: null, error: null }]);
    expect(await getUserPlan(UID)).toBe('free');
  });

  it('returns "free" when subscription data has no plan_name', async () => {
    queueMockResults([{ data: { plan_name: null, status: 'active' }, error: null }]);
    expect(await getUserPlan(UID)).toBe('free');
  });

  it('returns "rider_plus" for an active rider_plus subscription', async () => {
    queueMockResults([
      {
        data: {
          plan_name:          'rider_plus_monthly',
          status:             'active',
          current_period_end: '2027-01-01T00:00:00Z',
        },
        error: null,
      },
    ]);
    expect(await getUserPlan(UID)).toBe('rider_plus');
  });

  it('returns "rider_premium" for an active rider_premium subscription', async () => {
    queueMockResults([
      {
        data: {
          plan_name:          'rider_premium_yearly',
          status:             'trialing',
          current_period_end: '2027-01-01T00:00:00Z',
        },
        error: null,
      },
    ]);
    expect(await getUserPlan(UID)).toBe('rider_premium');
  });

  it('upgrades legacy "premium_*" plan names to rider_premium', async () => {
    queueMockResults([
      {
        data: {
          plan_name:          'premium_monthly',
          status:             'active',
          current_period_end: '2027-01-01T00:00:00Z',
        },
        error: null,
      },
    ]);
    expect(await getUserPlan(UID)).toBe('rider_premium');
  });
});

// ─── hasEntitlement — free plan ───────────────────────────────────────────────
describe('hasEntitlement — free plan', () => {
  it('denies see_who_liked_you for free users', async () => {
    queueMockResults([{ data: null, error: null }]); // no subscription → free
    expect(await hasEntitlement(UID, 'see_who_liked_you')).toBe(false);
  });

  it('denies profile_boost for free users', async () => {
    queueMockResults([{ data: null, error: null }]);
    expect(await hasEntitlement(UID, 'profile_boost')).toBe(false);
  });

  it('denies advanced_filters for free users', async () => {
    queueMockResults([{ data: null, error: null }]);
    expect(await hasEntitlement(UID, 'advanced_filters')).toBe(false);
  });
});

// ─── hasEntitlement — rider_plus ─────────────────────────────────────────────
describe('hasEntitlement — rider_plus', () => {
  const riderPlusSub = {
    plan_name:          'rider_plus_monthly',
    status:             'active',
    current_period_end: '2027-01-01T00:00:00Z',
  };

  it('grants see_who_liked_you for rider_plus', async () => {
    queueMockResults([{ data: riderPlusSub, error: null }]);
    expect(await hasEntitlement(UID, 'see_who_liked_you')).toBe(true);
  });

  it('grants unlimited_revs for rider_plus', async () => {
    queueMockResults([{ data: riderPlusSub, error: null }]);
    expect(await hasEntitlement(UID, 'unlimited_revs')).toBe(true);
  });

  it('denies profile_boost (rider_premium only)', async () => {
    queueMockResults([{ data: riderPlusSub, error: null }]);
    expect(await hasEntitlement(UID, 'profile_boost')).toBe(false);
  });

  it('denies priority_discovery (rider_premium only)', async () => {
    queueMockResults([{ data: riderPlusSub, error: null }]);
    expect(await hasEntitlement(UID, 'priority_discovery')).toBe(false);
  });
});

// ─── hasEntitlement — rider_premium ──────────────────────────────────────────
describe('hasEntitlement — rider_premium', () => {
  const riderPremiumSub = {
    plan_name:          'rider_premium_yearly',
    status:             'active',
    current_period_end: '2027-01-01T00:00:00Z',
  };

  it('grants profile_boost for rider_premium', async () => {
    queueMockResults([{ data: riderPremiumSub, error: null }]);
    expect(await hasEntitlement(UID, 'profile_boost')).toBe(true);
  });

  it('grants priority_discovery for rider_premium', async () => {
    queueMockResults([{ data: riderPremiumSub, error: null }]);
    expect(await hasEntitlement(UID, 'priority_discovery')).toBe(true);
  });

  it('grants all rider_plus features too (superset)', async () => {
    queueMockResults([{ data: riderPremiumSub, error: null }]);
    expect(await hasEntitlement(UID, 'unlimited_revs')).toBe(true);
  });
});

// ─── requireEntitlement ───────────────────────────────────────────────────────
describe('requireEntitlement', () => {
  it('throws PremiumRequiredError when free user accesses premium feature', async () => {
    queueMockResults([{ data: null, error: null }]); // free plan
    await expect(requireEntitlement(UID, 'profile_boost')).rejects.toThrow(
      PremiumRequiredError,
    );
  });

  it('thrown PremiumRequiredError has status 403', async () => {
    queueMockResults([{ data: null, error: null }]);
    const err = await requireEntitlement(UID, 'profile_boost').catch((e) => e);
    expect(err).toBeInstanceOf(PremiumRequiredError);
    expect(err.status).toBe(403);
    expect(err.entitlement).toBe('profile_boost');
  });

  it('does not throw when user has the required entitlement', async () => {
    queueMockResults([
      {
        data: {
          plan_name:          'rider_premium_monthly',
          status:             'active',
          current_period_end: '2027-01-01T00:00:00Z',
        },
        error: null,
      },
    ]);
    await expect(requireEntitlement(UID, 'profile_boost')).resolves.toBeUndefined();
  });
});

// ─── getUserEntitlements — server-side entitlement check ─────────────────────
describe('getUserEntitlements — premium features require server-side check', () => {
  it('returns all false flags and free plan for a free user', async () => {
    queueMockResults([{ data: null, error: null }]);
    const ent = await getUserEntitlements(UID);
    expect(ent.plan).toBe('free');
    expect(ent.canSeeWhoLiked).toBe(false);
    expect(ent.boostProfile).toBe(false);
    expect(ent.priorityDiscovery).toBe(false);
    expect(ent.revCreditsPerWeek).toBe(3);
  });

  it('returns correct flags for rider_plus', async () => {
    queueMockResults([
      {
        data: {
          plan_name:          'rider_plus_monthly',
          status:             'active',
          current_period_end: '2027-01-01T00:00:00Z',
        },
        error: null,
      },
    ]);
    const ent = await getUserEntitlements(UID);
    expect(ent.plan).toBe('rider_plus');
    expect(ent.canSeeWhoLiked).toBe(true);
    expect(ent.unlimitedRevs).toBe(true);
    expect(ent.boostProfile).toBe(false);
    expect(ent.revCreditsPerWeek).toBe(Infinity);
  });

  it('returns all true flags for rider_premium', async () => {
    queueMockResults([
      {
        data: {
          plan_name:          'rider_premium_yearly',
          status:             'active',
          current_period_end: '2027-01-01T00:00:00Z',
        },
        error: null,
      },
    ]);
    const ent = await getUserEntitlements(UID);
    expect(ent.plan).toBe('rider_premium');
    expect(ent.boostProfile).toBe(true);
    expect(ent.priorityDiscovery).toBe(true);
    expect(ent.revCreditsPerWeek).toBe(Infinity);
  });
});
