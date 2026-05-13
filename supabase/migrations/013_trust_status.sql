-- =============================================================
-- 013_trust_status.sql
--
-- Adds a simple trust status system to user profiles.
--
-- Four conditions are evaluated:
--   1. Verified account    — profiles.is_verified = TRUE
--   2. No actioned reports — no reports.status = 'actioned' against the user
--   3. Active messaging    — user has sent at least one message
--   4. Completed ride date — user has an accepted ride_date
--
-- Status tiers:
--   trusted_rider  — all four conditions satisfied
--   active_rider   — condition 3 OR 4 (showing genuine engagement)
--   new_rider      — default (no activity yet)
--
-- trust_status is stored as a column on profiles and kept current
-- via triggers on messages, ride_dates, profiles, and reports.
-- =============================================================

-- ── 1. Enum ───────────────────────────────────────────────────

CREATE TYPE trust_status_type AS ENUM ('new_rider', 'active_rider', 'trusted_rider');

-- ── 2. Column on profiles ─────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN trust_status trust_status_type NOT NULL DEFAULT 'new_rider';

-- ── 3. Compute function ───────────────────────────────────────

CREATE OR REPLACE FUNCTION compute_trust_status(p_user_id UUID)
RETURNS trust_status_type
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_verified   BOOLEAN;
  v_no_reports BOOLEAN;
  v_messaging  BOOLEAN;
  v_ride_date  BOOLEAN;
BEGIN
  -- 1. Verified account
  SELECT is_verified INTO v_verified
  FROM profiles WHERE id = p_user_id;

  -- 2. No actioned reports
  SELECT NOT EXISTS (
    SELECT 1 FROM reports
    WHERE reported_id = p_user_id AND status = 'actioned'
  ) INTO v_no_reports;

  -- 3. Active messaging (sent at least one message)
  SELECT EXISTS (
    SELECT 1 FROM messages WHERE sender_id = p_user_id LIMIT 1
  ) INTO v_messaging;

  -- 4. Completed ride date (accepted)
  SELECT EXISTS (
    SELECT 1 FROM ride_dates
    WHERE (user_one = p_user_id OR user_two = p_user_id)
      AND status = 'accepted'
    LIMIT 1
  ) INTO v_ride_date;

  -- Determine tier
  IF v_verified AND v_no_reports AND v_messaging AND v_ride_date THEN
    RETURN 'trusted_rider';
  ELSIF v_messaging OR v_ride_date THEN
    RETURN 'active_rider';
  ELSE
    RETURN 'new_rider';
  END IF;
END;
$$;

