'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Cookie } from 'lucide-react';

const CONSENT_KEY = 'rm_consent_v1';

interface ConsentState {
  essential: true;
  analytics: boolean;
  timestamp: string;
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSENT_KEY);
      if (!stored) setVisible(true);
    } catch {
      // localStorage unavailable (e.g., private browsing with strict settings)
    }
  }, []);

  function persist(analytics: boolean) {
    const state: ConsentState = {
      essential: true,
      analytics,
      timestamp: new Date().toISOString(),
    };
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify(state));
    } catch {}

    // Log to server — best effort, do not block UI
    fetch('/api/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consent_type: 'cookies_analytics',
        consented: analytics,
        version: '1.0',
      }),
    }).catch(() => {});

    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-[200] p-4 safe-area-pb"
    >
      <div className="max-w-lg mx-auto bg-brand-dark-2 border border-brand-dark-4 rounded-2xl shadow-2xl p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Cookie className="w-5 h-5 text-brand-orange flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Cookies &amp; analytics</p>
            <p className="text-brand-chrome text-xs mt-1 leading-relaxed">
              We use essential cookies to keep you signed in. We'd also like to use optional analytics cookies to understand how riders use the app so we can improve it.{' '}
              <Link href="/cookies" className="text-brand-orange hover:underline">
                Cookie Policy
              </Link>
            </p>

            {expanded && (
              <div className="mt-3 space-y-2 text-xs text-brand-chrome">
                <div className="flex items-start gap-2 p-2.5 bg-brand-dark-3 rounded-xl">
                  <div className="flex-1">
                    <p className="font-semibold text-white">Essential (always on)</p>
                    <p>Authentication &amp; security cookies required to operate the service. Cannot be disabled.</p>
                  </div>
                  <span className="text-green-400 text-xs font-medium flex-shrink-0">Required</span>
                </div>
                <div className="flex items-start gap-2 p-2.5 bg-brand-dark-3 rounded-xl">
                  <div className="flex-1">
                    <p className="font-semibold text-white">Analytics (optional)</p>
                    <p>Cookie-free analytics (PostHog) to understand feature usage. No PII is collected.</p>
                  </div>
                  <span className="text-brand-orange text-xs font-medium flex-shrink-0">Optional</span>
                </div>
              </div>
            )}

            <button
              onClick={() => setExpanded((e) => !e)}
              className="text-brand-chrome text-xs hover:text-white mt-1.5 underline underline-offset-2"
            >
              {expanded ? 'Show less' : 'Manage preferences'}
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => persist(false)}
            className="flex-1 py-2.5 rounded-xl border border-brand-dark-4 text-brand-chrome text-xs font-medium hover:border-brand-orange/50 hover:text-white transition-colors"
          >
            Essential only
          </button>
          <button
            onClick={() => persist(true)}
            className="flex-1 py-2.5 rounded-xl bg-brand-orange text-white text-xs font-bold hover:bg-brand-orange/90 transition-colors"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
