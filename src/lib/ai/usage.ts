import 'server-only';

import { getUserPlan } from '@/lib/premium';
import { createAdminClient } from '@/lib/supabase/admin';

export const AI_FEATURES = [
  'profile_helper',
  'icebreaker',
  'message_safety',
  'ride_planner',
  'admin_moderation_summary',
] as const;

export type AiFeatureKey = typeof AI_FEATURES[number];

export const AI_PLAN_NAMES = ['free', 'rider_plus', 'rider_premium', 'admin'] as const;
export type AiPlanName = typeof AI_PLAN_NAMES[number];

export const AI_USAGE_OUTCOMES = [
  'allowed',
  'completed',
  'limited',
  'provider_error',
  'validation_error',
  'configuration_error',
  'blocked_by_policy',
] as const;

export type AiUsageOutcome = typeof AI_USAGE_OUTCOMES[number];
export type AiCompletionOutcome = Exclude<AiUsageOutcome, 'allowed' | 'limited'> | 'completed';
export type AiPeriodType = 'week' | 'month';
export type AiRiskLevel = 'low' | 'medium' | 'high';
export type AiRelatedEntityType = 'match' | 'report' | 'profile';

export type AiSafeMetadataKey =
  | 'ride_length'
  | 'vibe'
  | 'remaining_weekly'
  | 'remaining_monthly'
  | 'route'
  | 'ui_surface'
  | 'error_code';

type AiSafeMetadataValue = string | number | boolean | null;
export type AiSafeMetadata = Partial<Record<AiSafeMetadataKey, AiSafeMetadataValue>>;

type AiFeatureLimitRow = {
  plan_name: AiPlanName;
  feature: AiFeatureKey;
  period_type: AiPeriodType;
  limit_count: number | null;
  enabled: boolean;
  hard_block: boolean;
};

type AiUsageCounterRow = {
  user_id: string;
  feature: AiFeatureKey;
  period_type: AiPeriodType;
  period_start: string;
  used_count: number;
  limited_count: number;
  last_used_at: string | null;
};

type UntypedSupabase = {
  from: (table: string) => any;
};

export type AiPeriodAllowance = {
  periodType: AiPeriodType;
  periodStart: string;
  resetAt: string;
  enabled: boolean;
  hardBlock: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
};

export type AiAllowanceResult = {
  feature: AiFeatureKey;
  planName: AiPlanName;
  allowed: boolean;
  limited: boolean;
  hardBlock: boolean;
  trackingAvailable: boolean;
  reason: 'allowed' | 'feature_disabled' | 'quota_exceeded' | 'tracking_unavailable';
  weekly: AiPeriodAllowance;
  monthly: AiPeriodAllowance;
};

export type AiAllowanceSummary = {
  feature: AiFeatureKey;
  planName: AiPlanName;
  enabled: boolean;
  weekly: Pick<AiPeriodAllowance, 'limit' | 'used' | 'remaining' | 'resetAt'>;
  monthly: Pick<AiPeriodAllowance, 'limit' | 'used' | 'remaining' | 'resetAt'>;
};

export type CheckAiAllowanceParams = {
  userId: string;
  feature: AiFeatureKey;
  planName?: AiPlanName;
  requestId?: string;
};

export type ConsumeAiAllowanceParams = CheckAiAllowanceParams;

export type RecordAiUsageEventParams = {
  userId?: string | null;
  feature: AiFeatureKey;
  planName?: AiPlanName | null;
  outcome: AiUsageOutcome;
  requestId?: string | null;
  model?: string | null;
  providerRequestMs?: number | null;
  inputCharCount?: number | null;
  outputItemCount?: number | null;
  riskLevel?: AiRiskLevel | null;
  riskCategories?: string[] | null;
  relatedEntityType?: AiRelatedEntityType | null;
  relatedEntityId?: string | null;
  metadata?: AiSafeMetadata;
  createdAt?: string;
};

