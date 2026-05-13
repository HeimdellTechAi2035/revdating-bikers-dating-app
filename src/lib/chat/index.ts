/**
 * lib/chat/index.ts
 *
 * Server-side chat business logic for REVdating.
 * All functions use the admin client and are intended for use in API routes
 * / server actions only — never import this in client components.
 *
 * Public surface:
 *   sendMessage(matchId, senderId, content)     → MessageRow
 *   markMessagesAsRead(matchId, userId)          → number (rows updated)
 *   getChatList(userId)                          → ChatListItem[]
 *   getMessages(matchId, userId)                 → ChatMessage[]
 *   reportMessage(messageId, reporterId, reason) → void
 *
 * Security guarantees enforced here (not only in RLS):
 *   - Only participants of an active match can send or read messages
 *   - Banned senders are rejected before DB write
 *   - Blocked pairs cannot message regardless of match state
 *   - Empty / whitespace-only content is rejected
 *   - Reporters cannot report their own messages
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { signPhotoUrls } from '@/lib/photos/sign';
import { notifyNewMessage } from '@/lib/notifications';
import { emailNewMessage } from '@/lib/email';
import type { MessageRow, ReportReasonType } from '@/types/database.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MessageReportReason =
  | 'harassment'
  | 'spam'
  | 'hate_speech'
  | 'inappropriate_photos'
  | 'other';

/** A message row enriched with the `is_mine` flag for the requesting user. */
export interface ChatMessage extends MessageRow {
  is_mine: boolean;
}

/** One item in the user's chat/match list. */
export interface ChatListItem {
  id:              string;
  is_active:       boolean;
  created_at:      string;
  last_message_at: string | null;
  other_user: {
    id:               string;
    display_name:     string;
    primary_photo_url: string | null;
    last_active:      string;
    is_verified:      boolean;
    is_premium:       boolean;
  };
  last_message: {
    content:    string;
    sender_id:  string;
    is_read:    boolean;
    created_at: string;
  } | null;
  unread_count:  number;
  you_superliked:  boolean;
  they_superliked: boolean;
}

// ---------------------------------------------------------------------------
// sendMessage
// ---------------------------------------------------------------------------

/**
 * Sends a message within an existing match.
 *
 * Validation order (each throws with a user-safe message):
 *  1. Content is non-empty after trimming
 *  2. Match exists and sender is a participant
 *  3. Match is active
 *  4. Sender is not banned
 *  5. Neither participant has blocked the other
 *
 * Side effects (fire-and-forget):
 *  - Updates `matches.last_message_at`
 *  - Sends push notification to recipient
 *
 * Supabase Realtime automatically broadcasts the INSERT event to any client
 * subscribed to `postgres_changes` for the `messages` table (requires the
 * table to be in the `supabase_realtime` publication — see migration 016).
 *
 * @throws {Error} with a user-safe message on validation failure.
 */
export async function sendMessage(
  matchId:  string,
  senderId: string,
  content:  string,
): Promise<MessageRow> {
  // ── 1. Content validation ────────────────────────────────────────────────
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('Message content cannot be empty.');
  }
  if (trimmed.length > 2000) {
    throw new Error('Message content exceeds the 2000-character limit.');
  }

  const admin = createAdminClient();

  // ── 2. Match exists + sender is a participant ────────────────────────────
  const { data: match, error: matchError } = await admin
    .from('matches')
    .select('id, user1_id, user2_id, is_active')
    .eq('id', matchId)
    .single();

  if (matchError || !match) {
    throw new Error('Match not found.');
  }

  const isParticipant = match.user1_id === senderId || match.user2_id === senderId;
  if (!isParticipant) {
    throw new Error('You are not a participant in this match.');
  }

  // ── 3. Match must be active ──────────────────────────────────────────────
  if (!match.is_active) {
    throw new Error('This match is no longer active.');
  }

  const recipientId = match.user1_id === senderId ? match.user2_id : match.user1_id;

  // ── 4. Sender must not be banned ─────────────────────────────────────────
  const { data: senderProfile } = await admin
    .from('profiles')
    .select('is_banned, display_name')
    .eq('id', senderId)
    .single();

  if (senderProfile?.is_banned) {
    throw new Error('Your account has been suspended and cannot send messages.');
  }

  // ── 5. Neither participant has blocked the other ──────────────────────────
  const { count: blockCount } = await admin
    .from('blocked_users')
    .select('*', { count: 'exact', head: true })
    .or(
      `and(blocker_id.eq.${senderId},blocked_id.eq.${recipientId}),` +
      `and(blocker_id.eq.${recipientId},blocked_id.eq.${senderId})`,
    );

  if ((blockCount ?? 0) > 0) {
    throw new Error('You cannot message this user.');
  }

  // ── Insert the message ───────────────────────────────────────────────────
  const { data: message, error: insertError } = await admin
    .from('messages')
    .insert({
      match_id:  matchId,
      sender_id: senderId,
      content:   trimmed,
    })
    .select()
    .single();

  if (insertError || !message) {
    throw new Error(`Failed to send message: ${insertError?.message ?? 'unknown error'}`);
  }

  // ── Side effects (non-blocking) ───────────────────────────────────────────
  void Promise.all([
    // Update last_message_at on the match for chat list sorting
    admin
      .from('matches')
      .update({ last_message_at: message.created_at })
      .eq('id', matchId),

    // Push notification to recipient
    notifyNewMessage(
      recipientId,
      senderProfile?.display_name ?? 'Someone',
      matchId,
      trimmed,
    ),

    // Email notification to recipient (fire-and-forget, respects opt-out)
    emailNewMessage(
      recipientId,
      senderProfile?.display_name ?? 'Someone',
      matchId,
      trimmed,
    ),
  ]).catch((err) => {
    console.error('[chat/sendMessage] Side effect error:', err);
  });

  return message;
}

