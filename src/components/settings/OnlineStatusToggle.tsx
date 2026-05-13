'use client';

import { useState } from 'react';
import { Eye } from 'lucide-react';
import toast from 'react-hot-toast';

export default function OnlineStatusToggle({ initial }: { initial: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    try {
      const res = await fetch('/api/settings/online-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ show_online_status: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setEnabled(!next);
      toast.error('Failed to update setting');
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={saving}
      className="w-full flex items-center gap-3 p-3 text-sm disabled:opacity-60"
    >
      <span className="text-brand-chrome"><Eye className="w-4 h-4" /></span>
      <span className="flex-1 font-medium text-left">Show online status</span>
      <div className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-green-500' : 'bg-brand-dark-4'}`}>
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
      </div>
    </button>
  );
}
