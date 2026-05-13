-- =============================================================
-- RevMatch — Migration 001: Initial Schema
-- Apply via: supabase db push  OR  supabase db reset (dev)
-- =============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
-- ENUMS
-- =============================================================

CREATE TYPE gender_type AS ENUM (
  'man', 'woman', 'non_binary', 'other', 'prefer_not_to_say'
);

CREATE TYPE interested_in_type AS ENUM ('men', 'women', 'everyone');

CREATE TYPE dating_intent_type AS ENUM (
  'serious_relationship', 'casual_dating', 'riding_partner',
  'friendship', 'open_to_anything'
);

CREATE TYPE riding_style_type AS ENUM (
  'cruiser', 'sport', 'touring', 'adventure', 'dirt',
  'chopper', 'cafe_racer', 'bobber', 'naked', 'scooter', 'electric', 'other'
);

CREATE TYPE bike_type_type AS ENUM (
  'cruiser', 'sport', 'touring', 'adventure', 'dirt',
  'chopper', 'cafe_racer', 'bobber', 'naked', 'scooter', 'electric', 'other'
);

CREATE TYPE owned_or_dream_type AS ENUM ('owned', 'dream');

CREATE TYPE swipe_action_type AS ENUM ('like', 'pass', 'superlike');

CREATE TYPE report_reason_type AS ENUM (
  'inappropriate_photos', 'harassment', 'fake_profile',
  'underage', 'spam', 'hate_speech', 'other'
);

CREATE TYPE report_status_type AS ENUM ('pending', 'reviewed', 'actioned', 'dismissed');

CREATE TYPE moderation_status_type AS ENUM ('pending', 'approved', 'rejected');

CREATE TYPE subscription_status_type AS ENUM (
  'active', 'canceled', 'past_due', 'trialing', 'incomplete'
);

CREATE TYPE verification_type_type AS ENUM (
  'id_document', 'face_selfie', 'phone', 'social_link'
);

CREATE TYPE verification_status_type AS ENUM ('pending', 'approved', 'rejected');

CREATE TYPE checkin_status_type AS ENUM ('active', 'resolved', 'overdue', 'alert_sent');

CREATE TYPE admin_action_type AS ENUM (
  'ban', 'unban', 'warn', 'photo_rejected', 'photo_approved',
  'report_actioned', 'report_dismissed', 'profile_note',
  'verification_approved', 'verification_rejected'
);

CREATE TYPE admin_role_type AS ENUM ('moderator', 'admin', 'super_admin');

-- =============================================================
-- ADMIN USERS (declared early — used by the users view)
-- =============================================================

CREATE TABLE admin_users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        admin_role_type NOT NULL DEFAULT 'moderator',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- USERS VIEW
-- Exposes safe columns from auth.users. Security enforced via
-- WHERE: users see only their own row; admins see all.
-- =============================================================

CREATE OR REPLACE VIEW public.users AS
SELECT
  u.id,
  u.email,
  u.phone,
  u.created_at,
  u.last_sign_in_at,
  u.raw_user_meta_data,
  u.email_confirmed_at IS NOT NULL AS email_confirmed
FROM auth.users u
WHERE u.id = auth.uid()
   OR EXISTS (SELECT 1 FROM public.admin_users a WHERE a.id = auth.uid());

-- =============================================================
-- PROFILES
-- One row per auth.users entry.
-- =============================================================

