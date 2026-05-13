'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import type { ProfileRow, BikeRow, InterestedInType, DatingIntentType, RidingStyleType, ClubTypeType } from '@/types/database.types';

// ── Schema ────────────────────────────────────────────────────────────────────

const RIDING_STYLES = [
  'cruiser', 'sport', 'touring', 'adventure', 'dirt',
  'chopper', 'cafe_racer', 'bobber', 'naked', 'scooter', 'electric', 'other',
] as const;

const schema = z.object({
  // About
  bio:              z.string().max(500).optional().nullable(),
  interested_in:    z.enum(['men', 'women', 'everyone'] as const).optional(),
  dating_intent:    z.enum(['serious_relationship', 'casual_dating', 'riding_partner', 'friendship', 'open_to_anything'] as const).optional().nullable(),
  smoker:           z.boolean().optional().nullable(),
  drinker:          z.boolean().optional().nullable(),
  // Location
  city:             z.string().max(100).optional(),
  country:          z.string().max(100).optional(),
  max_distance_miles: z.number().min(5).max(500).optional(),
  hide_exact_location: z.boolean().optional(),
  // Riding
  riding_style:     z.enum(RIDING_STYLES).optional().nullable(),
  years_riding:     z.number().min(0).max(80).optional().nullable(),
  attends_rallies:  z.boolean().optional().nullable(),
  has_passenger_helmet: z.boolean().optional().nullable(),
  // Club
  club_type:        z.enum(['MC', 'RC', 'independent', 'none'] as const).optional(),
  club_name:        z.string().max(100).optional().nullable(),
  // Mood
  mood:             z.enum([
    'Looking for a pillion',
    'Planning a Sunday blast',
    'Just chatting bikes',
    'Up for a group ride',
    'Weekend touring',
    'Track day partner wanted',
    'Post-ride coffee date',
  ] as const).optional().nullable(),
  // Primary bike (goes to bikes table)
  bike_brand:       z.string().max(50).optional().nullable(),
  bike_model:       z.string().max(50).optional().nullable(),
  bike_year:        z.number().min(1900).max(new Date().getFullYear() + 1).optional().nullable(),
});

type FormValues = z.infer<typeof schema>;

// ── Props ─────────────────────────────────────────────────────────────────────

const MOODS = [
  { value: 'Looking for a pillion',      emoji: '🏍️' },
  { value: 'Planning a Sunday blast',    emoji: '☀️' },
  { value: 'Just chatting bikes',        emoji: '💬' },
  { value: 'Up for a group ride',        emoji: '👥' },
  { value: 'Weekend touring',            emoji: '🗺️' },
  { value: 'Track day partner wanted',   emoji: '🏁' },
  { value: 'Post-ride coffee date',      emoji: '☕' },
] as const;