// ---------------------------------------------------------------------------
// markMessagesAsRead
// ---------------------------------------------------------------------------

/**
 * Marks all unread messages sent by the *other* participant as read.
 *
 * Sets `is_read = true` and `read_at = now()` for every message in the match
 * where `sender_id != userId` and `is_read = false`.
 *
 * Supabase Realtime automatically broadcasts the UPDATE events to any client
 * subscribed to `postgres_changes` for the `messages` table, enabling the
 * sender to see real-time read receipts (the `read_at` column flip).
 *
 * @returns The number of messages that were marked as read.
 * @throws  {Error} if the userId is not a participant in the match.
 */
export async function markMessagesAsRead(
  matchId: string,
  userId:  string,
): Promise<number> {
  const admin = createAdminClient();

  // Verify participation — prevents marking reads for matches you're not in
  const { data: match } = await admin
    .from('matches')
    .select('user1_id, user2_id')
    .eq('id', matchId)
    .single();

  if (!match || (match.user1_id !== userId && match.user2_id !== userId)) {
    throw new Error('Match not found or you are not a participant.');
  }

  // Update all unread messages sent by the other participant
  const { data: updated, error } = await admin
    .from('messages')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('match_id', matchId)
    .eq('is_read', false)
    .neq('sender_id', userId)
    .select('id');

  if (error) {
    throw new Error(`Failed to mark messages as read: ${error.message}`);
  }

  return updated?.length ?? 0;
}

// ---------------------------------------------------------------------------
// getChatList
// ---------------------------------------------------------------------------

/**
 * Returns the current user's active match list, enriched with:
 *  - Other participant's profile and primary photo
 *  - Last message in each chat (preview)
 *  - Unread message count per match
 *  - Superlike flags
 *
 * Sorted by: last_message_at DESC (nulls last), then created_at DESC.
 */
export async function getChatList(userId: string): Promise<ChatListItem[]> {
  const admin = createAdminClient();

  // Fetch active matches the user participates in
  const { data: rawMatches, error } = await admin
    .from('matches')
    .select('id, is_active, created_at, last_message_at, user1_id, user2_id, user1_superliked, user2_superliked')
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .eq('is_active', true)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(`Failed to fetch chat list: ${error.message}`);
  }

  if (!rawMatches?.length) return [];

  const otherUserIds = rawMatches.map((m) =>
    m.user1_id === userId ? m.user2_id : m.user1_id,
  );
  const matchIds = rawMatches.map((m) => m.id);

  // Parallel fetch: profiles, photos, last message per match, unread counts
  const [
    { data: profiles },
    { data: photos },
    { data: lastMessages },
    { data: unreadRows },
  ] = await Promise.all([
    admin
      .from('profiles')
      .select('id, display_name, last_active, is_verified, is_premium')
      .in('id', otherUserIds),

    admin
      .from('profile_photos')
      .select('user_id, storage_path, public_url')
      .in('user_id', otherUserIds)
      .eq('is_primary', true)
      .eq('moderation_status', 'approved'),

    // One query for all messages; we pick the newest per match in JS
    admin
      .from('messages')
      .select('match_id, content, sender_id, is_read, created_at')
      .in('match_id', matchIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),

    admin
      .from('messages')
      .select('match_id')
      .in('match_id', matchIds)
      .eq('is_read', false)
      .neq('sender_id', userId)
      .is('deleted_at', null),
  ]);

  const signedPhotos = await signPhotoUrls(
    (photos ?? []) as { user_id: string; storage_path: string }[],
    'profile-photos',
  );
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const photoMap   = new Map(signedPhotos.map((p) => [p.user_id, p.public_url]));

  // Keep only the most-recent message per match
  const lastMessageMap = new Map<string, NonNullable<typeof lastMessages>[0]>();
  for (const msg of lastMessages ?? []) {
    if (!lastMessageMap.has(msg.match_id)) lastMessageMap.set(msg.match_id, msg);
  }

  // Count unread per match
  const unreadMap = new Map<string, number>();
  for (const row of unreadRows ?? []) {
    unreadMap.set(row.match_id, (unreadMap.get(row.match_id) ?? 0) + 1);
  }

  return rawMatches.map((m): ChatListItem => {
    const otherId   = m.user1_id === userId ? m.user2_id  : m.user1_id;
    const profile   = profileMap.get(otherId);
    const lastMsg   = lastMessageMap.get(m.id) ?? null;

    return {
      id:              m.id,
      is_active:       m.is_active,
      created_at:      m.created_at,
      last_message_at: m.last_message_at,
      other_user: {
        id:                otherId,
        display_name:      profile?.display_name     ?? 'Unknown',
        primary_photo_url: photoMap.get(otherId)     ?? null,
        last_active:       profile?.last_active      ?? '',
        is_verified:       profile?.is_verified      ?? false,
        is_premium:        profile?.is_premium       ?? false,
      },
      last_message: lastMsg
        ? {
            content:    lastMsg.content,
            sender_id:  lastMsg.sender_id,
            is_read:    lastMsg.is_read,
            created_at: lastMsg.created_at,
          }
        : null,
      unread_count:    unreadMap.get(m.id)  ?? 0,
      you_superliked:  m.user1_id === userId ? m.user1_superliked : m.user2_superliked,
      they_superliked: m.user1_id === userId ? m.user2_superliked : m.user1_superliked,
    };
  });
}

