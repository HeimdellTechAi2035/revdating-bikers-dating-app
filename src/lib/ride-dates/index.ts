/**
 * lib/ride-dates/index.ts
 *
 * Server-side business logic for the REVdating Ride Date Planner.
 * All functions use the admin client and are intended for use in API routes
 * / server actions only — never import this in client components.
 *
 * Public surface:
 *   createRideDateInvite(matchId, senderId, params)  → RideDateRow
 *   acceptRideDate(rideDateId, userId)               → { rideDate, checkinIds }
 *   declineRideDate(rideDateId, userId)              → RideDateRow
 *   cancelRideDate(rideDateId, userId)               → RideDateRow
 *   completeRideDate(rideDateId, userId)             → RideDateRow
 *
 * Security guarantees (enforced here, not only in RLS):
 *   - Only participants of an active match can create an invite
 *   - Only user_two (recipient) can accept or decline
 *   - Either participant can cancel a pending or accepted invite
 *   - Either participant can mark an accepted ride as completed
 *   - Banned users are rejected at create time
 *   - Scheduled time must be in the future
 *   - Location is stored as user-supplied text — callers should prompt
 *     users to enter a PUBLIC meeting place, not a home address.
 *   - One pending invite per match (enforced by DB EXCLUDE constraint)
 *
 * Safety check-ins:
 *   A safety_checkin row is created for EACH participant when a ride
 *   date is accepted. expected_return_at defaults to scheduled_time + 4 h.
 *   Check-ins are resolved when the ride is completed or cancelled post-
 *   acceptance.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { RideDateRow, SafetyCheckinRow, Json } from '@/types/database.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateRideDateParams {
  /** Public meeting point (e.g. "Ace Café, London"). NOT a home address. */
  location:      string;
  /** Approximate latitude of the meeting point. */
  locationLat?:  number;
  /** Approximate longitude of the meeting point. */
  locationLng?:  number;
  /** Optional human-readable route description (max 1 000 chars). */
  routeSummary?: string;
  /** Structured Google Maps Directions payload or freeform JSON. */
  routeData?:    Record<string, unknown>;
  /** ISO 8601 datetime with timezone offset. Must be in the future. */
  scheduledTime: string;
}

export interface AcceptRideDateResult {
  rideDate:   RideDateRow;
  /** IDs of the newly created safety_checkin rows (one per participant). */
  checkinIds: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Fetches a ride date and asserts the caller is a participant.
 * Throws with a user-safe message on failure.
 */
async function _fetchAsParticipant(rideDateId: string, userId: string): Promise<RideDateRow> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('ride_dates')
    .select('*')
    .eq('id', rideDateId)
    .single();

  if (error || !data) throw new Error('Ride date not found');

  if (data.user_one !== userId && data.user_two !== userId) {
    throw new Error('Not a participant of this ride date');
  }

  return data as RideDateRow;
}

/**
 * Resolves all active safety_checkins linked to a ride_date by match_id +
 * participant user IDs.  Called when a ride is cancelled or completed.
 */
async function _resolveCheckins(rideDate: RideDateRow): Promise<void> {
  const admin = createAdminClient();

  await admin
    .from('safety_checkins')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('match_id', rideDate.match_id)
    .in('user_id', [rideDate.user_one, rideDate.user_two])
    .eq('status', 'active');
  // Fire-and-forget — non-critical; don't throw on error
}

// ---------------------------------------------------------------------------
// createRideDateInvite
// ---------------------------------------------------------------------------

/**
 * Creates a new ride date invite. The caller becomes `user_one` (sender) and
 * the other match participant becomes `user_two` (recipient).
 *
 * Throws if:
 *  - Match does not exist or caller is not a participant
 *  - Match is no longer active
 *  - Caller is banned
 *  - Scheduled time is not in the future
 *  - A pending invite already exists for this match
 */
