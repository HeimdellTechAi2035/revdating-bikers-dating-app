'use client';

import posthog from 'posthog-js';

let initialised = false;

export function initAnalytics() {
  if (
    initialised ||
    typeof window === 'undefined' ||
    !process.env.NEXT_PUBLIC_POSTHOG_KEY
  ) {
    return;
  }

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com',
    capture_pageview: false, // We'll capture manually per page
    persistence: 'localStorage',
    autocapture: false, // Disable to avoid capturing PII
    disable_session_recording: true,
  });

  initialised = true;
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  posthog.identify(userId, properties);
}

export function resetAnalyticsUser() {
  if (typeof window === 'undefined') return;
  posthog.reset();
}

export function trackEvent(
  name: string,
  properties?: Record<string, string | number | boolean | null>
) {
  if (typeof window === 'undefined') return;
  posthog.capture(name, properties);
}

export function trackPageView(path: string) {
  if (typeof window === 'undefined') return;
  posthog.capture('$pageview', { $current_url: path });
}

/**
 * Fire an event exactly once per browser via a localStorage guard.
 * Also sets a PostHog `$set_once` person property so the first-occurrence
 * timestamp is permanently recorded on the user's profile.
 *
 * @param key   Short identifier — stored in localStorage as `rm_first_{key}`
 * @param name  The PostHog event name (e.g. 'first_swipe')
 * @param props Optional additional properties
 */
export function trackFirstTime(
  key: string,
  name: string,
  props?: Record<string, string | number | boolean | null>,
) {
  if (typeof window === 'undefined') return;
  const storageKey = `rm_first_${key}`;
  if (localStorage.getItem(storageKey)) return;

  const ts = new Date().toISOString();
  localStorage.setItem(storageKey, ts);

  posthog.capture(name, {
    ...props,
    $set_once: { [`${key}_at`]: ts },
  });
}

// ── Named event helpers ────────────────────────────────────────────────────
export const analytics = {
  // ── Existing events (preserved for backward compatibility) ──────────────
  signUp: () => trackEvent('user_signed_up'),
  login: () => trackEvent('user_logged_in'),
  onboardingComplete: () => trackEvent('onboarding_completed'),
  profileUpdated: () => trackEvent('profile_updated'),
  photoUploaded: () => trackEvent('photo_uploaded'),
  swipeLike: (targetId: string) => trackEvent('swipe_like', { target_id: targetId }),
  swipePass: (targetId: string) => trackEvent('swipe_pass', { target_id: targetId }),
  swipeSuperlike: (targetId: string) => trackEvent('swipe_superlike', { target_id: targetId }),
  matchCreated: (matchId: string) => trackEvent('match_created', { match_id: matchId }),
  messageSent: (matchId: string) => trackEvent('message_sent', { match_id: matchId }),
  userBlocked: () => trackEvent('user_blocked'),
  userReported: (reason: string) => trackEvent('user_reported', { reason }),
  premiumViewed: () => trackEvent('premium_page_viewed'),
  checkoutStarted: (priceId: string) => trackEvent('checkout_started', { price_id: priceId }),
  subscriptionCreated: () => trackEvent('subscription_created'),
  subscriptionCanceled: () => trackEvent('subscription_canceled'),
  gdprExportRequested: () => trackEvent('gdpr_export_requested'),
  gdprDeleteRequested: () => trackEvent('gdpr_delete_requested'),

  // ── Lifecycle: sign-up ───────────────────────────────────────────────────
  /** Fire when the user begins filling in the registration form (first interaction). */
  signUpStarted: () =>
    trackFirstTime('sign_up_started', 'sign_up_started'),

  /** Fire after the auth account is successfully created. */
  signUpCompleted: () => {
    trackFirstTime('sign_up_completed', 'sign_up_completed');
    // Record signup timestamp so day_1_retention can be calculated later
    if (typeof window !== 'undefined') {
      localStorage.setItem('rm_signup_ts', new Date().toISOString());
    }
  },

  // ── Lifecycle: onboarding ────────────────────────────────────────────────
  /** Fire when the onboarding flow is first rendered. */
  onboardingStarted: () =>
    trackFirstTime('onboarding_started', 'onboarding_started'),

  /** Fire when the user completes all onboarding steps and reaches the app. */
  onboardingCompleted: () =>
    trackFirstTime('onboarding_completed', 'onboarding_completed'),

  // ── Lifecycle: discovery ─────────────────────────────────────────────────
  /** Fire the first time the user uploads any photo. */
  firstPhotoUploaded: () =>
    trackFirstTime('first_photo_uploaded', 'first_photo_uploaded'),

  /** Fire the first time the user performs any swipe action. */
  firstSwipe: (action: 'like' | 'pass' | 'rev_it') =>
    trackFirstTime('first_swipe', 'first_swipe', { action }),

  /** Fire the first time the user sends a like (right-swipe or Rev It). */
  firstLike: () =>
    trackFirstTime('first_like', 'first_like'),

  /** Fire the first time the user gets a mutual match. */
  firstMatch: () =>
    trackFirstTime('first_match', 'first_match'),

  /** Fire the first time the user sends a chat message. */
  firstMessageSent: () =>
    trackFirstTime('first_message_sent', 'first_message_sent'),

  // ── Lifecycle: retention ─────────────────────────────────────────────────
  /**
   * Call once per app boot. Fires `day_1_retention` exactly once if the user
   * returns at least 24 hours after their sign-up timestamp.
   */
  day1Retention: () => {
    if (typeof window === 'undefined') return;
    const signupTs = localStorage.getItem('rm_signup_ts');
    if (!signupTs) return;
    const elapsed = Date.now() - new Date(signupTs).getTime();
    const oneDay = 24 * 60 * 60 * 1000;
    if (elapsed >= oneDay) {
      trackFirstTime('day_1_retention', 'day_1_retention', {
        hours_since_signup: Math.round(elapsed / (60 * 60 * 1000)),
      });
    }
  },

  // ── Lifecycle: monetisation ──────────────────────────────────────────────
  /** Fire when a Stripe checkout completes and the subscription is confirmed. */
  subscriptionStarted: (plan: string) =>
    trackFirstTime('subscription_started', 'subscription_started', { plan }),

  // ── Lifecycle: safety ────────────────────────────────────────────────────
  /** Fire every time a report is submitted (not de-duped — each report is intentional). */
  reportSubmitted: (reportType: string) =>
    trackEvent('report_submitted', { report_type: reportType }),
};
