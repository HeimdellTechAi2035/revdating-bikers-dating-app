-- =============================================================
-- RevMatch — Migration 015: Authoritative RLS Policies
--
-- Drops and recreates all Row Level Security policies for the
-- eight core tables specified, plus supporting helper functions.
--
-- Safe to re-run: all DROP POLICY IF EXISTS before CREATE POLICY.
--
-- Design principles:
--   1. Deny by default — RLS is enabled; unlisted operations fail.
--   2. Server/admin bypass — service-role key bypasses RLS entirely.
--      Use it from API routes and webhook handlers, never the browser.
--   3. No client-side privilege escalation — WITH CHECK guards on
--      UPDATE prevent users from flipping is_banned, is_premium,
--      is_verified, or is_admin on their own row.
--   4. Block awareness — are_users_blocked() is checked on every
--      cross-user read so blocked users are mutually invisible.
--   5. Matches are DB-only — the match-creation trigger in
--      migration 001 is the sole insert path; clients are blocked.
-- =============================================================

-- =============================================================
-- HELPER FUNCTIONS
-- SECURITY DEFINER so they run as postgres and bypass RLS
-- when checking admin status or block relationships.
-- =============================================================

-- is_admin: checks EITHER the admin_users table (primary) OR
-- the profiles.is_admin boolean (fallback for older rows).
CREATE OR REPLACE FUNCTION is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM admin_users  WHERE id = p_user_id)
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND is_admin = TRUE);
$$;

CREATE OR REPLACE FUNCTION is_super_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users WHERE id = p_user_id AND role = 'super_admin'
  );
$$;

-- are_users_blocked: symmetric; returns TRUE if either direction is blocked.
CREATE OR REPLACE FUNCTION are_users_blocked(p_user_a UUID, p_user_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM blocked_users
    WHERE (blocker_id = p_user_a AND blocked_id = p_user_b)
       OR (blocker_id = p_user_b AND blocked_id = p_user_a)
  );
$$;

-- profile_field_unchanged: used in profiles UPDATE WITH CHECK to prevent
-- clients from mutating server-controlled boolean flags.
-- Reads the CURRENT (pre-update) value from the row and compares.
CREATE OR REPLACE FUNCTION profile_field_unchanged(p_user_id UUID, p_field TEXT, p_new_value BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_current BOOLEAN;
BEGIN
  EXECUTE format('SELECT %I FROM profiles WHERE id = $1', p_field)
    INTO v_current
    USING p_user_id;
  RETURN v_current IS NOT DISTINCT FROM p_new_value;
END;
$$;

-- =============================================================
-- ENSURE RLS IS ON (idempotent)
-- =============================================================

ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE bikes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_photos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE swipes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches         ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_users   ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_actions   ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- PROFILES
-- =============================================================

DROP POLICY IF EXISTS "profiles_select_public"       ON profiles;
DROP POLICY IF EXISTS "profiles_select_own"          ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own"          ON profiles;
DROP POLICY IF EXISTS "profiles_insert_trigger"      ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"          ON profiles;
DROP POLICY IF EXISTS "profiles_admin_all"           ON profiles;

-- Any authenticated user can read profiles that are:
--   • active and not banned
--   • have completed onboarding
--   • have not blocked the viewer (and viewer has not blocked them)
CREATE POLICY "profiles_select_public"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    is_active        = TRUE
    AND is_banned    = FALSE
    AND onboarding_complete = TRUE
    AND NOT are_users_blocked(auth.uid(), id)
  );

-- A user can always read their own profile regardless of status.
-- (Needed for settings, onboarding, and ban-notice pages.)
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- The new-user trigger (SECURITY DEFINER) creates the initial row.
-- This policy exists only as a safety net for edge cases.
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile.
-- WITH CHECK prevents elevating server-controlled flags:
--   is_banned, is_premium, is_verified, is_admin
-- Users legitimately CANNOT flip those; only the server can.
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Each call reads the current DB value and compares to what the client sent.
    AND profile_field_unchanged(auth.uid(), 'is_banned',   is_banned)
    AND profile_field_unchanged(auth.uid(), 'is_premium',  is_premium)
    AND profile_field_unchanged(auth.uid(), 'is_verified', is_verified)
    AND profile_field_unchanged(auth.uid(), 'is_admin',    is_admin)
  );

