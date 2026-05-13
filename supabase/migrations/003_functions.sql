-- =============================================================
-- RevMatch — Migration 003: Functions, Triggers & Stored Procedures
-- =============================================================

-- =============================================================
-- UTILITY: auto-update updated_at on any table that has it
-- =============================================================

CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER profile_photos_updated_at
  BEFORE UPDATE ON profile_photos
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER bikes_updated_at
  BEFORE UPDATE ON bikes
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER verifications_updated_at
  BEFORE UPDATE ON verifications
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- =============================================================
-- UTILITY: compute age from date_of_birth
-- Called on INSERT and whenever date_of_birth changes.
-- =============================================================

CREATE OR REPLACE FUNCTION compute_age()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.age := DATE_PART('year', AGE(NOW(), NEW.date_of_birth))::SMALLINT;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_compute_age
  BEFORE INSERT OR UPDATE OF date_of_birth ON profiles
  FOR EACH ROW EXECUTE FUNCTION compute_age();

-- =============================================================
-- UTILITY: sync latitude/longitude when location point changes
-- =============================================================

CREATE OR REPLACE FUNCTION sync_lat_lng()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.location IS NOT NULL THEN
    NEW.latitude  := ST_Y(NEW.location::GEOMETRY);
    NEW.longitude := ST_X(NEW.location::GEOMETRY);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_sync_lat_lng
  BEFORE INSERT OR UPDATE OF location ON profiles
  FOR EACH ROW EXECUTE FUNCTION sync_lat_lng();

-- =============================================================
-- UTILITY: build location point when lat/lng are set directly
-- =============================================================

CREATE OR REPLACE FUNCTION sync_location_from_lat_lng()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.latitude IS DISTINCT FROM OLD.latitude
          OR NEW.longitude IS DISTINCT FROM OLD.longitude)
  THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::GEOGRAPHY;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_sync_location
  BEFORE INSERT OR UPDATE OF latitude, longitude ON profiles
  FOR EACH ROW EXECUTE FUNCTION sync_location_from_lat_lng();

-- =============================================================
-- AUTH HOOK: create profile row when a new user signs up
-- =============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dob     DATE;
  v_gender  gender_type;
  v_name    TEXT;
