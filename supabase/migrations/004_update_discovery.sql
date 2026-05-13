-- =============================================================
-- Migration 004: Update get_discovery_candidates
--
-- Changes:
--   1. LEFT JOIN → INNER JOIN on profile_photos
--      Profiles without an approved primary photo are excluded
--      from discovery entirely.
--   2. Gracefully handle NULL location (return NULL distance instead
--      of crashing ST_Distance).
-- =============================================================

CREATE OR REPLACE FUNCTION get_discovery_candidates(p_limit INTEGER DEFAULT 20)
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

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Use 50 miles as fallback if the user hasn't set a preference
  v_distance_metres := COALESCE(v_me.max_distance_miles, 50) * 1609.344;

  RETURN QUERY
  SELECT
    p.id,
    p.display_name,
    p.age,
    p.gender,
    p.bio,
    p.city,
    p.country,
    p.riding_style,
    p.years_riding,
    p.club_status,
    p.attends_rallies,
    p.music_taste,
    p.smoker,
    p.drinker,
    p.has_passenger_helmet,
    p.is_verified,
    p.is_premium,
    p.dating_intent,
    -- Return NULL distance when either party has no location stored
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
  -- INNER JOIN: only show profiles that have an approved primary photo
  INNER JOIN profile_photos pp
    ON  pp.user_id          = p.id
    AND pp.is_primary        = TRUE
    AND pp.moderation_status = 'approved'
  LEFT JOIN bikes b
    ON  b.user_id      = p.id
    AND b.primary_bike = TRUE
  WHERE p.id                != auth.uid()
    AND p.is_active          = TRUE
    AND p.is_banned          = FALSE
    AND p.onboarding_complete = TRUE
    -- Respect the caller's gender preference
    AND (
         v_me.interested_in = 'everyone'
      OR (v_me.interested_in = 'men'       AND p.gender = 'man')
      OR (v_me.interested_in = 'women'     AND p.gender = 'woman')
      OR (v_me.interested_in = 'non_binary' AND p.gender = 'non_binary')
    )
    -- Exclude users already swiped on
    AND NOT EXISTS (
      SELECT 1 FROM swipes s
      WHERE s.swiper_id = auth.uid()
        AND s.swiped_id = p.id
    )
    -- Exclude blocked users (in either direction)
    AND NOT are_users_blocked(auth.uid(), p.id)
    -- Distance filter — skip if either party has no location set
    AND (
         v_me.location IS NULL
      OR p.location    IS NULL
      OR ST_DWithin(p.location, v_me.location, v_distance_metres)
    )
  ORDER BY p.is_premium DESC, p.last_active DESC
  LIMIT p_limit;
END;
$$;
