'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Shield } from 'lucide-react';

export default function AdminLoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError || !data.user) {
      setError('Invalid email or password');
      setLoading(false);
      return;
    }

    // Check admin_users table
    const { data: adminRow } = await supabase
      .from('admin_users')
      .select('role')
      .eq('id', data.user.id)
      .single();

    if (!adminRow) {
      await supabase.auth.signOut();
      setError('This account does not have admin access');
      setLoading(false);
      return;
    }

    // Full reload so the server layout gets the fresh session cookie
    window.location.href = '/admin';
  }

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-brand-orange/10 border border-brand-orange/20 flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-brand-orange" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Login</h1>
          <p className="text-brand-chrome text-sm mt-1">REVdating control panel</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-brand-chrome mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-brand-dark-3 border border-brand-dark-4 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-orange/50"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label className="block text-sm text-brand-chrome mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-brand-dark-3 border border-brand-dark-4 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-orange/50"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-brand-orange text-white font-bold text-sm hover:bg-brand-orange/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
