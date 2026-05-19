'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Bike, ArrowLeft, Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [sent, setSent] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const email = data.email.trim().toLowerCase();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      // Always show success even if account doesn't exist (prevents email enumeration)
      setSentTo(email);
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center px-4 text-center">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 rounded-2xl bg-brand-orange/10 flex items-center justify-center mb-4">
              <Bike className="w-8 h-8 text-brand-orange" />
            </div>
            <h1 className="text-3xl font-bold gradient-text">REVdating</h1>
          </div>

          <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-6">
            <Mail className="w-10 h-10 text-blue-400" />
          </div>

          <h2 className="text-2xl font-bold mb-3">Reset link sent</h2>
          <p className="text-brand-chrome text-sm mb-2">We&apos;ve sent a password reset link to</p>
          <p className="text-white font-semibold mb-4 break-all">{sentTo}</p>
          <p className="text-brand-chrome text-sm leading-relaxed">
            Click the link in the email to choose a new password. The link expires in 1 hour.
          </p>

          <div className="mt-8 bg-brand-dark-2 rounded-2xl p-4 text-left space-y-3">
            {[
              'Check your inbox (and spam folder)',
              'Click "Reset password" in the email',
              'Choose a new strong password',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-brand-orange/20 text-brand-orange text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-brand-chrome">{step}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => setSent(false)}
            className="mt-8 text-brand-chrome text-sm hover:text-white transition-colors"
          >
            Didn&apos;t receive it? Try again
          </button>

          <div className="mt-4">
            <Link href="/login" className="text-brand-orange hover:underline text-sm font-medium">
              Back to sign in
            </Link>
          </div>
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
          <p className="text-brand-chrome mt-2 text-sm">Password recovery</p>
        </div>

        <h2 className="text-xl font-bold mb-2">Forgot your password?</h2>
        <p className="text-brand-chrome text-sm mb-6 leading-relaxed">
          Enter the email address associated with your account and we&apos;ll send you a reset link.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <label
              className="block text-sm font-medium text-brand-chrome mb-1.5"
              htmlFor="email"
            >
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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-brand-orange hover:bg-brand-orange-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base transition-colors"
          >
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <Link
          href="/login"
          className="flex items-center justify-center gap-2 mt-6 text-brand-chrome hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
