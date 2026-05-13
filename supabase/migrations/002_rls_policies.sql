-- =============================================================
-- RevMatch — Migration 002: Row Level Security Policies
-- =============================================================

-- Enable RLS on all user-facing tables
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_photos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bikes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE swipes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches            ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports            ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_checkins    ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens        ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_actions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE superlike_credits  ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_swipe_counts ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- SECURITY DEFINER HELPERS
-- These run as the postgres superuser so they can bypass RLS
-- when checking cross-table conditions.
-- =============================================================

CREATE OR REPLACE FUNCTION is_admin(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM admin_users WHERE id = p_user_id);
$$;

CREATE OR REPLACE FUNCTION is_super_admin(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users WHERE id = p_user_id AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION are_users_blocked(p_user_a UUID, p_user_b UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM blocked_users
    WHERE (blocker_id = p_user_a AND blocked_id = p_user_b)
       OR (blocker_id = p_user_b AND blocked_id = p_user_a)
  );
$$;

-- =============================================================
-- PROFILES POLICIES
-- =============================================================

-- Authenticated users can see non-banned, active, complete profiles
-- that haven't blocked them (and they haven't blocked).
CREATE POLICY "profiles_select_public"
  ON profiles FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND is_active = TRUE
    AND is_banned = FALSE
    AND onboarding_complete = TRUE
    AND NOT are_users_blocked(auth.uid(), id)
  );

-- A user can always see their own profile regardless of status.
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Auth trigger handles row creation; allow direct insert as fallback.
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile but CANNOT self-promote
-- is_banned, is_premium, or is_verified — only server-side can.
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND is_banned    = (SELECT is_banned    FROM profiles WHERE id = auth.uid())
    AND is_premium   = (SELECT is_premium   FROM profiles WHERE id = auth.uid())
    AND is_verified  = (SELECT is_verified  FROM profiles WHERE id = auth.uid())
  );

-- Admins bypass all profile restrictions.
CREATE POLICY "profiles_admin_all"
  ON profiles FOR ALL
  USING (is_admin(auth.uid()));

-- =============================================================
-- PROFILE PHOTOS POLICIES
-- =============================================================

-- Approved photos of non-banned, non-blocked users are public.
CREATE POLICY "profile_photos_select_approved"
  ON profile_photos FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND moderation_status = 'approved'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = profile_photos.user_id
        AND p.is_active = TRUE
        AND p.is_banned = FALSE
        AND NOT are_users_blocked(auth.uid(), p.id)
    )
  );

-- Users can see all their own photos (including pending/rejected).
CREATE POLICY "profile_photos_select_own"
  ON profile_photos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "profile_photos_insert_own"
  ON profile_photos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can reorder and set primary; cannot change moderation_status.
CREATE POLICY "profile_photos_update_own"
  ON profile_photos FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND moderation_status = (
      SELECT moderation_status FROM profile_photos WHERE id = profile_photos.id
    )
  );

CREATE POLICY "profile_photos_delete_own"
  ON profile_photos FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "profile_photos_admin_all"
  ON profile_photos FOR ALL
  USING (is_admin(auth.uid()));

-- =============================================================
-- BIKES POLICIES
-- =============================================================

-- Bikes of non-banned, non-blocked users are visible.
CREATE POLICY "bikes_select_public"
  ON bikes FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = bikes.user_id
        AND p.is_active = TRUE
        AND p.is_banned = FALSE
        AND NOT are_users_blocked(auth.uid(), p.id)
    )
  );

CREATE POLICY "bikes_select_own"
  ON bikes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "bikes_insert_own"
  ON bikes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bikes_update_own"
  ON bikes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bikes_delete_own"
  ON bikes FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "bikes_admin_all"
  ON bikes FOR ALL
  USING (is_admin(auth.uid()));

-- =============================================================
-- SWIPES POLICIES
-- =============================================================

CREATE POLICY "swipes_select_own"
  ON swipes FOR SELECT
  USING (auth.uid() = swiper_id);

CREATE POLICY "swipes_insert_own"
  ON swipes FOR INSERT
  WITH CHECK (
    auth.uid() = swiper_id
    AND NOT are_users_blocked(auth.uid(), swiped_id)
  );

-- =============================================================
-- MATCHES POLICIES
-- =============================================================

CREATE POLICY "matches_select_participant"
  ON matches FOR SELECT
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "matches_update_participant"
  ON matches FOR UPDATE
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "matches_admin_all"
  ON matches FOR ALL
  USING (is_admin(auth.uid()));

