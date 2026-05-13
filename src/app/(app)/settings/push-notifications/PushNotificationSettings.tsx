'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, Heart, MessageCircle, Zap, Shield, Loader2, Smartphone } from 'lucide-react';

type Permission = 'default' | 'granted' | 'denied' | 'unsupported';

interface NotifPrefs {
  matches:   boolean;
  messages:  boolean;
  likes:     boolean;
  safety:    boolean;
}

const DEFAULT_PREFS: NotifPrefs = { matches: true, messages: true, likes: true, safety: true };
const PREF_KEY = 'REVdating_notif_prefs';

function loadPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch { return DEFAULT_PREFS; }
}

function savePrefs(prefs: NotifPrefs) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch {}
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function savePushSubscription(sub: PushSubscription) {
  const p256dh = sub.getKey('p256dh');
  const auth   = sub.getKey('auth');
  if (!p256dh || !auth) return;

  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      keys: {
        p256dh: arrayBufferToBase64(p256dh),
        auth:   arrayBufferToBase64(auth),
      },
    }),
  });
}

async function registerPushSubscription(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  const registration = await navigator.serviceWorker.ready;
  let subscription   = await registration.pushManager.getSubscription();

  if (!subscription) {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) return;

    // Browsers accept the base64url VAPID key as a plain string
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidPublicKey,
    });
  }

  await savePushSubscription(subscription);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PushNotificationSettings() {
  const [permission,  setPermission]  = useState<Permission>('default');
  const [prefs,       setPrefs]       = useState<NotifPrefs>(DEFAULT_PREFS);
  const [requesting,  setRequesting]  = useState(false);
  const [isIOSBrowser, setIsIOSBrowser] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect iOS without standalone (Home Screen) — push needs PWA install
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true;
    setIsIOSBrowser(ios && !standalone);

    if (!('Notification' in window)) {
      setPermission('unsupported');
    } else {
      setPermission(Notification.permission as Permission);
      // Re-register subscription silently if already granted
      if (Notification.permission === 'granted') {
        void registerPushSubscription().catch(() => {});
      }
    }
    setPrefs(loadPrefs());
  }, []);

  async function requestPermission() {
    if (requesting) return;
    setRequesting(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as Permission);
      if (result === 'granted') {
        await registerPushSubscription();
      }
    } catch (err) {
      console.error('[push] subscription error:', err);
    } finally {
      setRequesting(false);
    }
  }

  function togglePref(key: keyof NotifPrefs) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    savePrefs(next);
  }

  const isEnabled = permission === 'granted';
  const isDenied  = permission === 'denied';

  return (
    <div className="space-y-6">
      {/* iOS install hint */}
      {isIOSBrowser && (
        <div className="p-4 rounded-2xl bg-brand-orange/10 border border-brand-orange/20 flex items-start gap-3">
          <Smartphone className="w-5 h-5 text-brand-orange flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-brand-orange">iPhone / iPad</p>
            <p className="text-xs text-brand-chrome mt-1">
              To enable notifications on iPhone or iPad, first tap the Share button in Safari and
              choose <strong>Add to Home Screen</strong>. Then open REVdating from your Home Screen
              and come back here.
            </p>
          </div>
        </div>
      )}

      {/* Status card */}
      <div className={`p-4 rounded-2xl border flex items-center gap-3 ${
        isEnabled  ? 'bg-green-500/10 border-green-500/20'
        : isDenied ? 'bg-red-500/10 border-red-500/20'
        : 'bg-brand-dark-3 border-brand-dark-4'
      }`}>
        {isEnabled
          ? <Bell    className="w-5 h-5 text-green-400 flex-shrink-0" />
          : <BellOff className="w-5 h-5 text-brand-chrome/50 flex-shrink-0" />}
        <div className="flex-1">
          <p className="font-semibold text-sm">
            {permission === 'unsupported' && 'Not supported'}
            {permission === 'default'     && 'Notifications off'}
            {permission === 'granted'     && 'Notifications enabled'}
            {permission === 'denied'      && 'Notifications blocked'}
          </p>
          <p className="text-xs text-brand-chrome mt-0.5">
            {permission === 'unsupported' && 'Your browser does not support push notifications.'}
            {permission === 'default'     && 'Tap below to allow REVdating to notify you.'}
            {permission === 'granted'     && 'You\'ll be notified for the events you select below.'}
            {permission === 'denied'      && 'Unblock REVdating in your browser site settings to re-enable.'}
          </p>
        </div>
      </div>

      {/* Enable button */}
      {permission === 'default' && !isIOSBrowser && (
        <button
          onClick={requestPermission}
          disabled={requesting}
          className="w-full py-3.5 rounded-2xl bg-brand-orange text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {requesting
            ? <><Loader2 size={16} className="animate-spin" /> Setting up…</>
            : <><Bell    size={16} /> Enable Notifications</>}
        </button>
      )}

      {/* Per-type preferences */}
      {isEnabled && (
        <div>
          <h2 className="text-xs font-semibold text-brand-chrome uppercase tracking-wider mb-2 px-1">
            Notify me about
          </h2>
          <div className="bg-brand-dark-3 border border-brand-dark-4 rounded-2xl divide-y divide-brand-dark-4">
            <PrefRow
              icon={<Heart size={16} className="text-brand-orange" />}
              label="New matches"
              description="When someone likes you back"
              checked={prefs.matches}
              onChange={() => togglePref('matches')}
            />
            <PrefRow
              icon={<MessageCircle size={16} className="text-brand-orange" />}
              label="Messages"
              description="When a match sends you a message"
              checked={prefs.messages}
              onChange={() => togglePref('messages')}
            />
            <PrefRow
              icon={<Zap size={16} className="text-brand-orange" />}
              label="Profile likes"
              description="When someone likes your profile"
              checked={prefs.likes}
              onChange={() => togglePref('likes')}
            />
            <PrefRow
              icon={<Shield size={16} className="text-brand-orange" />}
              label="Safety alerts"
              description="Check-in reminders and safety updates"
              checked={prefs.safety}
              onChange={() => togglePref('safety')}
            />
          </div>
        </div>
      )}

      <p className="text-xs text-brand-chrome/40 text-center px-4">
        {isEnabled
          ? 'Notifications work on all modern browsers. On iPhone, the app must be installed to your Home Screen.'
          : 'REVdating only sends notifications for events you care about.'}
      </p>
    </div>
  );
}

// ── Sub-component ─────────────────────────────────────────────────────────────

function PrefRow({
  icon, label, description, checked, onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-3 p-4 cursor-pointer hover:bg-brand-dark-4/50 transition-colors">
      <span className="flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-brand-chrome/60">{description}</p>
      </div>
      <div className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-brand-orange' : 'bg-brand-dark-4'}`}>
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
        <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      </div>
    </label>
  );
}
