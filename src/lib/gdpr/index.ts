/**
 * lib/gdpr/index.ts
 *
 * GDPR / UK GDPR compliance helpers for REVdating.
 *
 * Legal references:
 *   UK GDPR Art. 17   — right to erasure
 *   UK GDPR Art. 20   — right to data portability
 *   UK GDPR Art. 7    — conditions for consent
 *   Online Safety Act 2023 — mandatory record retention for illegal content
 *
 * ACCOUNT DELETION — anonymisation approach (not hard-delete):
 *   Personal data is erased or anonymised. Moderation records, reports,
 *   admin_actions, and illegal_content_reports are preserved in anonymised
 *   form (user FKs become NULL via ON DELETE SET NULL) to:
 *     (a) fulfil legal retention obligations for safety/abuse records
 *     (b) support law-enforcement cooperation if needed post-deletion
 *     (c) prevent appeal of permanent bans by re-registering
 *
 * Stripe subscriptions are cancelled immediately at period end before
 * the auth user is deleted, so Stripe retains billing history as required
 * by financial regulations (typically 7 years).
 *
 * NEVER import from client components — all helpers use the admin client.
 */

import { createAdminClient } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConsentType =
  | 'terms_privacy'
  | 'terms_of_service'
  | 'privacy_policy'
  | 'cookies_essential'
  | 'cookies_analytics'
  | 'cookie_consent'
  | 'marketing'
  | 'age_confirmation'
  | '18_plus_confirmation';

export interface LogConsentParams {
  userId?:      string | null;
  sessionId?:   string | null;
  consentType:  ConsentType;
  consented:    boolean;
  version?:     string;
  ipHash?:      string | null;
  userAgent?:   string | null;
}

export interface DataExportRow {
  _metadata:       Record<string, string>;
  account:         Record<string, unknown>;
  profile:         unknown;
  bikes:           unknown;
  photos:          unknown;
  swipes_sent:     unknown;
  matches:         unknown;
  messages_sent:   unknown;
  verifications:   unknown;
  consent_history: unknown;
  safety_checkins: unknown;
  subscriptions:   unknown;
  badges:          unknown;
  export_requests: unknown;
}

export interface DeleteAccountResult {
  success:             boolean;
  stripe_cancelled:    boolean;
  photos_deleted:      number;
}

// ---------------------------------------------------------------------------
// logConsent
// ---------------------------------------------------------------------------

/**
 * Writes a consent event to consent_logs (GDPR Art. 7 audit trail).
 *
 * This is intentionally fire-and-tolerant: a failure to record consent
 * does not break the user flow, but is logged to stderr.
 */
export async function logConsent(params: LogConsentParams): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin.from('consent_logs').insert({
    user_id:      params.userId      ?? null,
    session_id:   params.sessionId   ?? null,
    consent_type: params.consentType,
    version:      params.version     ?? '1.0',
    consented:    params.consented,
    ip_hash:      params.ipHash      ?? null,
    user_agent:   params.userAgent?.slice(0, 500) ?? null,
  });

  if (error) {
    console.error('[gdpr.logConsent] failed:', error.message, params.consentType);
  }
}

// ---------------------------------------------------------------------------
// requestDataExport
// ---------------------------------------------------------------------------

/**
 * Generates a GDPR Art. 20 data export for `userId`.
 *
 * Side effects:
 *   1. Creates a data_export_requests row (status=completed) for audit.
 *   2. Returns the full export payload as a plain object (caller serialises
 *      to JSON and streams it as a file download).
 *
 * What is exported:
 *   profile, bikes, photos (metadata only — not binaries), swipes, matches,
 *   messages, verifications, consent history, safety check-ins,
 *   subscriptions, badges, previous export requests.
 *
 * What is NOT exported:
 *   - Raw payment card data (processed by Stripe; never stored by REVdating)
 *   - Other users' messages (only messages sent BY this user)
 *   - Internal moderation notes (not subject to Art. 20 portability)
 */
