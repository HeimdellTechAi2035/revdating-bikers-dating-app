/**
 * lib/payments/index.ts
 *
 * Centralized payment module for REVdating.
 *
 * Responsibilities:
 *   - Stripe customer lifecycle (create / retrieve)
 *   - Subscription state synchronisation to Supabase
 *   - Webhook event dispatch
 *   - Convenience queries for subscription status
 *
 * Server-only — never import from client components.
 * Access-control decisions must go through lib/premium.ts, not this module.
 */

import Stripe from 'stripe';
import {
  stripe,
  STRIPE_PRICES,
  createCheckoutSession,
  createBillingPortalSession,
  constructWebhookEvent,
  resolvePlanFromPriceId,
  type StripePriceKey,
} from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SubscriptionStatus } from '@/types/database.types';

// Re-export so callers only need one import
export {
  stripe,
  STRIPE_PRICES,
  createCheckoutSession,
  createBillingPortalSession,
  constructWebhookEvent,
  resolvePlanFromPriceId,
};
export type { StripePriceKey };

// ---------------------------------------------------------------------------
// Customer management
// ---------------------------------------------------------------------------

/**
 * Returns the Stripe customer ID for the given user, creating one in Stripe
 * if one doesn't exist yet.
 *
 * Does NOT write to the subscriptions table here — the customer ID is
 * persisted when the first subscription is synced via syncSubscriptionToDb.
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
): Promise<string> {
  const admin = createAdminClient();

  // Look up any existing subscription row that already has a customer ID
  const { data: existing } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .not('stripe_customer_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.stripe_customer_id) {
    return existing.stripe_customer_id as string;
  }

  // No customer yet — create one in Stripe
  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });

  return customer.id;
}

// ---------------------------------------------------------------------------
// Subscription sync
// ---------------------------------------------------------------------------

/**
 * Upserts a Stripe Subscription into the local `subscriptions` table and
 * mirrors premium status on `profiles.is_premium` (display flag only).
 *
 * Called by the Stripe webhook handler whenever a subscription changes.
 *
 * @param subscription - Full Stripe Subscription object
 * @param userId       - Supply when available from session metadata;
 *                       falls back to subscription.metadata.userId
 */
export async function syncSubscriptionToDb(
  subscription: Stripe.Subscription,
  userId?: string,
): Promise<void> {
  const admin = createAdminClient();

  const resolvedUserId: string =
    userId ??
    (subscription.metadata?.userId as string | undefined) ??
    (() => {
      throw new Error(
        `syncSubscriptionToDb: userId not found in args or subscription metadata (id: ${subscription.id})`,
      );
    })();

  const isActive =
    subscription.status === 'active' || subscription.status === 'trialing';

  const toIso = (unix: number | null) =>
    unix ? new Date(unix * 1000).toISOString() : null;

  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const planName = resolvePlanFromPriceId(priceId);

  await admin.from('subscriptions').upsert(
    {
      user_id:                resolvedUserId,
      stripe_customer_id:     subscription.customer as string,
      stripe_subscription_id: subscription.id,
      stripe_price_id:        priceId,
      plan_name:              planName,
      status:                 subscription.status as SubscriptionStatus,
      current_period_start:   toIso(subscription.current_period_start),
      current_period_end:     toIso(subscription.current_period_end),
      cancel_at_period_end:   subscription.cancel_at_period_end,
      trial_end:              toIso(subscription.trial_end ?? null),
    },
    { onConflict: 'stripe_subscription_id' },
  );

  // Mirror premium flag on the profile for display reads.
  // All entitlement checks must still use getUserEntitlements() from lib/premium.ts.
  await admin
    .from('profiles')
    .update({ is_premium: isActive })
    .eq('id', resolvedUserId);
}

// ---------------------------------------------------------------------------
// Subscription queries
// ---------------------------------------------------------------------------

/**
 * Returns the user's most-recent active subscription row, or null if they
 * are on the free tier.
 *
 * For access-control, always use getUserEntitlements() from lib/premium.ts.
 * This function is for display purposes (e.g. settings page plan details).
 */
export async function getActiveSubscription(userId: string) {
  const admin = createAdminClient();

  const { data } = await admin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

/**
 * Returns all subscription history for a user (for admin panels or billing history).
 */
export async function getSubscriptionHistory(userId: string) {
  const admin = createAdminClient();

  const { data } = await admin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return data ?? [];
}

// ---------------------------------------------------------------------------
// Lifecycle actions
// ---------------------------------------------------------------------------

/**
 * Schedules a subscription to cancel at the end of the current billing period.
 * The user retains premium access until then.
 *
 * Use for user-initiated cancellations (settings page).
 */
export async function cancelSubscriptionAtPeriodEnd(
  stripeSubscriptionId: string,
): Promise<void> {
  const updated = await stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: true,
  });
  await syncSubscriptionToDb(updated);
}

/**
 * Immediately cancels a subscription and marks the user as non-premium.
 *
 * Only use for admin actions (fraud, bans). For user self-cancellation
 * use cancelSubscriptionAtPeriodEnd instead.
 */
export async function cancelSubscriptionImmediately(
  stripeSubscriptionId: string,
  userId: string,
): Promise<void> {
  await stripe.subscriptions.cancel(stripeSubscriptionId);

  const admin = createAdminClient();
  await admin
    .from('subscriptions')
    .update({ status: 'canceled', cancel_at_period_end: false })
    .eq('stripe_subscription_id', stripeSubscriptionId);

  await admin
    .from('profiles')
    .update({ is_premium: false })
    .eq('id', userId);
}

// ---------------------------------------------------------------------------
// Webhook event dispatcher
// ---------------------------------------------------------------------------

/**
 * Dispatches a verified Stripe webhook event to the correct handler.
 *
 * Call this from /api/webhooks/stripe AFTER constructWebhookEvent() succeeds.
 * Returns a short log string describing what was done.
 *
 * @throws on unrecoverable errors (e.g. missing userId in metadata)
 */
export async function handleWebhookEvent(event: Stripe.Event): Promise<string> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== 'subscription') {
        return 'ignored — not a subscription checkout';
      }

      const userId =
        (session.metadata?.userId as string | undefined) ??
        session.client_reference_id ??
        null;

      if (!userId) {
        throw new Error(
          'checkout.session.completed: userId missing from metadata and client_reference_id',
        );
      }

      const subscription = await stripe.subscriptions.retrieve(
        session.subscription as string,
      );
      await syncSubscriptionToDb(subscription, userId);
      return `subscription ${subscription.id} synced for user ${userId}`;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await syncSubscriptionToDb(subscription);
      return `subscription ${subscription.id} synced (status: ${subscription.status})`;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      // Subscription rows are updated by the customer.subscription.updated event.
      // Log only for audit purposes.
      return `invoice ${invoice.id} payment succeeded`;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      console.warn(
        `[payments] Invoice payment failed — customer: ${invoice.customer}, invoice: ${invoice.id}`,
      );
      return `invoice ${invoice.id} payment_failed (customer: ${invoice.customer})`;
    }

    default:
      return `event ${event.type} — no handler registered`;
  }
}
