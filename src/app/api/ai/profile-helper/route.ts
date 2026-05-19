import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  generateProfileHelperSuggestions,
  OpenAIConfigurationError,
  OpenAIProfileHelperError,
  type ProfileHelperInput,
} from '@/lib/ai/profile-helper';
import {
  consumeAiAllowance,
  getAiPlanForUser,
  recordAiUsageCompletion,
  type AiAllowanceResult,
  type AiPlanName,
} from '@/lib/ai/usage';

const DAILY_LIMIT = 3;
const DAILY_WINDOW_MS = 24 * 60 * 60_000;
const BURST_LIMIT = 1;
const BURST_WINDOW_MS = 60_000;
const AI_FEATURE = 'profile_helper' as const;
const AI_MODEL = process.env.OPENAI_PROFILE_HELPER_MODEL || 'gpt-5.4-nano';

export async function POST() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'AI helper is temporarily unavailable.' },
      { status: 503 },
    );
  }

  const burst = checkRateLimit(`ai-profile-helper-burst:${user.id}`, BURST_LIMIT, BURST_WINDOW_MS);
  if (!burst.allowed) return rateLimitedResponse(burst.resetAt);

  const daily = checkRateLimit(`ai-profile-helper:${user.id}`, DAILY_LIMIT, DAILY_WINDOW_MS);
  if (!daily.allowed) return rateLimitedResponse(daily.resetAt);

  const requestId = crypto.randomUUID();
  const planName = await safeGetAiPlan(user.id);
  const allowance = await consumeAiAllowance({
    userId: user.id,
    feature: AI_FEATURE,
    planName,
    requestId,
  });

  const profileQuery = supabase
    .from('profiles')
    .select(
      'display_name, bio, city, country, dating_intent, riding_style, years_riding, ' +
      'attends_rallies, smoker, drinker, has_passenger_helmet, mood, club_type, children_status',
    )
    .eq('id', user.id)
    .single() as unknown as Promise<{
      data: ProfileHelperInput['profile'] | null;
      error: { message: string } | null;
    }>;

  const primaryBikeQuery = supabase
    .from('bikes')
    .select('bike_brand, bike_model, bike_year, bike_type')
    .eq('user_id', user.id)
    .eq('primary_bike', true)
    .maybeSingle() as unknown as Promise<{
      data: NonNullable<ProfileHelperInput['primaryBike']> | null;
      error: { message: string } | null;
    }>;

  const [{ data: profile, error: profileError }, { data: primaryBike }] = await Promise.all([
    profileQuery,
    primaryBikeQuery,
  ]);

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const helperInput: ProfileHelperInput = {
    profile: {
      display_name: profile.display_name,
      bio: profile.bio,
      city: profile.city,
      country: profile.country,
      dating_intent: profile.dating_intent,
      riding_style: profile.riding_style,
      years_riding: profile.years_riding,
      attends_rallies: profile.attends_rallies,
      smoker: profile.smoker,
      drinker: profile.drinker,
      has_passenger_helmet: profile.has_passenger_helmet,
      mood: profile.mood,
      club_type: profile.club_type,
      children_status: profile.children_status,
    },
    primaryBike: primaryBike
      ? {
          bike_brand: primaryBike.bike_brand,
          bike_model: primaryBike.bike_model,
          bike_year: primaryBike.bike_year,
          bike_type: primaryBike.bike_type,
        }
      : null,
  };

  const inputCharCount = safeJsonLength(helperInput);

  try {
    const suggestions = await generateProfileHelperSuggestions(helperInput);
    await recordAiUsageCompletion({
      userId: user.id,
      feature: AI_FEATURE,
      planName,
      outcome: 'completed',
      requestId,
      model: AI_MODEL,
      inputCharCount,
      outputItemCount: 4,
      metadata: usageMetadata(allowance, '/api/ai/profile-helper'),
    });

    return NextResponse.json({
      suggestions,
      rate_limit: {
        remaining: daily.remaining,
        reset_at: new Date(daily.resetAt).toISOString(),
      },
      ai_usage: aiUsageResponse(allowance),
    });
  } catch (error) {
    if (error instanceof OpenAIConfigurationError) {
      await recordAiUsageCompletion({
        userId: user.id,
        feature: AI_FEATURE,
        planName,
        outcome: 'configuration_error',
        requestId,
        model: AI_MODEL,
        inputCharCount,
        metadata: { ...usageMetadata(allowance, '/api/ai/profile-helper'), error_code: 'openai_configuration' },
      });
      return NextResponse.json(
        { error: 'AI helper is temporarily unavailable.', ai_usage: aiUsageResponse(allowance) },
        { status: 503 },
      );
    }

    if (error instanceof OpenAIProfileHelperError) {
      await recordAiUsageCompletion({
        userId: user.id,
        feature: AI_FEATURE,
        planName,
        outcome: 'provider_error',
        requestId,
        model: AI_MODEL,
        inputCharCount,
        metadata: { ...usageMetadata(allowance, '/api/ai/profile-helper'), error_code: 'openai_provider' },
      });
      return NextResponse.json(
        { error: 'AI helper could not generate suggestions right now. Please try again later.', ai_usage: aiUsageResponse(allowance) },
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
      metadata: { ...usageMetadata(allowance, '/api/ai/profile-helper'), error_code: 'unexpected' },
    });
    console.error('[POST /api/ai/profile-helper] Unexpected error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'AI helper could not generate suggestions right now. Please try again later.', ai_usage: aiUsageResponse(allowance) },
      { status: 500 },
    );
  }
}

function rateLimitedResponse(resetAt: number) {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json(
    {
      error: 'You have reached the AI helper limit. Please try again later.',
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
    console.warn('[POST /api/ai/profile-helper] AI plan lookup failed:', error instanceof Error ? error.message : 'unknown error');
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
    ui_surface: 'profile_edit',
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
