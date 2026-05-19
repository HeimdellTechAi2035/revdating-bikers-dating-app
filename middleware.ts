import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isDevBypassEnabled } from '@/lib/dev-bypass';
import { validateProductionEnv } from '@/lib/env';

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
  '/community-guidelines',
  '/safety-policy',
  '/offline',
  '/account-deleted',
  '/admin/login',
  '/api/email/unsubscribe',
]);

const PUBLIC_FILE_ROUTES = new Set([
  '/BingSiteAuth.xml',
  '/robots.txt',
  '/sitemap.xml',
  '/favicon.ico',
  '/manifest.webmanifest',
  '/opengraph-image',
  '/icon',
  '/sw.js',
  '/sw.js.map',
  '/worker-b18b4a7472bb515f.js',
]);

const PUBLIC_PREFIXES = ['/auth/', '/api/auth/'];
const PUBLIC_FILE_PREFIXES = ['/icons/', '/.well-known/', '/_next/static/', '/_next/image/'];

function isPublicFile(pathname: string): boolean {
  return (
    PUBLIC_FILE_ROUTES.has(pathname) ||
    PUBLIC_FILE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}
const ADMIN_PREFIXES = ['/admin', '/api/admin'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public SEO/verification files and static assets must never hit auth logic
  // or redirect to login.
  if (isPublicFile(pathname)) {
    return NextResponse.next({ request });
  }

  // ── EXPLICIT DEV PREVIEW BYPASS ─────────────────────────────────────────────
  // Only enabled when DEV_BYPASS_AUTH=true and never enabled in production.
  if (isDevBypassEnabled()) {
    return NextResponse.next({ request });
  }
  // ────────────────────────────────────────────────────────────────────────────

  validateProductionEnv();

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

  // Authenticated users with no profile should complete onboarding before app pages.
  // API route handlers remain responsible for their own authorization/error handling.
  if (!profile) {
    if (isApiRoute) {
      return supabaseResponse;
    }
    if (!isOnboarding) {
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }
    return supabaseResponse;
  }

  // Banned users cannot access any application content
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
    return supabaseResponse;
  }

  // API routes (non-banned) — authorization is handled inside each route handler
  if (isApiRoute) {
    return supabaseResponse;
  }

  // Onboarding not complete — force to onboarding
  if (!profile.onboarding_complete && !isOnboarding) {
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
     * Match all paths except public assets already known to Next/Netlify.
     * Public SEO files are also guarded by isPublicFile() above so they never
     * reach auth if this matcher changes.
     */
    '/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|sitemap\\.xml|robots\\.txt|BingSiteAuth\\.xml|sw\\.js|sw\\.js\\.map|worker-b18b4a7472bb515f\\.js|icons/|\\.well-known/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
};
