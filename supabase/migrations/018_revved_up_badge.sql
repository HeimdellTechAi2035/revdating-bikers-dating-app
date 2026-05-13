-- =============================================================
-- 018_revved_up_badge.sql
--
-- Adds the "Revved Up" badge — awarded the first time a user
-- sends a Rev (super-like) swipe.
--
-- Changes:
--   1. Extends badge_name_type enum with 'revved_up'
--   2. Adds a trigger on swipes INSERT that fires for rev actions
--   3. Back-fills existing rev swipers
-- =============================================================

-- ── 1. Extend the enum ────────────────────────────────────────
-- PostgreSQL requires a fresh transaction to see the new value
-- in the same migration session, so we commit implicitly by
-- not wrapping in explicit BEGIN/COMMIT here.

ALTER TYPE badge_name_type ADD VALUE IF NOT EXISTS 'revved_up';

-- ── 2. Trigger function: award revved_up on first rev swipe ──

CREATE OR REPLACE FUNCTION on_swipe_check_revved_up()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.swipe_action = 'rev' THEN
    PERFORM award_badge(NEW.swiper_id, 'revved_up', 'activity');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_swipe_inserted_revved_up
  AFTER INSERT ON swipes
  FOR EACH ROW EXECUTE FUNCTION on_swipe_check_revved_up();

-- ── 3. Back-fill existing rev swipers ─────────────────────────

DO $$
DECLARE
  v_uid UUID;
BEGIN
  FOR v_uid IN
    SELECT DISTINCT swiper_id FROM swipes WHERE swipe_action = 'rev'
  LOOP
    PERFORM award_badge(v_uid, 'revved_up', 'activity');
  END LOOP;
END;
$$;
