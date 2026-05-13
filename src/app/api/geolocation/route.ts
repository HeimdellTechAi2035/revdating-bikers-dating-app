import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';
import type { Database } from '@/types/database.types';

type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

const schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  city: z.string().max(100).optional(),
  state_region: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
});

export async function POST(request: NextRequest) {
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

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
  }

  const { lat, lng, city, state_region, country } = parsed.data;

  // Build PostGIS geography point using EWKT format
  const locationWKT = `POINT(${lng} ${lat})`;

  const updates: ProfileUpdate = {
    location: locationWKT,
    latitude: lat,
    longitude: lng,
  };

  if (city !== undefined) updates.city = city;
  if (country !== undefined) updates.country = country;

  const { error } = await admin
    .from('profiles')
    .update(updates)
    .eq('id', user.id);

  if (error) {
    console.error('Geolocation update error:', error);
    return NextResponse.json({ error: 'Failed to update location' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
