-- =============================================================
-- 012_club_association.sql
--
-- Adds biker club association to user profiles:
--   club_type  — MC | RC | independent | none  (public, shown on cards)
--   club_name  — optional free text            (private, own profile only)
--
-- Also adds club_types to discovery_filters so users can filter
-- the swipe deck by club affiliation.
-- =============================================================

-- ── 1. Enum ───────────────────────────────────────────────────

CREATE TYPE club_type_type AS ENUM ('MC', 'RC', 'independent', 'none');

-- ── 2. Columns on profiles ────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN club_type  club_type_type NOT NULL DEFAULT 'none',
  ADD COLUMN club_name  TEXT
    CHECK (club_name IS NULL OR char_length(club_name) BETWEEN 1 AND 100);

-- ── 3. Column on discovery_filters ───────────────────────────

ALTER TABLE discovery_filters
  ADD COLUMN club_types club_type_type[] DEFAULT NULL;

-- ── 4. Updated get_discovery_candidates ──────────────────────
--
-- Adds:
--   - p_club_types  club_type_type[]  — filter by club type
--   - club_type     club_type_type    — returned for each candidate
--   (club_name is intentionally NOT returned — it is private)

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
  primary_bike_type     bike_type_type
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
    b.bike_type                        AS primary_bike_type
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
