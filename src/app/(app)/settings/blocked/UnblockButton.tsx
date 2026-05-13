'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export function UnblockButton({ blockedId }: { blockedId: string }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleUnblock() {
    if (pending) return;
    setPending(true);
    try {
      const res = await fetch(`/api/block?blocked_id=${blockedId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      toast.success('User unblocked');
      router.refresh();
    } catch {
      toast.error('Could not unblock — try again');
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      onClick={handleUnblock}
      disabled={pending}
      className="px-3 py-1.5 rounded-xl border border-brand-dark-4 text-xs font-medium text-brand-chrome hover:border-brand-orange/40 hover:text-brand-orange transition-colors disabled:opacity-50"
    >
      {pending ? '...' : 'Unblock'}
    </button>
  );
}
