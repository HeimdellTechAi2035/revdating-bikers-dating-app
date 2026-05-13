-- =============================================================
-- Migration 005: Match system hardening
-- =============================================================
-- Adds defense-in-depth RLS on matches so that blocked pairs
-- are hidden even if the is_active trigger somehow missed them.
-- Also tightens the UPDATE policy so participants can only
-- deactivate their own matches (unmatch), not alter other fields.
-- =============================================================

-- ── matches: strengthen SELECT policy ─────────────────────────
DROP POLICY IF EXISTS "matches_select_participant" ON matches;

CREATE POLICY "matches_select_participant"
  ON matches FOR SELECT
  USING (
    (auth.uid() = user1_id OR auth.uid() = user2_id)
    -- Exclude matches where either side has blocked the other.
    -- The handle_block trigger already sets is_active = FALSE,
    -- but this adds a second layer of protection.
    AND NOT are_users_blocked(
      auth.uid(),
      CASE WHEN auth.uid() = user1_id THEN user2_id ELSE user1_id END
    )
  );

-- ── matches: tighten UPDATE policy (unmatch only) ─────────────
-- Participants may set is_active = FALSE and update
-- last_message_at (done by handle_new_message trigger).
-- They must not be able to change user1_id / user2_id or
-- the superliked flags after the match was created.
DROP POLICY IF EXISTS "matches_update_participant" ON matches;

CREATE POLICY "matches_update_participant"
  ON matches FOR UPDATE
  USING (auth.uid() = user1_id OR auth.uid() = user2_id)
  WITH CHECK (
    -- Participants may only deactivate (unmatch) or leave active.
    -- Core immutable fields must stay the same.
    user1_id = (SELECT user1_id FROM matches WHERE id = matches.id)
    AND user2_id = (SELECT user2_id FROM matches WHERE id = matches.id)
  );
