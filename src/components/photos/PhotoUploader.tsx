'use client';

import { useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Upload, X, Star, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { validateImageFile, generateStorageFileName } from '@/lib/utils';
import type { ModerationStatus } from '@/types';

// ── Types ─────────────────────────────────────────────────────

export type PhotoRecord = {
  id: string;
  public_url: string;
  storage_path: string;
  is_primary: boolean;
  moderation_status: ModerationStatus;
  rejected_reason: string | null;
  sort_order: number;
};

type Props = {
  userId: string;
  initialPhotos?: PhotoRecord[];
  /** Called after any mutation so the parent can refresh its own state */
  onChange?: (photos: PhotoRecord[]) => void;
  /** Maximum simultaneous uploads (capped to keep UI snappy) */
  maxPhotos?: number;
};

// ── Status badge ──────────────────────────────────────────────

function StatusBadge({ status }: { status: ModerationStatus }) {
  if (status === 'approved') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-green-400 bg-green-400/10 rounded-full px-2 py-0.5">
        <CheckCircle className="w-2.5 h-2.5" /> Approved
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-red-400 bg-red-400/10 rounded-full px-2 py-0.5">
        <XCircle className="w-2.5 h-2.5" /> Rejected
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold text-yellow-400 bg-yellow-400/10 rounded-full px-2 py-0.5">
      <Clock className="w-2.5 h-2.5" /> Pending
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────

export function PhotoUploader({ userId, initialPhotos = [], onChange, maxPhotos = 6 }: Props) {
  const supabase = createClient();
  const [photos, setPhotos] = useState<PhotoRecord[]>(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function notify(next: PhotoRecord[]) {
    setPhotos(next);
    onChange?.(next);
  }

  // ── Upload ────────────────────────────────────────────────────

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      // Reset input so the same file can be re-selected after a delete
      if (fileInputRef.current) fileInputRef.current.value = '';

      if (!files.length) return;

      const available = maxPhotos - photos.length;
      if (available <= 0) {
        toast.error(`Maximum of ${maxPhotos} photos allowed`);
        return;
      }

      // Validate every selected file up-front
      const valid: File[] = [];
      for (const file of files.slice(0, available)) {
        const check = validateImageFile(file);
        if (!check.valid) {
          toast.error(check.error ?? 'Invalid file');
        } else {
          valid.push(file);
        }
      }
      if (!valid.length) return;

      setUploading(true);
      const uploaded: PhotoRecord[] = [];

      for (let i = 0; i < valid.length; i++) {
        const file = valid[i];
        const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
        const storagePath = generateStorageFileName(userId, ext);

        // 1. Upload binary to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('profile-photos')
          .upload(storagePath, file, { contentType: file.type, upsert: false });

        if (uploadError) {
          toast.error(`Failed to upload photo ${i + 1}: ${uploadError.message}`);
          continue;
        }

        const isFirst = photos.length === 0 && i === 0;

        // 2. Register metadata + trigger async moderation (server generates signed URL)
        const res = await fetch('/api/photos/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storage_path: storagePath,
            is_primary: isFirst,
            sort_order: photos.length + i,
          }),
        });

        if (!res.ok) {
          // Roll back storage upload if metadata save failed
          await supabase.storage.from('profile-photos').remove([storagePath]);
          const err = await res.json().catch(() => ({}));
          toast.error((err as { error?: string }).error ?? 'Failed to save photo');
          continue;
        }

        const { photo } = await res.json() as { photo: PhotoRecord };
        uploaded.push(photo);
      }

      if (uploaded.length) {
        const next = [...photos, ...uploaded];
        notify(next);
        toast.success(
          uploaded.length === 1
            ? 'Photo uploaded — under review'
            : `${uploaded.length} photos uploaded — under review`,
        );
      }

      setUploading(false);
    },
    [photos, userId, maxPhotos, supabase],
  );

  // ── Set primary ───────────────────────────────────────────────

  async function handleSetPrimary(photoId: string) {
    if (primaryId === photoId) return;
    setPrimaryId(photoId);

    const res = await fetch('/api/photos/upload', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo_id: photoId }),
    });

    setPrimaryId(null);

    if (!res.ok) {
      toast.error('Failed to set primary photo');
      return;
    }

    notify(photos.map((p) => ({ ...p, is_primary: p.id === photoId })));
  }

  // ── Delete ────────────────────────────────────────────────────

  async function handleDelete(photoId: string) {
    setDeletingId(photoId);

    const res = await fetch(`/api/photos/upload?id=${photoId}`, { method: 'DELETE' });
    setDeletingId(null);

    if (!res.ok) {
      toast.error('Failed to delete photo');
      return;
    }

    const next = photos.filter((p) => p.id !== photoId);
    // If the deleted one was primary, the API promotes the next approved photo automatically.
    // Reflect that locally by flagging the first approved item.
    const deletedPhoto = photos.find((p) => p.id === photoId);
    if (deletedPhoto?.is_primary) {
      const firstApproved = next.find((p) => p.moderation_status === 'approved');
      if (firstApproved) firstApproved.is_primary = true;
    }
    notify(next);
    toast.success('Photo deleted');
  }

  // ── Render ────────────────────────────────────────────────────

  const canUploadMore = photos.length < maxPhotos;

  return (
    <div className="space-y-4">
      {/* Grid of existing photos */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="relative group rounded-2xl overflow-hidden bg-brand-dark-3 border border-brand-dark-4 aspect-square"
            >
              <Image
                src={photo.public_url}
                alt="Profile photo"
                fill
                className={`object-cover transition-opacity ${
                  photo.moderation_status === 'rejected' ? 'opacity-40 grayscale' : ''
                }`}
                sizes="(max-width: 640px) 33vw, 25vw"
                unoptimized
              />

              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                {photo.moderation_status === 'approved' && !photo.is_primary && (
                  <button
                    onClick={() => handleSetPrimary(photo.id)}
                    disabled={primaryId === photo.id}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-orange text-white text-xs font-semibold hover:bg-brand-orange-dark disabled:opacity-50 transition-colors"
                  >
                    <Star className="w-3 h-3" />
                    Set primary
                  </button>
                )}
                <button
                  onClick={() => handleDelete(photo.id)}
                  disabled={deletingId === photo.id}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/30 disabled:opacity-50 transition-colors"
                >
                  <X className="w-3 h-3" />
                  {deletingId === photo.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>

              {/* Primary star badge */}
              {photo.is_primary && (
                <div className="absolute top-2 left-2">
                  <span className="flex items-center gap-1 text-[10px] font-bold text-brand-orange bg-black/70 rounded-full px-2 py-0.5">
                    <Star className="w-2.5 h-2.5 fill-current" /> Primary
                  </span>
                </div>
              )}

              {/* Moderation status badge */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <StatusBadge status={photo.moderation_status} />
              </div>

              {/* Rejected reason tooltip */}
              {photo.moderation_status === 'rejected' && (
                <div className="absolute top-2 right-2">
                  <span title={photo.rejected_reason ?? 'Photo rejected'}>
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Moderation info banner */}
      {photos.some((p) => p.moderation_status === 'pending') && (
        <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3">
          <Clock className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-yellow-300 text-xs leading-relaxed">
            Photos are reviewed before appearing in discovery. This usually takes a few minutes.
          </p>
        </div>
      )}

      {photos.some((p) => p.moderation_status === 'rejected') && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-300 text-xs leading-relaxed">
            One or more photos were rejected. Hover over the red icon to see why, then upload a replacement.
          </p>
        </div>
      )}

      {/* Upload button */}
      {canUploadMore && (
        <label
          className={`relative flex flex-col items-center justify-center gap-3 w-full rounded-2xl border-2 border-dashed cursor-pointer transition-colors overflow-hidden
            ${uploading
              ? 'border-brand-dark-4 bg-brand-dark-3 cursor-not-allowed'
              : 'border-brand-dark-4 bg-brand-dark-3 hover:border-brand-orange hover:bg-brand-orange/5'
            }`}
          style={{ minHeight: '120px' }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            disabled={uploading}
            onChange={handleFileChange}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2 py-6">
              <div className="w-6 h-6 border-2 border-brand-orange border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-brand-chrome">Uploading…</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-6">
              <Upload className="w-7 h-7 text-brand-chrome" />
              <div className="text-center">
                <p className="text-sm font-medium text-white">Upload photos</p>
                <p className="text-xs text-brand-chrome mt-0.5">
                  JPEG, PNG or WebP · max 5 MB each · {photos.length}/{maxPhotos} used
                </p>
              </div>
            </div>
          )}
        </label>
      )}

      {!canUploadMore && (
        <p className="text-center text-xs text-brand-chrome py-2">
          Maximum of {maxPhotos} photos reached. Delete one to add another.
        </p>
      )}
    </div>
  );
}
