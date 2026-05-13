'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const schema = z.object({
  password: z.string().min(1, 'Password required'),
});

type FormData = z.infer<typeof schema>;

// Pre-configured access — email is set server-side, only password is entered
const ACCESS_EMAIL = 'andrew@heimdell-tech-ai.co.uk';

export default function PortalPage() {
  const router = useRouter();
  const supabase = createClient();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: ACCESS_EMAIL,
        password: data.password,
      });

      if (error) {
        toast.error('Access denied');
        return;
      }

      // Verify admin status before granting access
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('role')
        .eq('id', (await supabase.auth.getUser()).data.user?.id ?? '')
        .maybeSingle();

      if (!adminUser) {
        await supabase.auth.signOut();
        toast.error('Access denied');
        return;
      }

      router.push('/admin');
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-xs">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Hidden identifier — not rendered in the DOM */}
          <input type="hidden" name="identifier" value={ACCESS_EMAIL} readOnly />

          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Access key"
              className="w-full px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors pr-12"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {errors.password && (
            <p className="text-red-500 text-xs">{errors.password.message}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
