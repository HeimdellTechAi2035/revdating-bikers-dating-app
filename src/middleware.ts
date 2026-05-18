import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { isDevBypassEnabled } from '@/lib/dev-bypass';
import { validateProductionEnv } from '@/lib/env';

// ── Route classification ──────────────────────────────────────────────────────

const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/terms',
  '/privacy',
  '/cookies',
  '/community-guidelines',
  '/safety-policy',
  '/offline',
  '/account-deleted',
  '/banned',
  '/admin/login',
  '/api/email/unsubscribe',
  '/contact',
  '/install',
  '/delete-account',
]);

const PUBLIC_PREFIXES = ['/auth/', '/api/auth/', '/api/stripe/webhook'];
const ADMIN_PREFIXES  = ['/admin', '/api/admin'];

// ── Rate limiting (auth pages only) ──────────────────────────────────────────

const authRateMap = new Map<string, { count: number; until: number }>();
let lastPrune = Date.now();

function checkAuthRate(ip: string): boolean {
  const now = Date.now();
  if (now - lastPrune > 10 * 60_000) {
    lastPrune = now;
    Array.from(authRateMap.entries()).forEach(([k, v]) => {
      if (now > v.until) authRateMap.delete(k);
    });
  }
  const rec = authRateMap.get(ip);
  if (!rec || now > rec.until) {
    authRateMap.set(ip, { count: 1, until: now + 15 * 60_000 });
    return true;
  }
  if (rec.count >= 20) return false;
  rec.count += 1;
  return true;
}

// ── Security headers ──────────────────────────────────────────────────────────

function addSecurityHeaders(res: NextResponse) {
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('X-DNS-Prefetch-Control', 'off');
  res.headers.set('X-Permitted-Cross-Domain-Policies', 'none');
  res.headers.set('Permissions-Policy', 'camera=self, microphone=(), geolocation=self, payment=()');
}

// ── Malicious pattern detection ───────────────────────────────────────────────

const DANGEROUS_PATH  = /(\.\.|%2e%2e|%252e|%00)/i;
const DANGEROUS_QUERY = /union[\s+]select|drop[\s+]table|exec[\s(]|<script|javascript:/i;

// ── Middleware ────────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  // ── Dev preview bypass ──────────────────────────────────────────────────────
  // Only active when DEV_BYPASS_AUTH=true — never enabled in production.
  if (isDevBypassEnabled()) {
    return NextResponse.next({ request });
  }

  validateProductionEnv();

  const { pathname } = request.nextUrl;

  // 1. Block malicious patterns immediately — no cost
  if (DANGEROUS_PATH.test(pathname) || DANGEROUS_QUERY.test(request.nextUrl.search)) {
    return new NextResponse(null, { status: 400 });
  }

  // 2. Static assets and public image routes — pass through instantly, no Supabase call
  const isStatic =
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/.well-known/') ||
    pathname.startsWith('/icons/') ||
    pathname === '/opengraph-image' ||
    pathname === '/icon' ||
    /\.(ico|png|jpg|jpeg|svg|webp|webmanifest|js|css|woff2?|ttf|otf|map)$/.test(pathname);

  if (isStatic) {
    return NextResponse.next({ request });
  }

  // 3. Rate-limit auth page hits before any DB work
  const isAuthPage =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/forgot-password';

  if (isAuthPage) {
    const ip =
      request.headers.get('x-nf-client-connection-ip') ??
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      '0.0.0.0';
    if (!checkAuthRate(ip)) {
      return new NextResponse('Too many requests. Please wait 15 minutes.', {
        status: 429,
        headers: { 'Content-Type': 'text/plain', 'Retry-After': '900' },
      });
    }
  }

  const isPublicRoute =
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  const isApiRoute    = pathname.startsWith('/api/');
  const isAdminRoute  = ADMIN_PREFIXES.some((p) => pathname.startsWith(p));
  const isOnboarding  = pathname === '/onboarding';

  // 4. Public routes — no Supabase call, just apply security headers.
  //    Auth pages (login/register) are in PUBLIC_PATHS so authenticated users
  //    hitting them are handled below after the getUser() call.
  if (isPublicRoute && !isAuthPage) {
    const response = NextResponse.next({ request });
    addSecurityHeaders(response);
    return response;
  }

  // 5. All other routes — verify the session server-side with getUser()
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(
              name,
              value,
              options as Parameters<typeof supabaseResponse.cookies.set>[2],
            ),
          );
        },
      },
    },
  );

  // getUser() validates the JWT with the Supabase Auth server — prevents
  // spoofed cookies from bypassing auth checks.
  const { data: { user } } = await supabase.auth.getUser();

  // ── Unauthenticated ───────────────────────────────────────────────────────
  if (!user) {
    // Auth pages (login/register/forgot-password) are fine for unauthenticated users.
    if (isAuthPage || isPublicRoute) {
      const response = NextResponse.next({ request });
      addSecurityHeaders(response);
      return response;
    }
    if (isApiRoute) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // ── Authenticated user on auth pages → redirect to app ───────────────────
  if (isAuthPage) {
    return NextResponse.redirect(new URL('/discover', request.url));
  }

  // ── Profile checks: banned status + onboarding ───────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_complete, is_banned')
    .eq('id', user.id)
    .single();

  // No profile yet — must complete onboarding first.
  if (!profile) {
    if (isApiRoute) {
      addSecurityHeaders(supabaseResponse);
      return supabaseResponse;
    }
    if (!isOnboarding) {
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }
    addSecurityHeaders(supabaseResponse);
    return supabaseResponse;
  }

  // Banned users are blocked from all protected content.
  if (profile.is_banned) {
    if (isApiRoute) {
      return NextResponse.json(
        { error: 'Your account has been suspended.' },
        { status: 403 },
      );
    }
    if (pathname !== '/banned') {
      return NextResponse.redirect(new URL('/banned', request.url));
    }
    addSecurityHeaders(supabaseResponse);
    return supabaseResponse;
  }

  // API routes (non-banned) — fine to proceed; each handler does its own authz.
  if (isApiRoute) {
    addSecurityHeaders(supabaseResponse);
    return supabaseResponse;
  }

  // Onboarding incomplete — force the user to finish before accessing the app.
  if (!profile.onboarding_complete && !isOnboarding) {
    return NextResponse.redirect(new URL('/onboarding', request.url));
  }

  // ── Admin route protection ───────────────────────────────────────────────
  if (isAdminRoute) {
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!adminUser) {
      return NextResponse.redirect(new URL('/discover', request.url));
    }
  }

  addSecurityHeaders(supabaseResponse);
  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\.ico|sitemap\.xml|robots\.txt|BingSiteAuth\.xml|google[a-z0-9]+\.html|sw\.js|workbox-|manifest).*)'],
};
