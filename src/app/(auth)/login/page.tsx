'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Bike, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type FormData = z.infer<typeof schema>;

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Show error passed from auth callback (e.g. expired link)
  const callbackError = searchParams.get('error');
  useEffect(() => {
    if (callbackError) {
      toast.error(decodeURIComponent(callbackError));
    }
  }, [callbackError]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function signInAsDemo() {
    const DEMO_EMAIL = 'andrewjamessmith1984@gmail.com';
    const DEMO_PASSWORD = 'Stevo1984@@@!?';
    setValue('email', DEMO_EMAIL);
    setValue('password', DEMO_PASSWORD);
    setLoading(true);
    try {
      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });
      if (error) { toast.error('Demo account unavailable'); return; }
      const userId = signInData.user?.id;
      const { data: profile } = userId
        ? await supabase.from('profiles').select('onboarding_complete, is_banned').eq('id', userId).single()
        : { data: null };
      if (!profile?.onboarding_complete) { router.push('/onboarding'); }
      else { router.push('/discover'); }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email: data.email.trim().toLowerCase(),
        password: data.password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Incorrect email or password');
        } else if (error.message.includes('Email not confirmed')) {
          toast.error('Please verify your email address before signing in');
        } else {
          toast.error(error.message);
        }
        return;
      }

      // Use the user ID from the sign-in response directly so we don't
      // rely on the session cookie being set before the profile query runs.
      const userId = signInData.user?.id;
      const { data: profile } = userId
        ? await supabase.from('profiles').select('onboarding_complete, is_banned').eq('id', userId).single()
        : { data: null };

      if (profile?.is_banned) {
        router.push('/banned');
        return;
      }

      const redirectTo = searchParams.get('redirectTo');
      if (!profile?.onboarding_complete) {
        router.push('/onboarding');
      } else if (redirectTo?.startsWith('/')) {
        router.push(redirectTo);
      } else {
        router.push('/discover');
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-brand-orange/10 flex items-center justify-center mb-4">
            <Bike className="w-8 h-8 text-brand-orange" />
          </div>
          <h1 className="text-3xl font-bold gradient-text">REVdating</h1>
          <p className="text-brand-chrome mt-2 text-sm">Welcome back, rider</p>
        </div>

        {/* Callback error banner */}
        {callbackError && (
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-xs leading-relaxed">
              {decodeURIComponent(callbackError)}
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <label className="block text-sm font-medium text-brand-chrome mb-1.5" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="w-full px-4 py-3 rounded-xl bg-brand-dark-3 border border-brand-dark-4 text-white placeholder:text-brand-chrome-dark focus:outline-none focus:border-brand-orange transition-colors"
              placeholder="you@example.com"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-red-400 text-xs mt-1.5">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-chrome mb-1.5" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
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
            <div className="flex justify-end mt-1.5">
              <Link
                href="/forgot-password"
                className="text-xs text-brand-chrome hover:text-brand-orange transition-colors"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-brand-orange hover:bg-brand-orange-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-brand-chrome text-sm mt-6">
          New to REVdating?{' '}
          <Link href="/register" className="text-brand-orange hover:underline font-medium">
            Create account
          </Link>
        </p>

        <p className="text-center mt-8 text-xs text-brand-chrome-dark">
          By signing in you agree to our{' '}
          <Link href="/terms" className="underline hover:text-brand-chrome">Terms</Link>
          {' '}and{' '}
          <Link href="/privacy" className="underline hover:text-brand-chrome">Privacy Policy</Link>.
        </p>

        {/* Demo access — for Google Play reviewers */}
        <div className="mt-8 pt-6 border-t border-brand-dark-4">
          <p className="text-center text-xs text-brand-chrome-dark mb-3">Google Play reviewer?</p>
          <button
            type="button"
            onClick={signInAsDemo}
            disabled={loading}
            className="w-full py-3 rounded-xl border border-brand-dark-4 text-brand-chrome text-sm font-medium hover:border-brand-orange/30 hover:text-white transition-colors disabled:opacity-50"
          >
            Sign in with demo account
          </button>
          <p className="text-center text-xs text-brand-chrome-dark/60 mt-2">
            andrewjamessmith1984@gmail.com · Stevo1984@@@!?
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
