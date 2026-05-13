export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// =============================================================================
// COLD-START LAUNCH TRACKER — API
//
// STRATEGY CONTEXT: Niche dating apps live or die on geographic density.
// A "cold start" with 80 genuinely active users in one city is far more
// valuable than 5,000 ghost accounts spread across a country. Users open
// a dating app, see nobody nearby, and delete it within 48 hours.
//
// The critical mass threshold for a biker dating app is approximately:
//   - 30+ users within a 30-mile radius for swipe activity to feel alive
//   - ≥40/60 gender ratio to prevent one side from hitting an empty deck
//   - >20% week-1 retention signals real product-market fit
//
// ACQUISITION PLAYBOOK for biker communities:
//   1. GEO-FOCUSED LAUNCH: pick 1-2 cities (e.g. London + Birmingham) and
//      saturate them before expanding. Never spread thin nationally on day 1.
//   2. EVENT-BASED SIGNUPS: run sign-up drives at motorcycle rallies, track
//      days, Coffee & Cruisers meetups, and charity ride-outs. QR codes on
//      stickers at bike shows convert extremely well.
//   3. COMMUNITY ACQUISITION: partner with local bike club chapters, moto
//      forums (UKGSer, UKBF, TalkMoto) and Facebook riding groups. A single
//      post from a club secretary can bring 30-50 sign-ups.
//   4. GENDER BALANCE DRIVES: when men outnumber women (common in biker
//      demographics), run targeted female-rider campaigns via Instagram and
//      female riding groups (Litas, Chicks on Bikes UK, Women Riders UK).
//   5. REFERRAL INCENTIVES: offer 1 free week of Premium per referred user
//      who completes onboarding. The biker community is tight-knit — word
//      of mouth is the highest-quality acquisition channel.
// =============================================================================

type CityEntry = {
  city: string;
  country: string;
  total: number;
  active7d: number;
};

