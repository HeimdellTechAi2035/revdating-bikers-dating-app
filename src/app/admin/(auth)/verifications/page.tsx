'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { ShieldCheck, ShieldX, Clock, FileImage, User2 } from 'lucide-react';
import toast from 'react-hot-toast';

type VerifStatus = 'pending' | 'approved' | 'rejected';
type VerifType   = 'face_selfie' | 'id_document' | 'phone' | 'social_link';

type Verification = {
  id:               string;
  verification_type: VerifType;
  status:           VerifStatus;
  selfie_url:       string | null;
  document_url:     string | null;
  admin_notes:      string | null;
  reviewed_at:      string | null;
  created_at:       string;
  user: { id: string; display_name: string; is_verified: boolean } | null;
};

const STATUS_TABS: VerifStatus[] = ['pending', 'approved', 'rejected'];

const TYPE_LABELS: Record<VerifType, string> = {
  face_selfie:  'Selfie',
  id_document:  'ID Document',
  phone:        'Phone',
  social_link:  'Social Link',
};

const TYPE_FILTERS = [
  ['all',         'All types'],
  ['face_selfie', 'Selfie'],
  ['id_document', 'ID Document'],
] as const;

export default function AdminVerificationsPage() {
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [count, setCount]   = useState(0);
  const [status, setStatus] = useState<VerifStatus>('pending');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [page, setPage]     = useState(1);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [notes, setNotes]   = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/verifications?status=${status}&type=${typeFilter}&page=${page}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) {
          toast.error(d.error ?? `Failed to load verifications (${r.status})`);
          return;
        }
        setVerifications(d.verifications ?? []);
        setCount(d.count ?? 0);
      })
      .catch(() => toast.error('Network error loading verifications'))
      .finally(() => setLoading(false));
  }, [status, typeFilter, page]);

  useEffect(() => { load(); }, [load]);

  async function doAction(id: string, action: 'approved' | 'rejected') {
    setPending(p => ({ ...p, [id]: true }));
    try {
      const res = await fetch('/api/admin/verifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verification_id: id,
          action,
          admin_notes: notes[id] || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? `Failed (${res.status})`);
      } else {
        toast.success(action === 'approved' ? 'Verification approved — user badge granted' : 'Verification rejected');
        load();
      }
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setPending(p => ({ ...p, [id]: false }));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Verifications</h1>
        <span className="text-sm text-brand-chrome">{count} total</span>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map(s => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-sm capitalize transition-colors ${
              status === s
                ? 'bg-brand-orange text-white'
                : 'bg-brand-dark-3 text-brand-chrome hover:text-white'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Type filter */}
      <div className="flex gap-2 flex-wrap">
        {TYPE_FILTERS.map(([val, label]) => (
          <button
            key={val}
            onClick={() => { setTypeFilter(val); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors border ${
              typeFilter === val
                ? 'bg-brand-dark-4 text-white border-brand-orange/40'
                : 'bg-brand-dark-3 text-brand-chrome hover:text-white border-transparent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-brand-chrome py-16 text-center">Loading…</div>
      ) : (
        <div className="space-y-4">
          {verifications.map(v => (
            <div
              key={v.id}
              className="p-5 rounded-2xl bg-brand-dark-3 border border-brand-dark-4 space-y-4"
            >
              {/* Header */}
              <div className="flex items-start gap-4">
                {/* Image preview */}
                <div className="shrink-0 w-24 h-24 rounded-xl overflow-hidden bg-brand-dark-4 flex items-center justify-center relative">
                  {(v.selfie_url || v.document_url) ? (
                    <Image
                      src={v.selfie_url ?? v.document_url!}
                      alt="Verification image"
                      fill
                      className="object-cover"
                      sizes="96px"
                      unoptimized
                    />
                  ) : (
                    <FileImage size={28} className="text-brand-chrome/30" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    {/* Type badge */}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-brand-orange/10 text-brand-orange border border-brand-orange/20">
                      {TYPE_LABELS[v.verification_type] ?? v.verification_type}
                    </span>
                    {/* Status badge */}
                    <span className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                      v.status === 'pending'  ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                      v.status === 'approved' ? 'bg-green-500/10  text-green-400  border-green-500/20'  :
                                                'bg-red-500/10    text-red-400    border-red-500/20'
                    }`}>
                      {v.status === 'pending'  && <Clock size={10} />}
                      {v.status === 'approved' && <ShieldCheck size={10} />}
                      {v.status === 'rejected' && <ShieldX size={10} />}
                      {v.status}
                    </span>
                    {/* Already verified badge */}
                    {v.user?.is_verified && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        Profile verified
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <User2 size={13} className="text-brand-chrome/50" />
                    <span className="font-medium">{v.user?.display_name ?? 'Unknown user'}</span>
                    <span className="text-brand-chrome/40 text-xs">{v.user?.id?.slice(0, 8)}…</span>
                  </div>

                  <p className="text-xs text-brand-chrome/50 mt-1">
                    Submitted {new Date(v.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>

                  {v.admin_notes && v.status !== 'pending' && (
                    <p className="text-xs bg-brand-dark-4 rounded-lg px-3 py-1.5 mt-2">
                      <span className="font-medium text-white">Notes:</span>{' '}
                      <span className="text-brand-chrome">{v.admin_notes}</span>
                    </p>
                  )}

                  {v.reviewed_at && (
                    <p className="text-xs text-brand-chrome/40 mt-1">
                      Reviewed {new Date(v.reviewed_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </p>
                  )}
                </div>

                {/* Full-size image link */}
                {(v.selfie_url || v.document_url) && (
                  <a
                    href={v.selfie_url ?? v.document_url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs text-brand-orange hover:underline"
                  >
                    Full size ↗
                  </a>
                )}
              </div>

              {/* Action panel */}
              {v.status === 'pending' && (
                <div className="space-y-2 border-t border-brand-dark-4 pt-4">
                  <input
                    value={notes[v.id] ?? ''}
                    onChange={e => setNotes(n => ({ ...n, [v.id]: e.target.value }))}
                    placeholder="Admin notes (optional — shown to user on rejection)"
                    className="w-full bg-brand-dark-4 border border-brand-dark-4 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-orange/60 placeholder:text-brand-chrome"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => doAction(v.id, 'approved')}
                      disabled={pending[v.id]}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-500/10 text-green-400 text-sm hover:bg-green-500/20 disabled:opacity-50 transition-colors"
                    >
                      <ShieldCheck size={14} /> Approve
                    </button>
                    <button
                      onClick={() => doAction(v.id, 'rejected')}
                      disabled={pending[v.id]}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/10 text-red-400 text-sm hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                    >
                      <ShieldX size={14} /> Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {verifications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
              <ShieldCheck size={40} className="text-brand-chrome/20" />
              <p className="text-brand-chrome">No {status} verifications</p>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      <div className="flex gap-3 items-center pt-2">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-4 py-2 rounded-xl bg-brand-dark-3 text-sm disabled:opacity-40 hover:bg-brand-dark-4 transition-colors"
        >
          Previous
        </button>
        <span className="text-sm text-brand-chrome">Page {page}</span>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={verifications.length < 20}
          className="px-4 py-2 rounded-xl bg-brand-dark-3 text-sm disabled:opacity-40 hover:bg-brand-dark-4 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
