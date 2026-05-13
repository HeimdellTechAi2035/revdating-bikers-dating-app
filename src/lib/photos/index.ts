/**
 * lib/photos/index.ts
 *
 * Server-side photo upload and moderation logic for REVdating.
 *
 * Only for use in API routes / server actions — uses the admin client.
 *
 * Public surface:
 *   uploadPhoto(userId, storagePath, publicUrl, options?) → PhotoRow
 *   moderatePhoto(photoId)                                → ModerationOutcome
 *   adminApprovePhoto(photoId, adminId)                   → void
 *   adminRejectPhoto(photoId, adminId, reason?)           → void
 *
 * Moderation guarantee:
 *   Every photo starts as 'pending'. Only 'approved' photos are returned
 *   to public discovery (enforced by RLS + photo query filters).
 *   Admins can override the auto decision via adminApprovePhoto /
 *   adminRejectPhoto regardless of the current status.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { moderateStorageImage } from '@/lib/moderation';
import { signPhotoUrl } from '@/lib/photos/sign';
import type { ModerationStatus, Database } from '@/types/database.types';

type ProfilePhotoUpdate = Database['public']['Tables']['profile_photos']['Update'];

/** Photo classification — stored at application level, not in profile_photos table. */
export type PhotoType = 'profile' | 'bike' | 'verification';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum photos allowed per user (also enforced by DB trigger). */
export const MAX_PHOTOS_PER_USER = 6;

/** Storage bucket name. */
const BUCKET = 'profile-photos';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadPhotoOptions {
  /**
   * 'profile' for a user-facing selfie/portrait, 'bike' for a motorcycle shot.
   * Defaults to 'profile'.
   */
  photo_type?: PhotoType;
  /** Whether this should become the user's primary displayed photo. */
  is_primary?: boolean;
  /** 0-based display order within the user's gallery. */
  sort_order?: number;
}

/** Slim representation returned to callers after upload. */
export interface UploadedPhoto {
  id: string;
  user_id: string;
  storage_path: string;
  /** Signed URL — generated fresh at upload time. Not stored in DB. */
  public_url: string;
  is_primary: boolean;
  moderation_status: ModerationStatus;
  sort_order: number;
  created_at: string;
}

/** Outcome returned by moderatePhoto(). */
export interface ModerationOutcome {
  photo_id: string;
  /** Final status after this call. */
  status: ModerationStatus;
  /** Human-readable rejection reason, if rejected. */
  rejected_reason: string | null;
  /** Which provider ran moderation (or 'none' if credentials are absent). */
  provider: string;
}

// ---------------------------------------------------------------------------
// uploadPhoto
// ---------------------------------------------------------------------------

/**
 * Registers a photo that has already been uploaded to Supabase Storage.
 * The caller (API route) is responsible for uploading the file to storage
 * first and validating that the storage_path is scoped to the owner.
 *
 * Steps:
 *   1. Verify the file exists in storage (prevents spoofed paths).
 *   2. Enforce the per-user photo limit.
 *   3. Clear existing primary flag if is_primary = true.
 *   4. Insert the row with moderation_status = 'pending'.
 *   5. Kick off async moderation (fire-and-forget).
 *
 * @throws {Error} with a user-safe message on validation failure.
 */
