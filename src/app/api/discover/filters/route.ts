import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserEntitlements, PremiumRequiredError } from '@/lib/premium';
import { z } from 'zod';

const BIKE_TYPES = [
  'cruiser', 'sport', 'touring', 'adventure', 'dirt',
  'chopper', 'cafe_racer', 'bobber', 'naked', 'scooter', 'electric', 'other',
] as const;

const RIDING_STYLES = [
  'cruiser', 'sport', 'touring', 'adventure', 'dirt',
  'chopper', 'cafe_racer', 'bobber', 'naked', 'scooter', 'electric', 'other',
] as const;

const DATING_INTENTS = [
  'serious_relationship', 'casual_dating', 'riding_partner', 'friendship', 'open_to_anything',
] as const;

const CLUB_TYPES = ['MC', 'RC', 'independent', 'none'] as const;

const updateSchema = z.object({
  bike_types:     z.array(z.enum(BIKE_TYPES)).optional().nullable(),
  riding_styles:  z.array(z.enum(RIDING_STYLES)).optional().nullable(),
  dating_intents: z.array(z.enum(DATING_INTENTS)).optional().nullable(),
  verified_only:  z.boolean().optional(),
  club_types:     z.array(z.enum(CLUB_TYPES)).optional().nullable(),
});

async function checkPremium(userId: string) {
  const ent = await getUserEntitlements(userId);
  if (!ent.advancedFilters) throw new PremiumRequiredError();
  return ent;
}

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try { await checkPremium(user.id); } catch (err) {
    if (err instanceof PremiumRequiredError) {
      return NextResponse.json({ error: 'Premium required', code: 'PREMIUM_REQUIRED' }, { status: 403 });
    }
    throw err;
  }

  const { data } = await supabase
    .from('discovery_filters')
    .select('bike_types, riding_styles, dating_intents, verified_only, club_types')
    .eq('user_id', user.id)
    .maybeSingle();

  return NextResponse.json({
    filters: data ?? { bike_types: null, riding_styles: null, dating_intents: null, verified_only: false, club_types: null },
  });
}

export async function PUT(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try { await checkPremium(user.id); } catch (err) {
    if (err instanceof PremiumRequiredError) {
      return NextResponse.json({ error: 'Premium required', code: 'PREMIUM_REQUIRED' }, { status: 403 });
    }
    throw err;
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid filters', details: parsed.error.format() }, { status: 400 });
  }

  const { error } = await supabase
    .from('discovery_filters')
    .upsert(
      {
        user_id:        user.id,
        bike_types:     parsed.data.bike_types   ?? null,
        riding_styles:  parsed.data.riding_styles ?? null,
        dating_intents: parsed.data.dating_intents ?? null,
        verified_only:  parsed.data.verified_only ?? false,
        club_types:     parsed.data.club_types ?? null,
        updated_at:     new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (error) {
    console.error('Save filters error:', error);
    return NextResponse.json({ error: 'Failed to save filters' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