export async function createRideDateInvite(
  matchId:  string,
  senderId: string,
  params:   CreateRideDateParams,
): Promise<RideDateRow> {
  const admin = createAdminClient();

  // 1. Scheduled time must be in the future
  const scheduled = new Date(params.scheduledTime);
  if (isNaN(scheduled.getTime()) || scheduled <= new Date()) {
    throw new Error('Scheduled time must be a valid future date');
  }

  // 2. Route summary length guard (DB constraint also enforces this)
  if (params.routeSummary && params.routeSummary.length > 1000) {
    throw new Error('Route summary must be 1 000 characters or fewer');
  }

  // 3. Match must exist, be active, and include the sender
  const { data: match, error: matchErr } = await admin
    .from('matches')
    .select('id, user1_id, user2_id, is_active')
    .eq('id', matchId)
    .single();

  if (matchErr || !match) throw new Error('Match not found');

  const isParticipant = match.user1_id === senderId || match.user2_id === senderId;
  if (!isParticipant) throw new Error('Not a participant of this match');
  if (!match.is_active) throw new Error('Match is no longer active');

  // 4. Sender must not be banned
  const { data: sender } = await admin
    .from('profiles')
    .select('is_banned')
    .eq('id', senderId)
    .single();

  if (sender?.is_banned) throw new Error('Your account has been suspended');

  // 5. Determine recipient (the other match participant)
  const recipientId = match.user1_id === senderId ? match.user2_id : match.user1_id;

  // 6. Insert — the DB EXCLUDE constraint prevents duplicate pending invites
  const { data: rideDate, error: insertErr } = await admin
    .from('ride_dates')
    .insert({
      user_one:       senderId,
      user_two:       recipientId,
      match_id:       matchId,
      location:       params.location,
      location_lat:   params.locationLat ?? null,
      location_lng:   params.locationLng ?? null,
      route_summary:  params.routeSummary ?? null,
      route_data:     (params.routeData ?? null) as Json | null,
      scheduled_time: params.scheduledTime,
      status:         'pending',
    })
    .select()
    .single();

  if (insertErr) {
    // Exclusion constraint violation — a pending invite already exists
    if (insertErr.code === '23P01' || insertErr.code === '23505') {
      throw new Error('A pending invite already exists for this match');
    }
    throw new Error(insertErr.message);
  }

  return rideDate as RideDateRow;
}

// ---------------------------------------------------------------------------
// acceptRideDate
// ---------------------------------------------------------------------------

/**
 * Accepts a pending ride date invite. Only `user_two` (the recipient) may
 * accept.
 *
 * Side-effects:
 *  - Creates one safety_checkin row per participant.
 *    `expected_return_at` = scheduled_time + 4 hours.
 *    `destination_name` = ride date location.
 *    Meeting coordinates are stored if available.
 *
 * Throws if:
 *  - Ride date not found / caller is not user_two
 *  - Invite is not in 'pending' state
 */
export async function acceptRideDate(
  rideDateId: string,
  userId:     string,
): Promise<AcceptRideDateResult> {
  const admin = createAdminClient();

  const rideDate = await _fetchAsParticipant(rideDateId, userId);

  if (rideDate.user_two !== userId) {
    throw new Error('Only the invited user can accept a ride date invite');
  }
  if (rideDate.status !== 'pending') {
    throw new Error(`Cannot accept a ride date with status '${rideDate.status}'`);
  }

  // Update status
  const { data: updated, error: updateErr } = await admin
    .from('ride_dates')
    .update({ status: 'accepted' })
    .eq('id', rideDateId)
    .select()
    .single();

  if (updateErr) throw new Error(updateErr.message);

  // Create safety_checkins for both participants
  const scheduledAt = new Date(rideDate.scheduled_time);
  const expectedReturn = new Date(scheduledAt.getTime() + 4 * 60 * 60 * 1000); // +4 h

  const checkinBase: Omit<SafetyCheckinRow, 'id' | 'created_at' | 'user_id'> = {
    match_id:                rideDate.match_id,
    ride_description:        `Ride date at ${rideDate.location}`,
    destination_name:        rideDate.location,
    destination_lat:         rideDate.location_lat,
    destination_lng:         rideDate.location_lng,
    expected_return_at:      expectedReturn.toISOString(),
    emergency_contact_name:  null,
    emergency_contact_phone: null,
    status:                  'active',
    resolved_at:             null,
    alert_sent_at:           null,
  };

  const { data: checkins, error: checkinErr } = await admin
    .from('safety_checkins')
    .insert([
      { ...checkinBase, user_id: rideDate.user_one },
      { ...checkinBase, user_id: rideDate.user_two },
    ])
    .select('id');

  if (checkinErr) {
    // Non-fatal — log but don't roll back the acceptance
    console.error('[acceptRideDate] safety_checkin insert failed:', checkinErr.message);
  }

  const checkinIds = checkins?.map((c) => c.id) ?? [];

  return { rideDate: updated as RideDateRow, checkinIds };
}