export type RecordAiUsageCompletionParams = Omit<RecordAiUsageEventParams, 'outcome'> & {
  outcome: AiCompletionOutcome;
};

const SAFE_METADATA_KEYS = new Set<AiSafeMetadataKey>([
  'ride_length',
  'vibe',
  'remaining_weekly',
  'remaining_monthly',
  'route',
  'ui_surface',
  'error_code',
]);

const DEFAULT_UNAVAILABLE_LIMIT: AiPeriodAllowance = {
  periodType: 'week',
  periodStart: '',
  resetAt: '',
  enabled: false,
  hardBlock: false,
  limit: null,
  used: 0,
  remaining: null,
};

export async function getAiPlanForUser(
  userId: string,
  options: { admin?: boolean } = {},
): Promise<AiPlanName> {
  if (options.admin) return 'admin';
  return getUserPlan(userId);
}

export async function checkAiAllowance(params: CheckAiAllowanceParams): Promise<AiAllowanceResult> {
  const planName = params.planName ?? await getAiPlanForUser(params.userId);
  const periods = getCurrentAiPeriods();

  try {
    const admin = getUntypedAdminClient();
    const limits = await fetchFeatureLimits(admin, planName, params.feature);
    const weeklyLimit = limits.week;
    const monthlyLimit = limits.month;

    if (!weeklyLimit || !monthlyLimit) {
      return buildUnavailableAllowance(params.feature, planName, periods);
    }

    const [weeklyCounter, monthlyCounter] = await Promise.all([
      fetchUsageCounter(admin, params.userId, params.feature, 'week', periods.week.periodStart),
      fetchUsageCounter(admin, params.userId, params.feature, 'month', periods.month.periodStart),
    ]);

    const weekly = buildPeriodAllowance('week', periods.week, weeklyLimit, weeklyCounter?.used_count ?? 0);
    const monthly = buildPeriodAllowance('month', periods.month, monthlyLimit, monthlyCounter?.used_count ?? 0);
    const enabled = weekly.enabled && monthly.enabled;
    const quotaExceeded = isPeriodLimited(weekly) || isPeriodLimited(monthly);
    const hardBlock = weekly.hardBlock || monthly.hardBlock;

    return {
      feature: params.feature,
      planName,
      allowed: enabled && !quotaExceeded,
      limited: !enabled || quotaExceeded,
      hardBlock,
      trackingAvailable: true,
      reason: !enabled ? 'feature_disabled' : quotaExceeded ? 'quota_exceeded' : 'allowed',
      weekly,
      monthly,
    };
  } catch (error) {
    logAiUsageWarning('check allowance failed; allowing until tracking tables are available', error);
    return buildUnavailableAllowance(params.feature, planName, periods);
  }
}

export async function consumeAiAllowance(params: ConsumeAiAllowanceParams): Promise<AiAllowanceResult> {
  const allowance = await checkAiAllowance(params);
  if (!allowance.trackingAvailable) return allowance;

  const now = new Date().toISOString();
  const countField: 'used_count' | 'limited_count' = allowance.allowed ? 'used_count' : 'limited_count';

  try {
    const admin = getUntypedAdminClient();
    await Promise.all([
      incrementCounterBestEffort(admin, params.userId, params.feature, 'week', allowance.weekly.periodStart, countField, now),
      incrementCounterBestEffort(admin, params.userId, params.feature, 'month', allowance.monthly.periodStart, countField, now),
    ]);
  } catch (error) {
    logAiUsageWarning('consume allowance counter update failed', error);
  }

  return allowance;
}

