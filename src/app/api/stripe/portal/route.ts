import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createBillingPortalSession } from '@/lib/stripe';

export async function POST() {
  const supabase = createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: subscription } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .not('stripe_customer_id', 'is', null)
    .single();

  if (!subscription?.stripe_customer_id) {
    return NextResponse.redirect(new URL('/premium', process.env.NEXT_PUBLIC_APP_URL!), 303);
  }

  try {
    const session = await createBillingPortalSession(subscription.stripe_customer_id);
    return NextResponse.redirect(session.url, 303);
  } catch (err) {
    console.error('Billing portal error:', err);
    return NextResponse.json({ error: 'Failed to open billing portal' }, { status: 500 });
  }
}
