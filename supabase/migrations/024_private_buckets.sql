-- =============================================================
-- Migration 024: Private Storage Buckets
-- Photo URLs are now generated as signed URLs at serve-time;
-- the public_url column is no longer written to.
-- =============================================================

-- 1. Make photo buckets private so CDN URLs stop working
UPDATE storage.buckets
SET public = false
WHERE id IN ('profile-photos', 'bike-photos');

-- 2. Allow public_url to be NULL (new uploads don't write to this column)
ALTER TABLE profile_photos
  ALTER COLUMN public_url DROP NOT NULL;

-- 3. Clear stale permanent public URLs from existing rows
--    (they will no longer resolve now that buckets are private)
UPDATE profile_photos SET public_url = NULL;
