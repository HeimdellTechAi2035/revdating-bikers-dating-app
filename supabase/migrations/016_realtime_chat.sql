-- =============================================================
-- Migration 016: Enable Supabase Realtime for chat tables
-- =============================================================
-- Adds the `messages` and `matches` tables to the Supabase Realtime
-- publication so that client-side postgres_changes subscriptions fire
-- for INSERT (new messages) and UPDATE (read receipts, match state) events.
--
-- After applying this migration, any client subscribed via:
--   supabase.channel('chat:…').on('postgres_changes', { event: 'INSERT', table: 'messages', … })
-- will receive new message events in real time.
--
-- RLS policies on the messages table continue to enforce row-level visibility —
-- only participants of the relevant match can subscribe to changes in that match.
-- =============================================================

-- Enable realtime for the messages table (new messages + read receipts)
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Enable realtime for the matches table (match activation / is_active changes)
ALTER PUBLICATION supabase_realtime ADD TABLE matches;

-- =============================================================
-- Replica identity: FULL is required for UPDATE/DELETE events
-- to include the old row values. Without it, only the new row
-- is available in the payload. We set FULL so that is_read,
-- read_at, and last_message_at changes are fully broadcast.
-- =============================================================
ALTER TABLE messages SET (replica_identity = full);
ALTER TABLE matches  SET (replica_identity = full);
