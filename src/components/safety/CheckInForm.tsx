'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ClipboardCheck, ArrowLeft, Clock, MapPin, Phone, User } from 'lucide-react';

const schema = z.object({
  ride_description:        z.string().min(3, 'Please describe where you are going').max(500),
  destination_name:        z.string().max(200).optional(),
  expected_return_at:      z.string().min(1, 'Return time required'),
  emergency_contact_name:  z.string().max(100).optional(),
  emergency_contact_phone: z.string().max(30).optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  savedContactName:  string | null;
  savedContactPhone: string | null;
}

export default function CheckInForm({ savedContactName, savedContactPhone }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Default expected return to 3 hours from now
  const defaultReturn = new Date(Date.now() + 3 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16); // "YYYY-MM-DDTHH:mm"

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      expected_return_at:      defaultReturn,
      emergency_contact_name:  savedContactName  ?? '',
      emergency_contact_phone: savedContactPhone ?? '',
    },
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      // Convert local datetime-local value to ISO string
      const expectedReturn = new Date(data.expected_return_at).toISOString();

      const res = await fetch('/api/safety/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ride_description:        data.ride_description,
          destination_name:        data.destination_name || undefined,
          expected_return_at:      expectedReturn,
          emergency_contact_name:  data.emergency_contact_name  || undefined,
          emergency_contact_phone: data.emergency_contact_phone || undefined,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? 'Failed to start check-in');
      }

      toast.success('Check-in started — ride safe! 🏍️');
      router.push('/safety');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start check-in');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-5 py-4 space-y-6 pb-10">
      {/* Header */}
      <div>
        <Link href="/safety" className="flex items-center gap-1.5 text-brand-chrome text-sm mb-4 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Safety
        </Link>
        <div className="flex items-center gap-3 mb-1">
          <ClipboardCheck className="w-6 h-6 text-brand-orange" />
          <h1 className="text-xl font-bold">Start Ride Check-In</h1>
        </div>
        <p className="text-brand-chrome text-sm">
          Let someone know you&apos;re out. If you don&apos;t check back in by your return time, your emergency contact will be notified.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Ride description */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-brand-chrome uppercase tracking-wider mb-1.5">
            <MapPin className="w-3.5 h-3.5" /> Where are you going? *
          </label>
          <textarea
            {...register('ride_description')}
            rows={3}
            placeholder="e.g. Riding up to the Peak District with a date, back via the A6"
            className="w-full px-3 py-2.5 rounded-xl bg-brand-dark-3 border border-brand-dark-4 text-sm resize-none outline-none focus:border-brand-orange transition-colors"
          />
          {errors.ride_description && (
            <p className="text-red-400 text-xs mt-1">{errors.ride_description.message}</p>
          )}
        </div>

        {/* Destination name (optional) */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-brand-chrome uppercase tracking-wider mb-1.5">
            <MapPin className="w-3.5 h-3.5" /> Destination name (optional)
          </label>
          <input
            {...register('destination_name')}
            placeholder="e.g. Mam Tor Car Park, Derbyshire"
            className="w-full px-3 py-2.5 rounded-xl bg-brand-dark-3 border border-brand-dark-4 text-sm outline-none focus:border-brand-orange transition-colors"
          />
        </div>

        {/* Expected return */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-brand-chrome uppercase tracking-wider mb-1.5">
            <Clock className="w-3.5 h-3.5" /> Expected return time *
          </label>
          <input
            {...register('expected_return_at')}
            type="datetime-local"
            className="w-full px-3 py-2.5 rounded-xl bg-brand-dark-3 border border-brand-dark-4 text-sm outline-none focus:border-brand-orange transition-colors"
          />
          {errors.expected_return_at && (
            <p className="text-red-400 text-xs mt-1">{errors.expected_return_at.message}</p>
          )}
        </div>

        {/* Emergency contact */}
        <div className="p-4 bg-brand-dark-3 rounded-2xl border border-brand-dark-4 space-y-3">
          <p className="text-xs font-semibold text-brand-chrome uppercase tracking-wider">
            Emergency contact
          </p>
          <div>
            <label className="flex items-center gap-1.5 text-xs text-brand-chrome mb-1.5">
              <User className="w-3.5 h-3.5" /> Contact name
            </label>
            <input
              {...register('emergency_contact_name')}
              placeholder="e.g. Jane Smith"
              className="w-full px-3 py-2.5 rounded-xl bg-brand-dark-2 border border-brand-dark-4 text-sm outline-none focus:border-brand-orange transition-colors"
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs text-brand-chrome mb-1.5">
              <Phone className="w-3.5 h-3.5" /> Contact phone
            </label>
            <input
              {...register('emergency_contact_phone')}
              type="tel"
              placeholder="+44 7700 900000"
              className="w-full px-3 py-2.5 rounded-xl bg-brand-dark-2 border border-brand-dark-4 text-sm outline-none focus:border-brand-orange transition-colors"
            />
          </div>
          <p className="text-brand-chrome text-xs">
            Pre-filled from your saved emergency contact. Update it on the{' '}
            <Link href="/safety" className="text-brand-orange hover:underline">Safety page</Link>.
          </p>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-2xl bg-brand-orange text-white font-bold text-base hover:bg-brand-orange/90 transition-colors disabled:opacity-50"
        >
          {loading ? 'Starting check-in…' : '🏍️ Start check-in'}
        </button>

        <p className="text-brand-chrome text-xs text-center">
          Remember to check back in when you return safely. If you don&apos;t, we&apos;ll alert your emergency contact.
        </p>
      </form>
    </div>
  );
}
