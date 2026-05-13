// Sentry client-side SDK initialisation
// Runs in the browser. Safe to import NEXT_PUBLIC_ env vars here.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,

    // Capture 10% of transactions for performance tracing in production,
    // 100% in development (so you can see traces immediately).
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Capture 10% of sessions for session replay in production.
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      Sentry.replayIntegration({
        // Mask all text / block all media to avoid capturing PII (GDPR)
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Filter out noisy non-actionable errors
    beforeSend(event) {
      // Ignore network errors from browser extensions
      if (event.exception?.values?.[0]?.value?.includes('Extension context')) {
        return null;
      }
      return event;
    },
  });
}
