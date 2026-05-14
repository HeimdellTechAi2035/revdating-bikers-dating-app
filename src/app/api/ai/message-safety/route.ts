import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  assessMessageSafety,
  LOW_RISK_MESSAGE_SAFETY_RESULT,
  OpenAIMessageSafetyConfigurationError,
  OpenAIMessageSafetyError,
} from '@/lib/ai/message-safety';
import {
  consumeAiAllowance,
  getAiPlanForUser,
  recordAiUsageCompletion,
  type AiAllowanceResult,
  type AiPlanName,
} from '@/lib/ai/usage';

const HOURLY_LIMIT = 30;
const HOURLY_WINDOW_MS = 60 * 60_000;
const BURST_LIMIT = 10;
const BURST_WINDOW_MS = 60_000;
const AI_FEATURE = 'message_safety' as const;
const AI_MODEL = process.env.OPENAI_SAFETY_MODEL || 'gpt-5.4-nano';

const requestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
}).strict();

export async function POST(request: NextRequest) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const burst = checkRateLimit(`ai-message-safety-burst:${user.id}`, BURST_LIMIT, BURST_WINDOW_MS);
  if (!burst.allowed) return rateLimitedResponse(burst.resetAt);

  const hourly = checkRateLimit(`ai-message-safety:${user.id}`, HOURLY_LIMIT, HOURLY_WINDOW_MS);
  if (!hourly.allowed) return rateLimitedResponse(hourly.resetAt);

  const requestId = crypto.randomUUID();
  const planName = await safeGetAiPlan(user.id);
  const allowance = await consumeAiAllowance({
    userId: user.id,
    feature: AI_FEATURE,
    planName,
    requestId,
  });
  const inputCharCount = parsed.data.message.length;

  try {
    const safety = await assessMessageSafety(parsed.data.message);
    await recordAiUsageCompletion({
      userId: user.id,
      feature: AI_FEATURE,
      planName,
      outcome: 'completed',
      requestId,
      model: AI_MODEL,
      inputCharCount,
      outputItemCount: 1,
      riskLevel: safety.risk_level,
      riskCategories: safety.categories,
      metadata: usageMetadata(allowance, '/api/ai/message-safety'),
    });
    return NextResponse.json({ ...safety, ai_usage: aiUsageResponse(allowance) });
  } catch (error) {
    if (
      error instanceof OpenAIMessageSafetyConfigurationError ||
      error instanceof OpenAIMessageSafetyError
    ) {
      await recordAiUsageCompletion({
        userId: user.id,
        feature: AI_FEATURE,
        planName,
        outcome: error instanceof OpenAIMessageSafetyConfigurationError ? 'configuration_error' : 'provider_error',
        requestId,
        model: AI_MODEL,
        inputCharCount,
        riskLevel: LOW_RISK_MESSAGE_SAFETY_RESULT.risk_level,
        riskCategories: LOW_RISK_MESSAGE_SAFETY_RESULT.categories,
        metadata: {
          ...usageMetadata(allowance, '/api/ai/message-safety'),
          error_code: error instanceof OpenAIMessageSafetyConfigurationError ? 'openai_configuration' : 'openai_provider',
        },
      });
      return NextResponse.json({ ...LOW_RISK_MESSAGE_SAFETY_RESULT, ai_usage: aiUsageResponse(allowance) });
    }

    await recordAiUsageCompletion({
      userId: user.id,
      feature: AI_FEATURE,
      planName,
      outcome: 'provider_error',
      requestId,
      model: AI_MODEL,
      inputCharCount,
      riskLevel: LOW_RISK_MESSAGE_SAFETY_RESULT.risk_level,
      riskCategories: LOW_RISK_MESSAGE_SAFETY_RESULT.categories,
      metadata: { ...usageMetadata(allowance, '/api/ai/message-safety'), error_code: 'unexpected' },
    });
    console.error('[POST /api/ai/message-safety] Unexpected error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ ...LOW_RISK_MESSAGE_SAFETY_RESULT, ai_usage: aiUsageResponse(allowance) });
  }
}

function rateLimitedResponse(resetAt: number) {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json(
    {
      error: 'You have reached the AI safety check limit. Messaging can continue normally.',
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
    console.warn('[POST /api/ai/message-safety] AI plan lookup failed:', error instanceof Error ? error.message : 'unknown error');
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