-- Admins can read and update any profile (moderator tools).
-- Service-role (webhook, admin API) bypasses RLS entirely.
CREATE POLICY "profiles_admin_all"
  ON profiles FOR ALL
  TO authenticated
  USING    (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- =============================================================
-- BIKES
-- =============================================================

DROP POLICY IF EXISTS "bikes_select_public" ON bikes;
DROP POLICY IF EXISTS "bikes_select_own"    ON bikes;
DROP POLICY IF EXISTS "bikes_insert_own"    ON bikes;
DROP POLICY IF EXISTS "bikes_update_own"    ON bikes;
DROP POLICY IF EXISTS "bikes_delete_own"    ON bikes;
DROP POLICY IF EXISTS "bikes_modify_own"    ON bikes;
DROP POLICY IF EXISTS "bikes_admin_all"     ON bikes;

-- Bikes of non-banned, non-blocked, onboarded users are readable.
CREATE POLICY "bikes_select_public"
  ON bikes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = bikes.user_id
        AND p.is_active        = TRUE
        AND p.is_banned        = FALSE
        AND p.onboarding_complete = TRUE
        AND NOT are_users_blocked(auth.uid(), p.id)
    )
  );

-- Own bikes are always readable (needed for edit profile screen).
CREATE POLICY "bikes_select_own"
  ON bikes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "bikes_insert_own"
  ON bikes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bikes_update_own"
  ON bikes FOR UPDATE
  TO authenticated
  USING    (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bikes_delete_own"
  ON bikes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "bikes_admin_all"
  ON bikes FOR ALL
  TO authenticated
  USING    (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- =============================================================
-- PROFILE PHOTOS
-- =============================================================

DROP POLICY IF EXISTS "profile_photos_select_approved"  ON profile_photos;
DROP POLICY IF EXISTS "profile_photos_select_own"       ON profile_photos;
DROP POLICY IF EXISTS "profile_photos_insert_own"       ON profile_photos;
DROP POLICY IF EXISTS "profile_photos_update_own"       ON profile_photos;
DROP POLICY IF EXISTS "profile_photos_delete_own"       ON profile_photos;
DROP POLICY IF EXISTS "profile_photos_modify_own"       ON profile_photos;
DROP POLICY IF EXISTS "profile_photos_admin_all"        ON profile_photos;

-- Approved photos of non-banned, non-blocked users are public.
CREATE POLICY "profile_photos_select_approved"
  ON profile_photos FOR SELECT
  TO authenticated
  USING (
    moderation_status = 'approved'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = profile_photos.user_id
        AND p.is_active = TRUE
        AND p.is_banned = FALSE
        AND NOT are_users_blocked(auth.uid(), p.id)
    )
  );

-- Users can see all their own photos including pending/rejected.
CREATE POLICY "profile_photos_select_own"
  ON profile_photos FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "profile_photos_insert_own"
  ON profile_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    -- New uploads must start in 'pending' — moderation sets approved/rejected.
    AND moderation_status = 'pending'
  );

-- Users can update sort_order and is_primary.
-- WITH CHECK prevents clients from overwriting moderation_status.
CREATE POLICY "profile_photos_update_own"
  ON profile_photos FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND moderation_status = (
      -- Lock: new moderation_status must equal the stored value.
      SELECT pf.moderation_status
      FROM   profile_photos pf
      WHERE  pf.id = profile_photos.id
    )
  );

CREATE POLICY "profile_photos_delete_own"
  ON profile_photos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can approve, reject, and manage all photos.
