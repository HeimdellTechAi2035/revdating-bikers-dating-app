import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createSchema = z.object({
  ride_description:        z.string().min(1).max(500),
  destination_name:        z.string().max(200).optional(),
  destination_lat:         z.number().min(-90).max(90).optional(),
  destination_lng:         z.number().min(-180).max(180).optional(),
  expected_return_at:      z.string().datetime(),
  emergency_contact_name:  z.string().max(100).optional(),
  emergency_contact_phone: z.string().max(30).optional(),
  match_id:                z.string().uuid().optional(),
});

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('safety_checkins')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['active', 'overdue'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'Failed to fetch check-in' }, { status: 500 });
  return NextResponse.json({ checkin: data });
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
  }

  const expectedReturn = new Date(parsed.data.expected_return_at);
  if (expectedReturn <= new Date()) {
    return NextResponse.json({ error: 'Expected return time must be in the future' }, { status: 400 });
  }

  // Resolve any existing active check-in first (only one at a time)
  await supabase
    .from('safety_checkins')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .in('status', ['active', 'overdue']);

  const { data, error } = await supabase
    .from('safety_checkins')
    .insert({
      user_id:                 user.id,
      ride_description:        parsed.data.ride_description,
      destination_name:        parsed.data.destination_name ?? null,
      destination_lat:         parsed.data.destination_lat ?? null,
      destination_lng:         parsed.data.destination_lng ?? null,
      expected_return_at:      parsed.data.expected_return_at,
      emergency_contact_name:  parsed.data.emergency_contact_name ?? null,
      emergency_contact_phone: parsed.data.emergency_contact_phone ?? null,
      match_id:                parsed.data.match_id ?? null,
      status:                  'active',
    })
    .select()
    .single();

  if (error) {
    console.error('Create check-in error:', error);
    return NextResponse.json({ error: 'Failed to create check-in' }, { status: 500 });
  }

  return NextResponse.json({ checkin: data }, { status: 201 });
}
