'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, MapPin, Navigation, Calendar, Clock,
  CheckCircle2, XCircle, Ban, AlertCircle, Shield, X,
} from 'lucide-react';
import type { RideDateRow, RideDateStatusType } from '@/types/database.types';

interface Props {
  rideDate: RideDateRow;
  currentUserId: string;
  userOneName: string;
  userTwoName: string;
}

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? '';

const STATUS_CONFIG: Record<RideDateStatusType, { label: string; className: string; icon: React.ReactNode }> = {
  pending:   { label: 'Awaiting response',  className: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400',  icon: <Clock size={14} /> },
  accepted:  { label: 'Ride date confirmed!', className: 'bg-green-500/15 border-green-500/30 text-green-400',    icon: <CheckCircle2 size={14} /> },
  declined:  { label: 'Invite declined',    className: 'bg-red-500/15 border-red-500/30 text-red-400',          icon: <XCircle size={14} /> },
  cancelled: { label: 'Invite cancelled',   className: 'bg-zinc-500/15 border-zinc-500/30 text-zinc-400',       icon: <Ban size={14} /> },
  completed: { label: 'Ride completed',     className: 'bg-blue-500/15 border-blue-500/30 text-blue-400',       icon: <CheckCircle2 size={14} /> },
};

// Handle unknown status values gracefully
function getStatusConfig(status: string) {
  return STATUS_CONFIG[status as RideDateStatusType] ?? STATUS_CONFIG.pending;
}

function formatScheduledTime(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  };
}

const SAFETY_TIPS = [
  'Meet at a well-lit, public place — not a home address.',
  'Tell a friend or family member where you\'re going and when to expect you back.',
  'Keep your phone charged and share your live location with someone you trust.',
  'Trust your instincts — it\'s always OK to leave if something feels off.',
  'The REVdating safety team is here if you ever need help.',
];

function SafetyModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-brand-dark-2 border border-brand-dark-4 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-green-500/15 flex items-center justify-center">
              <Shield size={18} className="text-green-400" />
            </div>
            <h3 className="font-bold text-lg">Stay safe on your ride</h3>
          </div>
          <button onClick={onClose} className="text-brand-chrome hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <ul className="space-y-3 mb-5">
          {SAFETY_TIPS.map((tip, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-green-400 text-[10px] font-bold">{i + 1}</span>
              </div>
              <p className="text-sm text-brand-chrome leading-relaxed">{tip}</p>
            </li>
          ))}
        </ul>
        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-2xl bg-green-500 text-white font-bold hover:bg-green-600 transition-colors"
        >
          Got it — I&apos;ll stay safe!
        </button>
      </div>
    </div>
  );
}

const SAFETY_KEY = (rideDateId: string) => `safety_shown_${rideDateId}`;

