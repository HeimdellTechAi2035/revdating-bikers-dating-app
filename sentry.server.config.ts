// Sentry server-side SDK initialisation
// Runs in Node.js (API routes, server components, server actions).
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,

    // Capture 20% of transactions in production for performance monitoring.
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

    // Enrich error context (but strip PII automatically)
    integrations: [
      Sentry.extraErrorDataIntegration({ depth: 3 }),
    ],

    beforeSend(event) {
      // Strip sensitive fields from request data before sending to Sentry
      if (event.request) {
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
        }
      }
      return event;
    },
  });
}