interface EditProfileFormProps {
  profile: Pick<ProfileRow,
    'bio' | 'interested_in' | 'dating_intent' | 'smoker' | 'drinker' |
    'city' | 'country' | 'max_distance_miles' | 'hide_exact_location' |
    'riding_style' | 'years_riding' | 'attends_rallies' | 'has_passenger_helmet' |
    'club_type' | 'club_name'
  > & { mood?: string | null };
  bike: Pick<BikeRow, 'bike_brand' | 'bike_model' | 'bike_year' | 'bike_type'> | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EditProfileForm({ profile, bike }: EditProfileFormProps) {
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors, isDirty } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      bio:                  profile.bio ?? '',
      interested_in:        (profile.interested_in as InterestedInType) ?? 'everyone',
      dating_intent:        (profile.dating_intent as DatingIntentType) ?? null,
      smoker:               profile.smoker ?? null,
      drinker:              profile.drinker ?? null,
      city:                 profile.city ?? '',
      country:              profile.country ?? '',
      max_distance_miles:   profile.max_distance_miles ?? 50,
      hide_exact_location:  profile.hide_exact_location ?? false,
      riding_style:         (profile.riding_style as RidingStyleType) ?? null,
      years_riding:         profile.years_riding ?? null,
      attends_rallies:      profile.attends_rallies ?? null,
      has_passenger_helmet: profile.has_passenger_helmet ?? null,
      club_type:            (profile.club_type as ClubTypeType) ?? 'none',
      club_name:            profile.club_name ?? null,
      mood:                 (profile.mood as FormValues['mood']) ?? null,
      bike_brand:           bike?.bike_brand ?? '',
      bike_model:           bike?.bike_model ?? '',
      bike_year:            bike?.bike_year ?? null,
    },
  });

  async function onSubmit(values: FormValues) {
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (res.ok) {
        toast.success('Profile updated');
      } else {
        const d = await res.json();
        toast.error(d.error ?? 'Failed to save');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  }

  const clubType = watch('club_type');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pb-24">

      {/* ── About ── */}
      <section className="bg-brand-dark-3 rounded-2xl p-5 space-y-4 border border-brand-dark-4">
        <h2 className="font-bold text-brand-chrome uppercase text-xs tracking-widest">About</h2>

        <div>
          <label className="block text-sm mb-1.5">Bio</label>
          <textarea
            {...register('bio')}
            rows={4}
            maxLength={500}
            placeholder="Tell other riders about yourself..."
            className="w-full bg-brand-dark-4 border border-brand-dark-4 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-brand-orange/50"
          />
          {errors.bio && <p className="text-red-400 text-xs mt-1">{errors.bio.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1.5">Interested in</label>
            <select {...register('interested_in')} className="w-full bg-brand-dark-4 border border-brand-dark-4 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-orange/50">
              <option value="everyone">Everyone</option>
              <option value="men">Men</option>
              <option value="women">Women</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1.5">Looking for</label>
            <select {...register('dating_intent')} className="w-full bg-brand-dark-4 border border-brand-dark-4 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-orange/50">
              <option value="">—</option>
              <option value="serious_relationship">Serious relationship</option>
              <option value="casual_dating">Casual dating</option>
              <option value="riding_partner">Riding partner</option>
              <option value="friendship">Friendship</option>
              <option value="open_to_anything">Open to anything</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-3 p-3 rounded-xl bg-brand-dark-4 border border-brand-dark-4 cursor-pointer">
            <input
              type="checkbox"
              {...register('smoker')}
              className="w-4 h-4 accent-brand-orange"
              onChange={e => setValue('smoker', e.target.checked, { shouldDirty: true })}
              defaultChecked={profile.smoker ?? false}
            />
            <span className="text-sm">Smoker</span>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-xl bg-brand-dark-4 border border-brand-dark-4 cursor-pointer">
            <input
              type="checkbox"
              {...register('drinker')}
              className="w-4 h-4 accent-brand-orange"
              onChange={e => setValue('drinker', e.target.checked, { shouldDirty: true })}
              defaultChecked={profile.drinker ?? false}
            />
            <span className="text-sm">Drinker</span>
          </label>
        </div>
      </section>

      {/* ── Location ── */}
      <section className="bg-brand-dark-3 rounded-2xl p-5 space-y-4 border border-brand-dark-4">
        <h2 className="font-bold text-brand-chrome uppercase text-xs tracking-widest">Location</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1.5">City</label>
            <input {...register('city')} className="w-full bg-brand-dark-4 border border-brand-dark-4 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-orange/50" />
          </div>
          <div>
            <label className="block text-sm mb-1.5">Country</label>
            <input {...register('country')} className="w-full bg-brand-dark-4 border border-brand-dark-4 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-orange/50" />
          </div>
        </div>

        <div>
          <label className="block text-sm mb-1.5">Max distance: {watch('max_distance_miles') ?? 50} miles</label>
          <input
            type="range"
            {...register('max_distance_miles', { valueAsNumber: true })}
            min={5}
            max={500}
            step={5}
            className="w-full accent-brand-orange"
          />
          <div className="flex justify-between text-xs text-brand-chrome mt-1">
            <span>5 mi</span><span>500 mi</span>
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" {...register('hide_exact_location')} className="w-4 h-4 accent-brand-orange" />
          <span className="text-sm">Hide my exact location from others</span>
        </label>
      </section>

      {/* ── Your Bike ── */}
      <section className="bg-brand-dark-3 rounded-2xl p-5 space-y-4 border border-brand-dark-4">
        <h2 className="font-bold text-brand-chrome uppercase text-xs tracking-widest">Your Bike</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1.5">Make</label>
            <input {...register('bike_brand')} placeholder="Harley-Davidson" className="w-full bg-brand-dark-4 border border-brand-dark-4 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-orange/50" />
          </div>
          <div>
            <label className="block text-sm mb-1.5">Model</label>
            <input {...register('bike_model')} placeholder="Road King" className="w-full bg-brand-dark-4 border border-brand-dark-4 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-orange/50" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1.5">Year</label>
            <input type="number" {...register('bike_year', { valueAsNumber: true })} placeholder="2022" className="w-full bg-brand-dark-4 border border-brand-dark-4 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-orange/50" />
          </div>
          <div>
            <label className="block text-sm mb-1.5">Years riding</label>
            <input type="number" {...register('years_riding', { valueAsNumber: true })} placeholder="5" className="w-full bg-brand-dark-4 border border-brand-dark-4 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-orange/50" />
          </div>
        </div>

        <div>
          <label className="block text-sm mb-1.5">Riding style</label>
          <select {...register('riding_style')} className="w-full bg-brand-dark-4 border border-brand-dark-4 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-orange/50">
            <option value="">—</option>
            <option value="cruiser">Cruiser</option>
            <option value="sport">Sport</option>
            <option value="touring">Touring</option>
            <option value="adventure">Adventure</option>
            <option value="dirt">Dirt</option>
            <option value="chopper">Chopper</option>
            <option value="cafe_racer">Café Racer</option>
            <option value="bobber">Bobber</option>
            <option value="naked">Naked</option>
            <option value="scooter">Scooter</option>
            <option value="electric">Electric</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-3 p-3 rounded-xl bg-brand-dark-4 border border-brand-dark-4 cursor-pointer">
            <input type="checkbox" {...register('attends_rallies')} className="w-4 h-4 accent-brand-orange" />
            <span className="text-sm">Attends rallies</span>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-xl bg-brand-dark-4 border border-brand-dark-4 cursor-pointer">
            <input type="checkbox" {...register('has_passenger_helmet')} className="w-4 h-4 accent-brand-orange" />
            <span className="text-sm">Has pillion helmet</span>
          </label>
        </div>
      </section>

      {/* ── Club ── */}
      <section className="bg-brand-dark-3 rounded-2xl p-5 space-y-4 border border-brand-dark-4">
        <h2 className="font-bold text-brand-chrome uppercase text-xs tracking-widest">Club Association</h2>

        <div>
          <label className="block text-sm mb-1.5">Club type</label>
          <select {...register('club_type')} className="w-full bg-brand-dark-4 border border-brand-dark-4 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-orange/50">
            <option value="none">None — independent rider</option>
            <option value="MC">MC — Motorcycle Club</option>
            <option value="RC">RC — Riding Club</option>
            <option value="independent">Independent</option>
          </select>
          <p className="text-xs text-brand-chrome/60 mt-1">Shown on your profile and in discovery</p>
        </div>

        {clubType !== 'none' && (
          <div>
            <label className="block text-sm mb-1.5">
              Club name{' '}
              <span className="text-xs text-brand-chrome/60 font-normal">(private — only visible to you)</span>
            </label>
            <input
              {...register('club_name')}
              placeholder="e.g. Iron Eagles MC"
              maxLength={100}
              className="w-full bg-brand-dark-4 border border-brand-dark-4 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-orange/50"
            />
          </div>
        )}
      </section>

      {/* ── Mood / Status ── */}
      <section className="bg-brand-dark-3 rounded-2xl p-5 space-y-3 border border-brand-dark-4">
        <div>
          <h2 className="font-bold text-brand-chrome uppercase text-xs tracking-widest">My Vibe Right Now</h2>
          <p className="text-xs text-brand-chrome/60 mt-1">Shown on your profile and swipe card</p>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {MOODS.map(({ value, emoji }) => {
            const selected = watch('mood') === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setValue('mood', selected ? null : value as FormValues['mood'], { shouldDirty: true })}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium text-left transition-colors ${
                  selected
                    ? 'border-brand-orange bg-brand-orange/10 text-brand-orange'
                    : 'border-brand-dark-4 bg-brand-dark-4 text-brand-chrome hover:border-brand-orange/30 hover:text-white'
                }`}
              >
                <span className="text-lg leading-none">{emoji}</span>
                <span>{value}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Save ── */}
      <button
        type="submit"
        disabled={saving || !isDirty}
        className="fixed bottom-20 left-4 right-4 py-4 rounded-2xl bg-brand-orange text-white font-bold text-lg shadow-glow-orange disabled:opacity-50 transition-all"
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  );
}
