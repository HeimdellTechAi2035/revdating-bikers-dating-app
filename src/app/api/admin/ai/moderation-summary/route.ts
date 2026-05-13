import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  generateAdminModerationSummary,
  OpenAIAdminModerationConfigurationError,
  OpenAIAdminModerationError,
  type AdminModerationInput,
} from '@/lib/ai/admin-moderation';
import {
  consumeAiAllowance,
  getAiPlanForUser,
  recordAiUsageCompletion,
  type AiAllowanceResult,
  type AiPlanName,
} from '@/lib/ai/usage';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const HOURLY_LIMIT = 20;
const HOURLY_WINDOW_MS = 60 * 60_000;
const BURST_LIMIT = 5;
const BURST_WINDOW_MS = 60_000;
const AI_FEATURE = 'admin_moderation_summary' as const;
const AI_MODEL = process.env.OPENAI_ADMIN_MODERATION_MODEL || 'gpt-5.4-nano';

const bodySchema = z.object({
  report_id: z.string().uuid(),
}).strict();

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'AI moderation assistant is temporarily unavailable.' },
      { status: 503 },
    );
  }

  const burst = checkRateLimit(`ai-admin-moderation-burst:${user.id}`, BURST_LIMIT, BURST_WINDOW_MS);
  if (!burst.allowed) return rateLimitedResponse(burst.resetAt);

  const hourly = checkRateLimit(`ai-admin-moderation:${user.id}`, HOURLY_LIMIT, HOURLY_WINDOW_MS);
  if (!hourly.allowed) return rateLimitedResponse(hourly.resetAt);

  const admin = createAdminClient();
  const { report_id } = parsed.data;
  const requestId = crypto.randomUUID();
  const planName = await safeGetAdminAiPlan(user.id);
  const allowance = await consumeAiAllowance({
    userId: user.id,
    feature: AI_FEATURE,
    planName,
    requestId,
  });

  const { data: report } = await admin
    .from('reports')
    .select('id, reason, description, status, created_at, photo_id, reporter_id, reported_id')
    .eq('id', report_id)
    .single() as unknown as {
      data: (AdminModerationInput['report'] & { photo_id: string | null; reporter_id: string; reported_id: string }) | null;
      error: { message: string } | null;
    };

  if (!report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  const safeProfileSelect = [
    'display_name',
    'bio',
    'city',
    'country',
    'dating_intent',
    'riding_style',
    'years_riding',
    'mood',
    'club_type',
    'is_banned',
  ].join(', ');

  const reporterProfileQuery = admin
    .from('profiles')
    .select(safeProfileSelect)
    .eq('id', report.reporter_id)
    .maybeSingle() as unknown as Promise<{
      data: AdminModerationInput['reporterProfile'] | null;
      error: { message: string } | null;
    }>;

  const reportedProfileQuery = admin
    .from('profiles')
    .select(safeProfileSelect)
    .eq('id', report.reported_id)
    .maybeSingle() as unknown as Promise<{
      data: AdminModerationInput['reportedProfile'] | null;
      error: { message: string } | null;
    }>;

  const [reporterProfileResult, reportedProfileResult] = await Promise.all([
    reporterProfileQuery,
    reportedProfileQuery,
  ]);

  const moderationInput: AdminModerationInput = {
    report: {
      reason: report.reason,
      description: report.description,
      status: report.status,
      created_at: report.created_at,
      has_reported_photo: Boolean(report.photo_id),
    },
    reporterProfile: reporterProfileResult.data,
    reportedProfile: reportedProfileResult.data,
    reportedContent: report.photo_id
      ? {
          type: 'photo',
          note: 'The report is attached to a specific profile photo. Review the reported photo in the existing admin reports UI.',
        }
      : {
          type: 'profile_or_message',
          note: 'No specific content object is attached to this report row. Review the report description and public profile summary; do not assume full chat context.',
        },
  };

  const inputCharCount = safeJsonLength(moderationInput);

  try {
    const summary = await generateAdminModerationSummary(moderationInput);
    await recordAiUsageCompletion({
      userId: user.id,
      feature: AI_FEATURE,
      planName,
      outcome: 'completed',
      requestId,
      model: AI_MODEL,
      inputCharCount,
      outputItemCount: 1,
      riskLevel: summary.risk_level,
      riskCategories: summary.categories,
      relatedEntityType: 'report',
      relatedEntityId: report_id,
      metadata: usageMetadata(allowance, '/api/admin/ai/moderation-summary'),
    });

    return NextResponse.json({
      ...summary,
      rate_limit: {
        remaining: hourly.remaining,
        reset_at: new Date(hourly.resetAt).toISOString(),
      },
      ai_usage: aiUsageResponse(allowance),
    });
  } catch (error) {
    if (error instanceof OpenAIAdminModerationConfigurationError) {
      await recordAiUsageCompletion({
        userId: user.id,
        feature: AI_FEATURE,
        planName,
        outcome: 'configuration_error',
        requestId,
        model: AI_MODEL,
        inputCharCount,
        relatedEntityType: 'report',
        relatedEntityId: report_id,
        metadata: { ...usageMetadata(allowance, '/api/admin/ai/moderation-summary'), error_code: 'openai_configuration' },
      });
      return NextResponse.json(
        { error: 'AI moderation assistant is temporarily unavailable.', ai_usage: aiUsageResponse(allowance) },
        { status: 503 },
      );
    }

    if (error instanceof OpenAIAdminModerationError) {
      await recordAiUsageCompletion({
        userId: user.id,
        feature: AI_FEATURE,
        planName,
        outcome: 'provider_error',
        requestId,
        model: AI_MODEL,
        inputCharCount,
        relatedEntityType: 'report',
        relatedEntityId: report_id,
        metadata: { ...usageMetadata(allowance, '/api/admin/ai/moderation-summary'), error_code: 'openai_provider' },
      });
      return NextResponse.json(
        { error: 'AI moderation assistant could not generate a summary right now. Please try again later.', ai_usage: aiUsageResponse(allowance) },
        { status: 502 },
      );
    }

    await recordAiUsageCompletion({
      userId: user.id,
      feature: AI_FEATURE,
      planName,
      outcome: 'provider_error',
      requestId,
      model: AI_MODEL,
      inputCharCount,
      relatedEntityType: 'report',
      relatedEntityId: report_id,
      metadata: { ...usageMetadata(allowance, '/api/admin/ai/moderation-summary'), error_code: 'unexpected' },
    });
    console.error('[POST /api/admin/ai/moderation-summary] Unexpected error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'AI moderation assistant could not generate a summary right now. Please try again later.', ai_usage: aiUsageResponse(allowance) },
      { status: 500 },
    );
  }
}

