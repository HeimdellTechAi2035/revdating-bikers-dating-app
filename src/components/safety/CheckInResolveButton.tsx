'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface Props {
  id: string;
}

export default function CheckInResolveButton({ id }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function resolve() {
    setLoading(true);
    try {
      const res = await fetch(`/api/safety/checkin/${id}`, { method: 'PATCH' });
      if (!res.ok) throw new Error();
      toast.success('Check-in resolved — glad you\'re safe! 🏍️');
      router.refresh();
    } catch {
      toast.error('Failed to resolve check-in');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={resolve}
      disabled={loading}
      className="flex-1 py-2 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-semibold hover:bg-green-500/30 transition-colors disabled:opacity-50"
    >
      {loading ? 'Saving…' : "✓ I'm safe"}
    </button>
  );
}