export async function GET() {
  // Auth + admin guard
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminCtx = await (await import('@/lib/admin')).requireAdmin();
  if (!adminCtx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const admin = createAdminClient();

  const now = new Date();

  // Time window boundaries
  const sevenDaysAgo    = new Date(now.getTime() - 7  * 86_400_000).toISOString();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86_400_000).toISOString();
  const eightDaysAgo    = new Date(now.getTime() - 8  * 86_400_000).toISOString();
  const thirtyDaysAgo   = new Date(now.getTime() - 30 * 86_400_000).toISOString();

  // ── Parallel data fetch ──────────────────────────────────────────────────
  // Profile limit: 10,000 covers the entire cold-start phase. At scale,
  // replace with DB-level GROUP BY via an RPC function.
  const [
    { data: profiles },
    { data: swipes },
    { count: matches7d },
    { count: totalActiveMatches },
    { count: matchesWithMessages },
  ] = await Promise.all([
    admin
      .from('profiles')
      .select('id, city, country, gender, created_at, last_active, onboarding_complete')
      .eq('is_banned', false)
      .limit(10_000),

    // Only swipe_action is needed — avoids transferring large blobs
    admin
      .from('swipes')
      .select('swipe_action')
      .gte('created_at', sevenDaysAgo)
      .limit(100_000),

    admin
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo),

    admin
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true),

    // Matches that have at least one message (last_message_at is set by trigger)
    admin
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .not('last_message_at', 'is', null),
  ]);

  // ── Process profiles ─────────────────────────────────────────────────────
  const countryMap  = new Map<string, number>();
  const cityMap     = new Map<string, CityEntry>();
  const genderMap   = new Map<string, number>();

  let totalOnboarded      = 0;
  let inactiveCount       = 0;
  let unfinishedOnboarding = 0;

  const sevenDaysAgoDate    = new Date(sevenDaysAgo);
  const fourteenDaysAgoDate = new Date(fourteenDaysAgo);
  const eightDaysAgoDate    = new Date(eightDaysAgo);
  const thirtyDaysAgoDate   = new Date(thirtyDaysAgo);

  // Cohort for week-1 retention: users who signed up 8–30 days ago
  // (old enough that day-7 has already elapsed, young enough to be meaningful)
  const week1Cohort: { createdAt: Date; lastActive: Date | null }[] = [];

  for (const p of profiles ?? []) {
    const country    = p.country ?? 'Unknown';
    const lastActive = p.last_active ? new Date(p.last_active) : null;
    const isActive7d = lastActive !== null && lastActive >= sevenDaysAgoDate;

    // ── Country totals ──────────────────────────────────────────────────────
    countryMap.set(country, (countryMap.get(country) ?? 0) + 1);

    // ── City totals ─────────────────────────────────────────────────────────
    // Key = "city|||country" prevents name collisions across countries
    if (p.city) {
      const key = `${p.city}|||${country}`;
      if (cityMap.has(key)) {
        const entry = cityMap.get(key)!;
        entry.total++;
        if (isActive7d) entry.active7d++;
      } else {
        cityMap.set(key, { city: p.city, country, total: 1, active7d: isActive7d ? 1 : 0 });
      }
    }

    // ── Gender breakdown ────────────────────────────────────────────────────
    const gender = p.gender ?? 'not_specified';
    genderMap.set(gender, (genderMap.get(gender) ?? 0) + 1);

    // ── Onboarding health ───────────────────────────────────────────────────
    if (!p.onboarding_complete) {
      unfinishedOnboarding++;
      continue; // Exclude incomplete profiles from activity metrics
    }

    totalOnboarded++;

    // Inactive = completed onboarding but no session in 14+ days.
    // These are prime targets for re-engagement campaigns.
    if (!lastActive || lastActive < fourteenDaysAgoDate) {
      inactiveCount++;
    }

    // ── Week-1 retention cohort ──────────────────────────────────────────────
    const createdAt = new Date(p.created_at);
    if (createdAt >= thirtyDaysAgoDate && createdAt < eightDaysAgoDate) {
      week1Cohort.push({ createdAt, lastActive });
    }
  }

  // ── Week-1 retention calculation ─────────────────────────────────────────
  // Definition: user returned at least once between day 1 and day 7 after signup.
  //
  // LIMITATION: this approximation uses last_active (most recent session only).
  // A user who returned on day 2 but not since will show as retained even if
  // they're now churned. A proper retention system should log every session.
  // For MVP cold-start monitoring this is sufficient signal.
  //
  // Industry benchmark: 20–30% week-1 retention is table stakes for dating apps.
  // <15% = product problem. >40% = strong PMF for a niche app.
  const week1Retained = week1Cohort.filter(({ createdAt, lastActive }) => {
    if (!lastActive) return false;
    const dayOne    = new Date(createdAt.getTime() + 1 * 86_400_000);
    const daySeven  = new Date(createdAt.getTime() + 7 * 86_400_000);
    return lastActive >= dayOne && lastActive <= daySeven;
  }).length;

  const week1RetentionPct =
    week1Cohort.length >= 10 // Only report once cohort is statistically meaningful
      ? Math.round((week1Retained / week1Cohort.length) * 100)
      : null;

  // ── Swipe processing ──────────────────────────────────────────────────────
  const swipeActionMap = new Map<string, number>();
  for (const s of swipes ?? []) {
    swipeActionMap.set(s.swipe_action, (swipeActionMap.get(s.swipe_action) ?? 0) + 1);
  }
  const totalSwipes7d = swipes?.length ?? 0;

  // Match rate = matches created / likes sent (in same 7-day window).
  // A match requires a mutual like, so the theoretical max is 50%.
  // For biker apps, 10–20% match rate is healthy; <5% suggests demographic mismatch.
  const likes7d     = (swipeActionMap.get('like') ?? 0) + (swipeActionMap.get('superlike') ?? 0);
  const matchRate7d = likes7d > 0
    ? Math.round(((matches7d ?? 0) / likes7d) * 100)
    : null;

  // Message rate = active matches with at least one message / total active matches.
  // <50% = messaging friction (UX or lack of ice-breaker features).
  // >80% = strong engagement; users are converting matches to conversations.
  const messageRate = (totalActiveMatches ?? 0) > 0
    ? Math.round(((matchesWithMessages ?? 0) / (totalActiveMatches ?? 0)) * 100)
    : null;

  // ── Shape output ─────────────────────────────────────────────────────────
  const totalProfiles = profiles?.length ?? 0;
  const inactivePct   = totalOnboarded > 0
    ? Math.round((inactiveCount / totalOnboarded) * 100)
    : 0;

  const genderTotal   = Array.from(genderMap.values()).reduce((a, b) => a + b, 0);

  const topCities = Array.from(cityMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);

  const usersByCountry = Array.from(countryMap.entries())
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count);

  const genderBalance = Array.from(genderMap.entries())
    .map(([gender, count]) => ({
      gender,
      count,
      pct: genderTotal > 0 ? Math.round((count / genderTotal) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const swipesByAction = Array.from(swipeActionMap.entries())
    .map(([action, count]) => ({
      action,
      count,
      pct: totalSwipes7d > 0 ? Math.round((count / totalSwipes7d) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    generatedAt: now.toISOString(),
    // Totals
    totalProfiles,
    onboardedProfiles: totalOnboarded,
    unfinishedOnboarding,
    // Geo
    usersByCountry,
    topCities,
    // Demographics
    genderBalance,
    // Swipe activity
    totalSwipes7d,
    swipesByAction,
    likes7d,
    matchesThisWeek: matches7d ?? 0,
    matchRate7d,
    // Match health
    totalActiveMatches: totalActiveMatches ?? 0,
    matchesWithMessages: matchesWithMessages ?? 0,
    messageRate,
    // User health
    inactiveProfiles: inactiveCount,
    inactivePct,
    // Retention
    week1CohortSize: week1Cohort.length,
    week1Retained,
    week1RetentionPct,
  });
}