-- =============================================================
-- MESSAGES POLICIES
-- =============================================================

-- Participants of an active match can read non-deleted messages.
CREATE POLICY "messages_select_participant"
  ON messages FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = messages.match_id
        AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
        AND m.is_active = TRUE
    )
  );

-- Sender must be a participant of the match.
CREATE POLICY "messages_insert_participant"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = messages.match_id
        AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
        AND m.is_active = TRUE
    )
  );

-- Sender can soft-delete their own messages.
CREATE POLICY "messages_update_sender"
  ON messages FOR UPDATE
  USING (auth.uid() = sender_id);

CREATE POLICY "messages_admin_all"
  ON messages FOR ALL
  USING (is_admin(auth.uid()));

-- =============================================================
-- BLOCKED USERS POLICIES
-- =============================================================

CREATE POLICY "blocked_users_select_own"
  ON blocked_users FOR SELECT
  USING (auth.uid() = blocker_id);

CREATE POLICY "blocked_users_insert_own"
  ON blocked_users FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "blocked_users_delete_own"
  ON blocked_users FOR DELETE
  USING (auth.uid() = blocker_id);

CREATE POLICY "blocked_users_admin_all"
  ON blocked_users FOR ALL
  USING (is_admin(auth.uid()));

-- =============================================================
-- REPORTS POLICIES
-- =============================================================

-- Reporters can see their own submitted reports.
CREATE POLICY "reports_select_own"
  ON reports FOR SELECT
  USING (auth.uid() = reporter_id);

CREATE POLICY "reports_insert_own"
  ON reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- Admins manage all reports.
CREATE POLICY "reports_admin_all"
  ON reports FOR ALL
  USING (is_admin(auth.uid()));

-- =============================================================
-- VERIFICATIONS POLICIES
-- =============================================================

-- Users can see their own verification records.
CREATE POLICY "verifications_select_own"
  ON verifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "verifications_insert_own"
  ON verifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins manage all verifications.
CREATE POLICY "verifications_admin_all"
  ON verifications FOR ALL
  USING (is_admin(auth.uid()));

-- =============================================================
-- SUBSCRIPTIONS POLICIES
-- =============================================================

CREATE POLICY "subscriptions_select_own"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Stripe webhook (service role) handles inserts/updates.
-- No user-direct insert policy — only service role bypasses RLS.

CREATE POLICY "subscriptions_admin_all"
  ON subscriptions FOR ALL
  USING (is_admin(auth.uid()));

-- =============================================================
-- SAFETY CHECK-INS POLICIES
-- =============================================================

CREATE POLICY "safety_checkins_select_own"
  ON safety_checkins FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "safety_checkins_insert_own"
  ON safety_checkins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "safety_checkins_update_own"
  ON safety_checkins FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "safety_checkins_delete_own"
  ON safety_checkins FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "safety_checkins_admin_all"
  ON safety_checkins FOR ALL
  USING (is_admin(auth.uid()));

-- =============================================================
-- PUSH TOKENS POLICIES
-- =============================================================

CREATE POLICY "push_tokens_select_own"
  ON push_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "push_tokens_insert_own"
  ON push_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_tokens_delete_own"
  ON push_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================
-- ADMIN USERS POLICIES
-- =============================================================

-- Only admins can see the admin roster.
CREATE POLICY "admin_users_select_admin"
  ON admin_users FOR SELECT
  USING (is_admin(auth.uid()));

-- Only super-admins can promote/demote admins.
CREATE POLICY "admin_users_write_super_admin"
  ON admin_users FOR ALL
  USING (is_super_admin(auth.uid()));

-- =============================================================
-- ADMIN ACTIONS POLICIES
-- =============================================================

CREATE POLICY "admin_actions_select_admin"
  ON admin_actions FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "admin_actions_insert_admin"
  ON admin_actions FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

-- =============================================================
-- SUPERLIKE CREDITS POLICIES
-- =============================================================

CREATE POLICY "superlike_credits_select_own"
  ON superlike_credits FOR SELECT
  USING (auth.uid() = user_id);

-- Only service-role (no RLS) or admins write credits.
CREATE POLICY "superlike_credits_admin_all"
  ON superlike_credits FOR ALL
  USING (is_admin(auth.uid()));

-- =============================================================
-- DAILY SWIPE COUNTS POLICIES
-- =============================================================

CREATE POLICY "daily_swipe_counts_select_own"
  ON daily_swipe_counts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "daily_swipe_counts_admin_all"
  ON daily_swipe_counts FOR ALL
  USING (is_admin(auth.uid()));
