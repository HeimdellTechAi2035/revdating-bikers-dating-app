/**
 * lib/moderation/index.ts
 *
 * Server-side blocking and reporting logic for REVdating.
 * For use in API routes / server actions only — uses the admin client.
 *
 * Public surface:
 *   blockUser(blockerId, blockedId, reason?)          → BlockResult
 *   reportUser(reporterId, reportedId, reason, ...)   → ReportResult
 *   reportMessage(messageId, reporterId, reason, ...) → ReportResult
 *   reportPhoto(photoId, reporterId, reason, ...)     → ReportResult
 *
 * Safety guarantees:
 *   - Users cannot block or report themselves
 *   - blockUser is idempotent (duplicate OK)
 *   - reportUser is idempotent per (reporter, reported, status=pending)
 *   - Reporters are never informed whether a reported user was actioned
 *   - All reports start as 'pending' for admin review
 *   - Blocking immediately deactivates any shared active match
 *   - Blocked pairs are hidden from discovery, prevented from swiping,
 *     and prevented from messaging (enforced in lib/discovery, lib/swipe,
 *     lib/chat — blocking here also prevents future attempts at the DB level)
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { ReportReasonType } from '@/types/database.types';

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export interface BlockResult {
  /** true if a new block was created; false if already blocked (idempotent) */
  blocked:           boolean;
  /** true if a shared active match was deactivated as a result of the block */
  match_deactivated: boolean;
}

export interface ReportResult {
  /** The id of the created report, or the existing pending report if duplicate */
  report_id:       string;
  /** true if a report already existed and no new row was inserted */
  already_reported: boolean;
}

export type UserReportReason = ReportReasonType;

export type MessageReportReason =
  | 'harassment'
  | 'spam'
  | 'hate_speech'
  | 'other';

export type PhotoReportReason =
  | 'inappropriate_photos'
  | 'underage'
  | 'fake_profile'
  | 'other';

// ---------------------------------------------------------------------------
// blockUser
// ---------------------------------------------------------------------------

/**
 * Blocks `blockedId` on behalf of `blockerId`.
 *
 * Side effects:
 *   1. Inserts a row into `blocked_users`.
 *   2. Deactivates any shared active match between the two users immediately
 *      (the DB trigger on blocked_users handles this too, but we do it here
 *      explicitly to make the behaviour testable and unconditional on whether
 *      the trigger is present).
 *
 * Visibility enforcement after blocking:
 *   - Discovery: `lib/discovery/getDiscoveryProfiles` already excludes blocked pairs.
 *   - Chat list:  `lib/chat/getChatList` only returns active matches — the
 *                 deactivated match is immediately hidden.
 *   - Messaging:  `lib/chat/sendMessage` checks for blocks before inserting.
 *   - Swiping:    `lib/swipe/createSwipe` checks for blocks before inserting.
 *
 * @throws {Error} with a user-safe message if the blocker tries to block themselves.
 */
export async function blockUser(
  blockerId: string,
  blockedId: string,
  reason?: string,
): Promise<BlockResult> {
  if (blockerId === blockedId) {
    throw new Error('You cannot block yourself.');
  }

  const admin = createAdminClient();

  // ── 1. Insert the block (idempotent via ON CONFLICT DO NOTHING) ───────────
  const { error: blockError, data: blockData } = await admin
    .from('blocked_users')
    .upsert(
      { blocker_id: blockerId, blocked_id: blockedId, reason: reason ?? null },
      { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true },
    )
    .select('id')
    .maybeSingle();

  if (blockError) {
    throw new Error(`Failed to block user: ${blockError.message}`);
  }

  const alreadyBlocked = blockData === null; // upsert returned nothing → already existed

  // ── 2. Deactivate any shared active match ─────────────────────────────────
  // canonical order: user1_id < user2_id (enforced by DB CHECK)
  const [u1, u2] = [blockerId, blockedId].sort();

  const { data: deactivated } = await admin
    .from('matches')
    .update({ is_active: false })
    .or(`and(user1_id.eq.${u1},user2_id.eq.${u2}),and(user1_id.eq.${u2},user2_id.eq.${u1})`)
    .eq('is_active', true)
    .select('id');

  return {
    blocked:           !alreadyBlocked,
    match_deactivated: (deactivated?.length ?? 0) > 0,
  };
}