export async function requestDataExport(
  userId:    string,
  userEmail: string,
  ipHash?:   string | null,
  userAgent?: string | null,
): Promise<DataExportRow> {
  const admin = createAdminClient();

  // Create export request record (mark processing first to be idempotent-safe)
  const { data: requestRow } = await admin
    .from('data_export_requests')
    .insert({
      user_id:    userId,
      email:      userEmail,
      status:     'processing',
      ip_hash:    ipHash    ?? null,
      user_agent: userAgent ?? null,
    })
    .select('id')
    .single();

  // Gather all data in parallel
  const [
    profileResult,
    bikesResult,
    photosResult,
    swipesResult,
    matchesResult,
    messagesResult,
    verificationsResult,
    consentResult,
    checkinsResult,
    subscriptionsResult,
    badgesResult,
    exportRequestsResult,
  ] = await Promise.allSettled([
    admin.from('profiles')
      .select('display_name, bio, date_of_birth, gender, pronouns, city, country, latitude, longitude, ' +
              'riding_style, bike_type, dating_intent, relationship_type, distance_preference, ' +
              'is_verified, onboarding_complete, created_at, last_active')
      .eq('id', userId)
      .single(),

    admin.from('bikes')
      .select('bike_type, bike_brand, bike_model, bike_year, engine_size_cc, owned_or_dream, primary_bike, notes, created_at')
      .eq('user_id', userId),

    admin.from('profile_photos')
      .select('photo_type, is_primary, moderation_status, sort_order, created_at')
      .eq('user_id', userId)
      .order('sort_order'),

    admin.from('swipes')
      .select('id, swiped_id, action, created_at')
      .eq('swiper_id', userId)
      .order('created_at'),

    admin.from('matches')
      .select('id, created_at, is_active')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order('created_at'),

    admin.from('messages')
      .select('id, match_id, content, created_at')
      .eq('sender_id', userId)
      .is('deleted_at', null)
      .order('created_at'),

    admin.from('verifications')
      .select('verification_type, status, submitted_at, reviewed_at')
      .eq('user_id', userId),

    admin.from('consent_logs')
      .select('consent_type, version, consented, created_at')
      .eq('user_id', userId)
      .order('created_at'),

    admin.from('safety_checkins')
      .select('ride_description, destination_name, expected_return_at, status, created_at, resolved_at')
      .eq('user_id', userId)
      .order('created_at'),

    admin.from('subscriptions')
      .select('status, plan_name, current_period_start, current_period_end, cancel_at_period_end, created_at')
      .eq('user_id', userId),

    admin.from('user_badges')
      .select('badge_name, badge_type, earned_at')
      .eq('user_id', userId)
      .order('earned_at'),

    admin.from('data_export_requests')
      .select('requested_at, status, completed_at')
      .eq('user_id', userId)
      .order('requested_at'),
  ]);

  function settled<T>(r: PromiseSettledResult<{ data: T | null; error: unknown }>): T | null {
    return r.status === 'fulfilled' ? r.value.data : null;
  }

  const exportData: DataExportRow = {
    _metadata: {
      exported_at:    new Date().toISOString(),
      format_version: '2.0',
      subject:        'REVdating — GDPR / UK GDPR Art. 20 Data Portability Export',
      note:           'Payment card details are processed by Stripe and are never stored by REVdating. ' +
                      'Other users\' messages are not included in personal exports.',
    },
    account: {
      id:         userId,
      email:      userEmail,
    },
    profile:         settled(profileResult),
    bikes:           settled(bikesResult),
    photos:          settled(photosResult),
    swipes_sent:     settled(swipesResult),
    matches:         settled(matchesResult),
    messages_sent:   settled(messagesResult),
    verifications:   settled(verificationsResult),
    consent_history: settled(consentResult),
    safety_checkins: settled(checkinsResult),
    subscriptions:   settled(subscriptionsResult),
    badges:          settled(badgesResult),
    export_requests: settled(exportRequestsResult),
  };

  // Mark request completed
  if (requestRow?.id) {
    await admin
      .from('data_export_requests')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', requestRow.id);
  }

  return exportData;
}

// ---------------------------------------------------------------------------
// deleteAccount
// ---------------------------------------------------------------------------

/**
 * GDPR Art. 17 — right to erasure.
 *
 * Execution order (each step is best-effort; failures are logged, not thrown):
 *
 *  1. Record deletion request in data_deletion_requests (legal accountability)
 *  2. Cancel Stripe subscription immediately if active — Stripe retains
 *     the billing record for 7 years per financial regulations.
 *  3. Delete all profile photos from storage + profile_photos rows
 *  4. Delete verification selfies from storage (verification rows are kept
 *     in anonymised form — user_id will become NULL after step 6)
 *  5. Delete bikes (no legal reason to keep)
 *  6. Delete the Supabase auth user — this triggers ON DELETE CASCADE on
 *     the profiles table, and ON DELETE SET NULL on reports, admin_actions,
 *     illegal_content_reports (preserving moderation history anonymised)
 *  7. Mark deletion request completed (email only — user_id is now NULL)
 *
 * @throws {Error}  Only if the auth user deletion fails (step 6) — all
 *                  other failures are logged and tolerated.
 */
