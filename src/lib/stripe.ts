import Stripe from 'stripe';
import type { PlanName } from '@/lib/premium';

// Lazily-initialised singleton — safe to import at module level during the
// Next.js build. The actual Stripe client (and key validation) is deferred
// until the first request that calls a Stripe method.
let _stripe: Stripe | undefined;

function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
      typescript: true,
    });
  }
  return _stripe;
}

export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop: string | symbol) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

/**
 * Stripe price IDs for each plan tier and billing interval.
 *
 * Environment variables required:
 *   STRIPE_PRICE_RIDER_PLUS_MONTHLY
 *   STRIPE_PRICE_RIDER_PLUS_YEARLY
 *   STRIPE_PRICE_RIDER_PREMIUM_MONTHLY
 *   STRIPE_PRICE_RIDER_PREMIUM_YEARLY
 *
 * Legacy vars (kept for existing checkout sessions in the wild):
 *   STRIPE_PRICE_MONTHLY  → treated as rider_plus_monthly
 *   STRIPE_PRICE_YEARLY   → treated as rider_plus_yearly
 */
export const STRIPE_PRICES = {
  // Rider Plus
  rider_plus_monthly:    process.env.STRIPE_PRICE_RIDER_PLUS_MONTHLY    ?? process.env.STRIPE_PRICE_MONTHLY    ?? '',
  rider_plus_yearly:     process.env.STRIPE_PRICE_RIDER_PLUS_YEARLY     ?? process.env.STRIPE_PRICE_YEARLY     ?? '',
  // Rider Premium
  rider_premium_monthly: process.env.STRIPE_PRICE_RIDER_PREMIUM_MONTHLY ?? '',
  rider_premium_yearly:  process.env.STRIPE_PRICE_RIDER_PREMIUM_YEARLY  ?? '',
} as const;

export type StripePriceKey = keyof typeof STRIPE_PRICES;

/**
 * Maps a Stripe price ID to its plan name.
 * Falls back to 'rider_plus' for any unrecognised paid price ID so that
 * legacy subscriptions keep working after the pricing migration.
 */
export function resolvePlanFromPriceId(priceId: string | null | undefined): PlanName {
  if (!priceId) return 'free';

  const { rider_premium_monthly, rider_premium_yearly } = STRIPE_PRICES;
  if (
    (rider_premium_monthly && priceId === rider_premium_monthly) ||
    (rider_premium_yearly  && priceId === rider_premium_yearly)
  ) {
    return 'rider_premium';
  }

  // Any other recognised price ID → rider_plus
  const allPrices = Object.values(STRIPE_PRICES).filter(Boolean);
  if (allPrices.includes(priceId)) return 'rider_plus';

  // Unknown price ID — default to rider_plus so paying users aren't downgraded
  return 'rider_plus';
}

// Create a Stripe Checkout session for a subscription
export async function createCheckoutSession(params: {
  userId:              string;
  email:               string;
  priceId:             string;
  existingCustomerId?: string;
}): Promise<Stripe.Checkout.Session> {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    ...(params.existingCustomerId
      ? { customer: params.existingCustomerId }
      : { customer_email: params.email }),
    client_reference_id: params.userId,
    line_items: [{ price: params.priceId, quantity: 1 }],
    subscription_data: {
      metadata: { userId: params.userId },
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?subscription=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/premium?canceled=true`,
    metadata: { userId: params.userId },
    allow_promotion_codes: true,
  });

  return session;
}

// Create a billing portal session so users can manage their subscription
export async function createBillingPortalSession(
  stripeCustomerId: string
): Promise<Stripe.BillingPortal.Session> {
  return stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
  });
}

// Validate a Stripe webhook event
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}