// ---------------------------------------------------------------------------
// reportUser
// ---------------------------------------------------------------------------

/**
 * Files a report against a user (and optionally a specific photo).
 *
 * Idempotent: if the same reporter already has a pending report against the
 * same reported user, the existing report id is returned and no new row is
 * inserted. This prevents double-submission floods while the admin queue is
 * being worked through.
 *
 * The reported user is NOT notified in any way.
 * The report starts with status = 'pending' for admin review.
 *
 * @throws {Error} if the reporter tries to report themselves, or if the
 *                 target user does not exist.
 */
export async function reportUser(
  reporterId:  string,
  reportedId:  string,
  reason:      UserReportReason,
  description?: string,
  photoId?:    string,
): Promise<ReportResult> {
  if (reporterId === reportedId) {
    throw new Error('You cannot report yourself.');
  }

  const admin = createAdminClient();

  // Verify target user exists (prevents reporting phantom UUIDs)
  const { data: target } = await admin
    .from('profiles')
    .select('id')
    .eq('id', reportedId)
    .single();

  if (!target) {
    throw new Error('User not found.');
  }

  // Check for existing pending report from this reporter → reported pair
  let existingQuery = admin
    .from('reports')
    .select('id')
    .eq('reporter_id', reporterId)
    .eq('reported_id', reportedId)
    .eq('status', 'pending' as const);
  if (photoId) {
    existingQuery = existingQuery.eq('photo_id', photoId);
  } else {
    existingQuery = existingQuery.is('photo_id', null);
  }
  const { data: existing } = await existingQuery.maybeSingle();

  if (existing) {
    return { report_id: existing.id, already_reported: true };
  }

  const { data: report, error } = await admin
    .from('reports')
    .insert({
      reporter_id:  reporterId,
      reported_id:  reportedId,
      reason,
      description:  description?.trim() || null,
      photo_id:     photoId ?? null,
      status:       'pending',
    })
    .select('id')
    .single();

  if (error || !report) {
    throw new Error(`Failed to submit report: ${error?.message ?? 'unknown error'}`);
  }

  return { report_id: report.id, already_reported: false };
}

// ---------------------------------------------------------------------------
// reportMessage
// ---------------------------------------------------------------------------

/**
 * Reports the sender of a specific message.
 *
 * Validates:
 *   - Message exists and is not soft-deleted
 *   - Reporter is not the sender of the message
 *   - Reporter is a participant in the match the message belongs to
 *
 * A report is created against `message.sender_id` (reported user is the
 * message author, not the match partner generically).
 *
 * @throws {Error} with a user-safe message on validation failure.
 */
export async function reportMessage(
  messageId:    string,
  reporterId:   string,
  reason:       MessageReportReason,
  description?: string,
): Promise<ReportResult> {
  const admin = createAdminClient();

  // Fetch message (with deleted check)
  const { data: message } = await admin
    .from('messages')
    .select('id, match_id, sender_id, deleted_at')
    .eq('id', messageId)
    .single();

  if (!message || message.deleted_at) {
    throw new Error('Message not found.');
  }

  if (message.sender_id === reporterId) {
    throw new Error('You cannot report your own message.');
  }

  // Verify reporter participates in the match
  const { data: match } = await admin
    .from('matches')
    .select('user1_id, user2_id')
    .eq('id', message.match_id)
    .single();

  if (!match || (match.user1_id !== reporterId && match.user2_id !== reporterId)) {
    throw new Error('Not authorized to report this message.');
  }

  // Delegate to reportUser (message report is a user report scoped to a message)
  // We cast reason — all message reasons are valid ReportReasonType values
  return reportUser(
    reporterId,
    message.sender_id,
    reason as ReportReasonType,
    description,
  );
}

// ---------------------------------------------------------------------------
// reportPhoto
// ---------------------------------------------------------------------------

