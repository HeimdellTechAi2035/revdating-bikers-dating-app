'use client';

import { useEffect } from 'react';
import { initAnalytics, analytics } from '@/lib/analytics';

/**
 * Bootstraps PostHog on the client and fires the day_1_retention event
 * when a returning user opens the app more than 24 hours after sign-up.
 * Must be rendered inside the root layout body.
 */
export default function AnalyticsProvider() {
  useEffect(() => {
    initAnalytics();
    analytics.day1Retention();
  }, []);

  return null;
}