export async function uploadPhoto(
  userId: string,
  storagePath: string,
  options: UploadPhotoOptions = {},
): Promise<UploadedPhoto> {
  const {
    photo_type  = 'profile',
    is_primary  = false,
    sort_order  = 0,
  } = options;

  if (!['profile', 'bike', 'verification'].includes(photo_type)) {
    throw new Error(`Invalid photo_type '${photo_type}'. Must be 'profile' or 'bike'.`);
  }

  const admin = createAdminClient();

  // ── 1. Verify the file actually exists in storage ─────────────────────────
  // Prevents a user from registering an arbitrary URL they do not own.
  const folder   = storagePath.substring(0, storagePath.lastIndexOf('/'));
  const fileName = storagePath.split('/').pop() ?? '';

  const { data: storageFiles, error: storageError } = await admin.storage
    .from(BUCKET)
    .list(folder, { search: fileName });

  if (storageError || !storageFiles?.length) {
    throw new Error('File not found in storage. Upload the file to storage before registering.');
  }

  // ── 2. Enforce per-user photo limit ───────────────────────────────────────
  const { count } = await admin
    .from('profile_photos')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if ((count ?? 0) >= MAX_PHOTOS_PER_USER) {
    throw new Error(`Maximum of ${MAX_PHOTOS_PER_USER} photos allowed per account.`);
  }

  // ── 3. Clear existing primary if this one takes over ─────────────────────
  if (is_primary) {
    await admin
      .from('profile_photos')
      .update({ is_primary: false })
      .eq('user_id', userId)
      .eq('is_primary', true);
  }

  // ── 4. Insert with pending status ─────────────────────────────────────────
  const { data: photo, error: insertError } = await admin
    .from('profile_photos')
    // public_url is now nullable (migration 024) — we sign on read, not at upload
    .insert({
      user_id:           userId,
      storage_path:      storagePath,
      public_url:        null as unknown as string,
      is_primary,
      sort_order,
      moderation_status: 'pending',
    })
    .select('id, user_id, storage_path, is_primary, moderation_status, sort_order, created_at')
    .single();

  if (insertError || !photo) {
    throw new Error(`Failed to save photo metadata: ${insertError?.message ?? 'unknown error'}`);
  }

  // ── 5. Fire-and-forget moderation ─────────────────────────────────────────
  // The photo is visible to its owner immediately (they can see pending photos).
  // It becomes publicly visible in discovery only once 'approved'.
  void moderatePhoto(photo.id).catch((err) => {
    console.error(`[photos] Background moderation failed for ${photo.id}:`, err);
  });

  // Generate a fresh signed URL to return to the caller for immediate display
  const signedUrl = await signPhotoUrl(storagePath, 'profile-photos');
  return { ...(photo as any), public_url: signedUrl } as UploadedPhoto;
}

// ---------------------------------------------------------------------------
// moderatePhoto
// ---------------------------------------------------------------------------

/**
 * Runs NSFW moderation on a photo and persists the result.
 *
 * Provider: Sightengine (configurable via SIGHTENGINE_API_USER / SIGHTENGINE_API_SECRET).
 * Falls back to 'pending' (manual review) on provider error.
 * Falls back to 'approved' when credentials are absent (dev/staging without API keys).
 *
 * Safe to call multiple times — re-moderates and updates the stored result.
 *
 * @param photoId UUID of the profile_photos row to moderate.
 * @throws {Error} if the photo does not exist in the database.
 */
export async function moderatePhoto(photoId: string): Promise<ModerationOutcome> {
  const admin = createAdminClient();

  // Load the photo row — we need storage_path to generate a signed URL for the provider
  const { data: photo, error: fetchError } = await admin
    .from('profile_photos')
    .select('id, storage_path, moderation_status')
    .eq('id', photoId)
    .single();

  if (fetchError || !photo) {
    throw new Error(`moderatePhoto: photo '${photoId}' not found — ${fetchError?.message ?? 'unknown error'}`);
  }

  // Generate a short-lived signed URL for the moderation provider
  const signedUrl = await signPhotoUrl((photo as any).storage_path, 'profile-photos');

  // Call the moderation provider (Sightengine or no-op stub)
  let result: Awaited<ReturnType<typeof moderateStorageImage>>;
  try {
    result = await moderateStorageImage(signedUrl);
  } catch (err) {
    console.error(`[photos] Moderation provider error for ${photoId} — leaving pending for manual admin review:`, err);
    return {
      photo_id:        photoId,
      status:          'pending',
      rejected_reason: null,
      provider:        'sightengine',
    };
  }

  // When no moderation provider is configured, leave the photo pending for manual admin review
  if (result.provider === 'none') {
    console.info(`[photos] Photo ${photoId} queued for manual admin review — no moderation provider configured`);
    return {
      photo_id:        photoId,
      status:          'pending',
      rejected_reason: null,
      provider:        'none',
    };
  }

  const newStatus: ModerationStatus = result.approved ? 'approved' : 'rejected';

  // Persist the moderation result
  const updatePayload: ProfilePhotoUpdate = {
    moderation_status:   newStatus,
    moderation_provider: result.provider,
    rejected_reason:     result.rejected_reason ?? null,
  };

  // Store the raw provider response if available (useful for admin audit)
  if (result.response && Object.keys(result.response).length > 0) {
    updatePayload.moderation_response = result.response as import('@/types/database.types').Json;
  }

  // If rejected: photo can no longer be primary
  if (newStatus === 'rejected') {
    updatePayload.is_primary = false;
  }

  const { error: updateError } = await admin
    .from('profile_photos')
    .update(updatePayload)
    .eq('id', photoId);

  if (updateError) {
    throw new Error(`moderatePhoto: failed to persist result — ${updateError.message}`);
  }

  // If a primary photo was just rejected, promote the next approved one
  if (newStatus === 'rejected') {
    await _promoteFallbackPrimary(admin, photoId);
  }

  if (newStatus === 'rejected') {
    console.info(
      `[photos] Photo ${photoId} auto-rejected by ${result.provider}: ${result.rejected_reason}`,
    );
  }

  return {
    photo_id:        photoId,
    status:          newStatus,
    rejected_reason: result.rejected_reason ?? null,
    provider:        result.provider,
  };
}

