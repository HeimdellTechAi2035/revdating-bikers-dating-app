'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Bike, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Include at least one uppercase letter')
      .regex(/[0-9]/, 'Include at least one number'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // Verify the user arrived here with a valid recovery session.
  // The callback route exchanges the code before redirecting here,
  // so the user will have a session in the Supabase cookie.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
      setSessionChecked(true);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      setDone(true);
      toast.success('Password updated successfully');

      // Sign out so the user logs in fresh with the new password
      await supabase.auth.signOut();
      setTimeout(() => router.push('/login'), 2000);
    } finally {
      setLoading(false);
    }
  };

  // Loading check
  if (!sessionChecked) {
    return (
      <div className="min-h-screen bg-brand-dark flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-orange border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // No valid session — link is expired or was already used
  if (!hasSession) {
    return (
      <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center px-4 text-center">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-brand-orange/10 flex items-center justify-center mb-4">
              <Bike className="w-8 h-8 text-brand-orange" />
            </div>
            <h1 className="text-3xl font-bold gradient-text">REVdating</h1>
          </div>

          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">⚠️</span>
          </div>

          <h2 className="text-xl font-bold mb-3">Link expired</h2>
          <p className="text-brand-chrome text-sm leading-relaxed mb-8">
            This password reset link has expired or has already been used. Please request a new one.
          </p>

          <a
            href="/forgot-password"
            className="block w-full py-3.5 rounded-xl bg-brand-orange hover:bg-brand-orange-dark text-white font-bold text-base transition-colors text-center"
          >
            Request new link
          </a>
        </div>
      </div>
    );
  }

  // Success state
  if (done) {
    return (
      <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center px-4 text-center">
        <div className="w-full max-w-sm">
          <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="w-10 h-10 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Password updated</h2>
          <p className="text-brand-chrome text-sm">Redirecting you to sign in…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-brand-orange/10 flex items-center justify-center mb-4">
            <Bike className="w-8 h-8 text-brand-orange" />
          </div>
          <h1 className="text-3xl font-bold gradient-text">REVdating</h1>
          <p className="text-brand-chrome mt-2 text-sm">Choose a new password</p>
        </div>

        <h2 className="text-xl font-bold mb-2">Reset your password</h2>
        <p className="text-brand-chrome text-sm mb-6">
          Choose a strong password you haven&apos;t used before.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* New password */}
          <div>
            <label
              className="block text-sm font-medium text-brand-chrome mb-1.5"
              htmlFor="password"
            >
              New password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className="w-full px-4 py-3 pr-12 rounded-xl bg-brand-dark-3 border border-brand-dark-4 text-white placeholder:text-brand-chrome-dark focus:outline-none focus:border-brand-orange transition-colors"
                placeholder="••••••••"
                {...register('password')}
              />
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-chrome hover:text-white transition-colors"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-400 text-xs mt-1.5">{errors.password.message}</p>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label
              className="block text-sm font-medium text-brand-chrome mb-1.5"
              htmlFor="confirm"
            >
              Confirm new password
            </label>
            <div className="relative">
              <input
                id="confirm"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                className="w-full px-4 py-3 pr-12 rounded-xl bg-brand-dark-3 border border-brand-dark-4 text-white placeholder:text-brand-chrome-dark focus:outline-none focus:border-brand-orange transition-colors"
                placeholder="••••••••"
                {...register('confirm')}
              />
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-chrome hover:text-white transition-colors"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.confirm && (
              <p className="text-red-400 text-xs mt-1.5">{errors.confirm.message}</p>
            )}
          </div>

          {/* Password requirements hint */}
          <ul className="text-xs text-brand-chrome space-y-1 pl-1">
            <li>• At least 8 characters</li>
            <li>• At least one uppercase letter</li>
            <li>• At least one number</li>
          </ul>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-brand-orange hover:bg-brand-orange-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base transition-colors"
          >
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
