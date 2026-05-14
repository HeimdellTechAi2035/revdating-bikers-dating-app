export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AiFeatureKey, AiPlanName, AiRiskLevel, AiUsageOutcome } from '@/lib/ai/usage';

const FEATURES = [
  'profile_helper',
  'icebreaker',
  'message_safety',
  'ride_planner',
  'admin_moderation_summary',
] as const satisfies readonly AiFeatureKey[];

const PERIODS = ['day', 'week', 'month'] as const;
type UsagePeriod = typeof PERIODS[number];
type FeatureFilter = AiFeatureKey | 'all';

type UntypedSupabase = {
  from: (table: string) => any;
};

type AiUsageEventRow = {
  created_at: string;
  feature: AiFeatureKey;
  plan_at_time: AiPlanName | null;
  outcome: AiUsageOutcome;
  risk_level: AiRiskLevel | null;
  risk_categories: string[] | null;
  output_item_count: number | null;
  input_char_count: number | null;
  related_entity_type: 'match' | 'report' | 'profile' | null;
};

type Totals = {
  events: number;
  completed: number;
  provider_errors: number;
  configuration_errors: number;
  validation_errors: number;
  limited: number;
};

type GroupCount = {
  key: string;
  total: number;
  completed: number;
  provider_errors: number;
  limited: number;
};

type RiskSummary = {
  risk_level: AiRiskLevel;
  total: number;
  categories: Array<{ category: string; total: number }>;
};

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(request.url);
  const period = parsePeriod(url.searchParams.get('period'));
  const feature = parseFeature(url.searchParams.get('feature'));
  const limit = parseLimit(url.searchParams.get('limit'));
  const generatedAt = new Date().toISOString();
  const since = getPeriodStart(period, new Date()).toISOString();

  const admin = createAdminClient() as unknown as UntypedSupabase;

  try {
    let query = admin
      .from('ai_usage_events')
      .select(
        'created_at, feature, plan_at_time, outcome, risk_level, risk_categories, output_item_count, input_char_count, related_entity_type',
      )
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (feature !== 'all') query = query.eq('feature', feature);

    const { data, error } = await query;

    if (error) {
      if (isMissingTrackingTableError(error)) {
        return NextResponse.json(unavailableResponse(period, feature, generatedAt));
      }

      console.error('[GET /api/admin/ai/usage] failed to load usage metadata:', safeErrorMessage(error));
      return NextResponse.json({ error: 'Failed to load AI usage metadata' }, { status: 500 });
    }

    const events = sanitizeRows(data ?? []);

    return NextResponse.json({
      tracking_available: true,
      period,
      feature,
      generated_at: generatedAt,
      totals: buildTotals(events),
      by_feature: groupBy(events, (event) => event.feature),
      by_plan: groupBy(events, (event) => event.plan_at_time ?? 'unknown'),
      risk_summary: buildRiskSummary(events),
      recent_events: events.map(toRecentEvent),
    });
  } catch (error) {
    if (isMissingTrackingTableError(error)) {
      return NextResponse.json(unavailableResponse(period, feature, generatedAt));
    }

    console.error('[GET /api/admin/ai/usage] unexpected error:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Failed to load AI usage metadata' }, { status: 500 });
  }
}

function parsePeriod(value: string | null): UsagePeriod {
  return PERIODS.includes(value as UsagePeriod) ? (value as UsagePeriod) : 'week';
}

function parseFeature(value: string | null): FeatureFilter {
  if (value === 'all') return 'all';
  return FEATURES.includes(value as AiFeatureKey) ? (value as AiFeatureKey) : 'all';
}

function parseLimit(value: string | null): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 100;
  return Math.min(parsed, 500);
}

function getPeriodStart(period: UsagePeriod, now: Date): Date {
  if (period === 'day') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  if (period === 'month') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = dayStart.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  dayStart.setUTCDate(dayStart.getUTCDate() + diff);
  return dayStart;
}

function sanitizeRows(rows: unknown[]): AiUsageEventRow[] {
  return rows
    .map((row) => sanitizeRow(row))
    .filter((row): row is AiUsageEventRow => Boolean(row));
}

function sanitizeRow(row: unknown): AiUsageEventRow | null {
  if (!row || typeof row !== 'object') return null;
  const record = row as Record<string, unknown>;
  const feature = FEATURES.includes(record.feature as AiFeatureKey) ? (record.feature as AiFeatureKey) : null;
  if (!feature || typeof record.created_at !== 'string') return null;

  return {
    created_at: record.created_at,
    feature,
    plan_at_time: isPlanName(record.plan_at_time) ? record.plan_at_time : null,
    outcome: isOutcome(record.outcome) ? record.outcome : 'completed',
    risk_level: isRiskLevel(record.risk_level) ? record.risk_level : null,
    risk_categories: Array.isArray(record.risk_categories)
      ? record.risk_categories.filter((category): category is string => typeof category === 'string')
      : null,
    output_item_count: typeof record.output_item_count === 'number' ? record.output_item_count : null,
    input_char_count: typeof record.input_char_count === 'number' ? record.input_char_count : null,
    related_entity_type: isRelatedEntityType(record.related_entity_type) ? record.related_entity_type : null,
  };
}