// ---------------------------------------------------------------------------
// adminApprovePhoto
// ---------------------------------------------------------------------------

/**
 * Manually approves a photo, overriding the auto-moderation result.
 * Records the action in admin_actions for audit trail.
 *
 * @param photoId   UUID of the profile_photos row to approve.
 * @param adminId   UUID of the admin performing the action.
 */
export async function adminApprovePhoto(photoId: string, adminId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: photo, error: fetchError } = await admin
    .from('profile_photos')
    .select('id, user_id, moderation_status')
    .eq('id', photoId)
    .single();

  if (fetchError || !photo) {
    throw new Error(`adminApprovePhoto: photo '${photoId}' not found`);
  }

  // Approve: clear any rejection reason from a previous auto-rejection
  await admin
    .from('profile_photos')
    .update({
      moderation_status:   'approved',
      moderation_provider: 'admin',
      rejected_reason:     null,
    })
    .eq('id', photoId);

  // Audit log
  await admin.from('admin_actions').insert({
    admin_id:       adminId,
    target_user_id: photo.user_id,
    action:         'photo_approved',
    reason:         `Photo ${photoId} manually approved`,
    metadata:       { photo_id: photoId, previous_status: photo.moderation_status },
  });
}

// ---------------------------------------------------------------------------
// adminRejectPhoto
// ---------------------------------------------------------------------------

/**
 * Manually rejects a photo, overriding the auto-moderation result.
 * Strips its primary flag and promotes a fallback if needed.
 * Records the action in admin_actions for audit trail.
 *
 * The photo row is kept in the DB (not deleted) so the admin can re-review.
 * Storage deletion should be done separately via the DELETE route if desired.
 *
 * @param photoId   UUID of the profile_photos row to reject.
 * @param adminId   UUID of the admin performing the action.
 * @param reason    Optional human-readable rejection reason shown to the user.
 */
export async function adminRejectPhoto(
  photoId: string,
  adminId: string,
  reason?: string,
): Promise<void> {
  const admin = createAdminClient();

  const { data: photo, error: fetchError } = await admin
    .from('profile_photos')
    .select('id, user_id, is_primary, moderation_status')
    .eq('id', photoId)
    .single();

  if (fetchError || !photo) {
    throw new Error(`adminRejectPhoto: photo '${photoId}' not found`);
  }

  const rejectedReason = reason?.trim() || 'Rejected by moderator';

  // Reject: strip primary flag so a rejected photo can never be shown
  await admin
    .from('profile_photos')
    .update({
      moderation_status:   'rejected',
      moderation_provider: 'admin',
      rejected_reason:     rejectedReason,
      is_primary:          false,
    })
    .eq('id', photoId);

  // If this was the user's primary photo, promote the next approved one
  if (photo.is_primary) {
    await _promoteFallbackPrimary(admin, photoId);
  }

  // Audit log
  await admin.from('admin_actions').insert({
    admin_id:       adminId,
    target_user_id: photo.user_id,
    action:         'photo_rejected',
    reason:         rejectedReason,
    metadata:       { photo_id: photoId, previous_status: photo.moderation_status },
  });
}

// ---------------------------------------------------------------------------
// Internal helper: promote next approved photo to primary
// ---------------------------------------------------------------------------

/**
 * After a primary photo is rejected, promote the next oldest approved photo
 * (by sort_order) to primary so the user's profile still shows a photo.
 */
async function _promoteFallbackPrimary(
  admin: ReturnType<typeof createAdminClient>,
  rejectedPhotoId: string,
): Promise<void> {
  // Find the user_id of the rejected photo
  const { data: rejected } = await admin
    .from('profile_photos')
    .select('user_id, is_primary')
    .eq('id', rejectedPhotoId)
    .single();

  // Only promote if the rejected photo was the primary
  if (!rejected?.is_primary) return;

  const { data: next } = await admin
    .from('profile_photos')
    .select('id')
    .eq('user_id', rejected.user_id)
    .eq('moderation_status', 'approved')
    .neq('id', rejectedPhotoId)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (next) {
    await admin
      .from('profile_photos')
      .update({ is_primary: true })
      .eq('id', next.id);
  }
}