CREATE TABLE profiles (
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identity
  display_name          TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 30),
  date_of_birth         DATE NOT NULL,
  age                   SMALLINT,                   -- maintained by trigger
  gender                gender_type NOT NULL,
  interested_in         interested_in_type NOT NULL DEFAULT 'everyone',
  dating_intent         dating_intent_type,
  bio                   TEXT CHECK (char_length(bio) <= 500),

  -- Location
  location              GEOGRAPHY(POINT, 4326),
  latitude              DOUBLE PRECISION CHECK (latitude  BETWEEN -90  AND  90),
  longitude             DOUBLE PRECISION CHECK (longitude BETWEEN -180 AND 180),
  city                  TEXT,
  country               TEXT NOT NULL DEFAULT 'GB',
  max_distance_miles    INTEGER NOT NULL DEFAULT 50 CHECK (max_distance_miles BETWEEN 1 AND 500),

  -- Biker identity
  riding_style          riding_style_type,
  years_riding          SMALLINT CHECK (years_riding BETWEEN 0 AND 80),
  club_status           TEXT CHECK (club_status IN ('member', 'founder', 'independent', 'none')),
  attends_rallies       BOOLEAN,
  music_taste           TEXT[],

  -- Lifestyle
  smoker                BOOLEAN,
  drinker               BOOLEAN,
  has_passenger_helmet  BOOLEAN,

  -- Account flags (writable only by server / admin)
  is_verified           BOOLEAN NOT NULL DEFAULT FALSE,
  is_premium            BOOLEAN NOT NULL DEFAULT FALSE,
  is_banned             BOOLEAN NOT NULL DEFAULT FALSE,
  ban_reason            TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  onboarding_complete   BOOLEAN NOT NULL DEFAULT FALSE,

  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ADD CONSTRAINT profiles_dob_not_future
  CHECK (date_of_birth < CURRENT_DATE);

-- =============================================================
-- PROFILE PHOTOS
-- =============================================================

CREATE TABLE profile_photos (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  storage_path         TEXT NOT NULL,
  public_url           TEXT NOT NULL,
  is_primary           BOOLEAN NOT NULL DEFAULT FALSE,
  moderation_status    moderation_status_type NOT NULL DEFAULT 'pending',
  moderation_provider  TEXT,
  moderation_response  JSONB,
  rejected_reason      TEXT,
  sort_order           INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION check_photo_limit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT COUNT(*) FROM profile_photos WHERE user_id = NEW.user_id) >= 6 THEN
    RAISE EXCEPTION 'Maximum of 6 photos allowed per user';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_photo_limit
  BEFORE INSERT ON profile_photos
  FOR EACH ROW EXECUTE FUNCTION check_photo_limit();

-- At most one primary photo per user
CREATE UNIQUE INDEX idx_profile_photos_one_primary
  ON profile_photos (user_id) WHERE is_primary = TRUE;

-- =============================================================
-- BIKES
-- =============================================================

CREATE TABLE bikes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bike_type       bike_type_type NOT NULL,
  bike_brand      TEXT NOT NULL CHECK (char_length(bike_brand) BETWEEN 1 AND 60),
  bike_model      TEXT NOT NULL CHECK (char_length(bike_model) BETWEEN 1 AND 80),
  bike_year       SMALLINT CHECK (bike_year BETWEEN 1900 AND 2100),
  engine_size_cc  INTEGER CHECK (engine_size_cc BETWEEN 50 AND 3000),
  owned_or_dream  owned_or_dream_type NOT NULL DEFAULT 'owned',
  primary_bike    BOOLEAN NOT NULL DEFAULT FALSE,
  photo_url       TEXT,
  notes           TEXT CHECK (char_length(notes) <= 300),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- At most one primary bike per user
CREATE UNIQUE INDEX idx_bikes_one_primary
  ON bikes (user_id) WHERE primary_bike = TRUE;

-- =============================================================
-- SWIPES
-- =============================================================

CREATE TABLE swipes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  swiper_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  swiped_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  swipe_action  swipe_action_type NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT swipes_no_self_swipe CHECK (swiper_id != swiped_id),
  CONSTRAINT swipes_unique UNIQUE (swiper_id, swiped_id)
);

-- =============================================================
-- MATCHES
-- user1_id < user2_id enforced to prevent duplicate pairs.
-- =============================================================

CREATE TABLE matches (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user1_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user2_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user1_superliked  BOOLEAN NOT NULL DEFAULT FALSE,
  user2_superliked  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at   TIMESTAMPTZ,

  CONSTRAINT matches_user_order CHECK (user1_id < user2_id),
  CONSTRAINT matches_unique UNIQUE (user1_id, user2_id)
);

-- =============================================================
-- MESSAGES
-- =============================================================

