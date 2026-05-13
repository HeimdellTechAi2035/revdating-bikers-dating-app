-- Engine Revs: public appreciation feature (one rev per giver-receiver pair, toggleable)

CREATE TABLE engine_revs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  giver_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (giver_id, receiver_id),
  CHECK  (giver_id != receiver_id)
);

CREATE INDEX idx_engine_revs_receiver_id ON engine_revs (receiver_id);

-- RLS
ALTER TABLE engine_revs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "engine_revs_select" ON engine_revs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "engine_revs_insert" ON engine_revs
  FOR INSERT TO authenticated WITH CHECK (giver_id = auth.uid());

CREATE POLICY "engine_revs_delete" ON engine_revs
  FOR DELETE TO authenticated USING (giver_id = auth.uid());

-- Aggregate view: per-user rev counts
CREATE OR REPLACE VIEW profile_rev_counts AS
  SELECT receiver_id AS user_id, COUNT(*) AS rev_count
  FROM   engine_revs
  GROUP  BY receiver_id;

GRANT SELECT ON profile_rev_counts TO authenticated;