function buildTotals(events: AiUsageEventRow[]): Totals {
  return events.reduce<Totals>((totals, event) => {
    totals.events += 1;
    if (event.outcome === 'completed') totals.completed += 1;
    if (event.outcome === 'provider_error') totals.provider_errors += 1;
    if (event.outcome === 'configuration_error') totals.configuration_errors += 1;
    if (event.outcome === 'validation_error') totals.validation_errors += 1;
    if (event.outcome === 'limited') totals.limited += 1;
    return totals;
  }, emptyTotals());
}

function groupBy(events: AiUsageEventRow[], getKey: (event: AiUsageEventRow) => string): GroupCount[] {
  const groups = new Map<string, GroupCount>();

  events.forEach((event) => {
    const key = getKey(event);
    const group = groups.get(key) ?? { key, total: 0, completed: 0, provider_errors: 0, limited: 0 };
    group.total += 1;
    if (event.outcome === 'completed') group.completed += 1;
    if (event.outcome === 'provider_error') group.provider_errors += 1;
    if (event.outcome === 'limited') group.limited += 1;
    groups.set(key, group);
  });

  return Array.from(groups.values()).sort((a, b) => b.total - a.total);
}

function buildRiskSummary(events: AiUsageEventRow[]): RiskSummary[] {
  const summaries = new Map<AiRiskLevel, { total: number; categories: Map<string, number> }>();

  events.forEach((event) => {
    if (!event.risk_level) return;
    const summary = summaries.get(event.risk_level) ?? { total: 0, categories: new Map<string, number>() };
    summary.total += 1;
    (event.risk_categories ?? []).forEach((category) => {
      summary.categories.set(category, (summary.categories.get(category) ?? 0) + 1);
    });
    summaries.set(event.risk_level, summary);
  });

  return Array.from(summaries.entries())
    .map(([risk_level, summary]) => ({
      risk_level,
      total: summary.total,
      categories: Array.from(summary.categories.entries())
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => riskSortValue(b.risk_level) - riskSortValue(a.risk_level));
}

function toRecentEvent(event: AiUsageEventRow) {
  return {
    created_at: event.created_at,
    feature: event.feature,
    plan_at_time: event.plan_at_time,
    outcome: event.outcome,
    risk_level: event.risk_level,
    output_item_count: event.output_item_count,
    input_char_count: event.input_char_count,
    related_entity_type: event.related_entity_type,
  };
}

function unavailableResponse(period: UsagePeriod, feature: FeatureFilter, generatedAt: string) {
  return {
    tracking_available: false,
    message: 'AI usage tracking tables are not available yet.',
    period,
    feature,
    generated_at: generatedAt,
    totals: {},
    by_feature: [],
    by_plan: [],
    risk_summary: [],
    recent_events: [],
  };
}

function emptyTotals(): Totals {
  return {
    events: 0,
    completed: 0,
    provider_errors: 0,
    configuration_errors: 0,
    validation_errors: 0,
    limited: 0,
  };
}

function isPlanName(value: unknown): value is AiPlanName {
  return ['free', 'rider_plus', 'rider_premium', 'admin'].includes(String(value));
}

function isOutcome(value: unknown): value is AiUsageOutcome {
  return [
    'allowed',
    'completed',
    'limited',
    'provider_error',
    'validation_error',
    'configuration_error',
    'blocked_by_policy',
  ].includes(String(value));
}

function isRiskLevel(value: unknown): value is AiRiskLevel {
  return ['low', 'medium', 'high'].includes(String(value));
}

function isRelatedEntityType(value: unknown): value is AiUsageEventRow['related_entity_type'] {
  return ['match', 'report', 'profile'].includes(String(value));
}

function riskSortValue(riskLevel: AiRiskLevel): number {
  if (riskLevel === 'high') return 3;
  if (riskLevel === 'medium') return 2;
  return 1;
}

function isMissingTrackingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as { code?: unknown; message?: unknown };
  const code = String(record.code ?? '');
  const message = String(record.message ?? '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    code === 'PGRST200' ||
    message.includes('ai_usage_events') && (
      message.includes('does not exist') ||
      message.includes('could not find') ||
      message.includes('schema cache')
    )
  );
}

function safeErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return 'unknown error';
  const record = error as { code?: unknown; message?: unknown };
  return `${String(record.code ?? 'unknown')}: ${String(record.message ?? 'unknown error')}`;
}
