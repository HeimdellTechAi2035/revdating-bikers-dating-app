'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { ToggleLeft, ToggleRight } from 'lucide-react';

interface Props {
  initial: boolean;
}

export default function LocationPrivacyToggle({ initial }: Props) {
  const [enabled, setEnabled] = useState(initial);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const next = !enabled;
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hide_exact_location: next }),
      });
      if (!res.ok) throw new Error();
      setEnabled(next);
      toast.success(next ? 'Exact location hidden' : 'Location privacy off');
    } catch {
      toast.error('Failed to update setting');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="flex items-center justify-between w-full p-4 rounded-2xl bg-brand-dark-3 border border-brand-dark-4 hover:border-brand-orange/30 transition-colors disabled:opacity-50"
    >
      <div className="text-left">
        <p className="font-semibold text-sm">Hide exact location</p>
        <p className="text-brand-chrome text-xs mt-0.5">
          {enabled
            ? 'Only approximate distance shown to others'
            : 'Your city name is visible to other riders'}
        </p>
      </div>
      {enabled
        ? <ToggleRight className="w-7 h-7 text-brand-orange flex-shrink-0" />
        : <ToggleLeft  className="w-7 h-7 text-brand-chrome flex-shrink-0" />
      }
    </button>
  );
}
