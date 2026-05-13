'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, MapPin, Navigation, Calendar, Clock, Send, AlertCircle, ShieldCheck } from 'lucide-react';

const DISCLAIMER_KEY = 'REVdating_ride_disclaimer_seen';

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? '';

interface Props {
  matchId: string;
  otherUserName: string;
  existingPendingId: string | null;
}

// Minimum schedulable time: 1 hour from now
function getMinDateTime() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  // datetime-local expects "YYYY-MM-DDTHH:MM"
  return d.toISOString().slice(0, 16);
}

export default function NewRideDateForm({ matchId, otherUserName, existingPendingId }: Props) {
  const router = useRouter();

  const [location, setLocation]       = useState('');
  const [locationLat, setLocationLat] = useState('');
  const [locationLng, setLocationLng] = useState('');
  const [routeNotes, setRouteNotes]   = useState('');
  const [dateTime, setDateTime]       = useState('');

  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const pendingSubmit = useRef(false);

  const locationInputRef              = useRef<HTMLInputElement>(null);
  const [mapsReady, setMapsReady]     = useState(false);

  // Load Google Maps JS API (Places library)
  useEffect(() => {
    if (!MAPS_KEY) return;
    if ((window as any).google?.maps?.places) { setMapsReady(true); return; }
    if (document.getElementById('REVdating-google-maps')) return;
    const script = document.createElement('script');
    script.id  = 'REVdating-google-maps';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places`;
    script.async = true;
    script.onload = () => setMapsReady(true);
    document.head.appendChild(script);
  }, []);

  // Attach Places Autocomplete once the library is ready
  useEffect(() => {
    if (!mapsReady || !locationInputRef.current) return;
    const g = (window as any).google;
    if (!g?.maps?.places) return;
    const ac = new g.maps.places.Autocomplete(locationInputRef.current, {
      types: ['establishment', 'geocode'],
    });
    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (!place?.geometry?.location) return;
      const name = place.name ?? '';
      const addr = place.formatted_address ?? '';
      setLocation(name && addr ? `${name}, ${addr}` : addr || name);
      setLocationLat(String(place.geometry.location.lat()));
      setLocationLng(String(place.geometry.location.lng()));
    });
    return () => g.maps.event.clearInstanceListeners(ac);
  }, [mapsReady]);

  const staticMapUrl = locationLat && locationLng && MAPS_KEY
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${locationLat},${locationLng}&zoom=15&size=600x300&scale=2&markers=color:orange%7C${locationLat},${locationLng}&key=${MAPS_KEY}`
    : null;

  if (existingPendingId) {
    return (
      <div className="flex flex-col h-full">
        <header className="flex items-center gap-3 px-4 py-4 border-b border-brand-dark-4">
          <Link href={`/chat/${matchId}`} className="p-1 -ml-1 text-brand-chrome hover:text-white transition-colors">
            <ChevronLeft size={22} />
          </Link>
          <h1 className="text-lg font-bold">Plan a Ride Date</h1>
        </header>
        <div className="flex flex-col items-center justify-center flex-1 px-6 text-center gap-4">
          <span className="text-5xl">🏍️</span>
          <h2 className="text-xl font-bold">Invite already sent</h2>
          <p className="text-brand-chrome text-sm">
            You already have a pending ride date invite with {otherUserName}. Cancel it first to send a new one.
          </p>
          <Link
            href={`/ride-dates/${existingPendingId}`}
            className="px-6 py-3 rounded-2xl bg-brand-orange text-white font-semibold"
          >
            View invite
          </Link>
        </div>
      </div>
    );
  }

  async function doSubmit() {
    setSubmitting(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        matchId,
        location: location.trim(),
        scheduledTime: new Date(dateTime).toISOString(),
      };

      if (locationLat && locationLng) {
        body.locationLat = parseFloat(locationLat);
        body.locationLng = parseFloat(locationLng);
      }
      if (routeNotes.trim()) {
        body.routeData = { notes: routeNotes.trim() };
      }

      const res = await fetch('/api/ride-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Something went wrong');
        return;
      }

      router.push(`/ride-dates/${json.rideDate.id}`);
    } catch {
      setError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!location.trim() || !dateTime) return;

    // Show safety disclaimer the first time; after accepted, submit directly
    if (!localStorage.getItem(DISCLAIMER_KEY)) {
      pendingSubmit.current = true;
      setShowDisclaimer(true);
    } else {
      void doSubmit();
    }
  }

  function acceptDisclaimer() {
    localStorage.setItem(DISCLAIMER_KEY, '1');
    setShowDisclaimer(false);
    if (pendingSubmit.current) {
      pendingSubmit.current = false;
      void doSubmit();
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-4 border-b border-brand-dark-4 bg-brand-dark-2 shrink-0">
        <Link
          href={`/chat/${matchId}`}
          className="p-1 -ml-1 text-brand-chrome hover:text-white transition-colors"
        >
          <ChevronLeft size={22} />
        </Link>
        <div>
          <h1 className="text-lg font-bold leading-tight">Plan a Ride Date</h1>
          <p className="text-xs text-brand-chrome">with {otherUserName}</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 px-5 py-6">
        {/* Meeting Point */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-brand-orange shrink-0" />
            <h2 className="font-semibold text-sm uppercase tracking-wide text-brand-chrome">
              Meeting Point
            </h2>
          </div>

          <input
            ref={locationInputRef}
            type="text"
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              setLocationLat('');
              setLocationLng('');
            }}
            placeholder={MAPS_KEY ? 'Search for a place…' : 'e.g. The Ace Café, North Circular Road, London'}
            maxLength={500}
            required
            className="w-full bg-brand-dark-3 border border-brand-dark-4 focus:border-brand-orange/50 rounded-xl px-4 py-3 text-sm outline-none placeholder:text-brand-chrome/50 transition-colors"
          />

          {/* Map preview */}
          {staticMapUrl ? (
            <div className="relative rounded-xl overflow-hidden border border-brand-dark-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={staticMapUrl}
                alt="Meeting point map"
                className="w-full"
                style={{ aspectRatio: '2/1' }}
              />
            </div>
          ) : MAPS_KEY ? (
            <div className="rounded-xl border border-brand-dark-4 bg-brand-dark-3">
              <div className="aspect-[2/1] flex flex-col items-center justify-center gap-3 px-6 text-center">
                <MapPin size={28} className="text-brand-chrome/40" />
                <p className="text-xs text-brand-chrome/60">
                  {mapsReady ? 'Search for a meeting point above to preview the map' : 'Loading Maps…'}
                </p>
              </div>
            </div>
          ) : null}

          {/* Manual coordinates — only shown when Places autocomplete is unavailable */}
          {!MAPS_KEY && (
            <details className="text-xs">
              <summary className="text-brand-chrome/60 cursor-pointer select-none hover:text-brand-chrome transition-colors">
                Add coordinates (optional)
              </summary>
              <div className="flex gap-3 mt-2">
                <input
                  type="number"
                  step="any"
                  value={locationLat}
                  onChange={(e) => setLocationLat(e.target.value)}
                  placeholder="Latitude"
                  className="flex-1 bg-brand-dark-3 border border-brand-dark-4 focus:border-brand-orange/50 rounded-xl px-3 py-2 text-xs outline-none placeholder:text-brand-chrome/40 transition-colors"
                />
                <input
                  type="number"
                  step="any"
                  value={locationLng}
                  onChange={(e) => setLocationLng(e.target.value)}
                  placeholder="Longitude"
                  className="flex-1 bg-brand-dark-3 border border-brand-dark-4 focus:border-brand-orange/50 rounded-xl px-3 py-2 text-xs outline-none placeholder:text-brand-chrome/40 transition-colors"
                />
              </div>
            </details>
          )}
        </section>

        {/* Route */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Navigation size={16} className="text-brand-orange shrink-0" />
            <h2 className="font-semibold text-sm uppercase tracking-wide text-brand-chrome">
              Route
            </h2>
          </div>

          <textarea
            value={routeNotes}
            onChange={(e) => setRouteNotes(e.target.value)}
            placeholder="Describe the route, stops, or any notes for your ride partner…"
            rows={3}
            maxLength={1000}
            className="w-full bg-brand-dark-3 border border-brand-dark-4 focus:border-brand-orange/50 rounded-xl px-4 py-3 text-sm outline-none placeholder:text-brand-chrome/50 resize-none transition-colors leading-relaxed"
          />
        </section>

        {/* Date & Time */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-brand-orange shrink-0" />
            <h2 className="font-semibold text-sm uppercase tracking-wide text-brand-chrome">
              Date &amp; Time
            </h2>
          </div>

          <div className="relative">
            <Clock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-chrome/50 pointer-events-none" />
            <input
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              min={getMinDateTime()}
              required
              className="w-full bg-brand-dark-3 border border-brand-dark-4 focus:border-brand-orange/50 rounded-xl pl-10 pr-4 py-3 text-sm outline-none transition-colors [color-scheme:dark]"
            />
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertCircle size={16} className="text-red-400 shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !location.trim() || !dateTime}
          className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-brand-orange text-white font-bold text-base disabled:opacity-50 hover:bg-brand-orange/90 transition-colors"
        >
          <Send size={18} />
          {submitting ? 'Sending invite…' : `Send Ride Invite to ${otherUserName}`}
        </button>
      </form>
      {/* Safety disclaimer modal — shown once before first ride invite */}
      {showDisclaimer && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm bg-brand-dark-2 border border-brand-dark-4 rounded-3xl overflow-hidden shadow-2xl">
            <div className="bg-brand-orange/10 border-b border-brand-orange/20 px-5 py-4 flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-brand-orange flex-shrink-0" />
              <h2 className="font-bold text-base">Safety Reminder</h2>
            </div>
            <div className="px-5 py-5 space-y-3 text-sm text-brand-chrome leading-relaxed">
              <p>
                REVdating provides the planning tools, but <strong className="text-white">you are responsible for your own safety</strong> and road conduct.
              </p>
              <ul className="space-y-2 text-xs">
                <li className="flex items-start gap-2">
                  <span className="text-brand-orange mt-0.5">•</span>
                  Always meet for the first time in a <strong className="text-white">public place</strong>.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-orange mt-0.5">•</span>
                  Tell someone you trust where you&apos;re going and when you&apos;ll be back.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-orange mt-0.5">•</span>
                  Use the <strong className="text-white">Safety Check-In</strong> feature before you leave.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-orange mt-0.5">•</span>
                  Never share your home address before building trust.
                </li>
              </ul>
            </div>
            <div className="px-5 pb-5 flex flex-col gap-2">
              <button
                onClick={acceptDisclaimer}
                className="w-full py-3.5 rounded-2xl bg-brand-orange text-white font-bold text-sm hover:bg-brand-orange/90 transition-colors"
              >
                I understand — send the invite
              </button>
              <button
                onClick={() => { setShowDisclaimer(false); pendingSubmit.current = false; }}
                className="w-full py-3 rounded-2xl text-brand-chrome text-sm hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