export async function deleteAccount(
  userId:    string,
  userEmail: string,
  reason?:   string,
): Promise<DeleteAccountResult> {
  const admin = createAdminClient();

  // ── 1. Record deletion request ────────────────────────────────────────────
  await admin.from('data_deletion_requests').insert({
    user_id:  userId,
    email:    userEmail,
    reason:   reason ?? null,
    status:   'processing',
  });

  let stripeCancelled = false;
  let photosDeleted   = 0;

  // ── 2. Cancel Stripe subscription ────────────────────────────────────────
  try {
    const { data: sub } = await admin
      .from('subscriptions')
      .select('stripe_subscription_id, status')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing'])
      .maybeSingle();

    if (sub?.stripe_subscription_id) {
      const { stripe } = await import('@/lib/stripe');
      await stripe.subscriptions.cancel(sub.stripe_subscription_id);
      stripeCancelled = true;
    }
  } catch (err) {
    console.error('[gdpr.deleteAccount] Stripe cancellation error:', err);
  }

  // ── 3. Delete profile photos from storage ─────────────────────────────────
  try {
    const { data: photos } = await admin
      .from('profile_photos')
      .select('storage_path')
      .eq('user_id', userId);

    if (photos?.length) {
      const paths = photos.map((p) => p.storage_path).filter(Boolean);
      if (paths.length) {
        await admin.storage.from('profile-photos').remove(paths);
        photosDeleted = paths.length;
      }
    }

    // Delete profile_photos rows (prevents orphan FK issues)
    await admin.from('profile_photos').delete().eq('user_id', userId);
  } catch (err) {
    console.error('[gdpr.deleteAccount] photo cleanup error:', err);
  }

  // ── 4. Delete verification selfies from storage ───────────────────────────
  try {
    const { data: verifs } = await admin
      .from('verifications')
      .select('selfie_path, document_path')
      .eq('user_id', userId);

    if (verifs?.length) {
      const paths = verifs
        .flatMap((v) => [v.selfie_path, v.document_path])
        .filter((p): p is string => p != null);
      if (paths.length) {
        await admin.storage.from('verifications').remove(paths);
      }
    }
  } catch (err) {
    console.error('[gdpr.deleteAccount] verification file cleanup error:', err);
  }

  // ── 5. Delete bikes ───────────────────────────────────────────────────────
  try {
    await admin.from('bikes').delete().eq('user_id', userId);
  } catch (err) {
    console.error('[gdpr.deleteAccount] bikes cleanup error:', err);
  }

  // ── 6. Delete auth user ───────────────────────────────────────────────────
  // This cascades to: profiles, swipes, matches (if user1/user2), messages,
  //   safety_checkins, subscriptions, user_badges, superlike_credits, etc.
  // FK ON DELETE SET NULL preserves: reports, admin_actions,
  //   illegal_content_reports (anonymised with user_id = NULL)
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    // Mark deletion request as failed so it can be retried / escalated
    await admin
      .from('data_deletion_requests')
      .update({ status: 'rejected', notes: deleteError.message })
      .eq('email', userEmail)
      .eq('status', 'processing');

    throw new Error(
      `Account deletion failed: ${deleteError.message}. ` +
      'Please contact privacy@REVdating.app for manual deletion.',
    );
  }

  // ── 7. Mark deletion request completed ───────────────────────────────────
  // At this point user_id FK is NULL (cascade), so match on email.
  await admin
    .from('data_deletion_requests')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('email', userEmail)
    .eq('status', 'processing');

  return { success: true, stripe_cancelled: stripeCancelled, photos_deleted: photosDeleted };
}

// ---------------------------------------------------------------------------
// hashIp — shared utility for routes that need to store hashed IPs
// ---------------------------------------------------------------------------

export async function hashIp(rawIp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data    = encoder.encode(rawIp);
  const buffer  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
