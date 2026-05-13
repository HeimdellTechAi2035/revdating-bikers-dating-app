-- =============================================================
-- Migration 023: Security Fixes
-- 1. Restrict storage bucket SELECT policies to authenticated users only
-- =============================================================

-- profile-photos: drop unauthenticated read, replace with authenticated-only
DROP POLICY IF EXISTS "profile_photos_public_read" ON storage.objects;

CREATE POLICY "profile_photos_authenticated_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'profile-photos' AND auth.uid() IS NOT NULL);

-- bike-photos: same fix
DROP POLICY IF EXISTS "bike_photos_public_read" ON storage.objects;

CREATE POLICY "bike_photos_authenticated_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'bike-photos' AND auth.uid() IS NOT NULL);