CREATE TABLE messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id    UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  read_at     TIMESTAMPTZ,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- BLOCKED USERS
-- =============================================================

CREATE TABLE blocked_users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocker_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason      TEXT CHECK (char_length(reason) <= 300),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT blocked_users_no_self CHECK (blocker_id != blocked_id),
  CONSTRAINT blocked_users_unique UNIQUE (blocker_id, blocked_id)
);

-- =============================================================
-- REPORTS
-- =============================================================

CREATE TABLE reports (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  photo_id       UUID REFERENCES profile_photos(id) ON DELETE SET NULL,
  reason         report_reason_type NOT NULL,
  description    TEXT CHECK (char_length(description) <= 1000),
  status         report_status_type NOT NULL DEFAULT 'pending',
  reviewed_by    UUID REFERENCES auth.users(id),
  reviewed_at    TIMESTAMPTZ,
  admin_notes    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT reports_no_self_report CHECK (reporter_id != reported_id)
);

-- =============================================================
-- VERIFICATIONS
-- =============================================================

CREATE TABLE verifications (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  verification_type   verification_type_type NOT NULL,
  status              verification_status_type NOT NULL DEFAULT 'pending',
  document_path       TEXT,
  selfie_path         TEXT,
  provider            TEXT,
  provider_reference  TEXT,
  provider_response   JSONB,
  admin_notes         TEXT,
  reviewed_by         UUID REFERENCES auth.users(id),
  reviewed_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- SUBSCRIPTIONS (Stripe-backed)
-- =============================================================

CREATE TABLE subscriptions (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_customer_id      TEXT UNIQUE,
  stripe_subscription_id  TEXT UNIQUE,
  stripe_price_id         TEXT,
  plan_name               TEXT,
  status                  subscription_status_type NOT NULL,
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN NOT NULL DEFAULT FALSE,
  trial_end               TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- SAFETY CHECK-INS
-- =============================================================

CREATE TABLE safety_checkins (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_id                UUID REFERENCES matches(id) ON DELETE SET NULL,
  ride_description        TEXT CHECK (char_length(ride_description) <= 500),
  destination_name        TEXT,
  destination_lat         DOUBLE PRECISION CHECK (destination_lat BETWEEN -90  AND  90),
  destination_lng         DOUBLE PRECISION CHECK (destination_lng BETWEEN -180 AND 180),
  expected_return_at      TIMESTAMPTZ NOT NULL,
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  status                  checkin_status_type NOT NULL DEFAULT 'active',
  resolved_at             TIMESTAMPTZ,
  alert_sent_at           TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- ADMIN ACTIONS (audit log)
-- =============================================================

CREATE TABLE admin_actions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id        UUID NOT NULL REFERENCES auth.users(id),
  target_user_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action          admin_action_type NOT NULL,
  reason          TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- PUSH NOTIFICATION TOKENS
-- =============================================================

CREATE TABLE push_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  platform    TEXT NOT NULL CHECK (platform IN ('web', 'ios', 'android')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT push_tokens_unique UNIQUE (user_id, token)
);

-- =============================================================
-- SUPERLIKE CREDITS (refreshed weekly)
-- =============================================================

CREATE TABLE superlike_credits (
  user_id        UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  credits        INTEGER NOT NULL DEFAULT 3 CHECK (credits >= 0),
  last_reset_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- DAILY SWIPE COUNTS (free tier: 20/day)
-- =============================================================

CREATE TABLE daily_swipe_counts (
  user_id     UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  count       INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  reset_date  DATE NOT NULL DEFAULT CURRENT_DATE
);

-- =============================================================
-- INDEXES
-- =============================================================

-- profiles
CREATE INDEX idx_profiles_location          ON profiles USING GIST (location);
CREATE INDEX idx_profiles_active_complete   ON profiles (is_active, is_banned, onboarding_complete);
CREATE INDEX idx_profiles_gender            ON profiles (gender);
CREATE INDEX idx_profiles_interested_in     ON profiles (interested_in);
CREATE INDEX idx_profiles_riding_style      ON profiles (riding_style);
CREATE INDEX idx_profiles_last_active       ON profiles (last_active DESC);
CREATE INDEX idx_profiles_created_at        ON profiles (created_at DESC);
CREATE INDEX idx_profiles_country_city      ON profiles (country, city);
CREATE INDEX idx_profiles_is_premium        ON profiles (is_premium) WHERE is_premium = TRUE;

-- profile_photos
CREATE INDEX idx_profile_photos_user_id           ON profile_photos (user_id);
CREATE INDEX idx_profile_photos_moderation_status ON profile_photos (moderation_status);

-- bikes
CREATE INDEX idx_bikes_user_id   ON bikes (user_id);
CREATE INDEX idx_bikes_bike_type ON bikes (bike_type);

-- swipes
CREATE INDEX idx_swipes_swiper_id   ON swipes (swiper_id);
CREATE INDEX idx_swipes_swiped_id   ON swipes (swiped_id);
CREATE INDEX idx_swipes_created_at  ON swipes (created_at DESC);

-- matches
CREATE INDEX idx_matches_user1_id        ON matches (user1_id);
CREATE INDEX idx_matches_user2_id        ON matches (user2_id);
CREATE INDEX idx_matches_last_message_at ON matches (last_message_at DESC NULLS LAST);
CREATE INDEX idx_matches_is_active       ON matches (is_active) WHERE is_active = TRUE;

-- messages
CREATE INDEX idx_messages_match_id  ON messages (match_id, created_at DESC);
CREATE INDEX idx_messages_sender_id ON messages (sender_id);
CREATE INDEX idx_messages_unread    ON messages (match_id, is_read) WHERE is_read = FALSE;

-- blocked_users
CREATE INDEX idx_blocked_users_blocker ON blocked_users (blocker_id);
CREATE INDEX idx_blocked_users_blocked ON blocked_users (blocked_id);

-- reports
CREATE INDEX idx_reports_reported_id ON reports (reported_id);
CREATE INDEX idx_reports_status      ON reports (status, created_at DESC);
CREATE INDEX idx_reports_reporter_id ON reports (reporter_id);

-- verifications
CREATE INDEX idx_verifications_user_id ON verifications (user_id);
CREATE INDEX idx_verifications_status  ON verifications (status);

-- subscriptions
CREATE INDEX idx_subscriptions_user_id            ON subscriptions (user_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions (stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_sub_id      ON subscriptions (stripe_subscription_id);
CREATE INDEX idx_subscriptions_status             ON subscriptions (status);

-- safety_checkins
CREATE INDEX idx_safety_checkins_user_id            ON safety_checkins (user_id);
CREATE INDEX idx_safety_checkins_status             ON safety_checkins (status);
CREATE INDEX idx_safety_checkins_expected_return_at ON safety_checkins (expected_return_at)
  WHERE status = 'active';

-- admin_actions
CREATE INDEX idx_admin_actions_target   ON admin_actions (target_user_id, created_at DESC);
CREATE INDEX idx_admin_actions_admin_id ON admin_actions (admin_id, created_at DESC);

-- =============================================================
-- STORAGE BUCKETS
-- =============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'profile-photos', 'profile-photos', true, 5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
  ),
  (
    'bike-photos', 'bike-photos', true, 5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
  ),
  (
    'verification-docs', 'verification-docs', false, 10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
  )
ON CONFLICT (id) DO NOTHING;

-- profile-photos bucket policies
CREATE POLICY "profile_photos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-photos');

CREATE POLICY "profile_photos_authenticated_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "profile_photos_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "profile_photos_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- bike-photos bucket policies
CREATE POLICY "bike_photos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bike-photos');

CREATE POLICY "bike_photos_authenticated_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'bike-photos'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "bike_photos_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'bike-photos'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "bike_photos_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'bike-photos'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- verification-docs bucket policies (private)
CREATE POLICY "verification_docs_owner_or_admin_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'verification-docs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::TEXT
      OR EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
    )
  );

CREATE POLICY "verification_docs_owner_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'verification-docs'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "verification_docs_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'verification-docs'
    AND EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
  );
