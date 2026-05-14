'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { AIReportModerationSummary } from '@/components/admin/AIReportModerationSummary';

type ReportStatus = 'pending' | 'reviewed' | 'actioned' | 'dismissed';

type Report = {
  id: string;
  reason: string;
  description: string | null;
  status: ReportStatus;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  reporter: { id: string; display_name: string } | null;
  reported: { id: string; display_name: string; is_banned: boolean } | null;
  photo: { public_url: string } | null;
};

const STATUS_TABS: ReportStatus[] = ['pending', 'reviewed', 'actioned', 'dismissed'];

const REASON_LABELS: Record<string, string> = {
  inappropriate_photos: 'Inappropriate photos',
  harassment: 'Harassment',
  fake_profile: 'Fake profile',
  underage: 'Underage',
  spam: 'Spam',
  hate_speech: 'Hate speech',
  other: 'Other',
};

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState<ReportStatus>('pending');
  const [reportType, setReportType] = useState<'all' | 'photo' | 'profile'>('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/reports?status=${status}&type=${reportType}&page=${page}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) {
          toast.error(d.error ?? `Failed to load reports (${r.status})`);
          return;
        }
        setReports(d.reports ?? []);
        setCount(d.count ?? 0);
      })
      .catch(() => toast.error('Network error loading reports'))
      .finally(() => setLoading(false));
  }, [status, reportType, page]);

  useEffect(() => { load(); }, [load]);

  async function doAction(
    reportId: string,
    action: 'reviewed' | 'actioned' | 'dismissed',
    banUser = false,
  ) {
    setPending((p) => ({ ...p, [reportId]: true }));
    try {
      const res = await fetch('/api/admin/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_id: reportId,
          action,
          admin_notes: notes[reportId] || undefined,
          ban_user: banUser,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? `Failed (${res.status})`);
      } else {
        const labels: Record<string, string> = {
          reviewed:  'Marked as reviewed',
          actioned:  banUser ? 'Actioned — user banned' : 'Actioned',
          dismissed: 'Report dismissed',
        };
        toast.success(labels[action] ?? 'Done');
        load();
      }
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setPending((p) => ({ ...p, [reportId]: false }));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports</h1>
        <span className="text-sm text-brand-chrome">{count} total</span>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map((s) => (
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

      {/* Report type filter */}
      <div className="flex gap-2 flex-wrap">
        {([['all', 'All reports'], ['photo', 'Photo reports'], ['profile', 'Profile & message reports']] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => { setReportType(val); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
              reportType === val
                ? 'bg-brand-dark-4 text-white border border-brand-orange/40'
                : 'bg-brand-dark-3 text-brand-chrome hover:text-white border border-transparent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-brand-chrome py-8 text-center">Loading…</div>
      ) : (
        <div className="space-y-4">
          {reports.map((r) => (
            <div
              key={r.id}
              className="p-5 rounded-2xl bg-brand-dark-3 border border-brand-dark-4 space-y-4"
            >
              {/* Header row */}
              <div className="flex items-start gap-4">
                {/* Photo thumbnail if this is a photo report */}
                {r.photo?.public_url && (
                  <div className="shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-brand-dark-4 relative">
                    <Image
                      src={r.photo.public_url}
                      alt="Reported photo"
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                      {REASON_LABELS[r.reason] ?? r.reason}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      r.status === 'pending'   ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                      r.status === 'reviewed'  ? 'bg-blue-500/10   text-blue-400   border-blue-500/20'   :
                      r.status === 'actioned'  ? 'bg-green-500/10  text-green-400  border-green-500/20'  :
                                                 'bg-brand-dark-4  text-brand-chrome border-brand-dark-4'
                    }`}>
                      {r.status}
                    </span>
                    <span className="text-xs text-brand-chrome">
                      {new Date(r.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </span>
                  </div>

                  <p className="text-sm">
                    <span className="text-brand-chrome">Reporter:</span>{' '}
                    <strong>{r.reporter?.display_name ?? 'Unknown'}</strong>
                    {' → '}
                    <span className="text-brand-chrome">Reported:</span>{' '}
                    <strong className={r.reported?.is_banned ? 'text-red-400' : ''}>
                      {r.reported?.display_name ?? 'Unknown'}
                      {r.reported?.is_banned ? ' (banned)' : ''}
                    </strong>
                  </p>

                  {r.description && (
                    <p className="text-sm text-brand-chrome mt-1 italic">
                      &ldquo;{r.description}&rdquo;
                    </p>
                  )}

                  {r.admin_notes && r.status !== 'pending' && (
                    <p className="text-xs text-brand-chrome mt-1 bg-brand-dark-4 rounded-lg px-3 py-1.5">
                      <span className="font-medium text-white">Admin notes:</span> {r.admin_notes}
                    </p>
                  )}
                </div>
              </div>

              <AIReportModerationSummary reportId={r.id} />

              {/* Action panel — shown for pending and reviewed */}
              {(r.status === 'pending' || r.status === 'reviewed') && (
                <div className="space-y-2 border-t border-brand-dark-4 pt-4">
                  <input
                    value={notes[r.id] ?? ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                    placeholder="Admin notes (optional)"
                    className="w-full bg-brand-dark-4 border border-brand-dark-4 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-orange/60 placeholder:text-brand-chrome"
                  />
                  <div className="flex gap-2 flex-wrap">
                    {r.status === 'pending' && (
                      <button
                        onClick={() => doAction(r.id, 'reviewed')}
                        disabled={pending[r.id]}
                        className="px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-sm hover:bg-blue-500/20 disabled:opacity-50 transition-colors"
                      >
                        Mark reviewed
                      </button>
                    )}
                    <button
                      onClick={() => doAction(r.id, 'actioned')}
                      disabled={pending[r.id]}
                      className="px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-400 text-sm hover:bg-yellow-500/20 disabled:opacity-50 transition-colors"
                    >
                      Action (no ban)
                    </button>
                    <button
                      onClick={() => doAction(r.id, 'actioned', true)}
                      disabled={pending[r.id] || r.reported?.is_banned}
                      className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-sm hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                    >
                      Action + Ban user
                    </button>
                    <button
                      onClick={() => doAction(r.id, 'dismissed')}
                      disabled={pending[r.id]}
                      className="px-3 py-1.5 rounded-lg bg-brand-dark-4 text-brand-chrome text-sm hover:bg-brand-dark-3 disabled:opacity-50 transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {reports.length === 0 && (
            <div className="text-center py-16 text-brand-chrome">
              No {status} reports
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      <div className="flex gap-3 items-center pt-2">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-4 py-2 rounded-xl bg-brand-dark-3 text-sm disabled:opacity-40 hover:bg-brand-dark-4 transition-colors"
        >
          Previous
        </button>
        <span className="text-sm text-brand-chrome">Page {page}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={(page - 1) * 20 + reports.length >= count}
          className="px-4 py-2 rounded-xl bg-brand-dark-3 text-sm disabled:opacity-40 hover:bg-brand-dark-4 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}