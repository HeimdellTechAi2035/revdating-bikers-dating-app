import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

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
]);


const PUBLIC_FILE_PATHS = new Set([
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

const PUBLIC_FILE_PREFIXES = [
  '/icons/',
  '/.well-known/',
  '/_next/static/',
  '/_next/image/',
];

function isPublicFile(pathname: string): boolean {
  return (
    PUBLIC_FILE_PATHS.has(pathname) ||
    PUBLIC_FILE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

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
  const { pathname } = request.nextUrl;

  // 1. Block malicious patterns immediately — no cost
  if (DANGEROUS_PATH.test(pathname) || DANGEROUS_QUERY.test(request.nextUrl.search)) {
    return new NextResponse(null, { status: 400 });
  }

  // 2. Public SEO/verification files and static assets — pass through
  // instantly, with no Supabase call and no login redirect.
  if (isPublicFile(pathname)) {
    return NextResponse.next({ request });
  }

  const isStatic = /\.(ico|png|jpg|jpeg|svg|webp|webmanifest|js|css|woff2?|ttf|otf|map)$/.test(pathname);

  if (isStatic) {
    return NextResponse.next({ request });
  }

  // 3. Rate-limit auth page hits
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
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/api/stripe/webhook');

  // 4. Public routes — NO Supabase network call, just headers
  //    Individual pages do their own getUser() check as needed.
  if (isPublicRoute) {
    const response = NextResponse.next({ request });
    addSecurityHeaders(response);
    return response;
  }

  // 5. Protected routes — use getSession() which reads from the cookie
  //    (no network round-trip unless the token needs refreshing).
  //    Full getUser() server validation happens inside each protected page.
  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]),
          );
        },
      },
    },
  );

  // getSession() reads the JWT from the cookie — no network call for valid non-expired tokens.
  // It will make one call if the token needs a refresh (every ~1 hour per user).
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  addSecurityHeaders(response);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|sw\\.js\\.map|workbox-|manifest\\.webmanifest).*)',
  ],
};
