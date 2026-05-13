-- Rate My Ride: 1–5 star ratings on bike photos

CREATE TABLE ride_ratings (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id    uuid        NOT NULL REFERENCES profile_photos(id) ON DELETE CASCADE,
  rater_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stars       integer     NOT NULL CHECK (stars BETWEEN 1 AND 5),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (photo_id, rater_id)
);

CREATE INDEX idx_ride_ratings_photo_id ON ride_ratings (photo_id);

CREATE TRIGGER set_ride_ratings_updated_at
  BEFORE UPDATE ON ride_ratings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Prevent rating your own photos
CREATE OR REPLACE FUNCTION prevent_self_ride_rating()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  photo_owner_id uuid;
BEGIN
  SELECT user_id INTO photo_owner_id FROM profile_photos WHERE id = NEW.photo_id;
  IF photo_owner_id = NEW.rater_id THEN
    RAISE EXCEPTION 'Cannot rate your own photos';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER no_self_ride_rating
  BEFORE INSERT OR UPDATE ON ride_ratings
  FOR EACH ROW EXECUTE FUNCTION prevent_self_ride_rating();

ALTER TABLE ride_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ride_ratings_select" ON ride_ratings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ride_ratings_insert" ON ride_ratings
  FOR INSERT TO authenticated WITH CHECK (rater_id = auth.uid());

CREATE POLICY "ride_ratings_update" ON ride_ratings
  FOR UPDATE TO authenticated USING (rater_id = auth.uid());

CREATE POLICY "ride_ratings_delete" ON ride_ratings
  FOR DELETE TO authenticated USING (rater_id = auth.uid());

-- Publicly visible average per photo
CREATE OR REPLACE VIEW photo_rating_summaries AS
  SELECT
    photo_id,
    ROUND(AVG(stars)::numeric, 2) AS avg_stars,
    COUNT(*)                       AS rating_count
  FROM ride_ratings
  GROUP BY photo_id;

GRANT SELECT ON photo_rating_summaries TO authenticated;