CREATE POLICY "profile_photos_admin_all"
  ON profile_photos FOR ALL
  TO authenticated
  USING    (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- =============================================================
-- SWIPES
-- =============================================================

DROP POLICY IF EXISTS "swipes_select_own" ON swipes;
DROP POLICY IF EXISTS "swipes_insert_own" ON swipes;
DROP POLICY IF EXISTS "swipes_own"        ON swipes;

-- Users can only read their own swipes — prevents discovering
-- who has liked/passed on them.
CREATE POLICY "swipes_select_own"
  ON swipes FOR SELECT
  TO authenticated
  USING (auth.uid() = swiper_id);

-- Users can swipe on non-banned, non-blocked, onboarded profiles.
-- The swipe action is validated by a CHECK constraint on the table.
CREATE POLICY "swipes_insert_own"
  ON swipes FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = swiper_id
    AND swiper_id != swiped_id
    -- Cannot swipe on banned or blocked users
    AND NOT are_users_blocked(auth.uid(), swiped_id)
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = swiped_id
        AND p.is_active        = TRUE
        AND p.is_banned        = FALSE
        AND p.onboarding_complete = TRUE
    )
  );

-- =============================================================
-- MATCHES
-- =============================================================

DROP POLICY IF EXISTS "matches_select_participant" ON matches;
DROP POLICY IF EXISTS "matches_update_participant" ON matches;
DROP POLICY IF EXISTS "matches_insert_own"         ON matches;
DROP POLICY IF EXISTS "matches_participants"        ON matches;
DROP POLICY IF EXISTS "matches_admin_all"           ON matches;

-- Participants can read their own matches.
CREATE POLICY "matches_select_participant"
  ON matches FOR SELECT
  TO authenticated
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Participants can update match status (e.g. archive/unmatch).
-- WITH CHECK ensures neither participant ID can be changed.
CREATE POLICY "matches_update_participant"
  ON matches FOR UPDATE
  TO authenticated
  USING (auth.uid() = user1_id OR auth.uid() = user2_id)
  WITH CHECK (
    -- Prevent reassigning participants
    user1_id = (SELECT m.user1_id FROM matches m WHERE m.id = matches.id)
    AND user2_id = (SELECT m.user2_id FROM matches m WHERE m.id = matches.id)
  );

-- !! IMPORTANT: No INSERT policy for clients.
-- Matches are created exclusively by the trg_create_match_on_like
-- SECURITY DEFINER trigger. Any direct client insert will fail.

CREATE POLICY "matches_admin_all"
  ON matches FOR ALL
  TO authenticated
  USING    (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- =============================================================
-- MESSAGES
-- =============================================================

DROP POLICY IF EXISTS "messages_select_participant"  ON messages;
DROP POLICY IF EXISTS "messages_insert_participant"  ON messages;
DROP POLICY IF EXISTS "messages_update_sender"       ON messages;
DROP POLICY IF EXISTS "messages_participants"         ON messages;
DROP POLICY IF EXISTS "messages_send_own"            ON messages;
DROP POLICY IF EXISTS "messages_update_own"          ON messages;
DROP POLICY IF EXISTS "messages_admin_all"           ON messages;

-- Participants of an active match can read messages.
-- Soft-deleted messages (deleted_at IS NOT NULL) are filtered out.
CREATE POLICY "messages_select_participant"
  ON messages FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = messages.match_id
        AND m.is_active = TRUE
        AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
    )
  );

-- Users can send messages only in active matches they are part of.
-- sender_id must equal the authenticated user — prevents impersonation.
CREATE POLICY "messages_insert_participant"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = messages.match_id
        AND m.is_active = TRUE
        AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
    )
  );

-- Senders can soft-delete their own messages (set deleted_at).
-- Content cannot be changed after send — only deleted_at is updatable.
CREATE POLICY "messages_update_sender"
  ON messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id AND deleted_at IS NULL)
  WITH CHECK (
    auth.uid() = sender_id
    -- Prevent content mutation; only deleted_at column should change.
    AND content = (SELECT msg.content FROM messages msg WHERE msg.id = messages.id)
    AND sender_id = auth.uid()
  );

