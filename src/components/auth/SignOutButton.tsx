'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LogOut } from 'lucide-react';

export function SignOutButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function signOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      disabled={loading}
      className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
    >
      <LogOut size={18} />
      <span>{loading ? 'Signing out…' : 'Sign out'}</span>
    </button>
  );
}
