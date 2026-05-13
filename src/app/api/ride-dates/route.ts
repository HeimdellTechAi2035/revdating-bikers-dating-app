import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createRideDateInvite } from '@/lib/ride-dates';
import { emailRideDateInvite } from '@/lib/email';
import { notifyRideDateInvite } from '@/lib/notifications';

const CreateSchema = z.object({
  matchId:       z.string().uuid(),
  /** Public meeting place — NOT a home address. */
  location:      z.string().min(1).max(500),
  locationLat:   z.number().optional(),
  locationLng:   z.number().optional(),
  routeSummary:  z.string().max(1000).optional(),
  routeData:     z.record(z.unknown()).optional(),
  scheduledTime: z.string().datetime({ offset: true }),
});

/**
 * POST /api/ride-dates
 * Creates a new ride date invite. Caller becomes user_one (sender).
 * The other match participant is automatically assigned as user_two.
 *
 * Body: { matchId, location, locationLat?, locationLng?,
 *         routeSummary?, routeData?, scheduledTime }
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { matchId, location, locationLat, locationLng, routeSummary, routeData, scheduledTime } = parsed.data;

  try {
    const rideDate = await createRideDateInvite(matchId, user.id, {
      location,
      locationLat,
      locationLng,
      routeSummary,
      routeData,
      scheduledTime,
    });

    // Post a chat message so the ride plan appears in the conversation,
    // then push-notify + email the recipient (all fire-and-forget).
    void (async () => {
      const admin = createAdminClient();
      const { data: senderProfile } = await admin
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single();
      const senderName = (senderProfile as any)?.display_name ?? 'Someone';

      // Store invite as a structured card so both sides can tap to view/respond
      const messageContent = JSON.stringify({
        type: 'ride_invite',
        id: rideDate.id,
        location: rideDate.location,
        scheduled_time: rideDate.scheduled_time,
      });

      // Insert system chat message from the sender
      const { data: msg } = await admin
        .from('messages')
        .insert({ match_id: matchId, sender_id: user.id, content: messageContent })
        .select('created_at')
        .single();

      // Keep last_message_at in sync for the chat list
      if (msg?.created_at) {
        await admin
          .from('matches')
          .update({ last_message_at: msg.created_at })
          .eq('id', matchId);
      }

      // Push notification to recipient
      await notifyRideDateInvite(rideDate.user_two, senderName, rideDate.location, rideDate.id);

      // Email notification to recipient
      await emailRideDateInvite(
        rideDate.user_two,
        senderName,
        rideDate.location,
        rideDate.scheduled_time,
        rideDate.id,
      );
    })().catch((err) => console.warn('[ride-dates] post-create side-effects failed:', err));

    return NextResponse.json({ rideDate }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create invite';
    if (msg.includes('not found')) return NextResponse.json({ error: msg }, { status: 404 });
    if (msg.includes('suspended')) return NextResponse.json({ error: msg }, { status: 403 });
    if (msg.includes('not active') || msg.includes('already exists')) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    if (msg.includes('future') || msg.includes('participant')) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error('[POST /api/ride-dates]', msg);
    return NextResponse.json({ error: 'Failed to create ride date invite' }, { status: 500 });
  }
}

/**
 * GET /api/ride-dates?matchId=xxx
 * Returns all ride dates for a given match.
 */
export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get('matchId');
  if (!matchId) return NextResponse.json({ error: 'Missing matchId' }, { status: 400 });

  const { data, error } = await supabase
    .from('ride_dates')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ rideDates: data ?? [] });
}
