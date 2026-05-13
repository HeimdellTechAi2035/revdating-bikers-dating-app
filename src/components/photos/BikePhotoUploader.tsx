'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { Camera, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { validateImageFile } from '@/lib/utils';

type Props = {
  userId: string;
  bikeId: string;
  initialPhotoUrl?: string | null;
  /** Called with the new URL after a successful upload, or null after deletion */
  onChange?: (url: string | null) => void;
};

/**
 * Single-photo uploader for a bike record.
 * Uploads directly to the 'bike-photos' Supabase Storage bucket,
 * then calls POST /api/photos/bikes to update the bikes.photo_url column.
 * No content moderation — bike photos are not shown in discovery.
 */
export function BikePhotoUploader({ userId, bikeId, initialPhotoUrl, onChange }: Props) {
  const supabase = createClient();
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialPhotoUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    const check = validateImageFile(file);
    if (!check.valid) {
      toast.error(check.error ?? 'Invalid file');
      return;
    }

    setUploading(true);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const timestamp = Date.now();
      const random = Math.random().toString(36).slice(2, 6);
      // Path: {userId}/{bikeId}/{timestamp}-{random}.{ext}
      const storagePath = `${userId}/${bikeId}/${timestamp}-${random}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('bike-photos')
        .upload(storagePath, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        toast.error(`Upload failed: ${uploadError.message}`);
        return;
      }

      const res = await fetch('/api/photos/bikes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bike_id: bikeId, storage_path: storagePath }),
      });

      if (!res.ok) {
        // Roll back storage upload if the API call failed
        await supabase.storage.from('bike-photos').remove([storagePath]);
        const err = await res.json().catch(() => ({}));
        toast.error((err as { error?: string }).error ?? 'Failed to save bike photo');
        return;
      }

      const { signed_url } = await res.json() as { signed_url: string };
      setPhotoUrl(signed_url);
      onChange?.(signed_url);
      toast.success('Bike photo updated');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);

    const res = await fetch(`/api/photos/bikes?bike_id=${bikeId}`, { method: 'DELETE' });
    setDeleting(false);

    if (!res.ok) {
      toast.error('Failed to remove bike photo');
      return;
    }

    setPhotoUrl(null);
    onChange?.(null);
    toast.success('Bike photo removed');
  }

  const isBusy = uploading || deleting;

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-brand-dark-3 border border-brand-dark-4 group">
      {photoUrl ? (
        <>
          <Image
            src={photoUrl}
            alt="Bike photo"
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 50vw"
            unoptimized
          />

          {/* Hover overlay with change / remove actions */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
            <label
              className={`relative flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-orange text-white text-sm font-semibold cursor-pointer hover:bg-brand-orange-dark transition-colors overflow-hidden ${isBusy ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <Camera className="w-4 h-4 pointer-events-none" />
              <span className="pointer-events-none">{uploading ? 'Uploading…' : 'Change photo'}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isBusy}
                onChange={handleFileChange}
              />
            </label>

            <button
              onClick={handleDelete}
              disabled={isBusy}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 text-red-400 text-sm font-semibold hover:bg-red-500/30 disabled:opacity-50 transition-colors"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
              {deleting ? 'Removing…' : 'Remove'}
            </button>
          </div>
        </>
      ) : (
        /* Empty state — click to upload */
        <label
          className={`relative flex flex-col items-center justify-center w-full h-full cursor-pointer transition-colors overflow-hidden ${isBusy ? 'cursor-not-allowed' : 'hover:bg-brand-dark-4'}`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2 pointer-events-none">
              <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
              <span className="text-sm text-brand-chrome">Uploading…</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 pointer-events-none">
              <Camera className="w-8 h-8 text-brand-chrome" />
              <span className="text-sm text-brand-chrome">Add bike photo</span>
              <span className="text-xs text-brand-chrome-dark">Tap to choose from gallery</span>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            disabled={isBusy}
            onChange={handleFileChange}
          />
        </label>
      )}
    </div>
  );
}
