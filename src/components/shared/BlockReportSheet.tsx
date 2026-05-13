'use client';

import { useState } from 'react';
import { X, ShieldOff, Flag, AlertTriangle, Check } from 'lucide-react';
import { analytics } from '@/lib/analytics';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReportReason =
  | 'inappropriate_photos'
  | 'harassment'
  | 'fake_profile'
  | 'underage'
  | 'spam'
  | 'hate_speech'
  | 'other';

interface BlockReportSheetProps {
  /** The user being acted on */
  userId: string;
  displayName: string;
  /** Optional — to report a specific photo */
  photoId?: string;
  onClose: () => void;
  /** Called after a successful block so the parent can update UI */
  onBlocked?: () => void;
}

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'inappropriate_photos', label: 'Inappropriate photos' },
  { value: 'harassment',           label: 'Harassment' },
  { value: 'fake_profile',         label: 'Fake profile' },
  { value: 'underage',             label: 'Underage user' },
  { value: 'spam',                 label: 'Spam' },
  { value: 'hate_speech',          label: 'Hate speech' },
  { value: 'other',                label: 'Other' },
];

type Sheet = 'menu' | 'report' | 'block-confirm' | 'done';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BlockReportSheet({
  userId,
  displayName,
  photoId,
  onClose,
  onBlocked,
}: BlockReportSheetProps) {
  const [sheet, setSheet]         = useState<Sheet>('menu');
  const [reason, setReason]       = useState<ReportReason>('harassment');
  const [description, setDesc]    = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [doneMsg, setDoneMsg]     = useState('');
  const [reportError, setReportError] = useState('');

  // -- Actions ---------------------------------------------------------------

  async function submitReport() {
    setSubmitting(true);
    setReportError('');
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reported_id: userId,
          reason,
          description: description.trim() || undefined,
          photo_id: photoId,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setReportError((body as { error?: string }).error ?? 'Failed to submit report. Please try again.');
        return;
      }
      analytics.reportSubmitted(reason);
      setDoneMsg('Report submitted. We will review it shortly.');
      setSheet('done');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitBlock() {
    setSubmitting(true);
    try {
      await fetch('/api/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked_id: userId }),
      });
      analytics.userBlocked();
      setDoneMsg(`${displayName} has been blocked and will no longer appear in discovery, matches, or chat.`);
      setSheet('done');
      onBlocked?.();
    } finally {
      setSubmitting(false);
    }
  }

  // -- Render ----------------------------------------------------------------

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-brand-dark-2 border border-brand-dark-4 rounded-t-3xl pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-brand-dark-4" />
        </div>

        {/* ── Menu sheet ────────────────────────────────────── */}
        {sheet === 'menu' && (
          <div className="px-5 pb-6">
            <div className="flex items-center justify-between mb-5 pt-1">
              <h3 className="font-bold text-lg">{displayName}</h3>
              <button onClick={onClose} className="text-brand-chrome hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setSheet('report')}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-brand-dark-3 hover:bg-brand-dark-4 transition-colors text-left"
              >
                <Flag size={18} className="text-yellow-400 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Report {displayName}</p>
                  <p className="text-xs text-brand-chrome mt-0.5">
                    {photoId ? 'Report this photo' : 'Report this user to our moderation team'}
                  </p>
                </div>
              </button>

              <button
                onClick={() => setSheet('block-confirm')}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-brand-dark-3 hover:bg-brand-dark-4 transition-colors text-left"
              >
                <ShieldOff size={18} className="text-red-400 shrink-0" />
                <div>
                  <p className="font-medium text-sm text-red-400">Block {displayName}</p>
                  <p className="text-xs text-brand-chrome mt-0.5">
                    They won&apos;t appear in discovery or be able to message you
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ── Report sheet ──────────────────────────────────── */}
        {sheet === 'report' && (
          <div className="px-5 pb-6">
            <div className="flex items-center gap-3 mb-5 pt-1">
              <button
                onClick={() => setSheet('menu')}
                className="text-brand-chrome hover:text-white transition-colors text-sm"
              >
                ← Back
              </button>
              <h3 className="font-bold text-lg flex-1">
                {photoId ? 'Report Photo' : `Report ${displayName}`}
              </h3>
              <button onClick={onClose} className="text-brand-chrome hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <p className="text-brand-chrome text-sm mb-3">Why are you reporting this?</p>

            <div className="space-y-1.5 mb-4">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setReason(r.value)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-colors ${
                    reason === r.value
                      ? 'border-brand-orange bg-brand-orange/10 text-white'
                      : 'border-brand-dark-4 text-brand-chrome hover:border-brand-dark-3 hover:text-white'
                  }`}
                >
                  {r.label}
                  {reason === r.value && <Check size={14} className="text-brand-orange shrink-0" />}
                </button>
              ))}
            </div>

            <textarea
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Add details (optional)"
              rows={3}
              maxLength={1000}
              className="w-full bg-brand-dark-3 border border-brand-dark-4 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-brand-orange/50 mb-4"
            />

            <button
              onClick={submitReport}
              disabled={submitting}
              className="w-full py-3.5 rounded-2xl bg-brand-orange text-white font-semibold text-sm disabled:opacity-50 hover:bg-brand-orange/90 transition-colors"
            >
              {submitting ? 'Submitting…' : 'Submit Report'}
            </button>
            {reportError && (
              <p className="text-red-400 text-xs text-center mt-2">{reportError}</p>
            )}
          </div>
        )}

        {/* ── Block confirm sheet ───────────────────────────── */}
        {sheet === 'block-confirm' && (
          <div className="px-5 pb-6">
            <div className="flex items-center gap-3 mb-5 pt-1">
              <button
                onClick={() => setSheet('menu')}
                className="text-brand-chrome hover:text-white transition-colors text-sm"
              >
                ← Back
              </button>
              <h3 className="font-bold text-lg flex-1">Block {displayName}?</h3>
              <button onClick={onClose} className="text-brand-chrome hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-5">
              <div className="flex gap-3">
                <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
                <div className="text-sm text-brand-chrome space-y-1">
                  <p><strong className="text-white">{displayName}</strong> will be removed from your discovery, matches, and chat.</p>
                  <p>They will not be notified. You can unblock them from your settings.</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={submitBlock}
                disabled={submitting}
                className="w-full py-3.5 rounded-2xl bg-red-500 text-white font-semibold text-sm disabled:opacity-50 hover:bg-red-600 transition-colors"
              >
                {submitting ? 'Blocking…' : `Block ${displayName}`}
              </button>
              <button
                onClick={() => setSheet('menu')}
                className="w-full py-3 rounded-2xl text-brand-chrome text-sm hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Done sheet ────────────────────────────────────── */}
        {sheet === 'done' && (
          <div className="px-5 pb-8 text-center">
            <div className="flex justify-center mb-4 pt-4">
              <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center">
                <Check size={28} className="text-green-400" />
              </div>
            </div>
            <p className="font-bold text-lg mb-2">Done</p>
            <p className="text-brand-chrome text-sm mb-6">{doneMsg}</p>
            <button
              onClick={onClose}
              className="px-8 py-3 rounded-2xl bg-brand-dark-3 text-sm text-white hover:bg-brand-dark-4 transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
