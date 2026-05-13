'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Trash2, AlertTriangle, Eye, EyeOff, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';

const schema = z.object({
  password:     z.string().min(1, 'Enter your password'),
  confirmation: z.literal('DELETE MY ACCOUNT', {
    errorMap: () => ({ message: 'Type DELETE MY ACCOUNT exactly to confirm' }),
  }),
  reason: z.string().max(1000).optional(),
});

type FormData = z.infer<typeof schema>;

export default function DeleteAccountPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    const res = await fetch('/api/gdpr/delete', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    });

    const json = await res.json();

    if (!res.ok) {
      toast.error(json.error ?? 'Deletion failed. Please try again.');
      return;
    }

    // Session is now invalid — redirect to confirmation page
    router.push('/account-deleted');
  }

  return (
    <div className="px-5 py-4 space-y-6 pb-16">
      {/* Back */}
      <Link
        href="/settings"
        className="flex items-center gap-1.5 text-brand-chrome text-sm hover:text-white transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Settings
      </Link>

      {/* Title */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-red-400" />
          Delete account
        </h1>
        <p className="text-brand-chrome text-sm mt-1">This action is permanent and cannot be undone.</p>
      </div>

      {/* What gets deleted */}
      <div className="bg-red-500/8 border border-red-500/20 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="font-semibold text-sm text-red-400">What will be deleted</p>
        </div>
        <ul className="text-brand-chrome text-xs space-y-1.5 pl-2">
          <li>• Your profile, bio, and all personal information</li>
          <li>• All uploaded photos</li>
          <li>• All matches and conversations</li>
          <li>• Your verification records</li>
          <li>• Your subscription (cancels immediately — no refund for unused period)</li>
        </ul>
        <p className="text-brand-chrome text-xs border-t border-red-500/20 pt-3">
          Payment records are retained for 7 years as required by UK law.
          For data queries, email <a href="mailto:privacy@REVdating.app" className="text-brand-orange">privacy@REVdating.app</a>.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Optional reason */}
        <div>
          <label className="block text-sm font-medium mb-1.5 text-brand-chrome">
            Reason for leaving <span className="text-brand-chrome/60">(optional)</span>
          </label>
          <textarea
            {...register('reason')}
            rows={2}
            placeholder="Help us improve…"
            className="w-full px-4 py-3 rounded-xl bg-brand-dark-3 border border-brand-dark-4 text-white text-sm placeholder:text-brand-chrome-dark focus:outline-none focus:border-brand-orange/50 transition-colors resize-none"
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="delete-password">
            Your password
          </label>
          <div className="relative">
            <input
              id="delete-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className="w-full px-4 py-3 pr-12 rounded-xl bg-brand-dark-3 border border-brand-dark-4 text-white placeholder:text-brand-chrome-dark focus:outline-none focus:border-red-500/50 transition-colors"
              placeholder="Enter your password to confirm"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-chrome hover:text-white"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-red-400 text-xs mt-1.5">{errors.password.message}</p>
          )}
        </div>

        {/* Confirmation text */}
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="delete-confirm">
            Type <span className="text-red-400 font-mono">DELETE MY ACCOUNT</span> to confirm
          </label>
          <input
            id="delete-confirm"
            type="text"
            className="w-full px-4 py-3 rounded-xl bg-brand-dark-3 border border-brand-dark-4 text-white font-mono text-sm placeholder:text-brand-chrome-dark focus:outline-none focus:border-red-500/50 transition-colors"
            placeholder="DELETE MY ACCOUNT"
            {...register('confirmation')}
          />
          {errors.confirmation && (
            <p className="text-red-400 text-xs mt-1.5">{errors.confirmation.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3.5 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Deleting account…' : 'Delete my account permanently'}
        </button>

        <Link
          href="/settings"
          className="block w-full py-3 rounded-xl border border-brand-dark-4 text-brand-chrome text-sm font-medium text-center hover:border-brand-orange/50 transition-colors"
        >
          Cancel — keep my account
        </Link>
      </form>
    </div>
  );
}