export async function recordAiUsageEvent(params: RecordAiUsageEventParams): Promise<void> {
  try {
    const periods = getCurrentAiPeriods(params.createdAt ? new Date(params.createdAt) : undefined);
    const admin = getUntypedAdminClient();
    const metadata = sanitizeMetadata(params.metadata);

    const { error } = await admin
      .from('ai_usage_events')
      .insert({
        user_id: params.userId ?? null,
        feature: params.feature,
        plan_at_time: params.planName ?? null,
        outcome: params.outcome,
        period_week_start: periods.week.periodStart,
        period_month_start: periods.month.periodStart,
        model: params.model ?? null,
        request_id: params.requestId ?? null,
        provider_request_ms: params.providerRequestMs ?? null,
        input_char_count: params.inputCharCount ?? null,
        output_item_count: params.outputItemCount ?? null,
        risk_level: params.riskLevel ?? null,
        risk_categories: params.riskCategories ?? null,
        related_entity_type: params.relatedEntityType ?? null,
        related_entity_id: params.relatedEntityId ?? null,
        metadata,
        created_at: params.createdAt ?? new Date().toISOString(),
      });

    if (error) logAiUsageWarning('record usage event failed', error);
  } catch (error) {
    logAiUsageWarning('record usage event failed', error);
  }
}

export async function recordAiUsageCompletion(params: RecordAiUsageCompletionParams): Promise<void> {
  await recordAiUsageEvent(params);
}

export async function getAiAllowanceSummary(params: CheckAiAllowanceParams): Promise<AiAllowanceSummary> {
  const allowance = await checkAiAllowance(params);
  return {
    feature: allowance.feature,
    planName: allowance.planName,
    enabled: allowance.weekly.enabled && allowance.monthly.enabled,
    weekly: pickSummaryPeriod(allowance.weekly),
    monthly: pickSummaryPeriod(allowance.monthly),
  };
}

function getUntypedAdminClient(): UntypedSupabase {
  return createAdminClient() as unknown as UntypedSupabase;
}

async function fetchFeatureLimits(
  admin: UntypedSupabase,
  planName: AiPlanName,
  feature: AiFeatureKey,
): Promise<Partial<Record<AiPeriodType, AiFeatureLimitRow>>> {
  const { data, error } = await admin
    .from('ai_feature_limits')
    .select('plan_name, feature, period_type, limit_count, enabled, hard_block')
    .eq('plan_name', planName)
    .eq('feature', feature)
    .in('period_type', ['week', 'month']);

  if (error) throw error;

  return ((data ?? []) as AiFeatureLimitRow[]).reduce<Partial<Record<AiPeriodType, AiFeatureLimitRow>>>(
    (acc, row) => {
      acc[row.period_type] = row;
      return acc;
    },
    {},
  );
}

async function fetchUsageCounter(
  admin: UntypedSupabase,
  userId: string,
  feature: AiFeatureKey,
  periodType: AiPeriodType,
  periodStart: string,
): Promise<AiUsageCounterRow | null> {
  const { data, error } = await admin
    .from('ai_usage_counters')
    .select('user_id, feature, period_type, period_start, used_count, limited_count, last_used_at')
    .eq('user_id', userId)
    .eq('feature', feature)
    .eq('period_type', periodType)
    .eq('period_start', periodStart)
    .maybeSingle();

  if (error) throw error;
  return (data as AiUsageCounterRow | null) ?? null;
}

/**
 * Best-effort counter increment using the unique period constraint to avoid
 * duplicate rows. This is safe enough for pre-RPC integration scaffolding, but
 * not a fully atomic increment under high concurrency. Before hard-enforcing
 * quotas in routes, prefer a Postgres RPC that checks limits and increments
 * counters in one transaction.
 */
