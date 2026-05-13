'use client';

// =============================================================================
// COLD-START LAUNCH TRACKER — ADMIN PAGE
//
// PURPOSE: Give the REVdating team real-time visibility into whether the app has
// enough density in each city to produce a good user experience.
//
// COLD-START PROBLEM FOR NICHE DATING APPS:
//   Unlike general dating apps (Tinder, Hinge) that can launch nationally and
//   rely on raw volume, niche apps must build city-level density first.
//   A biker-only app with 10 users in a city delivers zero matches → churn.
//   The team should NOT market nationally until at least 2–3 anchor cities
//   have crossed the minimum viable density threshold (~50 onboarded users).
//
// HOW TO READ THIS DASHBOARD:
//   - "Active (7d)" per city is more important than total user count.
//     Ghost accounts inflate total but destroy match-rate confidence.
//   - Gender balance: aim for 35/65 minimum. >70/30 in either direction
//     means the minority side sees an empty deck → they churn first.
//   - Week-1 retention <20% = the product isn't sticky enough yet.
//     Fix: improve matching quality, onboarding, or push notifications.
//   - Message rate <50% = matches aren't converting. Add ice-breaker prompts.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  MapPin,
  Users,
  Activity,
  MessageSquare,
  AlertTriangle,
  TrendingUp,
  Info,
  Bike,
  BarChart2,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface CityRow {
  city: string;
  country: string;
  total: number;
  active7d: number;
}

interface BreakdownRow {
  label: string; // gender or swipe action
  count: number;
  pct: number;
}

interface LaunchData {
  generatedAt: string;
  totalProfiles: number;
  onboardedProfiles: number;
  unfinishedOnboarding: number;
  usersByCountry: { country: string; count: number }[];
  topCities: CityRow[];
  genderBalance: { gender: string; count: number; pct: number }[];
  totalSwipes7d: number;
  swipesByAction: { action: string; count: number; pct: number }[];
  likes7d: number;
  matchesThisWeek: number;
  matchRate7d: number | null;
  totalActiveMatches: number;
  matchesWithMessages: number;
  messageRate: number | null;
  inactiveProfiles: number;
  inactivePct: number;
  week1CohortSize: number;
  week1Retained: number;
  week1RetentionPct: number | null;
}

// ── Label maps ───────────────────────────────────────────────────────────────

const GENDER_LABELS: Record<string, string> = {
  man:               'Men',
  woman:             'Women',
  non_binary:        'Non-binary',
  other:             'Other',
  prefer_not_to_say: 'Prefer not to say',
  not_specified:     'Not specified',
};

const GENDER_COLORS: Record<string, string> = {
  man:               'bg-blue-500',
  woman:             'bg-pink-500',
  non_binary:        'bg-purple-500',
  other:             'bg-gray-500',
  prefer_not_to_say: 'bg-gray-500',
  not_specified:     'bg-gray-600',
};

const ACTION_LABELS: Record<string, string> = {
  like:      'Like (right swipe)',
  pass:      'Pass (left swipe)',
  superlike: 'Ride With (superlike)',
};

const ACTION_COLORS: Record<string, string> = {
  like:      'bg-green-500',
  pass:      'bg-red-500',
  superlike: 'bg-brand-orange',
};

