// @ts-check
const { withSentryConfig } = require('@sentry/nextjs');
const withPWA = require('@ducanh2912/next-pwa').default;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable instrumentation hook for Sentry server/edge init
  experimental: {
    instrumentationHook: true,
    outputFileTracingExcludes: {
      '*': [
        'node_modules/@esbuild/**',
        'node_modules/webpack/**',
        'node_modules/terser/**',
        'node_modules/rollup/**',
        'node_modules/.cache/**',
      ],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/sign/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=self, microphone=(), geolocation=self' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // unsafe-eval retained for framer-motion / Next.js internals; remove once libs support strict mode
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://app.posthog.com https://browser.sentry-cdn.com https://js.stripe.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.sightengine.com https://app.posthog.com https://*.sentry.io https://resend.com",
              "frame-src https://js.stripe.com",
              "font-src 'self' data:",
              "worker-src 'self' blob:",
              "media-src 'self' blob: https://*.supabase.co",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = withSentryConfig(
  withPWA({
    dest:                          'public',
    cacheOnFrontEndNav:            true,
    aggressiveFrontEndNavCaching:  true,
    reloadOnOnline:                true,
    disable:                       process.env.NODE_ENV === 'development',
    fallbackRoutes: {
      document: '/offline',
    },
    workboxOptions: {
      disableDevLogs: true,
      // Cache the offline page itself
      additionalManifestEntries: [
        { url: '/offline', revision: null },
      ],
    },
  })(nextConfig),
  {
    // Sentry webpack plugin options
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,

    // Only upload source maps in CI / production builds, not local dev
    silent: true,
    disableLogger: true,

    // Upload source maps to Sentry for readable stack traces
    // Automatically disabled if SENTRY_AUTH_TOKEN is not set
    authToken: process.env.SENTRY_AUTH_TOKEN,

    // Tree-shake Sentry debug code in production
    hideSourceMaps: true,
    widenClientFileUpload: true,
  },
);