/**
 * Reports a specific profile photo.
 *
 * Validates:
 *   - Photo exists and is not from the reporter's own account
 *   - Photo owner exists
 *
 * The photo_id is stored on the report row so admins can view the exact photo
 * that was flagged. The reported user is not notified.
 *
 * @throws {Error} with a user-safe message on validation failure.
 */
export async function reportPhoto(
  photoId:      string,
  reporterId:   string,
  reason:       PhotoReportReason,
  description?: string,
): Promise<ReportResult> {
  const admin = createAdminClient();

  // Fetch the photo to get the owner
  const { data: photo } = await admin
    .from('profile_photos')
    .select('id, user_id')
    .eq('id', photoId)
    .single();

  if (!photo) {
    throw new Error('Photo not found.');
  }

  if (photo.user_id === reporterId) {
    throw new Error('You cannot report your own photo.');
  }

  return reportUser(
    reporterId,
    photo.user_id,
    reason as ReportReasonType,
    description,
    photoId, // attach the specific photo to the report
  );
}

// ---------------------------------------------------------------------------
// Admin helpers (used by admin API routes)
// ---------------------------------------------------------------------------

/**
 * Returns pending report counts grouped by type for admin dashboard badges.
 * Does not reveal any personally-identifiable information — count only.
 */
export async function getPendingReportStats(): Promise<{
  total:   number;
  profile: number;
  photo:   number;
}> {
  const admin = createAdminClient();

  const { data: rows } = await admin
    .from('reports')
    .select('photo_id')
    .eq('status', 'pending');

  const all     = rows ?? [];
  const photo   = all.filter((r) => r.photo_id !== null).length;
  const profile = all.length - photo;

  return { total: all.length, profile, photo };
}

/**
 * Reviews and resolves a report.
 *
 * Actions:
 *   'reviewed'  — Marks seen; no user action taken.
 *   'actioned'  — Marks resolved; optionally bans the reported user.
 *   'dismissed' — Marks dismissed; no user action taken.
 *
 * When `banUser` is true and action is 'actioned':
 *   - Sets profiles.is_banned = true with a reason derived from the report
 *   - Deactivates all the banned user's active matches
 *   - Logs a 'ban' admin_action
 *
 * The reporter is never told the outcome.
 *
 * @throws {Error} if the report does not exist.
 */
export async function reviewReport(
  reportId:   string,
  adminId:    string,
  action:     'reviewed' | 'actioned' | 'dismissed',
  adminNotes?: string,
  banUser?:   boolean,
): Promise<void> {
  const admin = createAdminClient();

  const { data: report } = await admin
    .from('reports')
    .select('id, reported_id, reason')
    .eq('id', reportId)
    .single();

  if (!report) {
    throw new Error(`Report '${reportId}' not found.`);
  }

  // Update report status
  await admin
    .from('reports')
    .update({
      status:      action,
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
      admin_notes: adminNotes ?? null,
    })
    .eq('id', reportId);

  // Audit log
  const adminActionType =
    action === 'actioned'  ? 'report_actioned'  :
    action === 'dismissed' ? 'report_dismissed' :
    'profile_note';

  await admin.from('admin_actions').insert({
    admin_id:       adminId,
    target_user_id: report.reported_id,
    action:         adminActionType,
    reason:         adminNotes ?? null,
    metadata:       { report_id: reportId, report_reason: report.reason },
  });

  // Optionally ban the reported user
  if (banUser && action === 'actioned') {
    const banReason = `Account suspended following ${report.reason} report (report #${reportId}).`;

    await Promise.all([
      admin
        .from('profiles')
        .update({ is_banned: true, ban_reason: banReason })
        .eq('id', report.reported_id),

      // Deactivate all their active matches
      admin
        .from('matches')
        .update({ is_active: false })
        .or(`user1_id.eq.${report.reported_id},user2_id.eq.${report.reported_id}`)
        .eq('is_active', true),

      // Log the ban as a separate admin action
      admin.from('admin_actions').insert({
        admin_id:       adminId,
        target_user_id: report.reported_id,
        action:         'ban',
        reason:         banReason,
        metadata:       { triggered_by_report: reportId },
      }),
    ]);
  }
}
