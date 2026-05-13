import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { constructWebhookEvent, stripe, resolvePlanFromPriceId } from '@/lib/stripe';
import Stripe from 'stripe';

// Stripe requires the raw body — disable body parsing for this route
// (App Router reads body as stream via request.text())
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;

  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription') break;

        const userId = session.client_reference_id ?? session.metadata?.userId;
        if (!userId) {
          console.error('No userId in checkout session:', session.id);
          break;
        }

        const subscriptionId = session.subscription as string;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        await upsertSubscription(admin, userId, session.customer as string, subscription);
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata.userId;

        if (!userId) {
          // Look up by customer ID
          const { data: existing } = await admin
            .from('subscriptions')
            .select('user_id')
            .eq('stripe_customer_id', subscription.customer as string)
            .single();

          if (!existing) {
            console.error('Cannot find user for subscription:', subscription.id);
            break;
          }
          await upsertSubscription(admin, existing.user_id, subscription.customer as string, subscription);
        } else {
          await upsertSubscription(admin, userId, subscription.customer as string, subscription);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        await admin
          .from('subscriptions')
          .update({ status: 'canceled' })
          .eq('stripe_subscription_id', subscription.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          await admin
            .from('subscriptions')
            .update({ status: 'past_due' })
            .eq('stripe_subscription_id', invoice.subscription as string);
        }
        break;
      }

      default:
        // Unhandled event type — ignore
        break;
    }
  } catch (err) {
    console.error(`Error handling Stripe event ${event.type}:`, err);
    // Return 200 to prevent Stripe from retrying (we'll handle via monitoring)
  }

  return NextResponse.json({ received: true });
}

async function upsertSubscription(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  customerId: string,
  subscription: Stripe.Subscription
) {
  const priceId = subscription.items.data[0]?.price.id ?? null;
  const status = subscription.status as 'active' | 'canceled' | 'past_due' | 'trialing';
  const isActive = status === 'active' || status === 'trialing';
  const planName = resolvePlanFromPriceId(priceId);

  await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      plan_name: planName,
      status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
    },
    { onConflict: 'stripe_subscription_id' }
  );

  // Sync is_premium display flag on profile (for UI display only — NOT for access control)
  await admin
    .from('profiles')
    .update({ is_premium: isActive })
    .eq('id', userId);

  // Grant premium Ride With credits (10/week) on activation
  if (isActive) {
    await admin.rpc('set_premium_superlike_credits', {
      p_user_id: userId,
      p_credits: 10,
    });
  }
}
