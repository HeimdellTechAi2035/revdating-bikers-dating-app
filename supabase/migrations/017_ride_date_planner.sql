-- =============================================================
-- 017_ride_date_planner.sql
--
-- Extends the ride_dates table (created in 011) with:
--   • 'completed' status value
--   • route_summary  — optional human-readable route description
--   • cancelled_by   — which participant cancelled the invite
--   • completed_at   — timestamp when the ride was marked done
--
-- Updates RLS so EITHER user can cancel or complete.
-- Updates badge trigger to also fire on completion.
-- Adds Realtime publication entry so clients see live updates.
-- =============================================================

-- ── 1. Status CHECK constraint — add 'completed' ──────────────
-- PostgreSQL names the inline CHECK as ride_dates_status_check.

ALTER TABLE ride_dates
  DROP CONSTRAINT IF EXISTS ride_dates_status_check;

ALTER TABLE ride_dates
  ADD CONSTRAINT ride_dates_status_check
  CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'completed'));

-- ── 2. New columns ────────────────────────────────────────────

-- Human-readable route description (e.g. "Take the coastal highway via Point Reyes")
-- Stored in addition to the structured route_data JSONB.
ALTER TABLE ride_dates
  ADD COLUMN IF NOT EXISTS route_summary TEXT
  CHECK (char_length(route_summary) <= 1000);

-- Which participant cancelled (user_one or user_two UUID)
ALTER TABLE ride_dates
  ADD COLUMN IF NOT EXISTS cancelled_by UUID
  REFERENCES profiles(id) ON DELETE SET NULL;

-- When both users agreed the ride happened
ALTER TABLE ride_dates
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- ── 3. RLS UPDATE policy — allow cancel/complete by either user
-- Original policy only let user_one cancel. The planner requires
-- either participant to cancel (pending OR accepted) and to
-- mark the ride completed (accepted only).

DROP POLICY IF EXISTS "ride_dates_update_participant" ON ride_dates;

CREATE POLICY "ride_dates_update_participant"
  ON ride_dates FOR UPDATE
  USING (auth.uid() = user_one OR auth.uid() = user_two)
  WITH CHECK (
    -- Only the invited user (user_two) can accept or decline
    (auth.uid() = user_two AND status IN ('accepted', 'declined'))
    OR
    -- Either participant can cancel a pending or accepted invite
    ((auth.uid() = user_one OR auth.uid() = user_two) AND status = 'cancelled')
    OR
    -- Either participant can mark an accepted ride as completed
    ((auth.uid() = user_one OR auth.uid() = user_two) AND status = 'completed')
  );

-- ── 4. Badge trigger — also fire on 'completed' ───────────────
-- Replace the function defined in 011 to handle both accepted
-- and completed transitions.

CREATE OR REPLACE FUNCTION on_ride_date_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Award first_ride_date badge on acceptance (original behaviour)
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    PERFORM award_badge(NEW.user_one, 'first_ride_date', 'activity');
    PERFORM award_badge(NEW.user_two, 'first_ride_date', 'activity');
  END IF;

  -- Future: award a separate 'completed_ride_date' badge here if desired
  RETURN NEW;
END;
$$;

-- ── 5. Realtime — broadcast ride-date status changes ─────────
-- Clients subscribe to ride_dates changes to reflect live status.

ALTER PUBLICATION supabase_realtime ADD TABLE ride_dates;
ALTER TABLE ride_dates SET (replica_identity = full);