// ---------------------------------------------------------------------------
// declineRideDate
// ---------------------------------------------------------------------------

/**
 * Declines a pending ride date invite. Only `user_two` (the recipient) may
 * decline.
 *
 * Throws if:
 *  - Ride date not found / caller is not user_two
 *  - Invite is not in 'pending' state
 */
export async function declineRideDate(
  rideDateId: string,
  userId:     string,
): Promise<RideDateRow> {
  const admin = createAdminClient();

  const rideDate = await _fetchAsParticipant(rideDateId, userId);

  if (rideDate.user_two !== userId) {
    throw new Error('Only the invited user can decline a ride date invite');
  }
  if (rideDate.status !== 'pending') {
    throw new Error(`Cannot decline a ride date with status '${rideDate.status}'`);
  }

  const { data: updated, error } = await admin
    .from('ride_dates')
    .update({ status: 'declined' })
    .eq('id', rideDateId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  return updated as RideDateRow;
}

// ---------------------------------------------------------------------------
// cancelRideDate
// ---------------------------------------------------------------------------

/**
 * Cancels a pending or accepted ride date. Either participant may cancel.
 *
 * If the ride date was accepted (safety check-ins are active), they are
 * resolved automatically.
 *
 * Throws if:
 *  - Ride date not found / caller is not a participant
 *  - Status is not 'pending' or 'accepted' (can't cancel a completed/declined ride)
 */
export async function cancelRideDate(
  rideDateId: string,
  userId:     string,
): Promise<RideDateRow> {
  const admin = createAdminClient();

  const rideDate = await _fetchAsParticipant(rideDateId, userId);

  if (rideDate.status !== 'pending' && rideDate.status !== 'accepted') {
    throw new Error(`Cannot cancel a ride date with status '${rideDate.status}'`);
  }

  const wasAccepted = rideDate.status === 'accepted';

  const { data: updated, error } = await admin
    .from('ride_dates')
    .update({ status: 'cancelled', cancelled_by: userId })
    .eq('id', rideDateId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Resolve any open safety check-ins if cancelling an accepted ride
  if (wasAccepted) {
    void _resolveCheckins(rideDate);
  }

  return updated as RideDateRow;
}

// ---------------------------------------------------------------------------
// completeRideDate
// ---------------------------------------------------------------------------

/**
 * Marks an accepted ride date as completed. Either participant may trigger
 * this (mutual completion model — no second confirmation required).
 *
 * Side-effects:
 *  - Sets `completed_at` to now
 *  - Resolves active safety check-ins for both participants
 *
 * Throws if:
 *  - Ride date not found / caller is not a participant
 *  - Status is not 'accepted'
 */
export async function completeRideDate(
  rideDateId: string,
  userId:     string,
): Promise<RideDateRow> {
  const admin = createAdminClient();

  const rideDate = await _fetchAsParticipant(rideDateId, userId);

  if (rideDate.status !== 'accepted') {
    throw new Error(`Cannot complete a ride date with status '${rideDate.status}'`);
  }

  const { data: updated, error } = await admin
    .from('ride_dates')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', rideDateId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Resolve safety check-ins — fire-and-forget
  void _resolveCheckins(rideDate);

  return updated as RideDateRow;
}
