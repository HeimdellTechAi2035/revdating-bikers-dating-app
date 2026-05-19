import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  // `next` is set by password-reset flow: /auth/callback?next=/reset-password
  const next = url.searchParams.get('next');

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', request.url));
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('Auth callback error:', error);
    const message = error.message.toLowerCase().includes('code verifier')
      ? 'signin_session_expired'
      : 'signin_failed';
    return NextResponse.redirect(
      new URL(`/login?error=${message}`, request.url)
    );
  }

  // If an explicit `next` was requested (e.g. password reset), honour it.
  // Only allow internal paths to prevent open-redirect attacks.
  if (next && next.startsWith('/')) {
    return NextResponse.redirect(new URL(next, request.url));
  }

  // For email confirmation / magic-link sign-ins, decide where to send the
  // user based on their onboarding status.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_complete, is_banned')
    .eq('id', user.id)
    .single();

  if (profile?.is_banned) {
    return NextResponse.redirect(new URL('/banned', request.url));
  }

  if (!profile?.onboarding_complete) {
    return NextResponse.redirect(new URL('/onboarding', request.url));
  }

  return NextResponse.redirect(new URL('/discover', request.url));
}
