-- =============================================================
-- RevMatch — Migration 007: Premium Features
--
-- Changes:
--   1. profile_boosts table (boost profile visibility)
--   2. discovery_filters table (persisted premium filters per user)
--   3. Updated get_discovery_candidates with filter params + boost priority
--   4. Webhook helper: update_premium_superlike_credits function
--   5. RLS for new tables
-- =============================================================

-- ----------------------------------------------------------
-- 1. Profile Boosts
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS profile_boosts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One active boost per user (upsert on conflict)
  CONSTRAINT profile_boosts_unique_user UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_boosts_expires_at
  ON profile_boosts (expires_at);

ALTER TABLE profile_boosts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profile_boosts' AND policyname = 'boosts_select_own'
  ) THEN
    CREATE POLICY boosts_select_own ON profile_boosts FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profile_boosts' AND policyname = 'boosts_insert_own'
  ) THEN
    CREATE POLICY boosts_insert_own ON profile_boosts FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profile_boosts' AND policyname = 'boosts_update_own'
  ) THEN
    CREATE POLICY boosts_update_own ON profile_boosts FOR UPDATE USING (user_id = auth.uid());
  END IF;
END;
$$;

-- ----------------------------------------------------------
-- 2. Discovery Filters (persisted per user — premium only at API level)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS discovery_filters (
  user_id        UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  bike_types     bike_type_type[]   DEFAULT NULL,
  riding_styles  riding_style_type[] DEFAULT NULL,
  dating_intents dating_intent_type[] DEFAULT NULL,
  verified_only  BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE discovery_filters ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'discovery_filters' AND policyname = 'filters_select_own'
  ) THEN
    CREATE POLICY filters_select_own ON discovery_filters FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'discovery_filters' AND policyname = 'filters_upsert_own'
  ) THEN
    CREATE POLICY filters_upsert_own ON discovery_filters FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'discovery_filters' AND policyname = 'filters_update_own'
  ) THEN
    CREATE POLICY filters_update_own ON discovery_filters FOR UPDATE USING (user_id = auth.uid());
  END IF;
END;
$$;

-- ----------------------------------------------------------
-- 3. Updated get_discovery_candidates
--    New params:
--      p_bike_types     bike_type_type[]    — filter by candidate's primary bike type
--      p_riding_styles  riding_style_type[] — filter by candidate's riding style
--      p_dating_intents dating_intent_type[] — filter by candidate's dating intent
--      p_verified_only  BOOLEAN             — only show verified profiles
--    Boost priority: boosted profiles bubble up ahead of un-boosted
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION get_discovery_candidates(
  p_limit          INTEGER              DEFAULT 20,
  p_bike_types     bike_type_type[]     DEFAULT NULL,
  p_riding_styles  riding_style_type[]  DEFAULT NULL,
  p_dating_intents dating_intent_type[] DEFAULT NULL,
  p_verified_only  BOOLEAN              DEFAULT FALSE
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
  -- Boost priority: LEFT JOIN to know if this profile has an active boost
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
    -- Advanced filters (only applied when non-null — gating is at API level)
    AND (p_bike_types     IS NULL OR b.bike_type    = ANY(p_bike_types))
    AND (p_riding_styles  IS NULL OR p.riding_style = ANY(p_riding_styles))
    AND (p_dating_intents IS NULL OR p.dating_intent = ANY(p_dating_intents))
    AND (NOT p_verified_only   OR p.is_verified = TRUE)
  -- Boosted profiles first, then premium, then most recently active
  ORDER BY
    (pb.user_id IS NOT NULL) DESC,
    p.is_premium DESC,
    p.last_active DESC
  LIMIT p_limit;
END;
$$;

-- ----------------------------------------------------------
-- 4. Helper: set premium superlike credits when subscription activates
--    Called by the webhook handler via admin client
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION set_premium_superlike_credits(p_user_id UUID, p_credits INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE superlike_credits
  SET credits = GREATEST(credits, p_credits),
      last_reset_at = NOW()
  WHERE user_id = p_user_id;
END;
$$;