async function incrementCounterBestEffort(
  admin: UntypedSupabase,
  userId: string,
  feature: AiFeatureKey,
  periodType: AiPeriodType,
  periodStart: string,
  countField: 'used_count' | 'limited_count',
  now: string,
): Promise<void> {
  const existing = await fetchUsageCounter(admin, userId, feature, periodType, periodStart);

  if (!existing) {
    const payload = {
      user_id: userId,
      feature,
      period_type: periodType,
      period_start: periodStart,
      used_count: countField === 'used_count' ? 1 : 0,
      limited_count: countField === 'limited_count' ? 1 : 0,
      last_used_at: now,
    };
    const { error } = await admin.from('ai_usage_counters').insert(payload);
    if (!error) return;

    // A concurrent request may have inserted the unique row first; refetch and update below.
    if (!isUniqueViolation(error)) throw error;
  }

  const latest = existing ?? await fetchUsageCounter(admin, userId, feature, periodType, periodStart);
  const current = latest?.[countField] ?? 0;
  const { error } = await admin
    .from('ai_usage_counters')
    .update({
      [countField]: current + 1,
      last_used_at: now,
    })
    .eq('user_id', userId)
    .eq('feature', feature)
    .eq('period_type', periodType)
    .eq('period_start', periodStart);

  if (error) throw error;
}

function buildPeriodAllowance(
  periodType: AiPeriodType,
  period: { periodStart: string; resetAt: string },
  limit: AiFeatureLimitRow,
  used: number,
): AiPeriodAllowance {
  const remaining = limit.limit_count === null ? null : Math.max(0, limit.limit_count - used);
  return {
    periodType,
    periodStart: period.periodStart,
    resetAt: period.resetAt,
    enabled: limit.enabled,
    hardBlock: limit.hard_block,
    limit: limit.limit_count,
    used,
    remaining,
  };
}

function isPeriodLimited(period: AiPeriodAllowance): boolean {
  return period.enabled && period.limit !== null && period.used >= period.limit;
}

function buildUnavailableAllowance(
  feature: AiFeatureKey,
  planName: AiPlanName,
  periods: ReturnType<typeof getCurrentAiPeriods>,
): AiAllowanceResult {
  return {
    feature,
    planName,
    allowed: true,
    limited: false,
    hardBlock: false,
    trackingAvailable: false,
    reason: 'tracking_unavailable',
    weekly: {
      ...DEFAULT_UNAVAILABLE_LIMIT,
      periodType: 'week',
      periodStart: periods.week.periodStart,
      resetAt: periods.week.resetAt,
    },
    monthly: {
      ...DEFAULT_UNAVAILABLE_LIMIT,
      periodType: 'month',
      periodStart: periods.month.periodStart,
      resetAt: periods.month.resetAt,
    },
  };
}

function getCurrentAiPeriods(now = new Date()) {
  const weekStart = startOfUtcWeek(now);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextWeek = addUtcDays(weekStart, 7);
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  return {
    week: {
      periodStart: toDateString(weekStart),
      resetAt: nextWeek.toISOString(),
    },
    month: {
      periodStart: toDateString(monthStart),
      resetAt: nextMonth.toISOString(),
    },
  };
}

function startOfUtcWeek(date: Date): Date {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = start.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addUtcDays(start, diff);
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function pickSummaryPeriod(period: AiPeriodAllowance): Pick<AiPeriodAllowance, 'limit' | 'used' | 'remaining' | 'resetAt'> {
  return {
    limit: period.limit,
    used: period.used,
    remaining: period.remaining,
    resetAt: period.resetAt,
  };
}

function sanitizeMetadata(metadata: AiSafeMetadata | undefined): AiSafeMetadata {
  if (!metadata) return {};

  return Object.entries(metadata).reduce<AiSafeMetadata>((acc, [key, value]) => {
    if (!SAFE_METADATA_KEYS.has(key as AiSafeMetadataKey)) return acc;
    if (!isSafeMetadataValue(value)) return acc;
    acc[key as AiSafeMetadataKey] = value;
    return acc;
  }, {});
}

function isSafeMetadataValue(value: unknown): value is AiSafeMetadataValue {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && String((error as { code?: unknown }).code) === '23505';
}

function logAiUsageWarning(message: string, error: unknown) {
  const detail = error instanceof Error ? error.message : typeof error === 'string' ? error : 'unknown error';
  console.warn(`[ai-usage] ${message}: ${detail}`);
}
