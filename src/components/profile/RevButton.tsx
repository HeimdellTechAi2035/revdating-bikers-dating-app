'use client';

import { useState } from 'react';
import { Flame } from 'lucide-react';

interface RevButtonProps {
  receiverId: string;
  initialCount: number;
  initialRevved: boolean;
  disabled?: boolean;
}

export function RevButton({
  receiverId,
  initialCount,
  initialRevved,
  disabled = false,
}: RevButtonProps) {
  const [count, setCount] = useState(initialCount);
  const [revved, setRevved] = useState(initialRevved);
  const [pending, setPending] = useState(false);

  async function handleToggle() {
    if (pending) return;
    const wasRevved = revved;
    const prevCount = count;
    setRevved(!wasRevved);
    setCount(wasRevved ? prevCount - 1 : prevCount + 1);
    setPending(true);
    try {
      const res = await fetch('/api/revs', {
        method: wasRevved ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId }),
      });
      if (!res.ok) throw new Error('Request failed');
      const data: { revved: boolean; count: number } = await res.json();
      setRevved(data.revved);
      setCount(data.count);
    } catch {
      setRevved(wasRevved);
      setCount(prevCount);
    } finally {
      setPending(false);
    }
  }

  if (disabled) {
    return (
      <span
        className="flex items-center gap-1.5 text-brand-chrome/40 cursor-not-allowed select-none"
        title="You can't rev your own profile"
        aria-label={`${count} revs`}
      >
        <Flame size={18} aria-hidden />
        <span className="text-sm font-semibold">{count}</span>
      </span>
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={pending}
      aria-label={revved ? `Un-rev — ${count} revs` : `Rev this profile — ${count} revs`}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${
        revved
          ? 'bg-brand-orange/15 border-brand-orange/50 text-brand-orange'
          : 'bg-brand-dark-3 border-brand-dark-4 text-brand-chrome hover:border-brand-orange/40 hover:text-brand-orange'
      } ${pending ? 'opacity-60' : ''}`}
    >
      <Flame size={16} className={revved ? 'fill-brand-orange' : ''} aria-hidden />
      <span className="text-sm font-semibold">{count}</span>
    </button>
  );
}
