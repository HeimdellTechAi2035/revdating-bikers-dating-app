import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logConsent, hashIp, type ConsentType } from '@/lib/gdpr';
import { z } from 'zod';

const schema = z.object({
  consent_type: z.enum([
    'terms_privacy',
    'terms_of_service',
    'privacy_policy',
    'cookies_essential',
    'cookies_analytics',
    'cookie_consent',
    'marketing',
    'age_confirmation',
    '18_plus_confirmation',
  ]),
  consented: z.boolean(),
  version:   z.string().default('1.0'),
  session_id: z.string().optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { consent_type, consented, version, session_id } = parsed.data;

  // user_id is optional — pre-auth consent is allowed
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Hash the IP address — never store raw IPs (GDPR best practice)
  const forwarded = request.headers.get('x-forwarded-for');
  const rawIp     = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  const ipHash    = await hashIp(rawIp);

  await logConsent({
    userId:      user?.id ?? null,
    sessionId:   session_id ?? null,
    consentType: consent_type as ConsentType,
    consented,
    version,
    ipHash,
    userAgent:   request.headers.get('user-agent'),
  });

  return NextResponse.json({ ok: true });
}

