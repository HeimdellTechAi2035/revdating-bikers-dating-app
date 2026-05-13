import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  generateIcebreakers,
  OpenAIIcebreakerConfigurationError,
  OpenAIIcebreakerError,
  type IcebreakerInput,
} from '@/lib/ai/icebreaker';
import {
  consumeAiAllowance,
  getAiPlanForUser,
  recordAiUsageCompletion,
  type AiAllowanceResult,
  type AiPlanName,
} from '@/lib/ai/usage';

const DAILY_LIMIT = 5;
const DAILY_WINDOW_MS = 24 * 60 * 60_000;
const BURST_LIMIT = 1;
const BURST_WINDOW_MS = 60_000;
const AI_FEATURE = 'icebreaker' as const;
const AI_MODEL = process.env.OPENAI_ICEBREAKER_MODEL || 'gpt-5.4-nano';

const bodySchema = z.object({
  match_id: z.string().uuid(),
});

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
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'AI icebreaker helper is temporarily unavailable.' },
      { status: 503 },
    );
  }

  const burst = checkRateLimit(`ai-icebreaker-burst:${user.id}`, BURST_LIMIT, BURST_WINDOW_MS);
  if (!burst.allowed) return rateLimitedResponse(burst.resetAt);

  const daily = checkRateLimit(`ai-icebreaker:${user.id}`, DAILY_LIMIT, DAILY_WINDOW_MS);
  if (!daily.allowed) return rateLimitedResponse(daily.resetAt);

  const { match_id } = parsed.data;
  const requestId = crypto.randomUUID();
  const planName = await safeGetAiPlan(user.id);
  const allowance = await consumeAiAllowance({
    userId: user.id,
    feature: AI_FEATURE,
    planName,
    requestId,
  });

  const { data: match } = await supabase
    .from('matches')
    .select('id, user1_id, user2_id, is_active')
    .eq('id', match_id)
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .single() as unknown as {
      data: { id: string; user1_id: string; user2_id: string; is_active: boolean } | null;
      error: { message: string } | null;
    };

  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }

  if (!match.is_active) {
    return NextResponse.json({ error: 'Match is no longer active' }, { status: 403 });
  }

  const targetUserId = match.user1_id === user.id ? match.user2_id : match.user1_id;

  const safeProfileSelect =
    'display_name, bio, city, country, dating_intent, riding_style, years_riding, mood, club_type';

  const currentProfileQuery = supabase
    .from('profiles')
    .select(safeProfileSelect)
    .eq('id', user.id)
    .single() as unknown as Promise<{
      data: IcebreakerInput['currentUser'] | null;
      error: { message: string } | null;
    }>;

  const targetProfileQuery = supabase
    .from('profiles')
    .select(safeProfileSelect)
    .eq('id', targetUserId)
    .eq('is_active', true)
    .eq('is_banned', false)
    .single() as unknown as Promise<{
      data: IcebreakerInput['targetProfile'] | null;
      error: { message: string } | null;
    }>;

  const targetPrimaryBikeQuery = supabase
    .from('bikes')
    .select('bike_brand, bike_model, bike_year, bike_type')
    .eq('user_id', targetUserId)
    .eq('primary_bike', true)
    .maybeSingle() as unknown as Promise<{
      data: IcebreakerInput['targetPrimaryBike'] | null;
      error: { message: string } | null;
    }>;

  const [currentProfileResult, targetProfileResult, targetBikeResult] = await Promise.all([
    currentProfileQuery,
    targetProfileQuery,
    targetPrimaryBikeQuery,
  ]);

  if (!targetProfileResult.data) {
    return NextResponse.json({ error: 'Profile not available' }, { status: 404 });
  }

  const input: IcebreakerInput = {
    currentUser: currentProfileResult.data,
    targetProfile: targetProfileResult.data,
    targetPrimaryBike: targetBikeResult.data,
  };
  const inputCharCount = safeJsonLength(input);

  try {
    const suggestions = await generateIcebreakers(input);
    await recordAiUsageCompletion({
      userId: user.id,
      feature: AI_FEATURE,
      planName,
      outcome: 'completed',
      requestId,
      model: AI_MODEL,
      inputCharCount,
      outputItemCount: 3,
      relatedEntityType: 'match',
      relatedEntityId: match_id,
      metadata: usageMetadata(allowance, '/api/ai/icebreaker'),
    });

    return NextResponse.json({
      ...suggestions,
      rate_limit: {
        remaining: daily.remaining,
        reset_at: new Date(daily.resetAt).toISOString(),
      },
      ai_usage: aiUsageResponse(allowance),
    });
  } catch (error) {
    if (error instanceof OpenAIIcebreakerConfigurationError) {
      await recordAiUsageCompletion({
        userId: user.id,
        feature: AI_FEATURE,
        planName,
        outcome: 'configuration_error',
        requestId,
        model: AI_MODEL,
        inputCharCount,
        relatedEntityType: 'match',
        relatedEntityId: match_id,
        metadata: { ...usageMetadata(allowance, '/api/ai/icebreaker'), error_code: 'openai_configuration' },
      });
      return NextResponse.json(
        { error: 'AI icebreaker helper is temporarily unavailable.', ai_usage: aiUsageResponse(allowance) },
        { status: 503 },
      );
    }

    if (error instanceof OpenAIIcebreakerError) {
      await recordAiUsageCompletion({
        userId: user.id,
        feature: AI_FEATURE,
        planName,
        outcome: 'provider_error',
        requestId,
        model: AI_MODEL,
        inputCharCount,
        relatedEntityType: 'match',
        relatedEntityId: match_id,
        metadata: { ...usageMetadata(allowance, '/api/ai/icebreaker'), error_code: 'openai_provider' },
      });
      return NextResponse.json(
        { error: 'AI icebreaker helper could not generate suggestions right now. Please try again later.', ai_usage: aiUsageResponse(allowance) },
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
      relatedEntityType: 'match',
      relatedEntityId: match_id,
      metadata: { ...usageMetadata(allowance, '/api/ai/icebreaker'), error_code: 'unexpected' },
    });
    console.error('[POST /api/ai/icebreaker] Unexpected error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'AI icebreaker helper could not generate suggestions right now. Please try again later.', ai_usage: aiUsageResponse(allowance) },
      { status: 500 },
    );
  }
}

function rateLimitedResponse(resetAt: number) {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json(
    {
      error: 'You have reached the AI icebreaker limit. Please try again later.',
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

async function safeGetAiPlan(userId: string): Promise<AiPlanName> {
  try {
    return await getAiPlanForUser(userId);
  } catch (error) {
    console.warn('[POST /api/ai/icebreaker] AI plan lookup failed:', error instanceof Error ? error.message : 'unknown error');
    return 'free';
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
    ui_surface: 'chat',
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
