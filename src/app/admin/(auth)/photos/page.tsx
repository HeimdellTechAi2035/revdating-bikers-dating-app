'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { CheckCircle, XCircle, Trash2, RefreshCw, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

type Photo = {
  id: string;
  user_id: string;
  public_url: string;
  storage_path: string;
  moderation_status: 'pending' | 'approved' | 'rejected';
  moderation_provider: string | null;
  rejected_reason: string | null;
  is_primary: boolean;
  created_at: string;
  profiles: { display_name: string; is_banned: boolean } | null;
};

type Tab = 'pending' | 'approved' | 'rejected';

const TAB_LABELS: Record<Tab, string> = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
};

export default function AdminPhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [count, setCount] = useState(0);
  const [tab, setTab] = useState<Tab>('pending');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/photos?status=${tab}&page=${page}`)
      .then((r) => r.json())
      .then((d) => {
        setPhotos(d.photos ?? []);
        setCount(d.count ?? 0);
      })
      .finally(() => setLoading(false));
  }, [tab, page]);

  useEffect(() => { load(); }, [load]);

  // Reset to page 1 when tab changes
  useEffect(() => { setPage(1); }, [tab]);

  async function patchPhoto(photoId: string, action: 'approved' | 'rejected', reason?: string) {
    setBusy((b) => ({ ...b, [photoId]: true }));
    try {
      const res = await fetch('/api/admin/photos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_id: photoId, action, reason }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error ?? `Failed (${res.status})`);
      } else {
        toast.success(action === 'approved' ? 'Photo approved' : 'Photo rejected');
        load();
      }
    } catch {
      toast.error('Network error');
    } finally {
      setBusy((b) => ({ ...b, [photoId]: false }));
    }
  }

  async function deletePhoto(photoId: string) {
    if (!confirm('Permanently delete this photo from storage?')) return;
    setBusy((b) => ({ ...b, [photoId]: true }));
    try {
      const res = await fetch(`/api/admin/photos?id=${photoId}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error ?? `Failed (${res.status})`);
      } else {
        toast.success('Photo deleted');
        load();
      }
    } catch {
      toast.error('Network error');
    } finally {
      setBusy((b) => ({ ...b, [photoId]: false }));
    }
  }

  const totalPages = Math.ceil(count / 20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Photo Moderation</h1>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-dark-3 text-brand-chrome text-sm hover:bg-brand-dark-4 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-brand-orange text-white'
                : 'bg-brand-dark-3 text-brand-chrome hover:bg-brand-dark-4'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 text-sm text-brand-chrome">
        {tab === 'pending' && <Clock className="w-4 h-4 text-yellow-400" />}
        {tab === 'approved' && <CheckCircle className="w-4 h-4 text-green-400" />}
        {tab === 'rejected' && <XCircle className="w-4 h-4 text-red-400" />}
        {count} {tab} photo{count !== 1 ? 's' : ''}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-brand-orange border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="rounded-2xl bg-brand-dark-3 border border-brand-dark-4 overflow-hidden flex flex-col"
            >
              {/* Photo */}
              <div className="relative aspect-square">
                <Image
                  src={photo.public_url}
                  alt="User photo"
                  fill
                  className={`object-cover ${photo.moderation_status === 'rejected' ? 'grayscale opacity-60' : ''}`}
                  sizes="(max-width: 640px) 50vw, 25vw"
                  unoptimized
                />
                {photo.is_primary && (
                  <div className="absolute top-2 left-2 bg-brand-orange text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Primary
                  </div>
                )}
              </div>

              {/* Meta */}
              <div className="p-3 space-y-2 flex-1 flex flex-col">
                <div className="text-sm font-medium truncate">
                  {photo.profiles?.display_name ?? 'Unknown user'}
                  {photo.profiles?.is_banned && (
                    <span className="ml-1.5 text-[10px] text-red-400 font-normal">(banned)</span>
                  )}
                </div>
                <div className="text-xs text-brand-chrome-dark">
                  {new Date(photo.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                  {photo.moderation_provider && (
                    <span className="ml-2 text-brand-chrome-dark">· {photo.moderation_provider}</span>
                  )}
                </div>

                {/* Rejection reason (read-only for approved/rejected tabs) */}
                {photo.rejected_reason && tab !== 'pending' && (
                  <div className="flex items-start gap-1.5 bg-red-500/10 rounded-lg px-2 py-1.5">
                    <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-red-300 leading-relaxed">{photo.rejected_reason}</p>
                  </div>
                )}

                <div className="flex-1" />

                {/* Actions — Pending */}
                {tab === 'pending' && (
                  <div className="space-y-1.5">
                    <input
                      value={reasons[photo.id] ?? ''}
                      onChange={(e) => setReasons((r) => ({ ...r, [photo.id]: e.target.value }))}
                      placeholder="Rejection reason (optional)"
                      className="w-full text-xs bg-brand-dark-4 rounded-lg px-2 py-1.5 focus:outline-none border border-brand-dark-4 focus:border-brand-orange text-white placeholder:text-brand-chrome-dark"
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => patchPhoto(photo.id, 'approved')}
                        disabled={busy[photo.id]}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-xs font-semibold hover:bg-green-500/20 disabled:opacity-50 transition-colors"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Approve
                      </button>
                      <button
                        onClick={() => patchPhoto(photo.id, 'rejected', reasons[photo.id])}
                        disabled={busy[photo.id]}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-semibold hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                      >
                        <XCircle className="w-3 h-3" />
                        Reject
                      </button>
                    </div>
                  </div>
                )}

                {/* Actions — Rejected (can re-approve or hard-delete) */}
                {tab === 'rejected' && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => patchPhoto(photo.id, 'approved')}
                      disabled={busy[photo.id]}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-xs font-semibold hover:bg-green-500/20 disabled:opacity-50 transition-colors"
                    >
                      <CheckCircle className="w-3 h-3" />
                      Re-approve
                    </button>
                    <button
                      onClick={() => deletePhoto(photo.id)}
                      disabled={busy[photo.id]}
                      className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-semibold hover:bg-red-500/30 disabled:opacity-50 transition-colors"
                      title="Hard delete from storage"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Actions — Approved (can reject or hard-delete) */}
                {tab === 'approved' && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => patchPhoto(photo.id, 'rejected', 'Revoked by admin')}
                      disabled={busy[photo.id]}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-semibold hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                    >
                      <XCircle className="w-3 h-3" />
                      Revoke
                    </button>
                    <button
                      onClick={() => deletePhoto(photo.id)}
                      disabled={busy[photo.id]}
                      className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-semibold hover:bg-red-500/30 disabled:opacity-50 transition-colors"
                      title="Hard delete from storage"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {photos.length === 0 && !loading && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-brand-chrome gap-3">
              {tab === 'pending' && <Clock className="w-10 h-10 opacity-40" />}
              {tab === 'approved' && <CheckCircle className="w-10 h-10 opacity-40" />}
              {tab === 'rejected' && <XCircle className="w-10 h-10 opacity-40" />}
              <p className="text-sm">No {tab} photos</p>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="px-4 py-2 rounded-xl bg-brand-dark-3 text-sm disabled:opacity-40 hover:bg-brand-dark-4 transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-brand-chrome">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages || loading}
            className="px-4 py-2 rounded-xl bg-brand-dark-3 text-sm disabled:opacity-40 hover:bg-brand-dark-4 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

