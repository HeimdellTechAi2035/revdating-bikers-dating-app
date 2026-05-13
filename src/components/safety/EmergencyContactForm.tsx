'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import { Phone, User, Save } from 'lucide-react';

const schema = z.object({
  emergency_contact_name:  z.string().min(1, 'Name required').max(100),
  emergency_contact_phone: z.string().min(5, 'Phone required').max(30),
});
type FormData = z.infer<typeof schema>;

interface Props {
  initialName:  string | null;
  initialPhone: string | null;
}

export default function EmergencyContactForm({ initialName, initialPhone }: Props) {
  const [saved, setSaved] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      emergency_contact_name:  initialName  ?? '',
      emergency_contact_phone: initialPhone ?? '',
    },
  });

  async function onSubmit(data: FormData) {
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      toast.success('Emergency contact saved');
    } catch {
      toast.error('Failed to save contact');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div>
        <label className="text-xs text-brand-chrome font-medium flex items-center gap-1.5 mb-1.5">
          <User className="w-3.5 h-3.5" /> Contact name
        </label>
        <input
          {...register('emergency_contact_name')}
          placeholder="e.g. Jane Smith"
          className="w-full px-3 py-2.5 rounded-xl bg-brand-dark-2 border border-brand-dark-4 text-sm outline-none focus:border-brand-orange transition-colors"
        />
        {errors.emergency_contact_name && (
          <p className="text-red-400 text-xs mt-1">{errors.emergency_contact_name.message}</p>
        )}
      </div>
      <div>
        <label className="text-xs text-brand-chrome font-medium flex items-center gap-1.5 mb-1.5">
          <Phone className="w-3.5 h-3.5" /> Contact phone
        </label>
        <input
          {...register('emergency_contact_phone')}
          type="tel"
          placeholder="+44 7700 900000"
          className="w-full px-3 py-2.5 rounded-xl bg-brand-dark-2 border border-brand-dark-4 text-sm outline-none focus:border-brand-orange transition-colors"
        />
        {errors.emergency_contact_phone && (
          <p className="text-red-400 text-xs mt-1">{errors.emergency_contact_phone.message}</p>
        )}
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange/90 transition-colors disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        {saved ? 'Saved!' : 'Save contact'}
      </button>
      <p className="text-brand-chrome text-xs">
        This contact is pre-filled when you start a Ride Check-In. It&apos;s stored privately and never shown to other riders.
      </p>
    </form>
  );
}