-- ── 4. Refresh helper ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION refresh_trust_status(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET trust_status = compute_trust_status(p_user_id)
  WHERE id = p_user_id;
END;
$$;

-- ── 5. Trigger functions ──────────────────────────────────────

-- On message sent: refresh the sender's trust status
CREATE OR REPLACE FUNCTION trg_messages_refresh_trust()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM refresh_trust_status(NEW.sender_id);
  RETURN NULL;
END;
$$;

-- On ride date status change: refresh both participants when accepted
CREATE OR REPLACE FUNCTION trg_ride_dates_refresh_trust()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted' THEN
    PERFORM refresh_trust_status(NEW.user_one);
    PERFORM refresh_trust_status(NEW.user_two);
  END IF;
  RETURN NULL;
END;
$$;

-- On is_verified change: refresh the profile owner's trust status
CREATE OR REPLACE FUNCTION trg_profile_verified_refresh_trust()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
    PERFORM refresh_trust_status(NEW.id);
  END IF;
  RETURN NULL;
END;
$$;

-- On report status change: refresh the reported user's trust status
CREATE OR REPLACE FUNCTION trg_reports_refresh_trust()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM refresh_trust_status(NEW.reported_id);
  END IF;
  RETURN NULL;
END;
$$;

-- ── 6. Triggers ───────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_messages_trust ON messages;
CREATE TRIGGER trg_messages_trust
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION trg_messages_refresh_trust();

DROP TRIGGER IF EXISTS trg_ride_dates_trust ON ride_dates;
CREATE TRIGGER trg_ride_dates_trust
  AFTER UPDATE OF status ON ride_dates
  FOR EACH ROW
  EXECUTE FUNCTION trg_ride_dates_refresh_trust();

DROP TRIGGER IF EXISTS trg_profile_verified_trust ON profiles;
CREATE TRIGGER trg_profile_verified_trust
  AFTER UPDATE OF is_verified ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION trg_profile_verified_refresh_trust();

DROP TRIGGER IF EXISTS trg_reports_trust ON reports;
CREATE TRIGGER trg_reports_trust
  AFTER UPDATE OF status ON reports
  FOR EACH ROW
  EXECUTE FUNCTION trg_reports_refresh_trust();

-- ── 7. Updated get_discovery_candidates ──────────────────────
--
-- Adds trust_status to the returned row (no filter — it is display-only).

DROP FUNCTION IF EXISTS get_discovery_candidates(integer);
DROP FUNCTION IF EXISTS get_discovery_candidates(integer,bike_type_type[],riding_style_type[],dating_intent_type[],boolean);
DROP FUNCTION IF EXISTS get_discovery_candidates(integer,bike_type_type[],riding_style_type[],dating_intent_type[],boolean,club_type_type[]);

CREATE OR REPLACE FUNCTION get_discovery_candidates(
  p_limit          INTEGER              DEFAULT 20,
  p_bike_types     bike_type_type[]     DEFAULT NULL,
  p_riding_styles  riding_style_type[]  DEFAULT NULL,
  p_dating_intents dating_intent_type[] DEFAULT NULL,
  p_verified_only  BOOLEAN              DEFAULT FALSE,
  p_club_types     club_type_type[]     DEFAULT NULL
)
RETURNS TABLE (
  id                    UUID,
  display_name          TEXT,
  age                   SMALLINT,
  gender                gender_type,
  bio                   TEXT,
  city                  TEXT,
  country               TEXT,
  riding_style          riding_style_type,
  years_riding          SMALLINT,
  club_status           TEXT,
  club_type             club_type_type,
  attends_rallies       BOOLEAN,
  music_taste           TEXT[],
  smoker                BOOLEAN,
  drinker               BOOLEAN,
  has_passenger_helmet  BOOLEAN,
  is_verified           BOOLEAN,
  is_premium            BOOLEAN,
  dating_intent         dating_intent_type,
  distance_miles        NUMERIC,
  primary_photo_url     TEXT,
  primary_bike_brand    TEXT,
  primary_bike_model    TEXT,
  primary_bike_type     bike_type_type,
  trust_status          trust_status_type
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me               profiles%ROWTYPE;
  v_distance_metres  NUMERIC;
BEGIN
  SELECT * INTO v_me FROM profiles WHERE id = auth.uid();
  IF NOT FOUND THEN RETURN; END IF;

  v_distance_metres := COALESCE(v_me.max_distance_miles, 50) * 1609.344;

  RETURN QUERY
  SELECT
    p.id,
    p.display_name,
    p.age,
    p.gender,
    p.bio,
    CASE WHEN p.hide_exact_location THEN NULL ELSE p.city END AS city,
    p.country,
    p.riding_style,
    p.years_riding,
    p.club_status,
    p.club_type,
    p.attends_rallies,
    p.music_taste,
    p.smoker,
    p.drinker,
    p.has_passenger_helmet,
    p.is_verified,
    p.is_premium,
    p.dating_intent,
    CASE
      WHEN v_me.location IS NOT NULL AND p.location IS NOT NULL
        THEN ROUND(ST_Distance(p.location, v_me.location) / 1609.344, 1)
      ELSE NULL
    END                                AS distance_miles,
    pp.public_url                      AS primary_photo_url,
    b.bike_brand                       AS primary_bike_brand,
    b.bike_model                       AS primary_bike_model,
    b.bike_type                        AS primary_bike_type,
    p.trust_status
  FROM profiles p
  INNER JOIN profile_photos pp
    ON  pp.user_id          = p.id
    AND pp.is_primary        = TRUE
    AND pp.moderation_status = 'approved'
  LEFT JOIN bikes b
    ON  b.user_id      = p.id
    AND b.primary_bike = TRUE
  LEFT JOIN profile_boosts pb
    ON  pb.user_id    = p.id
    AND pb.expires_at > NOW()
  WHERE p.id                 != auth.uid()
    AND p.is_active           = TRUE
    AND p.is_banned           = FALSE
    AND p.onboarding_complete = TRUE
    AND (
         v_me.interested_in = 'everyone'
      OR (v_me.interested_in = 'men'        AND p.gender = 'man')
      OR (v_me.interested_in = 'women'      AND p.gender = 'woman')
      OR (v_me.interested_in = 'non_binary' AND p.gender = 'non_binary')
    )
    AND NOT EXISTS (
      SELECT 1 FROM swipes s
      WHERE s.swiper_id = auth.uid() AND s.swiped_id = p.id
    )
    AND NOT are_users_blocked(auth.uid(), p.id)
    AND (
         v_me.location IS NULL
      OR p.location    IS NULL
      OR ST_DWithin(p.location, v_me.location, v_distance_metres)
    )
    -- Advanced filters (gating enforced at API level)
    AND (p_bike_types     IS NULL OR b.bike_type     = ANY(p_bike_types))
    AND (p_riding_styles  IS NULL OR p.riding_style  = ANY(p_riding_styles))
    AND (p_dating_intents IS NULL OR p.dating_intent = ANY(p_dating_intents))
    AND (NOT p_verified_only   OR p.is_verified = TRUE)
    AND (p_club_types     IS NULL OR p.club_type     = ANY(p_club_types))
  ORDER BY
    (pb.user_id IS NOT NULL) DESC,
    p.is_premium DESC,
    p.last_active DESC
  LIMIT p_limit;
END;
$$;

-- ── 8. Back-fill existing profiles ────────────────────────────

UPDATE profiles
SET trust_status = compute_trust_status(id);