function rateLimitedResponse(resetAt: number) {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json(
    {
      error: 'You have reached the AI moderation summary limit. Please try again later.',
      rate_limit: {
        remaining: 0,
        reset_at: new Date(resetAt).toISOString(),
      },
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
      },
    },
  );
}

async function safeGetAdminAiPlan(userId: string): Promise<AiPlanName> {
  try {
    return await getAiPlanForUser(userId, { admin: true });
  } catch (error) {
    console.warn('[POST /api/admin/ai/moderation-summary] AI plan lookup failed:', error instanceof Error ? error.message : 'unknown error');
    return 'admin';
  }
}

function aiUsageResponse(allowance: AiAllowanceResult) {
  return {
    tracking_available: allowance.trackingAvailable,
    feature: allowance.feature,
    plan: allowance.planName,
    weekly_remaining: allowance.weekly.remaining,
    monthly_remaining: allowance.monthly.remaining,
    weekly_reset: allowance.weekly.resetAt || null,
    monthly_reset: allowance.monthly.resetAt || null,
  };
}

function usageMetadata(allowance: AiAllowanceResult, route: string) {
  return {
    route,
    ui_surface: 'admin_reports',
    remaining_weekly: allowance.weekly.remaining,
    remaining_monthly: allowance.monthly.remaining,
  };
}

function safeJsonLength(value: unknown): number | null {
  try {
    return JSON.stringify(value).length;
  } catch {
    return null;
  }
}
