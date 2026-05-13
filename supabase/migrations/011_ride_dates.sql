-- =============================================================
-- 011_ride_dates.sql
--
-- Ride Date Planner: a post-match feature that lets matched
-- users organise a real-world ride date. One user sends an
-- invite; the other accepts or declines.
--
-- Table:   ride_dates
-- Status:  pending → accepted | declined | cancelled
--
-- Google Maps API integration is handled client-side via the
-- NEXT_PUBLIC_GOOGLE_MAPS_KEY env var. The table stores a
-- structured location name + optional lat/lng + a JSONB
-- route_data column ready for directions payloads.
-- =============================================================

-- ── 1. Table ──────────────────────────────────────────────────

CREATE TABLE ride_dates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- user_one sent the invite; user_two received it
  user_one        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_two        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Back-reference to the originating match
  match_id        UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,

  -- Meeting point (human-readable + optional coordinates)
  location        TEXT NOT NULL CHECK (char_length(location) BETWEEN 1 AND 500),
  location_lat    DOUBLE PRECISION,
  location_lng    DOUBLE PRECISION,

  -- Route payload — stores Google Maps Directions API response or
  -- a freeform route description as { notes: string }
  route_data      JSONB,

  scheduled_time  TIMESTAMPTZ NOT NULL,

  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One active invite per match at a time (prevents spam)
  CONSTRAINT ride_dates_unique_pending
    EXCLUDE USING btree (match_id WITH =)
    WHERE (status = 'pending')
);

CREATE INDEX idx_ride_dates_user_one  ON ride_dates (user_one);
CREATE INDEX idx_ride_dates_user_two  ON ride_dates (user_two);
CREATE INDEX idx_ride_dates_match_id  ON ride_dates (match_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_ride_dates_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER ride_dates_updated_at
  BEFORE UPDATE ON ride_dates
  FOR EACH ROW EXECUTE FUNCTION set_ride_dates_updated_at();

-- ── 2. RLS ────────────────────────────────────────────────────

ALTER TABLE ride_dates ENABLE ROW LEVEL SECURITY;

-- Both participants can read their ride dates
CREATE POLICY "ride_dates_select_participant"
  ON ride_dates FOR SELECT
  USING (auth.uid() = user_one OR auth.uid() = user_two);

-- Only user_one (the sender) can create a ride date invite,
-- and only if they are actually a participant in the match.
CREATE POLICY "ride_dates_insert_user_one"
  ON ride_dates FOR INSERT
  WITH CHECK (
    auth.uid() = user_one
    AND EXISTS (
      SELECT 1 FROM matches
      WHERE id = match_id
        AND is_active = TRUE
        AND (user1_id = auth.uid() OR user2_id = auth.uid())
    )
  );

-- Status transitions:
--   user_two  may:  pending → accepted | declined
--   user_one  may:  pending → cancelled
CREATE POLICY "ride_dates_update_participant"
  ON ride_dates FOR UPDATE
  USING (auth.uid() = user_one OR auth.uid() = user_two)
  WITH CHECK (
    -- user_two can accept or decline a pending invite
    (auth.uid() = user_two AND status IN ('accepted', 'declined'))
    OR
    -- user_one can cancel
    (auth.uid() = user_one AND status = 'cancelled')
  );

-- ── 3. Badge trigger: award first_ride_date on acceptance ─────
-- Integrates with the badge system created in 010_badges.sql.

CREATE OR REPLACE FUNCTION on_ride_date_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Award badge to both participants
    PERFORM award_badge(NEW.user_one, 'first_ride_date', 'activity');
    PERFORM award_badge(NEW.user_two, 'first_ride_date', 'activity');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_ride_date_status_change
  AFTER UPDATE OF status ON ride_dates
  FOR EACH ROW EXECUTE FUNCTION on_ride_date_accepted();
