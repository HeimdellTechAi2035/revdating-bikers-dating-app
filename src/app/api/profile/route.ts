import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserBadges } from '@/lib/badges';
import { z } from 'zod';

const RIDING_STYLES = [
  'cruiser', 'sport', 'touring', 'adventure', 'dirt',
  'chopper', 'cafe_racer', 'bobber', 'naked', 'scooter', 'electric', 'other',
] as const;

const updateSchema = z.object({
  // Profile fields — must match actual profiles table columns
  display_name:         z.string().min(2).max(30).optional(),
  bio:                  z.string().max(500).optional().nullable(),
  interested_in:        z.enum(['men', 'women', 'everyone']).optional(),
  dating_intent:        z.enum(['serious_relationship', 'casual_dating', 'riding_partner', 'friendship', 'open_to_anything']).optional().nullable(),
  city:                 z.string().max(100).optional(),
  country:              z.string().max(100).optional(),
  max_distance_miles:   z.number().int().min(1).max(500).optional(),
  riding_style:         z.enum(RIDING_STYLES).optional().nullable(),
  years_riding:         z.number().int().min(0).max(80).optional().nullable(),
  smoker:               z.boolean().optional().nullable(),
  drinker:              z.boolean().optional().nullable(),
  attends_rallies:      z.boolean().optional().nullable(),
  has_passenger_helmet: z.boolean().optional().nullable(),
  hide_exact_location:  z.boolean().optional(),
  emergency_contact_name:  z.string().max(100).optional().nullable(),
  emergency_contact_phone: z.string().max(30).optional().nullable(),
  club_type:            z.enum(['MC', 'RC', 'independent', 'none']).optional(),
  club_name:            z.string().max(100).optional().nullable(),
  mood:                 z.enum([
    'Looking for a pillion',
    'Planning a Sunday blast',
    'Just chatting bikes',
    'Up for a group ride',
    'Weekend touring',
    'Track day partner wanted',
    'Post-ride coffee date',
  ]).optional().nullable(),
  // Primary bike — saved to bikes table, not profiles
  bike_brand:           z.string().max(50).optional().nullable(),
  bike_model:           z.string().max(50).optional().nullable(),
  bike_year:            z.number().int().min(1900).max(2100).optional().nullable(),
});

const PROFILE_FIELDS = new Set([
  'display_name', 'bio', 'interested_in', 'dating_intent', 'city', 'country',
  'max_distance_miles', 'riding_style', 'years_riding', 'smoker', 'drinker',
  'attends_rallies', 'has_passenger_helmet', 'hide_exact_location',
  'emergency_contact_name', 'emergency_contact_phone', 'club_type', 'club_name', 'mood',
]);

const BIKE_FIELDS = new Set(['bike_brand', 'bike_model', 'bike_year']);

export async function GET() {
  const supabase = createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [profileResult, badges] = await Promise.all([
    admin.from('profiles').select('*').eq('id', user.id).single(),
    getUserBadges(user.id).catch(() => []),
  ]);

  const { data: profile, error } = profileResult;
  if (error || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  return NextResponse.json({ profile, badges });
}

export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
  }

  // Split into profile fields and bike fields
  const profileUpdates: Record<string, unknown> = {};
  const bikeUpdates:    Record<string, unknown> = {};

  for (const [key, val] of Object.entries(parsed.data)) {
    if (val === undefined) continue;
    if (PROFILE_FIELDS.has(key)) profileUpdates[key] = val;
    if (BIKE_FIELDS.has(key))    bikeUpdates[key]    = val;
  }

  // Update profile
  if (Object.keys(profileUpdates).length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: profileError } = await (admin.from('profiles') as any)
      .update(profileUpdates)
      .eq('id', user.id) as { error: { message: string } | null };

    if (profileError) {
      console.error('Profile update error:', profileError);
      return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
  }

  // Upsert primary bike if any bike fields were provided
  if (Object.keys(bikeUpdates).length > 0 && bikeUpdates.bike_brand) {
    const bikePayload = {
      user_id:        user.id,
      bike_brand:     String(bikeUpdates.bike_brand),
      bike_model:     bikeUpdates.bike_model ? String(bikeUpdates.bike_model) : 'Unknown',
      bike_year:      bikeUpdates.bike_year ? Number(bikeUpdates.bike_year) : null,
      bike_type:      (parsed.data.riding_style ?? profileUpdates.riding_style ?? 'other') as string,
      owned_or_dream: 'owned' as const,
      primary_bike:   true,
    };

    // Check if primary bike already exists
    const { data: existing } = await supabase
      .from('bikes')
      .select('id')
      .eq('user_id', user.id)
      .eq('primary_bike', true)
      .maybeSingle();

    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.from('bikes') as any)
        .update({
          bike_brand: bikePayload.bike_brand,
          bike_model: bikePayload.bike_model,
          bike_year:  bikePayload.bike_year,
          bike_type:  bikePayload.bike_type,
        })
        .eq('id', (existing as any).id);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.from('bikes') as any).insert(bikePayload);
    }
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return NextResponse.json({ success: true, profile });
}
