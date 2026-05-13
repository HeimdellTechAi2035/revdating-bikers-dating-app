'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { analytics } from '@/lib/analytics';

/**
 * Detects the `?subscription=success` query param set by the Stripe checkout
 * success_url and fires the `subscription_started` analytics event once.
 * Wrap in <Suspense> when used inside a server component page.
 */
export default function SubscriptionSuccessTracker() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('subscription') === 'success') {
      analytics.subscriptionStarted('premium');
    }
  }, [searchParams]);

  return null;
}
