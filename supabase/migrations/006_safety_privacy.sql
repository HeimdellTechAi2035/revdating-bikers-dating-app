-- =============================================================
-- RevMatch — Migration 006: Safety & Privacy Features
--
-- Changes:
--   1. Add hide_exact_location to profiles
--   2. Add emergency_contact_name / _phone to profiles
--   3. 18+ minimum-age DB constraint
--   4. Update get_discovery_candidates to respect hide_exact_location
--   5. RLS policies for safety_checkins
-- =============================================================

-- ----------------------------------------------------------
-- 1. Profiles: new privacy / safety columns
-- ----------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS hide_exact_location    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT    CHECK (char_length(emergency_contact_name)  <= 100),
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT   CHECK (char_length(emergency_contact_phone) <= 30);

-- ----------------------------------------------------------
-- 2. 18+ minimum-age constraint at DB level
--    (registration UI already validates this; DB is the safety net)
-- ----------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'profiles' AND constraint_name = 'profiles_minimum_age'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_minimum_age
      CHECK (date_of_birth <= (CURRENT_DATE - INTERVAL '18 years'));
  END IF;
END;
$$;

-- ----------------------------------------------------------
-- 3. Update get_discovery_candidates
--    When a candidate has hide_exact_location = TRUE,
--    return NULL for city so their exact hometown is hidden.
--    Callers still receive distance_miles.
-- ----------------------------------------------------------
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

  v_distance_metres := COALESCE(v_me.max_distance_miles, 50) * 1609.344;

  RETURN QUERY
  SELECT
    p.id,
    p.display_name,
    p.age,
    p.gender,
    p.bio,
    -- Mask exact city when the candidate has opted for location privacy
    CASE WHEN p.hide_exact_location THEN NULL ELSE p.city END AS city,
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
  WHERE p.id                 != auth.uid()
    AND p.is_active           = TRUE
    AND p.is_banned           = FALSE
    AND p.onboarding_complete = TRUE
    AND (
         v_me.interested_in = 'everyone'
      OR (v_me.interested_in = 'men'       AND p.gender = 'man')
      OR (v_me.interested_in = 'women'     AND p.gender = 'woman')
      OR (v_me.interested_in = 'non_binary' AND p.gender = 'non_binary')
    )
    AND NOT EXISTS (
      SELECT 1 FROM swipes s
      WHERE s.swiper_id = auth.uid()
        AND s.swiped_id = p.id
    )
    AND NOT are_users_blocked(auth.uid(), p.id)
    AND (
         v_me.location IS NULL
      OR p.location    IS NULL
      OR ST_DWithin(p.location, v_me.location, v_distance_metres)
    )
  ORDER BY p.is_premium DESC, p.last_active DESC
  LIMIT p_limit;
END;
$$;

-- ----------------------------------------------------------
-- 4. RLS: safety_checkins
--    Users own their check-ins. No one else can read them.
-- ----------------------------------------------------------
ALTER TABLE safety_checkins ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'safety_checkins' AND policyname = 'checkins_select_own'
  ) THEN
    CREATE POLICY checkins_select_own
      ON safety_checkins FOR SELECT
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'safety_checkins' AND policyname = 'checkins_insert_own'
  ) THEN
    CREATE POLICY checkins_insert_own
      ON safety_checkins FOR INSERT
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'safety_checkins' AND policyname = 'checkins_update_own'
  ) THEN
    CREATE POLICY checkins_update_own
      ON safety_checkins FOR UPDATE
      USING (user_id = auth.uid());
  END IF;
END;
$$;

-- ----------------------------------------------------------
-- 5. Indexes for safety_checkins
-- ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_safety_checkins_user_active
  ON safety_checkins (user_id, status, created_at DESC);
