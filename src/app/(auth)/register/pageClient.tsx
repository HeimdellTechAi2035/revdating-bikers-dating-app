'use client';

export const dynamic = 'force-dynamic';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Bike } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { isEighteenOrOlder } from '@/lib/utils';
import { GenderType } from '@/types';
import { analytics } from '@/lib/analytics';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Include at least one uppercase letter')
    .regex(/[0-9]/, 'Include at least one number'),
  display_name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(30, 'Name must be 30 characters or fewer')
    .regex(/^[a-zA-Z0-9 _'-]+$/, 'Name contains invalid characters'),
  date_of_birth: z.string().refine((val) => {
    if (!val) return false;
    return isEighteenOrOlder(val);
  }, 'You must be 18 or older to use REVdating'),
  gender: z.enum(['man', 'woman', 'non_binary', 'other', 'prefer_not_to_say'] as const),
  agree_terms: z.boolean().refine((v) => v === true, 'You must accept the terms'),
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const startedRef = useRef(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  function handleFormFocus() {
    if (startedRef.current) return;
    startedRef.current = true;
    analytics.signUpStarted();
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: data.email.trim().toLowerCase(),
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            display_name: data.display_name.trim(),
            date_of_birth: data.date_of_birth,
            gender: data.gender as GenderType,
          },
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('An account with this email already exists');
        } else {
          toast.error(error.message);
        }
        return;
      }

      analytics.signUpCompleted();

      // If Supabase auto-confirmed the account (no email verification required),
      // a session is returned immediately — go straight to onboarding.
      if (signUpData.session) {
        router.push('/onboarding');
        return;
      }

      // Otherwise send to verify-email page to wait for confirmation link.
      const encoded = encodeURIComponent(data.email.trim().toLowerCase());
      router.push(`/verify-email?email=${encoded}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-brand-orange/10 flex items-center justify-center mb-4">
            <Bike className="w-8 h-8 text-brand-orange" />
          </div>
          <h1 className="text-3xl font-bold gradient-text">REVdating</h1>
          <p className="text-brand-chrome mt-2 text-sm">Join the biker community</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} onFocus={handleFormFocus} className="space-y-4" noValidate>
          {/* Display name */}
          <div>
            <label className="block text-sm font-medium text-brand-chrome mb-1.5" htmlFor="display_name">
              Rider name
            </label>
            <input
              id="display_name"
              type="text"
              autoComplete="nickname"
              className="w-full px-4 py-3 rounded-xl bg-brand-dark-3 border border-brand-dark-4 text-white placeholder:text-brand-chrome-dark focus:outline-none focus:border-brand-orange transition-colors"
              placeholder="What should we call you?"
              {...register('display_name')}
            />
            {errors.display_name && (
              <p className="text-red-400 text-xs mt-1.5">{errors.display_name.message}</p>
            )}
          </div>

          {/* Email */}
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

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-brand-chrome mb-1.5" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className="w-full px-4 py-3 pr-12 rounded-xl bg-brand-dark-3 border border-brand-dark-4 text-white placeholder:text-brand-chrome-dark focus:outline-none focus:border-brand-orange transition-colors"
                placeholder="Min. 8 chars, 1 uppercase, 1 number"
                {...register('password')}
              />
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-chrome hover:text-white"
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

          {/* Date of birth */}
          <div>
            <label className="block text-sm font-medium text-brand-chrome mb-1.5" htmlFor="date_of_birth">
              Date of birth <span className="text-brand-chrome-dark">(must be 18+)</span>
            </label>
            <input
              id="date_of_birth"
              type="date"
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 rounded-xl bg-brand-dark-3 border border-brand-dark-4 text-white focus:outline-none focus:border-brand-orange transition-colors"
              {...register('date_of_birth')}
            />
            {errors.date_of_birth && (
              <p className="text-red-400 text-xs mt-1.5">{errors.date_of_birth.message}</p>
            )}
          </div>

          {/* Gender */}
          <div>
            <label className="block text-sm font-medium text-brand-chrome mb-1.5" htmlFor="gender">
              I am a
            </label>
            <select
              id="gender"
              className="w-full px-4 py-3 rounded-xl bg-brand-dark-3 border border-brand-dark-4 text-white focus:outline-none focus:border-brand-orange transition-colors"
              {...register('gender')}
            >
              <option value="" disabled>Select…</option>
              <option value="man">Man</option>
              <option value="woman">Woman</option>
              <option value="non_binary">Non-binary</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
            {errors.gender && (
              <p className="text-red-400 text-xs mt-1.5">{errors.gender.message}</p>
            )}
          </div>

          {/* Terms */}
          <div className="flex items-start gap-3">
            <input
              id="agree_terms"
              type="checkbox"
              className="mt-0.5 w-4 h-4 rounded accent-brand-orange"
              {...register('agree_terms')}
            />
            <label htmlFor="agree_terms" className="text-sm text-brand-chrome leading-relaxed">
              I agree to the{' '}
              <Link href="/terms" className="text-brand-orange hover:underline" target="_blank">Terms of Service</Link>
              {' '}and{' '}
              <Link href="/privacy" className="text-brand-orange hover:underline" target="_blank">Privacy Policy</Link>.
              I am 18 or older.
            </label>
          </div>
          {errors.agree_terms && (
            <p className="text-red-400 text-xs">{errors.agree_terms.message}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-brand-orange hover:bg-brand-orange-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base transition-colors"
          >
            {loading ? 'Creating account…' : 'Create free account'}
          </button>
        </form>

        <p className="text-center text-brand-chrome text-sm mt-6">
          Already a member?{' '}
          <Link href="/login" className="text-brand-orange hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
