import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isDevBypassEnabled } from '@/lib/dev-bypass';

// Routes that do NOT require authentication
const PUBLIC_ROUTES = new Set([
  '/',
  '/login',
  '/register',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  '/banned',
  '/privacy',
  '/terms',
  '/cookies',
]);
const PUBLIC_PREFIXES = ['/auth/', '/api/auth/'];
const ADMIN_PREFIXES = ['/admin', '/api/admin'];

export async function middleware(request: NextRequest) {
  // ── DEV PREVIEW BYPASS ──────────────────────────────────────────────────────
  // When DEV_BYPASS_AUTH=true all auth/admin checks are skipped so the UI can
  // be viewed without a real Supabase project. NEVER enable this in production.
  if (isDevBypassEnabled()) {
    return NextResponse.next({ request });
  }
  // ────────────────────────────────────────────────────────────────────────────

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — IMPORTANT: do not short-circuit before this
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Determine route type
  const isPublic =
    PUBLIC_ROUTES.has(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  const isApiRoute = pathname.startsWith('/api/');
  const isAdminRoute = ADMIN_PREFIXES.some((p) => pathname.startsWith(p));
  const isOnboarding = pathname === '/onboarding';
  const isAuthPage = pathname === '/login' || pathname === '/register';

  // ── Unauthenticated user ──────────────────────────────────────
  if (!user) {
    if (!isPublic) {
      if (isApiRoute) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // ── Authenticated user ────────────────────────────────────────

  // Redirect away from auth pages
  if (isAuthPage) {
    return NextResponse.redirect(new URL('/discover', request.url));
  }

  // Public routes need no profile checks
  if (isPublic) {
    return supabaseResponse;
  }

  // Check profile status for all authenticated, non-public requests.
  // - Page routes: need is_banned + onboarding_complete + admin check
  // - API routes:  need is_banned (write lib functions also check, but we gate here too
  //                to prevent any call from a suspended account reaching app logic)
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_complete, is_banned')
    .eq('id', user.id)
    .single();

  // Banned users cannot access any application content
  if (profile?.is_banned) {
    if (isApiRoute) {
      return NextResponse.json(
        { error: 'Your account has been suspended.' },
        { status: 403 },
      );
    }
    if (pathname !== '/banned') {
      return NextResponse.redirect(new URL('/banned', request.url));
    }
    return supabaseResponse;
  }

  // API routes (non-banned) — authorization is handled inside each route handler
  if (isApiRoute) {
    return supabaseResponse;
  }

  // Onboarding not complete — force to onboarding
  if (profile && !profile.onboarding_complete && !isOnboarding) {
    return NextResponse.redirect(new URL('/onboarding', request.url));
  }

  // Admin route protection
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

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico, sitemap.xml, robots.txt
     * - public assets (images, fonts, etc.)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
};
