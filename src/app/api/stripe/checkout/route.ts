import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createCheckoutSession, STRIPE_PRICES } from '@/lib/stripe';
import { z } from 'zod';

const schema = z.object({
  price_id: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Support both form submissions and JSON
  let priceId: string | undefined;
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => ({}));
    priceId = body.price_id;
  } else {
    const form = await request.formData().catch(() => new FormData());
    priceId = form.get('price_id')?.toString();
  }

  const parsed = schema.safeParse({ price_id: priceId });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid price' }, { status: 400 });
  }

  // Validate price_id is one of ours (prevent arbitrary price injection)
  const validPrices = Object.values(STRIPE_PRICES);
  if (!validPrices.includes(parsed.data.price_id)) {
    return NextResponse.json({ error: 'Invalid price ID' }, { status: 400 });
  }

  // Check for existing Stripe customer
  const { data: subscription } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .not('stripe_customer_id', 'is', null)
    .single();

  try {
    const session = await createCheckoutSession({
      userId: user.id,
      email: user.email!,
      priceId: parsed.data.price_id,
      existingCustomerId: subscription?.stripe_customer_id ?? undefined,
    });

    // Redirect to Stripe checkout
    return NextResponse.redirect(session.url!, 303);
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