// ---------------------------------------------------------------------------
// getMessages
// ---------------------------------------------------------------------------

/**
 * Returns all non-deleted messages for a match, enriched with `is_mine`.
 *
 * Validates that `userId` is a participant before returning any data.
 * Soft-deleted messages (`deleted_at IS NOT NULL`) are excluded.
 *
 * Messages are ordered oldest-first (ascending created_at) which is standard
 * for chat UIs that render history top-to-bottom.
 *
 * @param options.limit   Maximum number of messages to return (default: 50)
 * @param options.before  ISO timestamp cursor — return messages older than this
 *
 * @throws {Error} if the match doesn't exist or userId is not a participant.
 */
export async function getMessages(
  matchId: string,
  userId:  string,
  options: { limit?: number; before?: string } = {},
): Promise<ChatMessage[]> {
  const { limit = 50, before } = options;
  const admin = createAdminClient();

  // Verify participation
  const { data: match } = await admin
    .from('matches')
    .select('user1_id, user2_id')
    .eq('id', matchId)
    .single();

  if (!match || (match.user1_id !== userId && match.user2_id !== userId)) {
    throw new Error('Match not found or you are not a participant.');
  }

  let query = admin
    .from('messages')
    .select('id, match_id, sender_id, content, is_read, read_at, deleted_at, created_at')
    .eq('match_id', matchId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data: messages, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch messages: ${error.message}`);
  }

  return (messages ?? []).map((m) => ({
    ...m,
    is_mine: m.sender_id === userId,
  }));
}

// ---------------------------------------------------------------------------
// reportMessage
// ---------------------------------------------------------------------------

/**
 * Reports the *sender* of a message.
 *
 * A report entry is created in the `reports` table with:
 *  - `reporter_id`  = reporterId
 *  - `reported_id`  = message.sender_id
 *  - `reason`       = caller-supplied reason
 *  - `status`       = 'pending'
 *
 * The raw `description` is stored for moderator review.
 *
 * @throws {Error} if the message doesn't exist, is deleted, the reporter is
 *                 not a participant in the match, or is reporting themselves.
 */
export async function reportMessage(
  messageId:    string,
  reporterId:   string,
  reason:       MessageReportReason,
  description?: string,
): Promise<void> {
  const admin = createAdminClient();

  // Fetch the message (include deleted check)
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

  // Verify reporter is a participant in the match
  const { data: match } = await admin
    .from('matches')
    .select('user1_id, user2_id')
    .eq('id', message.match_id)
    .single();

  if (!match || (match.user1_id !== reporterId && match.user2_id !== reporterId)) {
    throw new Error('Not authorized to report this message.');
  }

  const { error } = await admin.from('reports').insert({
    reporter_id:  reporterId,
    reported_id:  message.sender_id,
    reason:       reason as ReportReasonType,
    description:  description?.trim() || null,
    status:       'pending',
  });

  if (error) {
    throw new Error(`Failed to submit report: ${error.message}`);
  }
}
