import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  acceptRideDate,
  declineRideDate,
  cancelRideDate,
  completeRideDate,
} from '@/lib/ride-dates';
import { notifyRideDateAccepted } from '@/lib/notifications';

const ActionSchema = z.object({
  action: z.enum(['accept', 'decline', 'cancel', 'complete']),
});

interface RouteParams {
  params: { rideDateId: string };
}

/**
 * GET /api/ride-dates/[rideDateId]
 * Returns a single ride date. Caller must be a participant (enforced by RLS).
 */
export async function GET(_req: Request, { params }: RouteParams) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: rideDate, error } = await supabase
    .from('ride_dates')
    .select('*')
    .eq('id', params.rideDateId)
    .or(`user_one.eq.${user.id},user_two.eq.${user.id}`)
    .single();

  if (error || !rideDate) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ rideDate });
}

/**
 * PATCH /api/ride-dates/[rideDateId]
 * Transitions a ride date to a new status via an action verb.
 *
 * Body: { action: 'accept' | 'decline' | 'cancel' | 'complete' }
 *
 * Permissions:
 *   accept   — user_two only (pending → accepted); creates safety check-ins
 *   decline  — user_two only (pending → declined)
 *   cancel   — either user  (pending|accepted → cancelled); resolves check-ins
 *   complete — either user  (accepted → completed); resolves check-ins
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { action } = parsed.data;
  const { rideDateId } = params;

  try {
    switch (action) {
      case 'accept': {
        const result = await acceptRideDate(rideDateId, user.id);

        // Fire-and-forget: notify sender + post a chat message
        void (async () => {
          const admin = createAdminClient();
          const rd = result.rideDate;

          const { data: acceptorProfile } = await admin
            .from('profiles').select('display_name').eq('id', user.id).single();
          const acceptorName = (acceptorProfile as { display_name?: string } | null)?.display_name ?? 'Your match';

          // Push notification to user_one (the sender)
          await notifyRideDateAccepted(rd.user_one, acceptorName, rd.location, rd.id);

          // Post a text message in the chat so user_one sees the acceptance
          const msg = `✅ ${acceptorName} accepted your ride date invite!\n📍 ${rd.location}`;
          const { data: chatMsg } = await admin
            .from('messages')
            .insert({ match_id: rd.match_id, sender_id: user.id, content: msg })
            .select('created_at')
            .single();
          if (chatMsg?.created_at) {
            await admin.from('matches')
              .update({ last_message_at: chatMsg.created_at })
              .eq('id', rd.match_id);
          }
        })().catch((err) => console.warn('[ride-dates] accept side-effects failed:', err));

        return NextResponse.json({ rideDate: result.rideDate, checkinIds: result.checkinIds });
      }
      case 'decline': {
        const rideDate = await declineRideDate(rideDateId, user.id);
        return NextResponse.json({ rideDate });
      }
      case 'cancel': {
        const rideDate = await cancelRideDate(rideDateId, user.id);
        return NextResponse.json({ rideDate });
      }
      case 'complete': {
        const rideDate = await completeRideDate(rideDateId, user.id);
        return NextResponse.json({ rideDate });
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Action failed';
    if (msg.includes('not found') || msg.includes('Not a participant')) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (msg.includes('Only the')) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    if (msg.includes('Cannot')) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    console.error(`[PATCH /api/ride-dates/${rideDateId}] action=${action}`, msg);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}