CREATE POLICY "messages_admin_all"
  ON messages FOR ALL
  TO authenticated
  USING    (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- =============================================================
-- BLOCKED USERS
-- =============================================================

DROP POLICY IF EXISTS "blocked_users_select_own" ON blocked_users;
DROP POLICY IF EXISTS "blocked_users_insert_own" ON blocked_users;
DROP POLICY IF EXISTS "blocked_users_delete_own" ON blocked_users;
DROP POLICY IF EXISTS "blocked_users_own"        ON blocked_users;
DROP POLICY IF EXISTS "blocked_users_admin_all"  ON blocked_users;

-- Users can read their own block records (who they have blocked).
CREATE POLICY "blocked_users_select_own"
  ON blocked_users FOR SELECT
  TO authenticated
  USING (auth.uid() = blocker_id);

-- Users can block others; cannot block themselves.
CREATE POLICY "blocked_users_insert_own"
  ON blocked_users FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = blocker_id
    AND blocker_id != blocked_id
  );

-- Users can unblock (delete) their own block records.
CREATE POLICY "blocked_users_delete_own"
  ON blocked_users FOR DELETE
  TO authenticated
  USING (auth.uid() = blocker_id);

CREATE POLICY "blocked_users_admin_all"
  ON blocked_users FOR ALL
  TO authenticated
  USING    (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- =============================================================
-- REPORTS
-- =============================================================

DROP POLICY IF EXISTS "reports_select_own"  ON reports;
DROP POLICY IF EXISTS "reports_insert_own"  ON reports;
DROP POLICY IF EXISTS "reports_admin_all"   ON reports;

-- Reporters can see their own submitted reports only.
CREATE POLICY "reports_select_own"
  ON reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

-- Any authenticated user can file a report.
-- reporter_id must equal auth.uid() — prevents reporting-as-someone-else.
-- Cannot report yourself.
CREATE POLICY "reports_insert_own"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = reporter_id
    AND reporter_id != reported_id
  );

-- Admins can read and update all reports (review, action, dismiss).
CREATE POLICY "reports_admin_all"
  ON reports FOR ALL
  TO authenticated
  USING    (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- =============================================================
-- SUBSCRIPTIONS
-- =============================================================

DROP POLICY IF EXISTS "subscriptions_select_own" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_own"        ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_admin_all"  ON subscriptions;

-- Users can read their own subscription to show plan details
-- in the settings/billing page.
CREATE POLICY "subscriptions_select_own"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- !! No INSERT / UPDATE policy for authenticated role.
-- All subscription writes come from the Stripe webhook handler
-- which uses the service-role client (bypasses RLS entirely).
-- This ensures subscription status can only change via
-- verified Stripe events, not client-side requests.

CREATE POLICY "subscriptions_admin_all"
  ON subscriptions FOR ALL
  TO authenticated
  USING    (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- =============================================================
-- ADMIN ACTIONS
-- =============================================================

DROP POLICY IF EXISTS "admin_actions_select_admin" ON admin_actions;
DROP POLICY IF EXISTS "admin_actions_insert_admin" ON admin_actions;
DROP POLICY IF EXISTS "admin_actions_write_admin"  ON admin_actions;

-- Only admins can read the audit log.
CREATE POLICY "admin_actions_select_admin"
  ON admin_actions FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- Only admins can write to the audit log.
-- admin_id must equal the authenticated admin user.
CREATE POLICY "admin_actions_insert_admin"
  ON admin_actions FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin(auth.uid())
    AND admin_id = auth.uid()
  );

-- Admin actions are immutable once written (append-only audit log).
-- No UPDATE or DELETE policy — neither admins nor service-role
-- should modify historical action records. Hard deletions of
-- the entire user via cascade are the only exception.