export default function RideDateView({ rideDate: initial, currentUserId, userOneName, userTwoName }: Props) {
  const router = useRouter();
  const [rideDate, setRideDate] = useState(initial);
  const [submitting, setSubmitting] = useState<'accept' | 'decline' | 'cancel' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSafety, setShowSafety] = useState(false);

  // Show safety modal to the sender (user_one) the first time they see an accepted ride
  useEffect(() => {
    if (rideDate.status === 'accepted') {
      const key = SAFETY_KEY(rideDate.id);
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, '1');
        setShowSafety(true);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideDate.id, rideDate.status]);

  const isUserOne = rideDate.user_one === currentUserId;
  const isUserTwo = rideDate.user_two === currentUserId;
  const otherName = isUserOne ? userTwoName : userOneName;
  const isPending = rideDate.status === 'pending';

  const { date: scheduledDate, time: scheduledTime } = formatScheduledTime(rideDate.scheduled_time);
  const statusConfig = getStatusConfig(rideDate.status);

  async function transition(action: 'accept' | 'decline' | 'cancel') {
    setSubmitting(action);
    setError(null);

    try {
      const res = await fetch(`/api/ride-dates/${rideDate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Something went wrong');
        return;
      }
      setRideDate(json.rideDate);
      // Show safety modal immediately when user_two accepts
      if (action === 'accept') {
        localStorage.setItem(SAFETY_KEY(rideDate.id), '1');
        setShowSafety(true);
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-4 border-b border-brand-dark-4 bg-brand-dark-2 shrink-0">
        <Link
          href={`/chat/${rideDate.match_id}`}
          className="p-1 -ml-1 text-brand-chrome hover:text-white transition-colors"
        >
          <ChevronLeft size={22} />
        </Link>
        <div>
          <h1 className="text-lg font-bold leading-tight">Ride Date</h1>
          <p className="text-xs text-brand-chrome">with {otherName}</p>
        </div>
      </header>

      <div className="flex flex-col gap-5 px-5 py-6">
        {/* Status badge */}
        <div className={`inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-full border text-sm font-medium ${statusConfig.className}`}>
          {statusConfig.icon}
          {statusConfig.label}
        </div>

        {/* Who planned it */}
        <p className="text-sm text-brand-chrome">
          {isUserOne ? 'You' : userOneName} invited {isUserOne ? userTwoName : 'you'} on a ride date
        </p>

        {/* Meeting Point */}
        <div className="p-4 rounded-xl bg-brand-dark-3 border border-brand-dark-4 space-y-3">
          <div className="flex items-center gap-2 text-brand-orange">
            <MapPin size={16} />
            <h2 className="font-semibold text-sm">Meeting Point</h2>
          </div>
          <p className="text-sm text-white leading-relaxed">{rideDate.location}</p>

          {/* Coordinates */}
          {rideDate.location_lat != null && rideDate.location_lng != null && (
            <p className="text-xs text-brand-chrome/60 font-mono">
              {rideDate.location_lat.toFixed(5)}, {rideDate.location_lng.toFixed(5)}
            </p>
          )}

          {/* Map preview */}
          {rideDate.location_lat != null && rideDate.location_lng != null && (
            MAPS_KEY ? (
              <div className="rounded-lg overflow-hidden border border-brand-dark-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://maps.googleapis.com/maps/api/staticmap?center=${rideDate.location_lat},${rideDate.location_lng}&zoom=15&size=600x300&scale=2&markers=color:orange%7C${rideDate.location_lat},${rideDate.location_lng}&key=${MAPS_KEY}`}
                  alt="Meeting point map"
                  className="w-full"
                  style={{ aspectRatio: '2/1' }}
                />
                <a
                  href={`https://www.google.com/maps?q=${rideDate.location_lat},${rideDate.location_lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-xs text-brand-orange hover:underline py-2 bg-brand-dark-2"
                >
                  Open in Google Maps ↗
                </a>
              </div>
            ) : (
              <a
                href={`https://www.google.com/maps?q=${rideDate.location_lat},${rideDate.location_lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand-orange hover:underline"
              >
                Open in Google Maps ↗
              </a>
            )
          )}
        </div>

        {/* Route */}
        {rideDate.route_data && (
          <div className="p-4 rounded-xl bg-brand-dark-3 border border-brand-dark-4 space-y-2">
            <div className="flex items-center gap-2 text-brand-orange">
              <Navigation size={16} />
              <h2 className="font-semibold text-sm">Route</h2>
            </div>
            {(rideDate.route_data as { notes?: string }).notes && (
              <p className="text-sm text-brand-chrome leading-relaxed">
                {(rideDate.route_data as { notes: string }).notes}
              </p>
            )}
          </div>
        )}

        {/* Date & Time */}
        <div className="p-4 rounded-xl bg-brand-dark-3 border border-brand-dark-4 space-y-2">
          <div className="flex items-center gap-2 text-brand-orange">
            <Calendar size={16} />
            <h2 className="font-semibold text-sm">Date &amp; Time</h2>
          </div>
          <p className="text-base font-semibold text-white">{scheduledDate}</p>
          <p className="text-sm text-brand-chrome flex items-center gap-1.5">
            <Clock size={13} />
            {scheduledTime}
          </p>
        </div>

        {/* Actions */}
        {isPending && (
          <div className="space-y-3 pt-2">
            {/* user_two: accept / decline */}
            {isUserTwo && (
              <div className="flex gap-3">
                <button
                  onClick={() => transition('decline')}
                  disabled={submitting !== null}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 font-semibold disabled:opacity-50 hover:bg-red-500/20 transition-colors"
                >
                  <XCircle size={18} />
                  {submitting === 'decline' ? 'Declining…' : 'Decline'}
                </button>
                <button
                  onClick={() => transition('accept')}
                  disabled={submitting !== null}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-brand-orange text-white font-bold disabled:opacity-50 hover:bg-brand-orange/90 transition-colors"
                >
                  <CheckCircle2 size={18} />
                  {submitting === 'accept' ? 'Accepting…' : 'Accept Ride'}
                </button>
              </div>
            )}

            {/* user_one: cancel */}
            {isUserOne && (
              <button
                onClick={() => transition('cancel')}
                disabled={submitting !== null}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-zinc-500/30 bg-zinc-500/10 text-zinc-400 font-semibold disabled:opacity-50 hover:bg-zinc-500/20 transition-colors"
              >
                <Ban size={18} />
                {submitting === 'cancel' ? 'Cancelling…' : 'Cancel Invite'}
              </button>
            )}
          </div>
        )}

        {/* Accepted: add to calendar link */}
        {rideDate.status === 'accepted' && (
          <a
            href={buildGoogleCalendarUrl(rideDate)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-brand-dark-3 border border-brand-dark-4 hover:border-brand-orange/50 text-white font-semibold text-sm transition-colors"
          >
            <Calendar size={18} className="text-brand-orange" />
            Add to Google Calendar
          </a>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertCircle size={16} className="text-red-400 shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
      </div>

      {showSafety && <SafetyModal onClose={() => setShowSafety(false)} />}
    </div>
  );
}

function buildGoogleCalendarUrl(rideDate: RideDateRow) {
  const start = new Date(rideDate.scheduled_time);
  const end   = new Date(start.getTime() + 3 * 60 * 60 * 1000); // assume 3h ride

  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text:   `Ride Date @ ${rideDate.location}`,
    dates:  `${fmt(start)}/${fmt(end)}`,
    details: rideDate.route_data
      ? `Route: ${(rideDate.route_data as { notes?: string }).notes ?? ''}`
      : '',
    location: rideDate.location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
