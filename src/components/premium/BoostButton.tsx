'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Zap } from 'lucide-react';

interface Props {
  initiallyActive: boolean;
  expiresAt:       string | null;
}

export default function BoostButton({ initiallyActive, expiresAt: initialExpiry }: Props) {
  const [active, setActive]   = useState(initiallyActive);
  const [expiry, setExpiry]   = useState<string | null>(initialExpiry);
  const [loading, setLoading] = useState(false);

  async function activate() {
    setLoading(true);
    try {
      const res = await fetch('/api/boost', { method: 'POST' });
      const json = await res.json();

      if (res.status === 409) {
        toast.error('Boost already active');
        return;
      }
      if (!res.ok) {
        throw new Error(json.error ?? 'Failed to activate boost');
      }

      setActive(true);
      setExpiry(json.boost?.expires_at ?? null);
      toast.success('🚀 Profile boosted for 1 hour!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to activate boost');
    } finally {
      setLoading(false);
    }
  }

  if (active && expiry) {
    const expiresDate = new Date(expiry);
    const minutesLeft = Math.max(0, Math.round((expiresDate.getTime() - Date.now()) / 60000));
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-orange/20 border border-brand-orange/40 text-brand-orange text-xs font-semibold">
        <Zap className="w-3.5 h-3.5 animate-pulse" />
        Boosted · {minutesLeft}m left
      </div>
    );
  }

  return (
    <button
      onClick={activate}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-dark-3 border border-brand-dark-4 text-brand-chrome text-xs font-semibold hover:border-brand-orange/50 hover:text-brand-orange transition-colors disabled:opacity-50"
    >
      <Zap className="w-3.5 h-3.5" />
      {loading ? 'Boosting…' : 'Boost'}
    </button>
  );
}
