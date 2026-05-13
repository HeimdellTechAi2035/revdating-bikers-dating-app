-- =============================================================
-- 009_rev_it.sql
--
-- Replaces the "superlike" concept with "Rev It" — a biker-themed
-- high-priority like. The DB enum gains the value 'rev'; 'superlike'
-- is kept so existing rows are not invalidated.
--
-- Changes:
--   1. Add 'rev' to swipe_action_type enum
--   2. Update check_for_match trigger to treat 'rev' == 'superlike'
--   3. Update record_swipe RPC to deduct credits for 'rev'
-- =============================================================

-- 1. ── Extend the enum ──────────────────────────────────────────
ALTER TYPE swipe_action_type ADD VALUE IF NOT EXISTS 'rev';


-- 2. ── Update match-detection trigger ──────────────────────────
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
  -- Only react to likes/superlikes/revs
  IF NEW.swipe_action = 'pass' THEN
    RETURN NEW;
  END IF;

  -- Check if the other person already liked/superliked/rev'd us
  SELECT swipe_action INTO v_other_action
  FROM public.swipes
  WHERE swiper_id = NEW.swiped_id
    AND swiped_id = NEW.swiper_id
    AND swipe_action IN ('like', 'superlike', 'rev');

  IF v_other_action IS NULL THEN
    RETURN NEW;
  END IF;

  -- Canonical pair order (smaller UUID = user1)
  v_user1 := LEAST(NEW.swiper_id, NEW.swiped_id);
  v_user2 := GREATEST(NEW.swiper_id, NEW.swiped_id);

  -- user1_superliked / user2_superliked flags cover both 'superlike' and 'rev'
  v_u1_super := (v_user1 = NEW.swiper_id AND NEW.swipe_action   IN ('superlike', 'rev'))
             OR (v_user1 = NEW.swiped_id AND v_other_action     IN ('superlike', 'rev'));
  v_u2_super := (v_user2 = NEW.swiper_id AND NEW.swipe_action   IN ('superlike', 'rev'))
             OR (v_user2 = NEW.swiped_id AND v_other_action     IN ('superlike', 'rev'));

  INSERT INTO public.matches (user1_id, user2_id, user1_superliked, user2_superliked)
  VALUES (v_user1, v_user2, v_u1_super, v_u2_super)
  ON CONFLICT (user1_id, user2_id) DO NOTHING;

  RETURN NEW;
END;
$$;


-- 3. ── Update record_swipe RPC ─────────────────────────────────
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

  -- Check premium status
  SELECT is_premium INTO v_is_premium FROM profiles WHERE id = v_swiper_id;
  v_swipe_limit := CASE WHEN v_is_premium THEN 999999 ELSE 20 END;

  -- Reset daily count if it's a new day
  UPDATE daily_swipe_counts
  SET count = 0, reset_date = CURRENT_DATE
  WHERE user_id = v_swiper_id AND reset_date < CURRENT_DATE;

  -- Ensure row exists
  INSERT INTO daily_swipe_counts (user_id) VALUES (v_swiper_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT count INTO v_today_count FROM daily_swipe_counts WHERE user_id = v_swiper_id;

  IF v_today_count >= v_swipe_limit THEN
    RETURN 'limit_reached';
  END IF;

  -- Rev It / Superlike: check and deduct credits from the shared superlike_credits table
  IF p_swipe_action IN ('superlike', 'rev') THEN
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

  -- Check if match was created by the trigger
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
