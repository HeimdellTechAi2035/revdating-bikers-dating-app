'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { analytics } from '@/lib/analytics';

const schema = z.object({
  reported_user_id: z.string().uuid().optional(),
  content_type:     z.enum(['profile', 'photo', 'message', 'chat', 'other']),
  content_id:       z.string().max(200).optional(),
  category:         z.enum(['csam', 'terrorism', 'violence', 'trafficking', 'extremism', 'other_illegal']),
  description:      z.string().min(10, 'Please provide more detail (at least 10 characters)').max(2000),
});

type FormData = z.infer<typeof schema>;

const CATEGORIES = [
  { value: 'csam',          label: 'Child sexual abuse material (CSAM)' },
  { value: 'terrorism',     label: 'Terrorism or violent extremism' },
  { value: 'trafficking',   label: 'Human trafficking or exploitation' },
  { value: 'violence',      label: 'Credible threat of violence' },
  { value: 'extremism',     label: 'Violent extremism' },
  { value: 'other_illegal', label: 'Other illegal content' },
] as const;

const CONTENT_TYPES = [
  { value: 'profile', label: 'Profile / bio' },
  { value: 'photo',   label: 'Photo' },
  { value: 'message', label: 'Message or chat' },
  { value: 'chat',    label: 'Chat conversation' },
  { value: 'other',   label: 'Other' },
] as const;

interface Props {
  reportedUserId?:   string;
  reportedUserName?: string;
  onClose?:          () => void;
}

export default function ReportIllegalContent({ reportedUserId, reportedUserName, onClose }: Props) {
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      reported_user_id: reportedUserId,
      content_type:     'profile',
      category:         'other_illegal',
    },
  });

  async function onSubmit(data: FormData) {
    const res = await fetch('/api/reports/illegal', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error ?? 'Failed to submit report. Please try again.');
      return;
    }

    analytics.reportSubmitted('illegal_content');
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="text-center py-8 px-4 space-y-4">
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-green-400" />
        </div>
        <h3 className="font-bold text-lg">Report received</h3>
        <p className="text-brand-chrome text-sm leading-relaxed max-w-xs mx-auto">
          Thank you. Our safety team will review this urgently. If a child is in immediate danger, contact{' '}
          <strong className="text-white">police (999)</strong> or the{' '}
          <strong className="text-white">NSPCC (0808 800 5000)</strong> right now.
        </p>
        {onClose && (
          <button
            onClick={onClose}
            className="mt-2 px-6 py-2.5 rounded-xl bg-brand-dark-3 border border-brand-dark-4 text-sm font-medium hover:border-brand-orange/50 transition-colors"
          >
            Close
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Immediate danger warning */}
      <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/25 rounded-xl p-3">
        <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
        <p className="text-red-300 text-xs leading-relaxed">
          <strong>Immediate danger?</strong> Call <strong>999</strong> now. For CSAM, also contact the{' '}
          <strong>NSPCC (0808 800 5000)</strong>. Do not wait for our response.
        </p>
      </div>

      {reportedUserName && (
        <p className="text-sm text-brand-chrome">
          Reporting: <span className="text-white font-semibold">{reportedUserName}</span>
        </p>
      )}

      <div>
        <label className="block text-sm font-medium mb-1.5">What are you reporting?</label>
        <select
          {...register('content_type')}
          className="w-full px-3 py-2.5 rounded-xl bg-brand-dark-3 border border-brand-dark-4 text-sm focus:outline-none focus:border-brand-orange/50 transition-colors"
        >
          {CONTENT_TYPES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Category of concern <span className="text-red-400">*</span></label>
        <select
          {...register('category')}
          className="w-full px-3 py-2.5 rounded-xl bg-brand-dark-3 border border-brand-dark-4 text-sm focus:outline-none focus:border-brand-orange/50 transition-colors"
        >
          {CATEGORIES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">
          Describe what you found <span className="text-red-400">*</span>
        </label>
        <textarea
          {...register('description')}
          rows={4}
          placeholder="Please describe what you saw and why you believe it is illegal or harmful…"
          className="w-full px-3 py-2.5 rounded-xl bg-brand-dark-3 border border-brand-dark-4 text-sm resize-none focus:outline-none focus:border-brand-orange/50 transition-colors"
        />
        {errors.description && (
          <p className="text-red-400 text-xs mt-1">{errors.description.message}</p>
        )}
      </div>

      <div className="flex gap-3">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-brand-dark-4 text-brand-chrome text-sm font-medium hover:border-brand-orange/50 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Submitting…' : 'Submit report'}
        </button>
      </div>
    </form>
  );
}
