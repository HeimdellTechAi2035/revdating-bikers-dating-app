'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { X, Share, Plus } from 'lucide-react';

type Platform = 'android' | 'ios' | null;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const STORAGE_KEY = 'pwa_install_dismissed_at';
const DISMISS_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return null;
}

function isAlreadyInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).standalone === true
  );
}

function wasDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    return Date.now() - parseInt(raw, 10) < DISMISS_TTL;
  } catch {
    return false;
  }
}

export default function InstallPrompt() {
  const [show, setShow]           = useState(false);
  const [platform, setPlatform]   = useState<Platform>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isAlreadyInstalled() || wasDismissedRecently()) return;

    const p = detectPlatform();
    setPlatform(p);

    if (p === 'ios') {
      // iOS can't use beforeinstallprompt — show manual instructions after a delay
      const t = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(t);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Also check if the event was already fired before we mounted
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch { /* */ }
    setShow(false);
  }

  async function install() {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        try { localStorage.setItem(STORAGE_KEY, String(Date.now() + DISMISS_TTL * 52)); } catch { /* */ }
      }
    } finally {
      setInstalling(false);
      setShow(false);
    }
  }

  if (!show) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
        onClick={dismiss}
      />

      {/* Bottom sheet */}
      <div className="fixed bottom-0 inset-x-0 z-[91] bg-brand-dark-2 border-t border-brand-dark-4 rounded-t-3xl p-6 pb-safe-or-6 animate-slide-up">
        {/* Dismiss button */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 p-2 rounded-full bg-brand-dark-3 text-brand-chrome hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* App info */}
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 bg-brand-dark-3 border border-brand-dark-4">
            <Image
              src="/icons/icon-192x192.png"
              alt="REVdating"
              width={64}
              height={64}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h2 className="text-lg font-bold">Install REVdating</h2>
            <p className="text-brand-chrome text-sm">revdating.co.uk</p>
          </div>
        </div>

        <p className="text-brand-chrome text-sm mb-5 leading-relaxed">
          Add REVdating to your home screen for the full app experience — faster, works offline, and no browser bar.
        </p>

        {platform === 'ios' ? (
          /* iOS: manual instructions */
          <div className="space-y-3 mb-5">
            <div className="flex items-center gap-3 p-3 bg-brand-dark-3 rounded-xl">
              <Share className="w-5 h-5 text-brand-orange flex-shrink-0" />
              <p className="text-sm">
                Tap the <strong>Share</strong> button at the bottom of your browser
              </p>
            </div>
            <div className="flex items-center gap-3 p-3 bg-brand-dark-3 rounded-xl">
              <Plus className="w-5 h-5 text-brand-orange flex-shrink-0" />
              <p className="text-sm">
                Scroll down and tap <strong>&ldquo;Add to Home Screen&rdquo;</strong>
              </p>
            </div>
          </div>
        ) : (
          /* Android / Chrome: native install */
          <button
            onClick={install}
            disabled={installing}
            className="w-full py-4 rounded-2xl bg-brand-orange text-white font-bold text-base hover:bg-brand-orange/90 transition-colors disabled:opacity-60 mb-3"
          >
            {installing ? 'Installing…' : 'Install app'}
          </button>
        )}

        <button
          onClick={dismiss}
          className="w-full py-3 rounded-2xl border border-brand-dark-4 text-brand-chrome text-sm hover:text-white transition-colors"
        >
          Not now
        </button>
      </div>
    </>
  );
}
