'use client';

import { useEffect, useState, useMemo } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { createClient } from '@/lib/supabase/client';

type Profile = Database['public']['Tables']['profiles']['Row'];

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Stable client reference — never recreated between renders
  const supabase = useMemo(() => createClient(), []);

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setProfile(data);
  }

  useEffect(() => {
    // Seed initial state from the current session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        fetchProfile(user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Keep state in sync with auth events (sign-in, sign-out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (nextUser) {
        fetchProfile(nextUser.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOnboarded = profile?.onboarding_complete ?? false;
  const isBanned = profile?.is_banned ?? false;
  const isPremium = profile?.is_premium ?? false;

  return { user, profile, loading, isOnboarded, isBanned, isPremium };
}
