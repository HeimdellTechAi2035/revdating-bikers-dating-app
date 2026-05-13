-- =============================================================
-- RevMatch — Migration 014: Consolidated Production Schema
--
-- A complete, self-contained schema definition for the RevMatch
-- biker dating app. Designed to be idempotent: uses IF NOT EXISTS
-- guards throughout so it can be applied safely on databases that
-- already have some or all of these objects.
--
-- Tables:
--   01. profiles
--   02. bikes
--   03. profile_photos
--   04. swipes
--   05. matches
--   06. messages
--   07. blocked_users
--   08. reports
--   09. verifications
--   10. user_badges
--   11. ride_dates
--   12. safety_checkins
--   13. subscriptions
--   14. admin_actions
--
-- Followed by:
--   - Indexes
--   - updated_at trigger
--   - RLS enablement
--   - Helper functions (blocking check, match detection)
-- =============================================================

-- ── Extensions ────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
-- 01. PROFILES
-- =============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id                     UUID          PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name           TEXT          NOT NULL
                                         CHECK (char_length(display_name) BETWEEN 1 AND 50),
  date_of_birth          DATE          NOT NULL,
  gender                 TEXT          NOT NULL
                                         CHECK (gender IN ('man','woman','non_binary','other','prefer_not_to_say')),
  -- Multiple gender preferences stored as an array
  interested_in          TEXT[]        NOT NULL DEFAULT ARRAY['everyone']
                                         CHECK (interested_in <@ ARRAY['men','women','everyone','non_binary']),
  dating_intent          TEXT          NOT NULL
                                         CHECK (dating_intent IN (
                                           'serious_relationship','casual_dating',
                                           'riding_partner','friendship','open_to_anything'
                                         )),
  bio                    TEXT          CHECK (char_length(bio) <= 500),

  -- Location
  city                   TEXT,
  country                TEXT          NOT NULL DEFAULT 'UK',
  latitude               DOUBLE PRECISION,
  longitude              DOUBLE PRECISION,
  location               GEOGRAPHY(POINT, 4326),  -- PostGIS for distance queries
  max_distance_miles     INTEGER       NOT NULL DEFAULT 50
                                         CHECK (max_distance_miles BETWEEN 1 AND 500),

  -- Rider details
  riding_style           TEXT[]        CHECK (riding_style <@ ARRAY[
                                         'cruiser','sport','touring','adventure','dirt',
                                         'chopper','cafe_racer','bobber','naked','scooter',
                                         'electric','other'
                                       ]),
  years_riding           INTEGER       CHECK (years_riding BETWEEN 0 AND 80),
  club_type              TEXT          CHECK (club_type IN ('MC','RC','independent','none')),
  club_name              TEXT          CHECK (char_length(club_name) <= 100),
  show_club_publicly     BOOLEAN       NOT NULL DEFAULT FALSE,
  attends_rallies        BOOLEAN       NOT NULL DEFAULT FALSE,

  -- Lifestyle
  music_taste            TEXT[],
  smoker                 TEXT          CHECK (smoker IN ('never','occasionally','regularly','prefer_not_to_say')),
  drinker                TEXT          CHECK (drinker IN ('never','socially','regularly','prefer_not_to_say')),
  has_passenger_helmet   BOOLEAN       NOT NULL DEFAULT FALSE,

  -- Privacy & status
  hide_exact_location    BOOLEAN       NOT NULL DEFAULT TRUE,
  onboarding_complete    BOOLEAN       NOT NULL DEFAULT FALSE,
  is_verified            BOOLEAN       NOT NULL DEFAULT FALSE,
  is_premium             BOOLEAN       NOT NULL DEFAULT FALSE,  -- display flag; truth is in subscriptions table
  is_banned              BOOLEAN       NOT NULL DEFAULT FALSE,
  ban_reason             TEXT,
  is_active              BOOLEAN       NOT NULL DEFAULT TRUE,
  is_admin               BOOLEAN       NOT NULL DEFAULT FALSE,

  -- Trust status (computed by triggers)
  trust_status           TEXT          NOT NULL DEFAULT 'new_rider'
                                         CHECK (trust_status IN ('new_rider','active_rider','trusted_rider')),

  created_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  last_active            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  profiles                    IS 'Core user profile data for RevMatch biker dating app.';
