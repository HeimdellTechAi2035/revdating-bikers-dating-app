'use client';

/**
 * lib/realtime/index.ts
 *
 * Supabase Realtime subscription helpers for REVdating.
 *
 * All subscribe* functions return a RealtimeChannel that MUST be cleaned up
 * by calling removeChannel(channel) when the component unmounts, or
 * removeAllChannels() when the user logs out.
 *
 * Client-side only — uses the browser Supabase client.
 */

import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { MessageRow, MatchRow } from '@/types/database.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TypingEvent = {
  userId: string;
  isTyping: boolean;
};

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/**
 * Subscribes to new messages in a specific match chat.
 * Fires `onMessage` for every INSERT into the messages table for this match.
 *
 * Supabase RLS ensures only participants in the match can receive these events.
 *
 * @returns The RealtimeChannel — call removeChannel(channel) on unmount.
 */
export function subscribeToMessages(
  matchId: string,
  onMessage: (message: MessageRow) => void,
): RealtimeChannel {
  const supabase = createClient();

  return supabase
    .channel(`messages:${matchId}`)
    .on<MessageRow>(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `match_id=eq.${matchId}`,
      },
      (payload) => onMessage(payload.new),
    )
    .subscribe();
}

/**
 * Subscribes to read-receipt updates for messages in a match chat.
 * Fires `onRead` when is_read flips to true on a message row.
 *
 * @returns The RealtimeChannel — call removeChannel(channel) on unmount.
 */
export function subscribeToReadReceipts(
  matchId: string,
  onRead: (messageId: string, readAt: string) => void,
): RealtimeChannel {
  const supabase = createClient();

  return supabase
    .channel(`receipts:${matchId}`)
    .on<MessageRow>(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `match_id=eq.${matchId}`,
      },
      (payload) => {
        const msg = payload.new;
        if (msg.is_read && msg.read_at) {
          onRead(msg.id, msg.read_at);
        }
      },
    )
    .subscribe();
}

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------

/**
 * Subscribes to new matches for the authenticated user.
 *
 * Because RLS limits the matches table to rows where the user is user1_id or
 * user2_id, these events are already scoped to the current user.
 *
 * @returns The RealtimeChannel — call removeChannel(channel) on unmount.
 */
export function subscribeToNewMatches(
  onMatch: (match: MatchRow) => void,
): RealtimeChannel {
  const supabase = createClient();

  return supabase
    .channel('new_matches')
    .on<MatchRow>(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'matches',
      },
      (payload) => onMatch(payload.new),
    )
    .subscribe();
}

// ---------------------------------------------------------------------------
// Typing indicators (Broadcast — ephemeral, never persisted to the DB)
// ---------------------------------------------------------------------------

/**
 * Broadcasts a typing indicator for the current user within a match chat.
 * Call this whenever the message input changes (apply your own debounce).
 *
 * Ephemeral: this fires a broadcast event only — nothing is stored in the DB.
 */
export async function broadcastTyping(
  matchId: string,
  userId: string,
  isTyping: boolean,
): Promise<void> {
  const supabase = createClient();
  const channel = supabase.channel(`typing:${matchId}`);

  await channel.send({
    type: 'broadcast',
    event: 'typing',
    payload: { userId, isTyping } satisfies TypingEvent,
  });
}

/**
 * Subscribes to typing indicator broadcasts in a match chat.
 * Fires `onTyping` whenever a participant starts or stops typing.
 *
 * @returns The RealtimeChannel — call removeChannel(channel) on unmount.
 */
export function subscribeToTyping(
  matchId: string,
  onTyping: (event: TypingEvent) => void,
): RealtimeChannel {
  const supabase = createClient();

  return supabase
    .channel(`typing:${matchId}`)
    .on('broadcast', { event: 'typing' }, ({ payload }) =>
      onTyping(payload as TypingEvent),
    )
    .subscribe();
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Removes a single Realtime channel subscription.
 * Call this in the cleanup callback of useEffect.
 */
export async function removeChannel(channel: RealtimeChannel): Promise<void> {
  const supabase = createClient();
  await supabase.removeChannel(channel);
}

/**
 * Removes all active Realtime subscriptions for this client instance.
 * Call this when the user logs out to ensure no stale listeners remain.
 */
export async function removeAllChannels(): Promise<void> {
  const supabase = createClient();
  await supabase.removeAllChannels();
}
