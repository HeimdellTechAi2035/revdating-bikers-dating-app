-- =============================================================
-- 010_badges.sql
--
-- Badge system for RevMatch user achievements.
--
-- badge_name values  (snake_case, stable identifiers):
--   first_match        – earned their first mutual match
--   five_matches       – earned 5 mutual matches
--   first_message      – sent their first message
--   first_ride_date    – planned their first ride date (safety check-in created)
--   verified_rider     – profile became verified
--   trusted_rider      – verified + 5+ matches
--
-- badge_type values:
--   social | communication | activity | trust
-- =============================================================

-- ── 1. Enums ──────────────────────────────────────────────────

CREATE TYPE badge_name_type AS ENUM (
  'first_match',
  'five_matches',
  'first_message',
  'first_ride_date',
  'verified_rider',
  'trusted_rider'
);

CREATE TYPE badge_type_type AS ENUM (
  'social',
  'communication',
  'activity',
  'trust'
);

-- ── 2. Table ──────────────────────────────────────────────────

CREATE TABLE user_badges (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_name  badge_name_type NOT NULL,
  badge_type  badge_type_type NOT NULL,
  earned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- A user can earn each badge only once
  CONSTRAINT user_badges_unique UNIQUE (user_id, badge_name)
);

CREATE INDEX idx_user_badges_user_id ON user_badges (user_id);

-- ── 3. RLS ────────────────────────────────────────────────────

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read badges (needed for profile views)
CREATE POLICY "badges_select_authenticated"
  ON user_badges FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only the system (SECURITY DEFINER functions) may insert/delete
CREATE POLICY "badges_admin_all"
  ON user_badges FOR ALL
  USING (is_admin(auth.uid()));

-- ── 4. Core award helper ──────────────────────────────────────
-- Inserts a badge row; silently ignores if the user already has it.

CREATE OR REPLACE FUNCTION award_badge(
  p_user_id   UUID,
  p_badge     badge_name_type,
  p_type      badge_type_type
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_badges (user_id, badge_name, badge_type)
  VALUES (p_user_id, p_badge, p_type)
  ON CONFLICT (user_id, badge_name) DO NOTHING;
END;
$$;

-- ── 5. Trigger: matches → social badges ───────────────────────

CREATE OR REPLACE FUNCTION on_match_check_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Award for each participant
  FOR v_uid IN SELECT NEW.user1_id UNION ALL SELECT NEW.user2_id LOOP

    -- First Match
    PERFORM award_badge(v_uid, 'first_match', 'social');

    -- 5 Matches
    SELECT COUNT(*) INTO v_count
    FROM matches
    WHERE (user1_id = v_uid OR user2_id = v_uid)
      AND is_active = TRUE;

    IF v_count >= 5 THEN
      PERFORM award_badge(v_uid, 'five_matches', 'social');
    END IF;

    -- Trusted Rider: verified + 5+ matches
    IF v_count >= 5 AND EXISTS (
      SELECT 1 FROM profiles WHERE id = v_uid AND is_verified = TRUE
    ) THEN
      PERFORM award_badge(v_uid, 'trusted_rider', 'trust');
    END IF;

  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_match_inserted_badges
  AFTER INSERT ON matches
  FOR EACH ROW EXECUTE FUNCTION on_match_check_badges();

-- ── 6. Trigger: messages → communication badge ────────────────

CREATE OR REPLACE FUNCTION on_message_check_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM award_badge(NEW.sender_id, 'first_message', 'communication');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_message_inserted_badges
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION on_message_check_badges();

-- ── 7. Trigger: safety_checkins → activity badge ──────────────

CREATE OR REPLACE FUNCTION on_checkin_check_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM award_badge(NEW.user_id, 'first_ride_date', 'activity');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_checkin_inserted_badges
  AFTER INSERT ON safety_checkins
  FOR EACH ROW EXECUTE FUNCTION on_checkin_check_badges();

-- ── 8. Trigger: profiles.is_verified → trust badges ──────────

CREATE OR REPLACE FUNCTION on_verification_check_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match_count INTEGER;
BEGIN
  -- Only react when is_verified flips to TRUE
  IF NEW.is_verified = TRUE AND (OLD.is_verified IS DISTINCT FROM TRUE) THEN
    PERFORM award_badge(NEW.id, 'verified_rider', 'trust');

    -- Trusted Rider: verified + 5+ active matches
    SELECT COUNT(*) INTO v_match_count
    FROM matches
    WHERE (user1_id = NEW.id OR user2_id = NEW.id)
      AND is_active = TRUE;

    IF v_match_count >= 5 THEN
      PERFORM award_badge(NEW.id, 'trusted_rider', 'trust');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_verified_badges
  AFTER UPDATE OF is_verified ON profiles
  FOR EACH ROW EXECUTE FUNCTION on_verification_check_badges();

-- ── 9. Back-fill existing users ───────────────────────────────
-- Awards badges to any existing data at migration time.

DO $$
DECLARE
  v_uid        UUID;
  v_count      INTEGER;
  v_verified   BOOLEAN;
BEGIN

  -- First Match & 5 Matches & Trusted Rider
  FOR v_uid IN
    SELECT DISTINCT unnest(ARRAY[user1_id, user2_id]) FROM matches WHERE is_active = TRUE
  LOOP
    PERFORM award_badge(v_uid, 'first_match', 'social');

    SELECT COUNT(*) INTO v_count
    FROM matches WHERE (user1_id = v_uid OR user2_id = v_uid) AND is_active = TRUE;

    IF v_count >= 5 THEN
      PERFORM award_badge(v_uid, 'five_matches', 'social');
    END IF;

    SELECT is_verified INTO v_verified FROM profiles WHERE id = v_uid;
    IF v_count >= 5 AND v_verified = TRUE THEN
      PERFORM award_badge(v_uid, 'trusted_rider', 'trust');
    END IF;
  END LOOP;

  -- First Message Sent
  FOR v_uid IN SELECT DISTINCT sender_id FROM messages LOOP
    PERFORM award_badge(v_uid, 'first_message', 'communication');
  END LOOP;

  -- First Ride Date Planned
  FOR v_uid IN SELECT DISTINCT user_id FROM safety_checkins LOOP
    PERFORM award_badge(v_uid, 'first_ride_date', 'activity');
  END LOOP;

  -- Verified Rider
  FOR v_uid IN SELECT id FROM profiles WHERE is_verified = TRUE LOOP
    PERFORM award_badge(v_uid, 'verified_rider', 'trust');
  END LOOP;

END;
$$;
