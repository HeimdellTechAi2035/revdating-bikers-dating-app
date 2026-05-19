'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { ChevronDown, ChevronUp, ShieldCheck, ShieldOff, Mail, KeyRound, RefreshCw, Eye, CheckCircle, XCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';

// ---------------------------------------------------------------------------
// User Profile Modal — shows full profile + photos with approve/reject
// ---------------------------------------------------------------------------

type PhotoDetail = {
  id: string;
  public_url: string;
  is_primary: boolean;
  moderation_status: 'pending' | 'approved' | 'rejected';
  rejected_reason: string | null;
  sort_order: number;
};

function UserProfileModal({ userId, displayName, onClose }: { userId: string; displayName: string; onClose: () => void }) {
  const [detail, setDetail] = useState<{ profile: Record<string, unknown>; photos: PhotoDetail[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [verifyBusy, setVerifyBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/users/${userId}`)
      .then((r) => r.json())
      .then((d) => setDetail(d))
      .finally(() => setLoading(false));
  }, [userId]);

  async function toggleVerify() {
    const isVerified = Boolean(detail?.profile?.is_verified);
    setVerifyBusy(true);
    try {
      const r = await fetch('/api/admin/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, action: isVerified ? 'unverify' : 'verify' }),
      });
      if (r.ok) {
        toast.success(isVerified ? 'Verification removed' : 'User manually verified');
        setDetail((d) => d ? { ...d, profile: { ...d.profile, is_verified: !isVerified } } : d);
      } else {
        toast.error('Failed to update verification');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setVerifyBusy(false);
    }
  }

  async function moderatePhoto(photoId: string, action: 'approved' | 'rejected', reason?: string) {
    setBusy((b) => ({ ...b, [photoId]: true }));
    const r = await fetch('/api/admin/photos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo_id: photoId, action, reason }),
    });
    if (r.ok) {
      toast.success(action === 'approved' ? 'Photo approved' : 'Photo rejected');
      setDetail((d) => d ? {
        ...d,
        photos: d.photos.map((p) =>
          p.id === photoId ? { ...p, moderation_status: action, rejected_reason: reason ?? null } : p
        ),
      } : d);
    } else {
      toast.error('Failed to update photo');
    }
    setBusy((b) => ({ ...b, [photoId]: false }));
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-brand-dark-3 rounded-2xl w-full max-w-lg my-4" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-brand-dark-4">
          <h2 className="font-bold text-lg">{displayName}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-brand-dark-4 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-brand-orange border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !detail ? (
          <p className="text-center py-8 text-brand-chrome">Failed to load profile</p>
        ) : (
          <div className="p-4 space-y-5">
            {/* Verification status + manual override */}
            <div className={`flex items-center justify-between p-3 rounded-xl border ${detail.profile.is_verified ? 'bg-blue-500/10 border-blue-500/20' : 'bg-brand-dark-4 border-brand-dark-4'}`}>
              <div className="flex items-center gap-2">
                <ShieldCheck className={`w-4 h-4 ${detail.profile.is_verified ? 'text-blue-400' : 'text-brand-chrome'}`} />
                <span className={`text-sm font-medium ${detail.profile.is_verified ? 'text-blue-400' : 'text-brand-chrome'}`}>
                  {detail.profile.is_verified ? 'Verified' : 'Not verified'}
                </span>
              </div>
              <button
                onClick={toggleVerify}
                disabled={verifyBusy}
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50 transition-colors ${
                  detail.profile.is_verified
                    ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                    : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                }`}
              >
                {verifyBusy ? '…' : detail.profile.is_verified ? 'Remove verification' : 'Manually verify'}
              </button>
            </div>

            {/* Profile info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {Boolean(detail.profile.city) && (
                <div><p className="text-brand-chrome text-xs">City</p><p>{String(detail.profile.city)}</p></div>
              )}
              {Boolean(detail.profile.country) && (
                <div><p className="text-brand-chrome text-xs">Country</p><p>{String(detail.profile.country)}</p></div>
              )}
              {Boolean(detail.profile.date_of_birth) && (
                <div><p className="text-brand-chrome text-xs">Date of Birth</p><p>{String(detail.profile.date_of_birth)}</p></div>
              )}
              {Boolean(detail.profile.gender) && (
                <div><p className="text-brand-chrome text-xs">Gender</p><p>{String(detail.profile.gender)}</p></div>
              )}
              {Boolean(detail.profile.riding_style) && (
                <div><p className="text-brand-chrome text-xs">Riding style</p><p>{String(detail.profile.riding_style)}</p></div>
              )}
              {Boolean(detail.profile.created_at) && (
                <div><p className="text-brand-chrome text-xs">Joined</p><p>{new Date(String(detail.profile.created_at)).toLocaleDateString('en-GB')}</p></div>
              )}
            </div>

            {Boolean(detail.profile.bio) && (
              <div>
                <p className="text-brand-chrome text-xs mb-1">Bio</p>
                <p className="text-sm bg-brand-dark-4 rounded-xl px-3 py-2 leading-relaxed">{String(detail.profile.bio)}</p>
              </div>
            )}

            {/* Photos */}
            <div>
              <p className="text-brand-chrome text-xs mb-3 uppercase tracking-widest font-bold">Photos ({detail.photos.length})</p>
              {detail.photos.length === 0 ? (
                <p className="text-brand-chrome text-sm text-center py-4">No photos uploaded</p>
              ) : (
                <div className="space-y-3">
                  {detail.photos.map((photo) => (
                    <div key={photo.id} className="flex items-center gap-3 bg-brand-dark-4 rounded-xl p-3">
                      <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                        <Image
                          src={photo.public_url}
                          alt="User photo"
                          fill
                          className={`object-cover ${photo.moderation_status === 'rejected' ? 'grayscale opacity-50' : ''}`}
                          sizes="80px"
                          unoptimized
                        />
                        {photo.is_primary && (
                          <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] bg-brand-orange text-white font-bold py-0.5">
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {photo.moderation_status === 'approved' && (
                            <span className="text-xs bg-green-500/20 text-green-400 rounded-full px-2 py-0.5">Approved</span>
                          )}
                          {photo.moderation_status === 'pending' && (
                            <span className="text-xs bg-yellow-500/20 text-yellow-400 rounded-full px-2 py-0.5">Pending</span>
                          )}
                          {photo.moderation_status === 'rejected' && (
                            <span className="text-xs bg-red-500/20 text-red-400 rounded-full px-2 py-0.5">Rejected</span>
                          )}
                        </div>
                        {photo.rejected_reason && (
                          <p className="text-xs text-red-300 mb-2 leading-relaxed">{photo.rejected_reason}</p>
                        )}
                        <div className="flex gap-2">
                          {photo.moderation_status !== 'approved' && (
                            <button
                              onClick={() => moderatePhoto(photo.id, 'approved')}
                              disabled={busy[photo.id]}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-xs font-semibold hover:bg-green-500/20 disabled:opacity-50 transition-colors"
                            >
                              <CheckCircle className="w-3 h-3" />
                              Approve
                            </button>
                          )}
                          {photo.moderation_status !== 'rejected' && (
                            <button
                              onClick={() => moderatePhoto(photo.id, 'rejected', 'Rejected by admin')}
                              disabled={busy[photo.id]}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-semibold hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                            >
                              <XCircle className="w-3 h-3" />
                              Reject
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type User = {
  id: string;
  display_name: string;
  email: string;
  date_of_birth: string | null;
  gender: string | null;
  city: string | null;
  country: string | null;
  is_verified: boolean;
  is_premium: boolean;
  is_banned: boolean;
  ban_reason: string | null;
  is_active: boolean;
  onboarding_complete: boolean;
  created_at: string;
  last_active: string | null;
};

type AdminAction = {
  id: string;
  action: string;
  reason: string | null;
  created_at: string;
  admin: { id: string; display_name: string } | null;
};

type Modal =
  | { type: 'ban'; userId: string; displayName: string }
  | { type: 'warn'; userId: string; displayName: string }
  | { type: 'note'; userId: string; displayName: string }
  | { type: 'change_email'; userId: string; displayName: string; currentEmail: string }
  | { type: 'change_password'; userId: string; displayName: string }
  | null;

type ProfileView = { userId: string; displayName: string } | null;

// ---------------------------------------------------------------------------
// Action colour helper
// ---------------------------------------------------------------------------
function actionBadgeClass(action: string) {
  if (action === 'ban')                  return 'bg-red-500/20 text-red-400';
  if (action === 'unban')                return 'bg-green-500/20 text-green-400';
  if (action === 'warn')                 return 'bg-yellow-500/20 text-yellow-400';
  if (action === 'verification_approved') return 'bg-blue-500/20 text-blue-400';
  if (action === 'verification_rejected') return 'bg-red-500/20 text-red-400';
  if (action === 'report_actioned')      return 'bg-orange-500/20 text-orange-400';
  return 'bg-brand-dark-4 text-brand-chrome';
}

// ---------------------------------------------------------------------------
// Row component with expandable history
// ---------------------------------------------------------------------------

function UserRow({
  user,
  onAction,
  onOpenModal,
  onViewProfile,
}: {
  user: User;
  onAction: (userId: string, action: string, reason?: string) => Promise<void>;
  onOpenModal: (modal: Modal) => void;
  onViewProfile: (userId: string, displayName: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState<AdminAction[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [actionPending, setActionPending] = useState(false);

  async function loadHistory() {
    if (history !== null) { setExpanded((e) => !e); return; }
    setExpanded(true);
    setLoadingHistory(true);
    const r = await fetch(`/api/admin/actions?user_id=${user.id}`);
    const d = await r.json();
    setHistory(d.actions ?? []);
    setLoadingHistory(false);
  }

  async function quickAction(action: string, reason?: string) {
    setActionPending(true);
    await onAction(user.id, action, reason);
    setActionPending(false);
    // Invalidate history so it reloads next expand
    setHistory(null);
  }

  return (
    <>
      <tr className="hover:bg-brand-dark-3/50 transition-colors">
        {/* Name + Email */}
        <td className="px-4 py-3">
          <div className="font-medium">{user.display_name}</div>
          <div className="text-brand-chrome text-xs flex items-center gap-1 mt-0.5">
            <Mail size={10} />
            {user.email || <span className="italic">no email</span>}
          </div>
          <div className="text-brand-chrome/40 text-xs">{user.id.slice(0, 8)}…</div>
        </td>

        {/* Location */}
        <td className="px-4 py-3 text-brand-chrome text-sm">
          {[user.city, user.country].filter(Boolean).join(', ') || '—'}
        </td>

        {/* Account status */}
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {user.is_banned && (
              <span className="text-xs bg-red-500/20 text-red-400 rounded-full px-2 py-0.5">Banned</span>
            )}
            {user.is_premium && (
              <span className="text-xs bg-brand-orange/20 text-brand-orange rounded-full px-2 py-0.5">Premium</span>
            )}
            {user.is_verified && (
              <span className="text-xs bg-blue-500/20 text-blue-400 rounded-full px-2 py-0.5 flex items-center gap-0.5">
                <ShieldCheck size={9} /> Verified
              </span>
            )}
            {!user.is_active && !user.is_banned && (
              <span className="text-xs bg-gray-500/20 text-gray-400 rounded-full px-2 py-0.5">Inactive</span>
            )}
            {!user.onboarding_complete && (
              <span className="text-xs bg-gray-500/10 text-gray-500 rounded-full px-2 py-0.5">Onboarding</span>
            )}
            {user.ban_reason && (
              <span className="text-[10px] text-brand-chrome italic truncate max-w-[140px]" title={user.ban_reason}>
                {user.ban_reason}
              </span>
            )}
          </div>
        </td>

        {/* Joined */}
        <td className="px-4 py-3 text-brand-chrome text-sm">
          <div>{new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
          {user.last_active && (
            <div className="text-xs text-brand-chrome/60">
              Active {new Date(user.last_active).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </div>
          )}
        </td>

        {/* Actions */}
        <td className="px-4 py-3">
          <div className="flex gap-1.5 flex-wrap items-center">
            {/* Ban / Unban */}
            {user.is_banned ? (
              <button
                onClick={() => quickAction('unban')}
                disabled={actionPending}
                className="text-xs px-2 py-1 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 disabled:opacity-50 transition-colors"
              >
                Unban
              </button>
            ) : (
              <button
                onClick={() => onOpenModal({ type: 'ban', userId: user.id, displayName: user.display_name })}
                className="text-xs px-2 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
              >
                Ban
              </button>
            )}

            {/* Verify / Unverify */}
            {user.is_verified ? (
              <button
                onClick={() => quickAction('unverify')}
                disabled={actionPending}
                className="text-xs px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-50 transition-colors flex items-center gap-0.5"
              >
                <ShieldOff size={10} /> Unverify
              </button>
            ) : (
              <button
                onClick={() => quickAction('verify')}
                disabled={actionPending}
                className="text-xs px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-50 transition-colors flex items-center gap-0.5"
              >
                <ShieldCheck size={10} /> Verify
              </button>
            )}

            {/* Warn */}
            <button
              onClick={() => onOpenModal({ type: 'warn', userId: user.id, displayName: user.display_name })}
              className="text-xs px-2 py-1 rounded-lg bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors"
            >
              Warn
            </button>

            {/* Add note */}
            <button
              onClick={() => onOpenModal({ type: 'note', userId: user.id, displayName: user.display_name })}
              className="text-xs px-2 py-1 rounded-lg bg-brand-dark-4 text-brand-chrome hover:text-white transition-colors"
            >
              Note
            </button>

            {/* Reset password email */}
            <button
              onClick={async () => {
                setActionPending(true);
                const r = await fetch('/api/admin/account', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'reset_password', user_id: user.id }),
                });
                const d = await r.json();
                if (d.ok) toast.success(d.message);
                else toast.error(d.error ?? 'Failed');
                setActionPending(false);
              }}
              disabled={actionPending}
              className="text-xs px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-50 transition-colors flex items-center gap-0.5"
            >
              <RefreshCw size={10} /> Reset pwd
            </button>

            {/* Change email */}
            <button
              onClick={() => onOpenModal({ type: 'change_email', userId: user.id, displayName: user.display_name, currentEmail: user.email })}
              className="text-xs px-2 py-1 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors flex items-center gap-0.5"
            >
              <Mail size={10} /> Email
            </button>

            {/* Set new password directly */}
            <button
              onClick={() => onOpenModal({ type: 'change_password', userId: user.id, displayName: user.display_name })}
              className="text-xs px-2 py-1 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors flex items-center gap-0.5"
            >
              <KeyRound size={10} /> Set pwd
            </button>

            {/* View profile + photos */}
            <button
              onClick={() => onViewProfile(user.id, user.display_name)}
              className="text-xs px-2 py-1 rounded-lg bg-brand-orange/10 text-brand-orange hover:bg-brand-orange/20 transition-colors flex items-center gap-0.5"
            >
              <Eye size={10} /> View
            </button>

            {/* Expand history */}
            <button
              onClick={loadHistory}
              className="text-xs px-2 py-1 rounded-lg bg-brand-dark-4 text-brand-chrome hover:text-white transition-colors flex items-center gap-0.5"
            >
              History {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
          </div>
        </td>
      </tr>

      {/* Expandable history panel */}
      {expanded && (
        <tr className="bg-brand-dark/50">
          <td colSpan={5} className="px-4 pb-3 pt-0">
            {loadingHistory ? (
              <div className="text-brand-chrome text-xs py-2">Loading history…</div>
            ) : history && history.length === 0 ? (
              <div className="text-brand-chrome text-xs py-2">No admin actions recorded for this user.</div>
            ) : (
              <div className="space-y-1.5 pt-2">
                {(history ?? []).map((a) => (
                  <div key={a.id} className="flex items-start gap-3 text-xs">
                    <span className={`shrink-0 px-2 py-0.5 rounded-full font-medium ${actionBadgeClass(a.action)}`}>
                      {a.action.replace(/_/g, ' ')}
                    </span>
                    {a.reason && <span className="text-brand-chrome italic">{a.reason}</span>}
                    <span className="text-brand-chrome/50 ml-auto shrink-0">
                      {new Date(a.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                      {a.admin?.display_name && ` · ${a.admin.display_name}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Modal component
// ---------------------------------------------------------------------------

function ActionModal({
  modal,
  onClose,
  onConfirm,
}: {
  modal: NonNullable<Modal>;
  onClose: () => void;
  onConfirm: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState(
    modal.type === 'change_email' ? modal.currentEmail : ''
  );
  const [submitting, setSubmitting] = useState(false);

  const config: Record<string, { title: string; label: string; button: string; btnClass: string; inputType: string }> = {
    ban:             { title: `Ban ${modal.displayName}`,             label: 'Ban reason (optional)',  button: 'Confirm Ban',    btnClass: 'bg-red-500 hover:bg-red-600',           inputType: 'textarea' },
    warn:            { title: `Warn ${modal.displayName}`,            label: 'Warning message',        button: 'Send Warning',   btnClass: 'bg-yellow-500 hover:bg-yellow-600',     inputType: 'textarea' },
    note:            { title: `Add note for ${modal.displayName}`,    label: 'Note',                   button: 'Save Note',      btnClass: 'bg-brand-orange hover:bg-brand-orange/90', inputType: 'textarea' },
    change_email:    { title: `Change email for ${modal.displayName}`, label: 'New email address',     button: 'Update Email',   btnClass: 'bg-purple-500 hover:bg-purple-600',     inputType: 'email' },
    change_password: { title: `Set new password for ${modal.displayName}`, label: 'New password (min 8 chars)', button: 'Set Password', btnClass: 'bg-orange-500 hover:bg-orange-600', inputType: 'password' },
  };

  const c = config[modal.type];

  async function submit() {
    setSubmitting(true);
    await onConfirm(value);
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-brand-dark-3 rounded-2xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">{c.title}</h2>
        {c.inputType === 'textarea' ? (
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={c.label}
            className="w-full h-24 bg-brand-dark-4 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-brand-orange border border-brand-dark-4 placeholder:text-brand-chrome"
          />
        ) : (
          <input
            type={c.inputType}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={c.label}
            className="w-full bg-brand-dark-4 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-orange border border-brand-dark-4 placeholder:text-brand-chrome"
          />
        )}
        <div className="flex gap-3">
          <button
            onClick={submit}
            disabled={submitting}
            className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-colors ${c.btnClass}`}
          >
            {submitting ? 'Saving…' : c.button}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-brand-dark-4 text-sm hover:bg-brand-dark-3 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [profileView, setProfileView] = useState<ProfileView>(null);

  const loadUsers = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ search, filter, page: String(page) });
    fetch(`/api/admin/users?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setUsers(d.users ?? []);
          setCount(d.count ?? 0);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [search, filter, page]);

  useEffect(() => { const cancel = loadUsers(); return cancel; }, [loadUsers]);
  useEffect(() => {
    const urlFilter = new URLSearchParams(window.location.search).get('filter');
    if (urlFilter && ['all', 'banned', 'active', 'premium', 'unverified'].includes(urlFilter)) {
      setFilter(urlFilter);
    }
  }, []);

  async function doAction(userId: string, action: string, reason?: string) {
    await fetch('/api/admin/ban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, action, reason: reason || undefined }),
    });
    loadUsers();
  }

  async function handleModalConfirm(value: string) {
    if (!modal) return;

    if (modal.type === 'change_email' || modal.type === 'change_password') {
      const body =
        modal.type === 'change_email'
          ? { action: 'change_email', user_id: modal.userId, new_email: value }
          : { action: 'change_password', user_id: modal.userId, new_password: value };

      const r = await fetch('/api/admin/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d.ok) { toast.success(d.message); loadUsers(); }
      else toast.error(d.error ?? 'Failed');
      setModal(null);
      return;
    }

    const actionMap = { ban: 'ban', warn: 'warn', note: 'profile_note' } as const;
    await doAction(modal.userId, actionMap[modal.type as 'ban' | 'warn' | 'note'], value);
    setModal(null);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Users</h1>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name…"
          className="bg-brand-dark-3 border border-brand-dark-4 rounded-xl px-4 py-2 text-sm text-white placeholder:text-brand-chrome focus:outline-none focus:border-brand-orange"
        />
        <select
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setPage(1); }}
          className="bg-brand-dark-3 border border-brand-dark-4 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-orange"
        >
          <option value="all">All users</option>
          <option value="banned">Banned</option>
          <option value="active">Active</option>
          <option value="premium">Premium</option>
          <option value="unverified">Unverified</option>
        </select>
      </div>

      <div className="text-sm text-brand-chrome">{count} users found</div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-brand-orange border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-brand-dark-4">
          <table className="w-full text-sm">
            <thead className="bg-brand-dark-3 text-brand-chrome">
              <tr>
                {['Name / Email', 'Location', 'Account status', 'Joined', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-dark-4">
              {users.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  onAction={doAction}
                  onOpenModal={setModal}
                  onViewProfile={(userId, displayName) => setProfileView({ userId, displayName })}
                />
              ))}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className="text-center py-16 text-brand-chrome">No users found</div>
          )}
        </div>
      )}

      {/* Pagination */}
      <div className="flex gap-3 items-center">
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
          disabled={users.length < 20}
          className="px-4 py-2 rounded-xl bg-brand-dark-3 text-sm disabled:opacity-40 hover:bg-brand-dark-4 transition-colors"
        >
          Next
        </button>
      </div>

      {/* Action modal */}
      {modal && (
        <ActionModal
          modal={modal}
          onClose={() => setModal(null)}
          onConfirm={handleModalConfirm}
        />
      )}

      {/* Profile view modal */}
      {profileView && (
        <UserProfileModal
          userId={profileView.userId}
          displayName={profileView.displayName}
          onClose={() => setProfileView(null)}
        />
      )}
    </div>
  );
}