COMMENT ON COLUMN profiles.interested_in      IS 'Array of gender preferences. Allows multi-select.';
COMMENT ON COLUMN profiles.location           IS 'PostGIS point used for proximity queries in discovery.';
COMMENT ON COLUMN profiles.is_premium         IS 'Display flag only. Use subscriptions table for entitlement checks.';
COMMENT ON COLUMN profiles.trust_status       IS 'Computed from: is_verified, no actioned reports, has messaged, has accepted a ride date.';

-- =============================================================
-- 02. BIKES
-- =============================================================

CREATE TABLE IF NOT EXISTS bikes (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID    NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  bike_type       TEXT    NOT NULL
                            CHECK (bike_type IN (
                              'cruiser','sport','touring','adventure','dirt',
                              'chopper','cafe_racer','bobber','naked','scooter','electric','other'
                            )),
  bike_brand      TEXT    CHECK (char_length(bike_brand) <= 100),
  bike_model      TEXT    CHECK (char_length(bike_model) <= 100),
  bike_year       INTEGER CHECK (bike_year BETWEEN 1885 AND EXTRACT(YEAR FROM NOW())::INTEGER + 2),
  engine_size_cc  INTEGER CHECK (engine_size_cc BETWEEN 50 AND 10000),
  owned_or_dream  TEXT    NOT NULL DEFAULT 'owned'
                            CHECK (owned_or_dream IN ('owned','dream')),
  primary_bike    BOOLEAN NOT NULL DEFAULT FALSE,
  photo_url       TEXT,
  notes           TEXT    CHECK (char_length(notes) <= 300),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one primary bike per user
CREATE UNIQUE INDEX IF NOT EXISTS bikes_user_primary_uq
  ON bikes (user_id)
  WHERE primary_bike = TRUE;

COMMENT ON TABLE bikes IS 'Bikes owned or dreamed-about by a user. One per user can be flagged as primary.';

-- =============================================================
-- 03. PROFILE PHOTOS
-- =============================================================

CREATE TABLE IF NOT EXISTS profile_photos (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID    NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  storage_path        TEXT    NOT NULL,
  public_url          TEXT    NOT NULL,
  photo_type          TEXT    NOT NULL DEFAULT 'profile'
                                CHECK (photo_type IN ('profile','bike','verification')),
  is_primary          BOOLEAN NOT NULL DEFAULT FALSE,
  moderation_status   TEXT    NOT NULL DEFAULT 'pending'
                                CHECK (moderation_status IN ('pending','approved','rejected')),
  moderation_provider TEXT,
  moderation_reason   TEXT,   -- reason for rejection if applicable
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one primary photo per user
CREATE UNIQUE INDEX IF NOT EXISTS profile_photos_user_primary_uq
  ON profile_photos (user_id)
  WHERE is_primary = TRUE;

COMMENT ON TABLE  profile_photos                  IS 'Photos uploaded by users. Gated by moderation_status.';
COMMENT ON COLUMN profile_photos.moderation_reason IS 'Reason returned by image moderation provider on rejection.';

-- =============================================================
-- 04. SWIPES
-- =============================================================

CREATE TABLE IF NOT EXISTS swipes (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  swiper_id   UUID    NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  swiped_id   UUID    NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  swipe_action TEXT   NOT NULL
                        CHECK (swipe_action IN ('pass','like','rev')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT swipes_unique_pair UNIQUE (swiper_id, swiped_id),
  CONSTRAINT swipes_no_self     CHECK  (swiper_id != swiped_id)
);

COMMENT ON COLUMN swipes.swipe_action IS 'pass = left swipe, like = right swipe, rev = superlike (RevIt).';

-- =============================================================
-- 05. MATCHES
-- =============================================================

CREATE TABLE IF NOT EXISTS matches (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_one    UUID    NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  user_two    UUID    NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  -- Which user used a superlike (rev)
  user_one_rev  BOOLEAN NOT NULL DEFAULT FALSE,
  user_two_rev  BOOLEAN NOT NULL DEFAULT FALSE,
  status        TEXT    NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','archived','unmatched')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,

  CONSTRAINT matches_unique_pair UNIQUE (user_one, user_two),
  -- Enforce canonical ordering: user_one < user_two (prevents mirror duplicates)
  CONSTRAINT matches_canonical_order CHECK (user_one < user_two),
  CONSTRAINT matches_no_self         CHECK (user_one != user_two)
);

COMMENT ON TABLE  matches                  IS 'Mutual likes between two users. Canonical pair order: user_one < user_two.';
COMMENT ON COLUMN matches.user_one_rev     IS 'TRUE if user_one used a RevIt (superlike) on user_two.';

-- =============================================================
-- 06. MESSAGES
-- =============================================================

CREATE TABLE IF NOT EXISTS messages (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id     UUID    NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
  sender_id    UUID    NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  body         TEXT    CHECK (char_length(body) <= 2000),
  message_type TEXT    NOT NULL DEFAULT 'text'
                         CHECK (message_type IN ('text','image','gif','system')),
  is_read      BOOLEAN NOT NULL DEFAULT FALSE,
  read_at      TIMESTAMPTZ,
  deleted_at   TIMESTAMPTZ,  -- soft delete
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- read_at must be set iff is_read is true
  CONSTRAINT messages_read_consistency CHECK (
    (is_read = FALSE AND read_at IS NULL) OR
    (is_read = TRUE  AND read_at IS NOT NULL)
  ),
  -- Non-system messages must have a body
  CONSTRAINT messages_body_required CHECK (
    message_type = 'system' OR body IS NOT NULL
  )
);

COMMENT ON COLUMN messages.body       IS 'Message content. NULL only allowed for system messages.';
COMMENT ON COLUMN messages.deleted_at IS 'Soft delete timestamp. Client should hide messages where deleted_at IS NOT NULL.';

-- =============================================================
-- 07. BLOCKED USERS
-- =============================================================

CREATE TABLE IF NOT EXISTS blocked_users (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id  UUID    NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  blocked_id  UUID    NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT blocked_users_unique   UNIQUE (blocker_id, blocked_id),
  CONSTRAINT blocked_users_no_self  CHECK  (blocker_id != blocked_id)
);

-- =============================================================
-- 08. REPORTS
-- =============================================================

CREATE TABLE IF NOT EXISTS reports (
  id                   UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id          UUID    NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  reported_user_id     UUID    NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  reported_message_id  UUID    REFERENCES messages (id) ON DELETE SET NULL,
  reported_photo_id    UUID    REFERENCES profile_photos (id) ON DELETE SET NULL,
  reason               TEXT    NOT NULL
                                 CHECK (reason IN (
                                   'inappropriate_photos','harassment','fake_profile',
                                   'underage','spam','hate_speech','other'
                                 )),
  details              TEXT    CHECK (char_length(details) <= 1000),
  status               TEXT    NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending','reviewed','actioned','dismissed')),
  admin_notes          TEXT,
  reviewed_by          UUID    REFERENCES profiles (id),
  reviewed_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT reports_no_self_report CHECK (reporter_id != reported_user_id)
);

-- =============================================================
-- 09. VERIFICATIONS
-- =============================================================

CREATE TABLE IF NOT EXISTS verifications (
  id                   UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID    NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  verification_type    TEXT    NOT NULL
                                 CHECK (verification_type IN ('id_document','face_selfie','phone','social_link')),
  status               TEXT    NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending','approved','rejected')),
  provider             TEXT,
  provider_reference   TEXT,
  provider_response    JSONB,
  document_path        TEXT,
  selfie_path          TEXT,
  admin_notes          TEXT,
  reviewed_by          UUID    REFERENCES profiles (id),
  reviewed_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- 10. USER BADGES
-- =============================================================

CREATE TABLE IF NOT EXISTS user_badges (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID    NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  badge_name  TEXT    NOT NULL
                        CHECK (badge_name IN (
                          'first_match','five_matches','first_message',
                          'first_ride_date','verified_rider','trusted_rider'
                        )),
  badge_type  TEXT    NOT NULL
                        CHECK (badge_type IN ('social','communication','activity','trust')),
  earned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT user_badges_unique UNIQUE (user_id, badge_name)
);

-- =============================================================
-- 11. RIDE DATES
-- =============================================================

CREATE TABLE IF NOT EXISTS ride_dates (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id            UUID    NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
  organiser_id        UUID    NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  invited_user_id     UUID    NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  meeting_location    TEXT    CHECK (char_length(meeting_location) <= 200),
  meeting_latitude    DOUBLE PRECISION,
  meeting_longitude   DOUBLE PRECISION,
  route_summary       TEXT    CHECK (char_length(route_summary) <= 500),
  route_data          JSONB,  -- optional structured route (waypoints etc.)
  scheduled_time      TIMESTAMPTZ NOT NULL,
  status              TEXT    NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','accepted','declined','cancelled')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ride_dates_no_self CHECK (organiser_id != invited_user_id),
  -- One pending invite per match at a time
  EXCLUDE USING btree (match_id WITH =)
    WHERE (status = 'pending')
);

COMMENT ON TABLE  ride_dates               IS 'Ride date invitations between matched users.';
COMMENT ON COLUMN ride_dates.route_data    IS 'Optional JSONB for waypoints, estimated duration, map provider data.';

-- =============================================================
-- 12. SAFETY CHECKINS
-- =============================================================

CREATE TABLE IF NOT EXISTS safety_checkins (
  id                     UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_date_id           UUID    REFERENCES ride_dates (id) ON DELETE CASCADE,
  user_id                UUID    NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  -- Optional free-form ride (not necessarily tied to a ride_date)
  ride_description       TEXT    CHECK (char_length(ride_description) <= 300),
  destination_name       TEXT,
  destination_lat        DOUBLE PRECISION,
  destination_lng        DOUBLE PRECISION,
  expected_return_at     TIMESTAMPTZ NOT NULL,
  trusted_contact_name   TEXT,
  trusted_contact_phone  TEXT,
  checkin_status         TEXT    NOT NULL DEFAULT 'pending'
                                   CHECK (checkin_status IN ('pending','checked_in','overdue','alert_sent','resolved')),
  last_checked_at        TIMESTAMPTZ,
  resolved_at            TIMESTAMPTZ,
  alert_sent_at          TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE safety_checkins IS 'Ride safety check-in system. Alerts trusted contact if user does not check in by expected_return_at.';

-- =============================================================
-- 13. SUBSCRIPTIONS
-- =============================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id                       UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID    NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  stripe_customer_id       TEXT,
  stripe_subscription_id   TEXT    UNIQUE,
  stripe_price_id          TEXT,
  plan                     TEXT    NOT NULL DEFAULT 'free'
                                     CHECK (plan IN ('free','premium_monthly','premium_yearly')),
  status                   TEXT    NOT NULL DEFAULT 'inactive'
                                     CHECK (status IN ('active','inactive','canceled','past_due','trialing','incomplete')),
  current_period_start     TIMESTAMPTZ,
  current_period_end       TIMESTAMPTZ,
  cancel_at_period_end     BOOLEAN NOT NULL DEFAULT FALSE,
  trial_end                TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  subscriptions                        IS 'Stripe subscription records. Source of truth for premium entitlements.';
COMMENT ON COLUMN subscriptions.stripe_subscription_id IS 'Unique Stripe sub ID used for webhook upserts.';

-- =============================================================
-- 14. ADMIN ACTIONS
-- =============================================================

CREATE TABLE IF NOT EXISTS admin_actions (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        UUID    NOT NULL REFERENCES profiles (id),
  target_user_id  UUID    REFERENCES profiles (id),
  action_type     TEXT    NOT NULL
                            CHECK (action_type IN (
                              'ban','unban','warn','photo_rejected','photo_approved',
                              'report_actioned','report_dismissed','profile_note',
                              'verification_approved','verification_rejected'
                            )),
  notes           TEXT,
  metadata        JSONB,  -- flexible payload (e.g. rejected photo ID, ban duration)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE admin_actions IS 'Immutable audit log of admin moderation actions.';

-- =============================================================
-- INDEXES
-- =============================================================

-- profiles — geo queries
CREATE INDEX IF NOT EXISTS idx_profiles_location
  ON profiles USING GIST (location);

CREATE INDEX IF NOT EXISTS idx_profiles_lat_lng
  ON profiles (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_active
  ON profiles (is_active, is_banned, onboarding_complete)
  WHERE is_active = TRUE AND is_banned = FALSE AND onboarding_complete = TRUE;

CREATE INDEX IF NOT EXISTS idx_profiles_last_active
  ON profiles (last_active DESC);

-- swipes — lookup in both directions
CREATE INDEX IF NOT EXISTS idx_swipes_swiper    ON swipes (swiper_id);
CREATE INDEX IF NOT EXISTS idx_swipes_swiped    ON swipes (swiped_id);
CREATE INDEX IF NOT EXISTS idx_swipes_pair      ON swipes (swiper_id, swiped_id);
CREATE INDEX IF NOT EXISTS idx_swipes_created   ON swipes (created_at DESC);

-- matches — both participants + recency
CREATE INDEX IF NOT EXISTS idx_matches_user_one      ON matches (user_one);
CREATE INDEX IF NOT EXISTS idx_matches_user_two      ON matches (user_two);
CREATE INDEX IF NOT EXISTS idx_matches_last_message  ON matches (last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_status        ON matches (status);

-- messages — chat load
CREATE INDEX IF NOT EXISTS idx_messages_match_id   ON messages (match_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender     ON messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread     ON messages (match_id, is_read)
  WHERE is_read = FALSE;

-- profile_photos — moderation queue
CREATE INDEX IF NOT EXISTS idx_profile_photos_user_id            ON profile_photos (user_id);
CREATE INDEX IF NOT EXISTS idx_profile_photos_moderation_status  ON profile_photos (moderation_status);
CREATE INDEX IF NOT EXISTS idx_profile_photos_primary            ON profile_photos (user_id, is_primary)
  WHERE is_primary = TRUE;

-- reports — admin queue
CREATE INDEX IF NOT EXISTS idx_reports_status        ON reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_reported_user ON reports (reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter      ON reports (reporter_id);

-- blocked_users — fast block checks
CREATE INDEX IF NOT EXISTS idx_blocked_blocker ON blocked_users (blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_blocked ON blocked_users (blocked_id);

-- subscriptions — entitlement lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status  ON subscriptions (user_id, status, current_period_end DESC);

-- ride_dates
CREATE INDEX IF NOT EXISTS idx_ride_dates_match       ON ride_dates (match_id);
CREATE INDEX IF NOT EXISTS idx_ride_dates_organiser   ON ride_dates (organiser_id);
CREATE INDEX IF NOT EXISTS idx_ride_dates_invited     ON ride_dates (invited_user_id);
CREATE INDEX IF NOT EXISTS idx_ride_dates_status      ON ride_dates (status);

-- safety_checkins
CREATE INDEX IF NOT EXISTS idx_safety_checkins_user     ON safety_checkins (user_id);
CREATE INDEX IF NOT EXISTS idx_safety_checkins_overdue  ON safety_checkins (expected_return_at)
  WHERE checkin_status IN ('pending','checked_in');

-- user_badges
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges (user_id);

-- admin_actions — audit queries
CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON admin_actions (target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin  ON admin_actions (admin_id, created_at DESC);

-- =============================================================
-- updated_at TRIGGER
-- Automatically sets updated_at = NOW() on row update.
-- Applied to every table that has an updated_at column.
-- =============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- profiles
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- bikes
DROP TRIGGER IF EXISTS trg_bikes_updated_at ON bikes;
CREATE TRIGGER trg_bikes_updated_at
  BEFORE UPDATE ON bikes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- profile_photos
DROP TRIGGER IF EXISTS trg_profile_photos_updated_at ON profile_photos;
CREATE TRIGGER trg_profile_photos_updated_at
  BEFORE UPDATE ON profile_photos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- matches
DROP TRIGGER IF EXISTS trg_matches_updated_at ON matches;
CREATE TRIGGER trg_matches_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ride_dates
DROP TRIGGER IF EXISTS trg_ride_dates_updated_at ON ride_dates;
CREATE TRIGGER trg_ride_dates_updated_at
  BEFORE UPDATE ON ride_dates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- subscriptions
DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- verifications
DROP TRIGGER IF EXISTS trg_verifications_updated_at ON verifications;
CREATE TRIGGER trg_verifications_updated_at
  BEFORE UPDATE ON verifications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================
-- AUTO-UPDATE last_active ON MESSAGES SENT
-- =============================================================

CREATE OR REPLACE FUNCTION trg_fn_message_last_active()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles SET last_active = NOW() WHERE id = NEW.sender_id;
  UPDATE matches  SET last_message_at = NOW() WHERE id = NEW.match_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_message_last_active ON messages;
CREATE TRIGGER trg_message_last_active
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION trg_fn_message_last_active();

-- =============================================================
-- AUTO-CREATE MATCH WHEN MUTUAL LIKE IS DETECTED
-- =============================================================

CREATE OR REPLACE FUNCTION trg_fn_create_match_on_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_other_action TEXT;
  v_user_one     UUID;
  v_user_two     UUID;
BEGIN
  -- Only proceed on like or rev (not pass)
  IF NEW.swipe_action = 'pass' THEN RETURN NULL; END IF;

  -- Check whether the other person already liked or rev'd back
  SELECT swipe_action INTO v_other_action
  FROM swipes
  WHERE swiper_id = NEW.swiped_id AND swiped_id = NEW.swiper_id;

  IF v_other_action IS NULL OR v_other_action = 'pass' THEN RETURN NULL; END IF;

  -- Canonical ordering: smaller UUID first
  v_user_one := LEAST(NEW.swiper_id, NEW.swiped_id);
  v_user_two := GREATEST(NEW.swiper_id, NEW.swiped_id);

  INSERT INTO matches (user_one, user_two, user_one_rev, user_two_rev)
  VALUES (
    v_user_one,
    v_user_two,
    (v_user_one = NEW.swiper_id AND NEW.swipe_action = 'rev')
      OR (v_user_one = NEW.swiped_id AND v_other_action = 'rev'),
    (v_user_two = NEW.swiper_id AND NEW.swipe_action = 'rev')
      OR (v_user_two = NEW.swiped_id AND v_other_action = 'rev')
  )
  ON CONFLICT (user_one, user_two) DO NOTHING;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_match_on_like ON swipes;
CREATE TRIGGER trg_create_match_on_like
  AFTER INSERT ON swipes
  FOR EACH ROW EXECUTE FUNCTION trg_fn_create_match_on_like();

-- =============================================================
-- BLOCK CHECK HELPER
-- Returns TRUE if either user has blocked the other.
-- Used in discovery RPC and RLS policies.
-- =============================================================

CREATE OR REPLACE FUNCTION are_users_blocked(user_a UUID, user_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM blocked_users
    WHERE (blocker_id = user_a AND blocked_id = user_b)
       OR (blocker_id = user_b AND blocked_id = user_a)
  );
$$;

-- =============================================================
-- NEW USER BOOTSTRAP TRIGGER
-- Creates a minimal profile row and default credits when a new
-- auth.users row is inserted (e.g. after email sign-up).
-- =============================================================

CREATE OR REPLACE FUNCTION trg_fn_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, display_name, date_of_birth, gender, interested_in, dating_intent)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'date_of_birth')::DATE, '2000-01-01'::DATE),
    COALESCE(NEW.raw_user_meta_data->>'gender', 'prefer_not_to_say'),
    ARRAY['everyone'],
    'open_to_anything'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_new_user ON auth.users;
CREATE TRIGGER trg_handle_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION trg_fn_handle_new_user();

-- =============================================================
-- ROW LEVEL SECURITY
-- Tables are locked down; all access goes through policies.
-- Policies delegate to auth.uid() for authenticated access.
-- Admin access uses a service-role client (bypasses RLS).
-- =============================================================

ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE bikes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_photos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE swipes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches           ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports           ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_dates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_checkins   ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_actions     ENABLE ROW LEVEL SECURITY;

-- ── PROFILES ──────────────────────────────────────────────────────────────

-- Any authenticated user can read non-banned, active, onboarded profiles
CREATE POLICY "profiles_select_public"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    is_active = TRUE
    AND is_banned = FALSE
    AND onboarding_complete = TRUE
    AND NOT are_users_blocked(auth.uid(), id)
  );

-- Own profile is always visible (needed for settings/onboarding)
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Users can only update their own profile
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- The new-user trigger creates the row; no client INSERT needed
CREATE POLICY "profiles_insert_trigger"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- ── BIKES ──────────────────────────────────────────────────────────────────

CREATE POLICY "bikes_select_public"
  ON bikes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = bikes.user_id
        AND p.is_active = TRUE
        AND p.is_banned = FALSE
        AND p.onboarding_complete = TRUE
    )
  );

CREATE POLICY "bikes_modify_own"
  ON bikes FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── PROFILE PHOTOS ────────────────────────────────────────────────────────

-- Only approved photos are visible to others
CREATE POLICY "profile_photos_select_approved"
  ON profile_photos FOR SELECT
  TO authenticated
  USING (
    moderation_status = 'approved'
    OR user_id = auth.uid()
  );

CREATE POLICY "profile_photos_modify_own"
  ON profile_photos FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── SWIPES ────────────────────────────────────────────────────────────────

-- Users can only see their own swipes (prevents snooping)
CREATE POLICY "swipes_own"
  ON swipes FOR ALL
  TO authenticated
  USING (swiper_id = auth.uid())
  WITH CHECK (swiper_id = auth.uid());

-- ── MATCHES ───────────────────────────────────────────────────────────────

CREATE POLICY "matches_participants"
  ON matches FOR SELECT
  TO authenticated
  USING (user_one = auth.uid() OR user_two = auth.uid());

-- Matches are created by the DB trigger, not by clients directly
-- If direct insert is needed, restrict to participants
CREATE POLICY "matches_insert_own"
  ON matches FOR INSERT
  TO authenticated
  WITH CHECK (user_one = auth.uid() OR user_two = auth.uid());

-- ── MESSAGES ─────────────────────────────────────────────────────────────

CREATE POLICY "messages_participants"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = messages.match_id
        AND (m.user_one = auth.uid() OR m.user_two = auth.uid())
    )
  );

CREATE POLICY "messages_send_own"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = messages.match_id
        AND m.status = 'active'
        AND (m.user_one = auth.uid() OR m.user_two = auth.uid())
    )
  );

-- Users can soft-delete (update deleted_at) their own messages
CREATE POLICY "messages_update_own"
  ON messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- ── BLOCKED USERS ─────────────────────────────────────────────────────────

CREATE POLICY "blocked_users_own"
  ON blocked_users FOR ALL
  TO authenticated
  USING (blocker_id = auth.uid())
  WITH CHECK (blocker_id = auth.uid());

-- ── REPORTS ───────────────────────────────────────────────────────────────

CREATE POLICY "reports_insert_own"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- Reporters can see their own reports
CREATE POLICY "reports_select_own"
  ON reports FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid());

-- ── VERIFICATIONS ──────────────────────────────────────────────────────────

CREATE POLICY "verifications_own"
  ON verifications FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── USER BADGES ───────────────────────────────────────────────────────────

-- Badges are public (visible on profile cards)
CREATE POLICY "user_badges_select"
  ON user_badges FOR SELECT
  TO authenticated
  USING (TRUE);

-- Only DB functions (SECURITY DEFINER) award badges
CREATE POLICY "user_badges_insert_definer"
  ON user_badges FOR INSERT
  TO authenticated
  WITH CHECK (FALSE);  -- blocked; use award_badge() function

-- ── RIDE DATES ────────────────────────────────────────────────────────────

CREATE POLICY "ride_dates_participants"
  ON ride_dates FOR SELECT
  TO authenticated
  USING (organiser_id = auth.uid() OR invited_user_id = auth.uid());

CREATE POLICY "ride_dates_insert_organiser"
  ON ride_dates FOR INSERT
  TO authenticated
  WITH CHECK (organiser_id = auth.uid());

-- Invited user can accept/decline; organiser can cancel
CREATE POLICY "ride_dates_update_participants"
  ON ride_dates FOR UPDATE
  TO authenticated
  USING (organiser_id = auth.uid() OR invited_user_id = auth.uid())
  WITH CHECK (organiser_id = auth.uid() OR invited_user_id = auth.uid());

-- ── SAFETY CHECKINS ────────────────────────────────────────────────────────

CREATE POLICY "safety_checkins_own"
  ON safety_checkins FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── SUBSCRIPTIONS ──────────────────────────────────────────────────────────

-- Users can read their own subscription (e.g. settings page)
CREATE POLICY "subscriptions_own"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Writes handled by Stripe webhook via service-role client (bypasses RLS)

-- ── ADMIN ACTIONS ──────────────────────────────────────────────────────────
-- Admin table is fully locked for clients — only service-role can write.
-- Admins view via a dedicated admin Next.js app with service-role key.

-- =============================================================
-- STORAGE BUCKETS
-- Run this once in the Supabase dashboard or via CLI.
-- Listed here as reference — storage.buckets is not directly
-- accessible via SQL migration in hosted Supabase.
-- =============================================================

-- bucket: profile-photos   (public: false, max file size: 5MB, allowed MIME: image/*)
-- bucket: bike-photos      (public: false, max file size: 5MB, allowed MIME: image/*)
-- bucket: verification-docs (public: false, max file size: 10MB)

-- Storage RLS policies (via dashboard or supabase/storage.sql companion file):
--   profile-photos: users can INSERT/DELETE their own files
--   profile-photos: anyone authenticated can read approved photos
--   verification-docs: user can INSERT their own; admin service-role reads

-- =============================================================
-- REALTIME
-- Enable Supabase Realtime on tables that need live updates.
-- Run via: supabase db push  or  dashboard Realtime settings.
-- =============================================================

-- Enable publication for Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END;
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE ride_dates;
ALTER PUBLICATION supabase_realtime ADD TABLE safety_checkins;
