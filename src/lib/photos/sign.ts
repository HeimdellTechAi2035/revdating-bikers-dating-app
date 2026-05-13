import { createAdminClient } from '@/lib/supabase/admin';

/** Signed URL TTL — 1 hour. Components re-mount (page navigation) before expiry. */
const TTL = 3600;

/**
 * Takes an array of photo rows that have a `storage_path` (and optionally a
 * `public_url` fallback), generates a batch of signed URLs, and returns the
 * rows with `public_url` populated.
 *
 * Fallback behaviour: if a storage path has no matching object (e.g. seed
 * profiles that point to external images), the original `public_url` from the
 * row is kept so those images continue to load.
 *
 * Safe to call with an empty array (returns [] immediately).
 */
export async function signPhotoUrls<T extends { storage_path: string; public_url?: string | null }>(
  items: T[],
  bucket: 'profile-photos' | 'bike-photos',
): Promise<(T & { public_url: string })[]> {
  if (!items.length) return [];
  const admin = createAdminClient();
  const { data } = await admin.storage
    .from(bucket)
    .createSignedUrls(items.map((i) => i.storage_path), TTL);
  const signedMap = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return items.map((i) => {
    const signed = signedMap.get(i.storage_path);
    // Use the signed URL if available; fall back to any stored external URL
    const url = (signed && signed !== '') ? signed : (i.public_url ?? '');
    return { ...i, public_url: url };
  });
}

/**
 * Generates a single signed URL for one storage path.
 * Returns an empty string on failure so callers don't have to null-check.
 */
export async function signPhotoUrl(
  storagePath: string,
  bucket: 'profile-photos' | 'bike-photos',
): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin.storage.from(bucket).createSignedUrl(storagePath, TTL);
  return data?.signedUrl ?? '';
}