// ── Sub-components ───────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-brand-dark-3 border border-brand-dark-4 overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-brand-dark-4">
        <span className="text-brand-orange">{icon}</span>
        <h2 className="font-bold text-sm uppercase tracking-wide">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  color = 'text-white',
  alert = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        alert
          ? 'bg-red-500/5 border-red-500/20'
          : 'bg-brand-dark-3 border-brand-dark-4'
      }`}
    >
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-brand-chrome text-sm mt-1">{label}</p>
      {sub && <p className="text-xs text-brand-chrome/60 mt-0.5">{sub}</p>}
    </div>
  );
}

function BarRow({ label, count, pct, colorClass }: BreakdownRow & { colorClass: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-brand-chrome tabular-nums">
          {count.toLocaleString()} — {pct}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-brand-dark-4 overflow-hidden">
        <div
          className={`h-full rounded-full ${colorClass} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Callout({
  type,
  children,
}: {
  type: 'info' | 'warning' | 'tip';
  children: React.ReactNode;
}) {
  const styles = {
    info:    'bg-blue-500/8 border-blue-500/20 text-blue-300',
    warning: 'bg-yellow-500/8 border-yellow-500/20 text-yellow-300',
    tip:     'bg-brand-orange/8 border-brand-orange/20 text-brand-orange',
  };
  const icons = {
    info:    <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />,
    warning: <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />,
    tip:     <Bike className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />,
  };
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs leading-relaxed ${styles[type]}`}>
      {icons[type]}
      <span>{children}</span>
    </div>
  );
}

// ── Threshold helpers ─────────────────────────────────────────────────────────

/** Active city count at which swipe activity becomes self-sustaining */
const CITY_DENSITY_THRESHOLD = 30;

/** Minimum gender minority share (%) before the experience degrades */
const GENDER_MIN_PCT = 30;

// ── Main page ────────────────────────────────────────────────────────────────

export default function LaunchTrackerPage() {
  const [data, setData]       = useState<LaunchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/launch');
      if (!res.ok) throw new Error(`${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Computed alerts ────────────────────────────────────────────────────────
  const womanPct = data?.genderBalance.find((g) => g.gender === 'woman')?.pct ?? 0;
  const genderAlert = womanPct < GENDER_MIN_PCT && (data?.onboardedProfiles ?? 0) > 20;

  const citiesAboveThreshold = (data?.topCities ?? []).filter(
    (c) => c.active7d >= CITY_DENSITY_THRESHOLD,
  ).length;

  const retentionAlert =
    data?.week1RetentionPct !== null &&
    data?.week1RetentionPct !== undefined &&
    data.week1RetentionPct < 20;

  const inactiveAlert = (data?.inactivePct ?? 0) > 40;

  return (
    <div className="space-y-6 pb-12">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-brand-orange" />
            Launch Tracker
          </h1>
          <p className="text-brand-chrome text-sm mt-1">
            Cold-start health dashboard — geographic density, engagement depth, and first-week retention.
          </p>
          {data && (
            <p className="text-brand-chrome/50 text-xs mt-1">
              Last updated: {new Date(data.generatedAt).toLocaleTimeString('en-GB', {
                hour: '2-digit', minute: '2-digit', second: '2-digit',
              })}
            </p>
          )}
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-dark-3 border border-brand-dark-4 text-sm text-brand-chrome hover:text-white hover:border-brand-orange/40 disabled:opacity-50 transition-colors shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Strategy context callout ─────────────────────────────────────── */}
      <div className="rounded-2xl border border-brand-orange/20 bg-brand-orange/5 p-5 space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <Bike className="w-5 h-5 text-brand-orange" />
          <h2 className="font-bold text-brand-orange">Cold-Start Playbook</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 text-xs text-brand-chrome leading-relaxed">
          {/* Strategy note: why geo-focused launch matters */}
          <div>
            <p className="font-semibold text-white mb-1">Why cities, not countries</p>
            <p>
              Niche apps need swipe-pool depth per city before a national launch.
              A user who opens the app and sees 3 profiles within 30 miles will delete
              it before reaching a match. Launch city by city — saturate before expanding.
            </p>
          </div>
          <div>
            <p className="font-semibold text-white mb-1">Acquisition that works for bikers</p>
            <p>
              Motorcycle rallies, track days, and Coffee &amp; Cruisers meetups are
              your highest-conversion channels. QR stickers at bike shows, DMs to local
              club secretaries, and female-rider Instagram campaigns address gender balance
              before it becomes a churn driver.
            </p>
          </div>
        </div>
        {citiesAboveThreshold === 0 && !loading && (
          <div className="mt-2 text-xs text-yellow-300 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              No city has reached the {CITY_DENSITY_THRESHOLD} active-user density threshold yet.
              Focus all acquisition efforts on a single anchor city before spreading thin.
            </span>
          </div>
        )}
        {citiesAboveThreshold > 0 && (
          <div className="mt-2 text-xs text-green-300 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2">
            ✓ {citiesAboveThreshold} {citiesAboveThreshold === 1 ? 'city has' : 'cities have'} crossed
            the {CITY_DENSITY_THRESHOLD}-active-user threshold. Safe to begin expanding to adjacent cities.
          </div>
        )}
      </div>

      {/* ── Loading / error states ───────────────────────────────────────── */}
      {loading && !data && (
        <div className="flex items-center justify-center py-20 text-brand-chrome">
          <RefreshCw className="w-6 h-6 animate-spin mr-3" /> Loading launch metrics…
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-red-400 text-sm">
          Failed to load metrics: {error}
        </div>
      )}

      {data && (
        <>
          {/* ── Key metrics grid ───────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Total profiles"
              value={data.totalProfiles.toLocaleString()}
              sub={`${data.unfinishedOnboarding} incomplete onboarding`}
              color="text-white"
            />
            <MetricCard
              label="Onboarded users"
              value={data.onboardedProfiles.toLocaleString()}
              sub={`${data.totalProfiles > 0 ? Math.round((data.onboardedProfiles / data.totalProfiles) * 100) : 0}% completion rate`}
              color="text-green-400"
            />
            <MetricCard
              label="Week-1 retention"
              value={
                data.week1RetentionPct !== null
                  ? `${data.week1RetentionPct}%`
                  : '—'
              }
              sub={
                data.week1CohortSize < 10
                  ? `Only ${data.week1CohortSize} in cohort — need 10+`
                  : `${data.week1Retained} / ${data.week1CohortSize} returned by day 7`
              }
              color={
                data.week1RetentionPct === null ? 'text-brand-chrome' :
                data.week1RetentionPct >= 30    ? 'text-green-400'    :
                data.week1RetentionPct >= 20    ? 'text-yellow-400'   : 'text-red-400'
              }
              alert={retentionAlert}
            />
            <MetricCard
              label="Inactive profiles"
              value={`${data.inactivePct}%`}
              sub={`${data.inactiveProfiles.toLocaleString()} users — no activity 14+ days`}
              color={inactiveAlert ? 'text-red-400' : 'text-yellow-400'}
              alert={inactiveAlert}
            />
          </div>

          {/* ── Geo: top cities ──────────────────────────────────────────────── */}
          <Section title="Geographic Distribution" icon={<MapPin className="w-4 h-4" />}>
            <div className="space-y-4">
              <Callout type="info">
                Target: {CITY_DENSITY_THRESHOLD}+ active users per city for meaningful swipe activity.
                Cities below this threshold feel like a ghost town — prioritise them in acquisition campaigns.
              </Callout>

              {data.topCities.length === 0 ? (
                <p className="text-brand-chrome text-sm">No city data yet — users may not have set a city during onboarding.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-brand-chrome text-xs uppercase tracking-wide border-b border-brand-dark-4">
                        <th className="text-left py-2 pr-4">City</th>
                        <th className="text-left py-2 pr-4">Country</th>
                        <th className="text-right py-2 pr-4">Total users</th>
                        <th className="text-right py-2 pr-4">Active (7d)</th>
                        <th className="text-right py-2">Active %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-dark-4">
                      {data.topCities.map((c) => {
                        const activePct   = c.total > 0 ? Math.round((c.active7d / c.total) * 100) : 0;
                        const aboveThreshold = c.active7d >= CITY_DENSITY_THRESHOLD;
                        return (
                          <tr key={`${c.city}-${c.country}`} className="hover:bg-brand-dark-4/30 transition-colors">
                            <td className="py-2.5 pr-4 font-medium">
                              <div className="flex items-center gap-2">
                                {aboveThreshold && (
                                  <span
                                    className="w-2 h-2 rounded-full bg-green-400 shrink-0"
                                    title="Above density threshold"
                                  />
                                )}
                                {!aboveThreshold && (
                                  <span
                                    className="w-2 h-2 rounded-full bg-brand-dark-4 shrink-0"
                                    title="Below density threshold"
                                  />
                                )}
                                {c.city}
                              </div>
                            </td>
                            <td className="py-2.5 pr-4 text-brand-chrome">{c.country}</td>
                            <td className="py-2.5 pr-4 text-right tabular-nums">{c.total}</td>
                            <td className="py-2.5 pr-4 text-right tabular-nums">
                              <span className={aboveThreshold ? 'text-green-400 font-semibold' : 'text-brand-chrome'}>
                                {c.active7d}
                              </span>
                            </td>
                            <td className="py-2.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-1.5 rounded-full bg-brand-dark-4 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${activePct >= 30 ? 'bg-green-500' : activePct >= 15 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                    style={{ width: `${activePct}%` }}
                                  />
                                </div>
                                <span className="text-brand-chrome text-xs tabular-nums w-8 text-right">{activePct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Country breakdown */}
              {data.usersByCountry.length > 0 && (
                <div className="border-t border-brand-dark-4 pt-4">
                  <p className="text-xs text-brand-chrome uppercase tracking-wide mb-2">By country</p>
                  <div className="flex flex-wrap gap-2">
                    {data.usersByCountry.map((c) => (
                      <span
                        key={c.country}
                        className="px-3 py-1 rounded-full bg-brand-dark-4 text-xs"
                      >
                        {c.country}: <strong>{c.count}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* ── Gender balance ──────────────────────────────────────────────── */}
          <Section title="Gender Balance" icon={<Users className="w-4 h-4" />}>
            <div className="space-y-4">
              {genderAlert && (
                <Callout type="warning">
                  Women represent less than {GENDER_MIN_PCT}% of onboarded users. This is the single biggest
                  churn driver for dating apps — women hit an empty deck, leave, and men follow.
                  Run a female-rider targeted campaign (Litas UK, Women Riders UK, Instagram) immediately.
                </Callout>
              )}
              {!genderAlert && (data?.onboardedProfiles ?? 0) > 20 && (
                <Callout type="info">
                  Aim to maintain at least a 35/65 split. Biker demographics skew male —
                  proactive female acquisition is an ongoing effort, not a one-time fix.
                </Callout>
              )}

              <div className="space-y-3">
                {data.genderBalance.map((g) => (
                  <BarRow
                    key={g.gender}
                    label={GENDER_LABELS[g.gender] ?? g.gender}
                    count={g.count}
                    pct={g.pct}
                    colorClass={GENDER_COLORS[g.gender] ?? 'bg-gray-500'}
                  />
                ))}
              </div>

              {data.genderBalance.length === 0 && (
                <p className="text-brand-chrome text-sm">No gender data yet.</p>
              )}
            </div>
          </Section>

          {/* ── Swipe & engagement ─────────────────────────────────────────── */}
          <Section title="Swipe Activity (last 7 days)" icon={<Activity className="w-4 h-4" />}>
            <div className="space-y-5">

              {/* Summary row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-brand-dark-4 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold">{data.totalSwipes7d.toLocaleString()}</p>
                  <p className="text-brand-chrome text-xs mt-0.5">Total swipes</p>
                </div>
                <div className="bg-brand-dark-4 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold">{data.likes7d.toLocaleString()}</p>
                  <p className="text-brand-chrome text-xs mt-0.5">Likes sent</p>
                </div>
                <div className="bg-brand-dark-4 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold">{data.matchesThisWeek.toLocaleString()}</p>
                  <p className="text-brand-chrome text-xs mt-0.5">New matches</p>
                </div>
                <div className="bg-brand-dark-4 rounded-xl p-3 text-center">
                  <p className={`text-2xl font-bold ${
                    data.matchRate7d === null    ? 'text-brand-chrome' :
                    data.matchRate7d >= 10       ? 'text-green-400'    :
                    data.matchRate7d >= 5        ? 'text-yellow-400'   : 'text-red-400'
                  }`}>
                    {data.matchRate7d !== null ? `${data.matchRate7d}%` : '—'}
                  </p>
                  <p className="text-brand-chrome text-xs mt-0.5">Match rate</p>
                </div>
              </div>

              {/* Match rate interpretation */}
              {data.matchRate7d !== null && (
                <Callout type={data.matchRate7d >= 10 ? 'info' : 'warning'}>
                  {data.matchRate7d >= 20
                    ? `${data.matchRate7d}% match rate — excellent. Strong mutual interest signals a healthy, well-matched user base.`
                    : data.matchRate7d >= 10
                    ? `${data.matchRate7d}% match rate — healthy. Benchmark for niche dating apps is 10–20%.`
                    : data.matchRate7d >= 5
                    ? `${data.matchRate7d}% match rate — low. May indicate gender imbalance or users mass-swiping right. Review gender balance above.`
                    : `${data.matchRate7d}% match rate — critically low. Primary cause is usually gender imbalance or insufficient user density in swipe pools.`
                  }
                </Callout>
              )}

              {/* Swipe breakdown bars */}
              {data.swipesByAction.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs text-brand-chrome uppercase tracking-wide">Breakdown by action</p>
                  {data.swipesByAction.map((s) => (
                    <BarRow
                      key={s.action}
                      label={ACTION_LABELS[s.action] ?? s.action}
                      count={s.count}
                      pct={s.pct}
                      colorClass={ACTION_COLORS[s.action] ?? 'bg-gray-500'}
                    />
                  ))}
                </div>
              )}

              {data.totalSwipes7d === 0 && (
                <p className="text-brand-chrome text-sm">No swipe activity in the last 7 days.</p>
              )}
            </div>
          </Section>

          {/* ── Message rate ───────────────────────────────────────────────── */}
          <Section title="Match → Message Conversion" icon={<MessageSquare className="w-4 h-4" />}>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-brand-dark-4 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold">{data.totalActiveMatches.toLocaleString()}</p>
                  <p className="text-brand-chrome text-xs mt-0.5">Active matches</p>
                </div>
                <div className="bg-brand-dark-4 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-400">{data.matchesWithMessages.toLocaleString()}</p>
                  <p className="text-brand-chrome text-xs mt-0.5">With messages</p>
                </div>
                <div className="bg-brand-dark-4 rounded-xl p-3 text-center">
                  <p className={`text-2xl font-bold ${
                    data.messageRate === null  ? 'text-brand-chrome' :
                    data.messageRate >= 70     ? 'text-green-400'    :
                    data.messageRate >= 50     ? 'text-yellow-400'   : 'text-red-400'
                  }`}>
                    {data.messageRate !== null ? `${data.messageRate}%` : '—'}
                  </p>
                  <p className="text-brand-chrome text-xs mt-0.5">Message rate</p>
                </div>
              </div>

              {data.messageRate !== null && (
                <>
                  <div className="h-3 rounded-full bg-brand-dark-4 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        data.messageRate >= 70 ? 'bg-green-500' :
                        data.messageRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${data.messageRate}%` }}
                    />
                  </div>
                  <Callout type={data.messageRate >= 50 ? 'info' : 'warning'}>
                    {data.messageRate >= 80
                      ? 'Excellent message rate — matched users are actively engaging. Strong signal of high-quality matches.'
                      : data.messageRate >= 60
                      ? 'Good message rate. Consider adding conversation ice-breakers or shared ride topics to push this above 80%.'
                      : data.messageRate >= 40
                      ? 'Message rate needs improvement. Add Quick Prompts in the chat UI (e.g. "What do you ride?") to reduce the blank-page problem.'
                      : 'Low message rate — matches are not converting to conversations. The primary fix is ice-breaker prompts and push notification nudges ("Your match hasn\'t heard from you yet!").'
                    }
                  </Callout>
                </>
              )}
            </div>
          </Section>

          {/* ── Inactive profiles ──────────────────────────────────────────── */}
          <Section title="Inactive Profile Health" icon={<AlertTriangle className="w-4 h-4" />}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className={`rounded-xl p-4 text-center border ${inactiveAlert ? 'bg-red-500/5 border-red-500/20' : 'bg-brand-dark-4 border-brand-dark-4'}`}>
                  <p className={`text-3xl font-bold ${inactiveAlert ? 'text-red-400' : 'text-yellow-400'}`}>
                    {data.inactiveProfiles.toLocaleString()}
                  </p>
                  <p className="text-brand-chrome text-xs mt-0.5">Inactive profiles (14+ days)</p>
                </div>
                <div className={`rounded-xl p-4 text-center border ${inactiveAlert ? 'bg-red-500/5 border-red-500/20' : 'bg-brand-dark-4 border-brand-dark-4'}`}>
                  <p className={`text-3xl font-bold ${inactiveAlert ? 'text-red-400' : 'text-yellow-400'}`}>
                    {data.inactivePct}%
                  </p>
                  <p className="text-brand-chrome text-xs mt-0.5">of onboarded users</p>
                </div>
              </div>

              <Callout type={inactiveAlert ? 'warning' : 'info'}>
                {inactiveAlert
                  ? `${data.inactivePct}% inactivity is high. Inactive profiles fill up swipe decks without producing matches, creating a hollow-pool experience. Consider a re-engagement email ("Someone liked you!") or removing ghost profiles from the discovery pool after 30 days.`
                  : `Inactive profiles (no session in 14+ days) should stay below 35%. These users were onboarded but haven't found enough value to return — a win-back email with a "You have new likes waiting" hook can recover 10–15%.`
                }
              </Callout>

              <div className="text-xs text-brand-chrome leading-relaxed space-y-1">
                <p className="font-semibold text-white">Re-engagement playbook:</p>
                <ul className="list-disc list-inside space-y-0.5 ml-1">
                  <li>Day 7 inactive: "Someone liked your profile" push notification</li>
                  <li>Day 14 inactive: email with "You have new matches near [city]"</li>
                  <li>Day 30 inactive: final win-back with 1-week Premium trial offer</li>
                  <li>Day 60+ inactive: hide from discovery pool to protect active user experience</li>
                </ul>
              </div>
            </div>
          </Section>

          {/* ── First-week retention ────────────────────────────────────────── */}
          <Section title="First-Week Retention" icon={<BarChart2 className="w-4 h-4" />}>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-brand-dark-4 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold">{data.week1CohortSize}</p>
                  <p className="text-brand-chrome text-xs mt-0.5">Cohort size (8–30 days ago)</p>
                </div>
                <div className="bg-brand-dark-4 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-400">{data.week1Retained}</p>
                  <p className="text-brand-chrome text-xs mt-0.5">Returned by day 7</p>
                </div>
                <div className="bg-brand-dark-4 rounded-xl p-3 text-center">
                  <p className={`text-2xl font-bold ${
                    data.week1RetentionPct === null  ? 'text-brand-chrome' :
                    data.week1RetentionPct >= 30     ? 'text-green-400'    :
                    data.week1RetentionPct >= 20     ? 'text-yellow-400'   : 'text-red-400'
                  }`}>
                    {data.week1RetentionPct !== null ? `${data.week1RetentionPct}%` : '—'}
                  </p>
                  <p className="text-brand-chrome text-xs mt-0.5">Retention rate</p>
                  {data.week1CohortSize < 10 && (
                    <p className="text-[10px] text-yellow-400 mt-0.5">Need 10+ in cohort</p>
                  )}
                </div>
              </div>

              {data.week1RetentionPct !== null && (
                <div className="h-3 rounded-full bg-brand-dark-4 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      data.week1RetentionPct >= 30 ? 'bg-green-500' :
                      data.week1RetentionPct >= 20 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(data.week1RetentionPct, 100)}%` }}
                  />
                </div>
              )}

              <Callout type="info">
                Industry benchmarks: &lt;15% = product not sticky; 20–30% = table stakes for dating apps;
                &gt;30% = strong PMF signal for a niche app. This metric uses{' '}
                <em>last_active</em> as a proxy — a full session-event log gives more accurate cohort curves.
              </Callout>

              <div className="text-xs text-brand-chrome leading-relaxed space-y-1">
                <p className="font-semibold text-white">Retention improvement levers:</p>
                <ul className="list-disc list-inside space-y-0.5 ml-1">
                  <li><strong>Day 1 push notification</strong>: "Your first match is waiting — tap to say hi"</li>
                  <li><strong>Improve onboarding funnel</strong>: users without photos never get matches</li>
                  <li><strong>Geo-targeting</strong>: show users their local active rider count on sign-up</li>
                  <li><strong>Event hooks</strong>: "3 riders near [city] are going to [event name] this weekend"</li>
                </ul>
              </div>
            </div>
          </Section>

          {/* ── Acquisition playbook (static) ──────────────────────────────── */}
          <Section title="Acquisition Playbook" icon={<Bike className="w-4 h-4" />}>
            {/*
              These notes are intentionally baked into the dashboard so the
              growth and ops team sees them alongside the live metrics.
              Update this section as you learn what works in practice.
            */}
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <p className="font-semibold text-brand-orange">Phase 1 — Anchor city (0–500 users)</p>
                <ul className="text-brand-chrome text-xs space-y-1.5 leading-relaxed list-disc list-inside ml-1">
                  <li>Pick one city (recommend London, Manchester, or Birmingham) and focus entirely on it</li>
                  <li>Attend local Coffee &amp; Cruisers events with a sign-up QR code and branded stickers</li>
                  <li>DM local Facebook riding group admins (UK Bikers, London Motorcycle Riders) for a post</li>
                  <li>Target female riders specifically — Litas London, Women Riders UK chapters</li>
                  <li>Metric to unlock Phase 2: 50+ active users in anchor city with &gt;25% female split</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="font-semibold text-brand-orange">Phase 2 — City cluster (500–2,000 users)</p>
                <ul className="text-brand-chrome text-xs space-y-1.5 leading-relaxed list-disc list-inside ml-1">
                  <li>Expand to the 2–3 next-largest cities while maintaining anchor city density</li>
                  <li>Sponsor a local rally or charity ride-out (branding + QR code on programmes)</li>
                  <li>Launch Instagram geo-targeted ads in new cities (£5–10/day, 18–45, interests: motorcycles)</li>
                  <li>Activate referral program: 1 free Premium week per referred user who onboards</li>
                  <li>Metric to unlock Phase 3: 3+ cities above the {CITY_DENSITY_THRESHOLD}-active-user threshold</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="font-semibold text-brand-orange">Phase 3 — National (2,000+ users)</p>
                <ul className="text-brand-chrome text-xs space-y-1.5 leading-relaxed list-disc list-inside ml-1">
                  <li>National press outreach: MCN, Bike, Ride — human-interest angle beats product angle</li>
                  <li>Podcast sponsorship: Throttle Roll, The Bike Shed Moto podcast</li>
                  <li>Affiliate deals with major UK bike insurance brands (Admiral, Bennetts, Devitt)</li>
                  <li>App Store search ads targeting "motorcycle dating", "biker singles"</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="font-semibold text-brand-orange">Ongoing — Retention first</p>
                <ul className="text-brand-chrome text-xs space-y-1.5 leading-relaxed list-disc list-inside ml-1">
                  <li>Acquiring users costs 5–10× more than retaining them — fix churn before scaling ads</li>
                  <li>Seasonal spikes: spring/summer riding season → launch campaigns March–April</li>
                  <li>Event calendar integration: notify users of rallies in their area to drive rides together</li>
                  <li>Premium conversion: users who match and message within 48h are the best Premium prospects</li>
                </ul>
              </div>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
