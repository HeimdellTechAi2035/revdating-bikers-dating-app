'use client';

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle, Clock, MapPin, Phone, User } from 'lucide-react';

type SafetyStatus = 'active' | 'overdue' | 'alert_sent' | 'resolved' | 'all';

interface SafetyUser {
  id: string;
  display_name: string;
  city: string | null;
  country: string;
  is_banned: boolean;
}

interface SafetyIncident {
  id: string;
  ride_description: string | null;
  destination_name: string | null;
  expected_return_at: string;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  status: 'active' | 'overdue' | 'alert_sent' | 'resolved';
  resolved_at: string | null;
  alert_sent_at: string | null;
  created_at: string;
  user: SafetyUser | null;
}

const STATUS_LABELS: Record<SafetyStatus, string> = {
  all:        'All Active',
  active:     'Active',
  overdue:    'Overdue',
  alert_sent: 'Alert Sent',
  resolved:   'Resolved',
};

const STATUS_COLORS: Record<string, string> = {
  active:     'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  overdue:    'bg-red-500/20 text-red-300 border border-red-500/30',
  alert_sent: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  resolved:   'bg-green-500/20 text-green-300 border border-green-500/30',
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function isOverdue(expectedReturnAt: string, status: string) {
  return status !== 'resolved' && new Date(expectedReturnAt) < new Date();
}

export default function AdminSafetyPage() {
  const [incidents, setIncidents]   = useState<SafetyIncident[]>([]);
  const [count, setCount]           = useState(0);
  const [status, setStatus]         = useState<SafetyStatus>('all');
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      status,
      page:    String(page),
      perPage: '25',
    });
    fetch(`/api/admin/safety?${params}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d) => {
        setIncidents(d.incidents ?? []);
        setCount(d.count ?? 0);
      })
      .catch(() => toast.error('Failed to load safety check-ins'))
      .finally(() => setLoading(false));
  }, [status, page]);

  useEffect(() => { load(); }, [load]);

  // Reset to page 1 when filter changes
  useEffect(() => { setPage(1); }, [status]);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Safety Check-ins</h1>
        <span className="text-sm text-brand-chrome">{count} total</span>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(STATUS_LABELS) as SafetyStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              status === s
                ? 'bg-brand-orange text-white'
                : 'bg-brand-dark-3 text-white/60 hover:text-white'
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {loading && (
        <p className="text-sm text-white/40 py-8 text-center">Loading…</p>
      )}

      {!loading && incidents.length === 0 && (
        <div className="text-center py-12 text-white/40">
          <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No check-ins found for this filter.</p>
        </div>
      )}

      {!loading && incidents.length > 0 && (
        <div className="space-y-3">
          {incidents.map((inc) => {
            const overdue = isOverdue(inc.expected_return_at, inc.status);
            return (
              <div
                key={inc.id}
                className={`rounded-2xl border p-4 space-y-3 ${
                  overdue
                    ? 'bg-red-950/30 border-red-500/30'
                    : 'bg-brand-dark-3 border-brand-dark-4'
                }`}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-white/40 flex-shrink-0" />
                    <div>
                      <a
                        href={`/admin/users?q=${inc.user?.id ?? ''}`}
                        className="font-semibold hover:text-brand-orange transition-colors"
                      >
                        {inc.user?.display_name ?? 'Unknown user'}
                      </a>
                      {inc.user?.city && (
                        <p className="text-xs text-white/50">{inc.user.city}, {inc.user.country}</p>
                      )}
                      {inc.user?.is_banned && (
                        <span className="text-xs text-red-400 font-medium">BANNED</span>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[inc.status]}`}>
                    {inc.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Ride details */}
                {inc.ride_description && (
                  <p className="text-sm text-white/80">{inc.ride_description}</p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-white/60">
                  {inc.destination_name && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{inc.destination_name}</span>
                    </div>
                  )}
                  <div className={`flex items-center gap-1.5 ${overdue ? 'text-red-400 font-medium' : ''}`}>
                    <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Expected back: {formatDateTime(inc.expected_return_at)}</span>
                    {overdue && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                  </div>
                  {inc.emergency_contact_name && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>
                        {inc.emergency_contact_name}
                        {inc.emergency_contact_phone && ` — ${inc.emergency_contact_phone}`}
                      </span>
                    </div>
                  )}
                  {inc.alert_sent_at && (
                    <div className="text-amber-400">Alert sent: {formatDateTime(inc.alert_sent_at)}</div>
                  )}
                  {inc.resolved_at && (
                    <div className="text-green-400">Resolved: {formatDateTime(inc.resolved_at)}</div>
                  )}
                </div>

                <div className="text-xs text-white/30">
                  Check-in created: {formatDateTime(inc.created_at)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && (
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
            disabled={(page - 1) * 25 + incidents.length >= count}
            className="px-4 py-2 rounded-xl bg-brand-dark-3 text-sm disabled:opacity-40 hover:bg-brand-dark-4 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
