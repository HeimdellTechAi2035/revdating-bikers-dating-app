import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserEntitlements, PremiumRequiredError } from '@/lib/premium';

const BOOST_DURATION_HOURS = 1;

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: boost } = await supabase
    .from('profile_boosts')
    .select('activated_at, expires_at')
    .eq('user_id', user.id)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  return NextResponse.json({ boost: boost ?? null });
}

export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Server-side entitlement check
  try {
    const ent = await getUserEntitlements(user.id);
    if (!ent.boostProfile) throw new PremiumRequiredError();
  } catch (err) {
    if (err instanceof PremiumRequiredError) {
      return NextResponse.json(
        { error: 'Premium required', code: 'PREMIUM_REQUIRED' },
        { status: 403 }
      );
    }
    throw err;
  }

  // Check if already boosted
  const { data: existing } = await supabase
    .from('profile_boosts')
    .select('expires_at')
    .eq('user_id', user.id)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: 'Boost already active', expires_at: existing.expires_at },
      { status: 409 }
    );
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + BOOST_DURATION_HOURS * 60 * 60 * 1000);
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('profile_boosts')
    .upsert(
      {
        user_id:      user.id,
        activated_at: now.toISOString(),
        expires_at:   expiresAt.toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) {
    console.error('Boost activation error:', error);
    return NextResponse.json({ error: 'Failed to activate boost' }, { status: 500 });
  }

  return NextResponse.json({ boost: data }, { status: 201 });
}