BEGIN
  v_name   := COALESCE(NEW.raw_user_meta_data->>'display_name', 'Rider');
  v_gender := COALESCE(
    (NEW.raw_user_meta_data->>'gender')::gender_type,
    'prefer_not_to_say'::gender_type
  );
  v_dob := COALESCE(
    (NEW.raw_user_meta_data->>'date_of_birth')::DATE,
    (NOW() - INTERVAL '25 years')::DATE
  );

  INSERT INTO public.profiles (id, display_name, date_of_birth, gender)
  VALUES (NEW.id, v_name, v_dob, v_gender)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.superlike_credits (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.daily_swipe_counts (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================================
-- MATCH DETECTION: fires after every swipe insert
-- Creates a match when both users have liked each other.
-- =============================================================

CREATE OR REPLACE FUNCTION check_for_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_other_action  swipe_action_type;
  v_user1         UUID;
  v_user2         UUID;
  v_u1_super      BOOLEAN;
  v_u2_super      BOOLEAN;
BEGIN
  IF NEW.swipe_action = 'pass' THEN
    RETURN NEW;
  END IF;

  SELECT swipe_action INTO v_other_action
  FROM public.swipes
  WHERE swiper_id = NEW.swiped_id
    AND swiped_id = NEW.swiper_id
    AND swipe_action IN ('like', 'superlike');

  IF v_other_action IS NULL THEN
    RETURN NEW;
  END IF;

  -- Canonical order: smaller UUID = user1
  v_user1 := LEAST(NEW.swiper_id, NEW.swiped_id);
  v_user2 := GREATEST(NEW.swiper_id, NEW.swiped_id);

  v_u1_super := (v_user1 = NEW.swiper_id AND NEW.swipe_action = 'superlike')
             OR (v_user1 = NEW.swiped_id AND v_other_action   = 'superlike');
  v_u2_super := (v_user2 = NEW.swiper_id AND NEW.swipe_action = 'superlike')
             OR (v_user2 = NEW.swiped_id AND v_other_action   = 'superlike');

  INSERT INTO public.matches (user1_id, user2_id, user1_superliked, user2_superliked)
  VALUES (v_user1, v_user2, v_u1_super, v_u2_super)
  ON CONFLICT (user1_id, user2_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_swipe_check_match
  AFTER INSERT ON swipes
  FOR EACH ROW EXECUTE FUNCTION check_for_match();

-- =============================================================
-- MESSAGES: update match.last_message_at + sender last_active
-- =============================================================

CREATE OR REPLACE FUNCTION handle_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.matches
  SET last_message_at = NEW.created_at
  WHERE id = NEW.match_id;

  UPDATE public.profiles
  SET last_active = NOW()
  WHERE id = NEW.sender_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_message_inserted
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION handle_new_message();

-- =============================================================
-- BLOCKS: deactivate existing match when a block is placed
-- =============================================================

CREATE OR REPLACE FUNCTION handle_block()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.matches
  SET is_active = FALSE
  WHERE (user1_id = NEW.blocker_id AND user2_id = NEW.blocked_id)
     OR (user1_id = NEW.blocked_id AND user2_id = NEW.blocker_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_block_placed
  AFTER INSERT ON blocked_users
  FOR EACH ROW EXECUTE FUNCTION handle_block();

-- =============================================================
-- SUBSCRIPTIONS: sync is_premium to profile on status change
-- =============================================================

CREATE OR REPLACE FUNCTION sync_premium_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET is_premium = (NEW.status = 'active' OR NEW.status = 'trialing')
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_subscription_change
  AFTER INSERT OR UPDATE OF status ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION sync_premium_status();

-- =============================================================
-- VERIFICATIONS: flip is_verified on profile when approved
-- =============================================================

CREATE OR REPLACE FUNCTION sync_verification_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.profiles
    SET is_verified = TRUE
    WHERE id = NEW.user_id;
  END IF;

  IF NEW.status = 'rejected'
     AND NOT EXISTS (
       SELECT 1 FROM public.verifications
       WHERE user_id = NEW.user_id AND status = 'approved' AND id != NEW.id
     )
  THEN
    UPDATE public.profiles
    SET is_verified = FALSE
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_verification_status_change
  AFTER UPDATE OF status ON verifications
  FOR EACH ROW EXECUTE FUNCTION sync_verification_status();

-- =============================================================
-- RPC: record_swipe
-- Handles daily limit enforcement and superlike credit deduction.
-- Returns: 'ok' | 'limit_reached' | 'already_swiped' | 'matched'
-- =============================================================

CREATE OR REPLACE FUNCTION record_swipe(
  p_swiped_id     UUID,
  p_swipe_action  swipe_action_type
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_swiper_id      UUID := auth.uid();
  v_is_premium     BOOLEAN;
  v_swipe_limit    INTEGER;
  v_today_count    INTEGER;
  v_credits        INTEGER;
  v_match_exists   BOOLEAN;
BEGIN
  -- Guard: cannot swipe yourself
  IF v_swiper_id = p_swiped_id THEN
    RETURN 'invalid';
  END IF;

  -- Guard: duplicate swipe
  IF EXISTS (SELECT 1 FROM swipes WHERE swiper_id = v_swiper_id AND swiped_id = p_swiped_id) THEN
    RETURN 'already_swiped';
  END IF;

  -- Check premium
  SELECT is_premium INTO v_is_premium FROM profiles WHERE id = v_swiper_id;
  v_swipe_limit := CASE WHEN v_is_premium THEN 999999 ELSE 20 END;

  -- Reset daily count if it's a new day
  UPDATE daily_swipe_counts
  SET count = 0, reset_date = CURRENT_DATE
  WHERE user_id = v_swiper_id AND reset_date < CURRENT_DATE;

  -- Fetch today's count (upsert ensures row exists)
  INSERT INTO daily_swipe_counts (user_id) VALUES (v_swiper_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT count INTO v_today_count FROM daily_swipe_counts WHERE user_id = v_swiper_id;

  IF v_today_count >= v_swipe_limit THEN
    RETURN 'limit_reached';
  END IF;

  -- Superlike: check + deduct credits
  IF p_swipe_action = 'superlike' THEN
    INSERT INTO superlike_credits (user_id) VALUES (v_swiper_id)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT credits INTO v_credits FROM superlike_credits WHERE user_id = v_swiper_id;

    IF v_credits <= 0 THEN
      RETURN 'no_superlike_credits';
    END IF;

    UPDATE superlike_credits SET credits = credits - 1 WHERE user_id = v_swiper_id;
  END IF;

  -- Record the swipe
  INSERT INTO swipes (swiper_id, swiped_id, swipe_action)
  VALUES (v_swiper_id, p_swiped_id, p_swipe_action);

  -- Increment daily count
  UPDATE daily_swipe_counts SET count = count + 1 WHERE user_id = v_swiper_id;

  -- Check if a match was created by the trigger
  v_match_exists := EXISTS (
    SELECT 1 FROM matches
    WHERE (user1_id = LEAST(v_swiper_id, p_swiped_id)
       AND user2_id = GREATEST(v_swiper_id, p_swiped_id))
  );

  IF v_match_exists THEN
    RETURN 'matched';
  END IF;

  RETURN 'ok';
END;
$$;

-- =============================================================
-- RPC: get_discovery_candidates
-- Returns profile candidates for the swipe deck, filtered by:
-- - distance (max_distance_miles)
-- - gender preference
-- - not already swiped
-- - not blocked
-- - active, onboarded, not banned
-- Ordered: premium first, then by last_active DESC.
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
  v_me                profiles%ROWTYPE;
  v_distance_metres   NUMERIC;
BEGIN
  SELECT * INTO v_me FROM profiles WHERE id = auth.uid();

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_distance_metres := v_me.max_distance_miles * 1609.344;

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
    ROUND(ST_Distance(p.location, v_me.location) / 1609.344, 1) AS distance_miles,
    pp.public_url                  AS primary_photo_url,
    b.bike_brand                   AS primary_bike_brand,
    b.bike_model                   AS primary_bike_model,
    b.bike_type                    AS primary_bike_type
  FROM profiles p
  LEFT JOIN profile_photos pp ON pp.user_id = p.id AND pp.is_primary = TRUE
                               AND pp.moderation_status = 'approved'
  LEFT JOIN bikes b ON b.user_id = p.id AND b.primary_bike = TRUE
  WHERE p.id != auth.uid()
    AND p.is_active = TRUE
    AND p.is_banned = FALSE
    AND p.onboarding_complete = TRUE
    -- Gender filter: respect the caller's interested_in preference
    AND (
      v_me.interested_in = 'everyone'
      OR (v_me.interested_in = 'men'   AND p.gender = 'man')
      OR (v_me.interested_in = 'women' AND p.gender = 'woman')
    )
    -- Not already swiped
    AND NOT EXISTS (
      SELECT 1 FROM swipes s
      WHERE s.swiper_id = auth.uid() AND s.swiped_id = p.id
    )
    -- Not blocked in either direction
    AND NOT are_users_blocked(auth.uid(), p.id)
    -- Within distance (skip if caller has no location)
    AND (
      v_me.location IS NULL
      OR p.location IS NULL
      OR ST_DWithin(p.location, v_me.location, v_distance_metres)
    )
  ORDER BY p.is_premium DESC, p.last_active DESC
  LIMIT p_limit;
END;
$$;

-- =============================================================
-- RPC: mark_messages_read
-- Marks all unread messages in a match as read.
-- =============================================================

CREATE OR REPLACE FUNCTION mark_messages_read(p_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE messages
  SET is_read = TRUE, read_at = NOW()
  WHERE match_id = p_match_id
    AND sender_id != auth.uid()
    AND is_read = FALSE
    AND deleted_at IS NULL;
END;
$$;

-- =============================================================
-- RPC: update_safety_checkin_status
-- Called by a scheduled Edge Function to mark overdue checkins.
-- =============================================================

CREATE OR REPLACE FUNCTION update_overdue_safety_checkins()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE safety_checkins
  SET status = 'overdue'
  WHERE status = 'active'
    AND expected_return_at < NOW() - INTERVAL '1 hour';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- =============================================================
-- GDPR: export_user_data
-- Returns a JSON blob of all data for the calling user.
-- =============================================================

CREATE OR REPLACE FUNCTION export_user_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  RETURN jsonb_build_object(
    'profile',
    (SELECT row_to_json(p) FROM profiles p WHERE id = v_uid),

    'profile_photos',
    (SELECT jsonb_agg(row_to_json(pp))
     FROM profile_photos pp WHERE user_id = v_uid),

    'bikes',
    (SELECT jsonb_agg(row_to_json(b))
     FROM bikes b WHERE user_id = v_uid),

    'swipes',
    (SELECT jsonb_agg(row_to_json(s))
     FROM swipes s WHERE swiper_id = v_uid),

    'matches',
    (SELECT jsonb_agg(row_to_json(m))
     FROM matches m WHERE user1_id = v_uid OR user2_id = v_uid),

    'messages',
    (SELECT jsonb_agg(row_to_json(msg))
     FROM messages msg WHERE sender_id = v_uid),

    'blocked_users',
    (SELECT jsonb_agg(row_to_json(bu))
     FROM blocked_users bu WHERE blocker_id = v_uid),

    'reports_filed',
    (SELECT jsonb_agg(row_to_json(r))
     FROM reports r WHERE reporter_id = v_uid),

    'verifications',
    (SELECT jsonb_agg(row_to_json(v))
     FROM verifications v WHERE user_id = v_uid),

    'safety_checkins',
    (SELECT jsonb_agg(row_to_json(sc))
     FROM safety_checkins sc WHERE user_id = v_uid),

    'subscription',
    (SELECT row_to_json(sub)
     FROM subscriptions sub WHERE user_id = v_uid ORDER BY created_at DESC LIMIT 1),

    'exported_at', NOW()
  );
END;
$$;

-- =============================================================
-- GDPR: delete_user_data
-- Hard-deletes all data for the calling user, then deletes
-- the auth.users record (cascade handles DB rows).
-- Service role must call auth.admin.deleteUser after this RPC.
-- =============================================================

CREATE OR REPLACE FUNCTION delete_user_data()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  -- Soft-delete messages first (preserve match thread integrity briefly)
  UPDATE messages SET deleted_at = NOW() WHERE sender_id = v_uid;

  -- Hard-delete everything else in dependency order
  DELETE FROM safety_checkins   WHERE user_id  = v_uid;
  DELETE FROM push_tokens       WHERE user_id  = v_uid;
  DELETE FROM superlike_credits WHERE user_id  = v_uid;
  DELETE FROM daily_swipe_counts WHERE user_id = v_uid;
  DELETE FROM verifications     WHERE user_id  = v_uid;
  DELETE FROM subscriptions     WHERE user_id  = v_uid;
  DELETE FROM reports           WHERE reporter_id = v_uid OR reported_id = v_uid;
  DELETE FROM blocked_users     WHERE blocker_id  = v_uid OR blocked_id  = v_uid;
  DELETE FROM swipes            WHERE swiper_id   = v_uid OR swiped_id   = v_uid;
  DELETE FROM profile_photos    WHERE user_id  = v_uid;
  DELETE FROM bikes             WHERE user_id  = v_uid;

  -- CASCADE on auth.users → profiles will clean up the profile row
  -- The calling API must then call supabase.auth.admin.deleteUser(uid)
END;
$$;
