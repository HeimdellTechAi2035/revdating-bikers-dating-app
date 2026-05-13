'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ background: '#0A0A0A', color: '#fff', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '1rem', textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '3rem' }}>⚠️</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Something went wrong</h1>
          <p style={{ color: '#888' }}>An unexpected error occurred. Our team has been notified.</p>
          {error.digest && (
            <p style={{ color: '#555', fontSize: '0.75rem' }}>Error ID: {error.digest}</p>
          )}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button
              onClick={reset}
              style={{ padding: '0.75rem 1.5rem', borderRadius: '0.75rem', background: '#FF6B00', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{ padding: '0.75rem 1.5rem', borderRadius: '0.75rem', background: '#1E1E1E', color: '#fff', textDecoration: 'none', fontWeight: 'bold' }}
            >
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
