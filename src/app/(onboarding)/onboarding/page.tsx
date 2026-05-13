'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Bike, ChevronRight, ChevronLeft, Camera, MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { validateImageFile, generateStorageFileName } from '@/lib/utils';
import { analytics } from '@/lib/analytics';

// ── Step schemas ──────────────────────────────────────────────

const step1Schema = z.object({
  bio: z.string().max(500, 'Bio must be 500 characters or fewer').optional(),
  seeking: z.enum(['men', 'women', 'everyone'] as const),
  looking_for: z.enum(['serious_relationship', 'casual_dating', 'riding_partner', 'friendship', 'open_to_anything'] as const),
  height_cm: z.coerce.number().min(100).max(250).optional().or(z.literal('')),
  children_status: z.enum(['has_children', 'wants_children', 'no_kids_no_want', 'open_to_it']).optional(),
  smoking: z.boolean().optional(),
  drinking: z.boolean().optional(),
});

const step2Schema = z.object({
  bike_make: z.string().max(50).optional(),
  bike_model: z.string().max(50).optional(),
  bike_year: z.coerce.number().min(1900).max(new Date().getFullYear() + 1).optional().or(z.literal('')),
  riding_style: z.enum(['cruiser','sport','touring','adventure','dirt','chopper','cafe_racer','bobber','naked','scooter','other'] as const).optional(),
  riding_frequency: z.enum(['daily','weekly','weekends','monthly','occasionally'] as const).optional(),
  years_riding: z.coerce.number().min(0).max(80).optional().or(z.literal('')),
  has_bike: z.boolean(),
});

const step3Schema = z.object({
  city: z.string().min(1, 'Please enter your city').max(100),
  country: z.string().min(2, 'Please enter your country').max(100),
  max_distance_km: z.coerce.number().min(1).max(500),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Step3Data = z.infer<typeof step3Schema>;

const STEPS = ['About you', 'Your ride', 'Location', 'Photos'];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(0);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [step2Data, setStep2Data] = useState<Step2Data | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // If onboarding is already complete, skip straight to discover
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_complete')
        .eq('id', user.id)
        .single();
      if (profile?.onboarding_complete) router.replace('/discover');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track that the user has started onboarding (fires once per browser)
  useEffect(() => { analytics.onboardingStarted(); }, []);

  // Step 1 form
  const form1 = useForm<Step1Data>({ resolver: zodResolver(step1Schema) });
  const form2 = useForm<Step2Data>({ resolver: zodResolver(step2Schema), defaultValues: { has_bike: true } });
  const form3 = useForm<Step3Data>({ resolver: zodResolver(step3Schema), defaultValues: { max_distance_km: 50, country: 'United Kingdom' } });

  // ── Helpers ───────────────────────────────────────────────────

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const valid: File[] = [];

    for (const file of files) {
      const result = validateImageFile(file);
      if (!result.valid) {
        toast.error(result.error ?? 'Invalid file');
      } else {
        valid.push(file);
      }
    }

    setPhotos((prev) => [...prev, ...valid].slice(0, 6));
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function finishOnboarding(locationData: Step3Data) {
    if (photos.length === 0) {
      toast.error('Please upload at least one photo');
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // 1. Update profile — only fields that exist in the profiles table
      const profilePayload = {
        bio:                step1Data?.bio || null,
        interested_in:      step1Data?.seeking ?? 'everyone',
        dating_intent:      step1Data?.looking_for || null,
        children_status:    step1Data?.children_status || null,
        smoker:             step1Data?.smoking ?? null,
        drinker:            step1Data?.drinking ?? null,
        riding_style:       step2Data?.riding_style || null,
        years_riding:       step2Data?.years_riding ? Number(step2Data.years_riding) : null,
        city:               locationData.city,
        country:            locationData.country,
        max_distance_miles: locationData.max_distance_km ?? 50,
        onboarding_complete: true,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: profileError } = await (supabase.from('profiles') as any)
        .update(profilePayload)
        .eq('id', user.id) as { error: { message: string } | null };

      if (profileError) throw profileError;

      // 1b. Insert primary bike if the user provided a bike make
      const bikeBrand = step2Data?.bike_make?.trim();
      if (bikeBrand) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('bikes') as any).insert({
          user_id:        user.id,
          bike_brand:     bikeBrand,
          bike_model:     step2Data?.bike_model?.trim() || 'Unknown',
          bike_year:      step2Data?.bike_year ? Number(step2Data.bike_year) : null,
          bike_type:      step2Data?.riding_style || 'other',
          owned_or_dream: 'owned',
          primary_bike:   true,
        });
      }

      // 2. Upload photos
      for (let i = 0; i < photos.length; i++) {
        const file = photos[i];
        const ext = (file.name.split('.').pop()?.toLowerCase() ?? 'jpg').replace('heic', 'jpg').replace('heif', 'jpg');
        const storagePath = generateStorageFileName(user.id, ext);

        const { error: uploadError } = await supabase.storage
          .from('profile-photos')
          .upload(storagePath, file, { contentType: file.type, upsert: false });

        if (uploadError) {
          console.error('Photo upload error:', uploadError);
          toast.error(`Failed to upload photo ${i + 1}: ${uploadError.message}`);
          continue;
        }

        // Insert photo record — moderation handled server-side
        await fetch('/api/photos/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storage_path: storagePath,
            is_primary: i === 0,
            sort_order: i,
          }),
        });

        // Track first photo upload after the primary photo succeeds
        if (i === 0) analytics.firstPhotoUploaded();
      }

      analytics.onboardingCompleted();
      toast.success('Profile created! Welcome to REVdating 🏍️');
      router.push('/discover');
    } catch (err) {
      console.error('Onboarding error:', err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  // ── Step handlers ─────────────────────────────────────────────

  const handleStep1 = form1.handleSubmit((data) => {
    setStep1Data(data);
    setStep(1);
  });

  const handleStep2 = form2.handleSubmit((data) => {
    setStep2Data(data);
    setStep(2);
  });

  const handleStep3 = form3.handleSubmit((data) => {
    setStep(3);
    void finishOnboarding(data);
  });

  // ── UI ────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <span className="font-display text-2xl text-brand-orange">REVdating</span>
        <span className="text-sm text-brand-chrome">{step + 1} of {STEPS.length}</span>
      </div>

      {/* Progress */}
      <div className="px-6 mb-8">
        <div className="flex gap-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? 'bg-brand-orange' : 'bg-brand-dark-4'
              }`}
            />
          ))}
        </div>
        <p className="text-white font-semibold mt-3 text-lg">{STEPS[step]}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-24">
        {/* ── Step 1: About you ── */}
        {step === 0 && (
          <form onSubmit={handleStep1} className="space-y-5">
            <div>
              <label className="label">Bio <span className="text-brand-chrome-dark text-xs">(optional)</span></label>
              <textarea
                rows={4}
                placeholder="Tell other bikers about yourself…"
                className="input w-full resize-none"
                {...form1.register('bio')}
              />
              {form1.formState.errors.bio && (
                <p className="error">{form1.formState.errors.bio.message}</p>
              )}
            </div>

            <div>
              <label className="label">I&apos;m interested in</label>
              <select className="input w-full" {...form1.register('seeking')}>
                <option value="everyone">Everyone</option>
                <option value="men">Men</option>
                <option value="women">Women</option>
              </select>
            </div>

            <div>
              <label className="label">Looking for</label>
              <select className="input w-full" {...form1.register('looking_for')}>
                <option value="open_to_anything">Open to anything</option>
                <option value="serious_relationship">Serious relationship</option>
                <option value="casual_dating">Casual dating</option>
                <option value="riding_partner">Riding partner</option>
                <option value="friendship">Friendship</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Height (cm) <span className="text-brand-chrome-dark text-xs">optional</span></label>
                <input type="number" className="input w-full" placeholder="175" {...form1.register('height_cm')} />
              </div>
            </div>

            <div>
              <label className="label">Children</label>
              <select className="input w-full" {...form1.register('children_status')}>
                <option value="">Prefer not to say</option>
                <option value="has_children">I have children</option>
                <option value="wants_children">No kids, but want them</option>
                <option value="no_kids_no_want">No kids &amp; don&apos;t want them</option>
                <option value="open_to_it">Open to it</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {([
                { field: 'smoking' as const, label: 'Smokes' },
                { field: 'drinking' as const, label: 'Drinks' },
              ]).map(({ field, label }) => (
                <label key={field} className="flex items-center gap-3 p-3 rounded-xl bg-brand-dark-3 border border-brand-dark-4 cursor-pointer">
                  <input type="checkbox" className="accent-brand-orange" {...form1.register(field)} />
                  <span className="text-sm text-white">{label}</span>
                </label>
              ))}
            </div>

            <StepFooter onBack={null} />
          </form>
        )}

        {/* ── Step 2: Your ride ── */}
        {step === 1 && (
          <form onSubmit={handleStep2} className="space-y-5">
            <label className="flex items-center gap-3 p-4 rounded-xl bg-brand-dark-3 border border-brand-dark-4 cursor-pointer">
              <input type="checkbox" className="accent-brand-orange" {...form2.register('has_bike')} />
              <div>
                <p className="font-medium text-white">I own a bike</p>
                <p className="text-xs text-brand-chrome">Uncheck if you ride pillion or are learning</p>
              </div>
            </label>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Make</label>
                <input type="text" className="input w-full" placeholder="Harley-Davidson" {...form2.register('bike_make')} />
              </div>
              <div>
                <label className="label">Model</label>
                <input type="text" className="input w-full" placeholder="Fat Boy" {...form2.register('bike_model')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Year</label>
                <input type="number" className="input w-full" placeholder="2022" {...form2.register('bike_year')} />
              </div>
              <div>
                <label className="label">Years riding</label>
                <input type="number" className="input w-full" placeholder="5" {...form2.register('years_riding')} />
              </div>
            </div>

            <div>
              <label className="label">Riding style</label>
              <select className="input w-full" {...form2.register('riding_style')}>
                <option value="">Select…</option>
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
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="label">How often do you ride?</label>
              <select className="input w-full" {...form2.register('riding_frequency')}>
                <option value="">Select…</option>
                <option value="daily">Every day</option>
                <option value="weekly">A few times a week</option>
                <option value="weekends">Weekends only</option>
                <option value="monthly">Monthly</option>
                <option value="occasionally">Occasionally</option>
              </select>
            </div>

            <StepFooter onBack={() => setStep(0)} />
          </form>
        )}

        {/* ── Step 3: Location ── */}
        {step === 2 && (
          <form onSubmit={handleStep3} className="space-y-5">
            <p className="text-brand-chrome text-sm">
              We use your location to show you riders nearby. You control how far to search.
            </p>

            <div>
              <label className="label">City</label>
              <input type="text" className="input w-full" placeholder="e.g. Manchester" {...form3.register('city')} />
              {form3.formState.errors.city && (
                <p className="error">{form3.formState.errors.city.message}</p>
              )}
            </div>

            <div>
              <label className="label">Country</label>
              <input type="text" className="input w-full" placeholder="e.g. United Kingdom" {...form3.register('country')} />
            </div>

            <div>
              <label className="label">Max distance: {form3.watch('max_distance_km')} km</label>
              <input
                type="range"
                min={5}
                max={500}
                step={5}
                className="w-full accent-brand-orange"
                {...form3.register('max_distance_km')}
              />
              <div className="flex justify-between text-xs text-brand-chrome mt-1">
                <span>5 km</span>
                <span>500 km</span>
              </div>
            </div>

            <StepFooter onBack={() => setStep(1)} loading={uploading} submitLabel={uploading ? 'Saving…' : 'Continue to photos'} />
          </form>
        )}

        {/* ── Step 4: Photos ── */}
        {step === 3 && (
          <div className="space-y-5">
            <p className="text-brand-chrome text-sm">
              Add up to 6 photos. Your first photo is your profile picture. All photos are moderated before going live.
            </p>

            <div className="grid grid-cols-3 gap-3">
              {photos.map((file, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-brand-dark-3 border border-brand-dark-4">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Photo ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {i === 0 && (
                    <span className="absolute bottom-1 left-1 text-xs bg-brand-orange text-white px-1.5 py-0.5 rounded-full">
                      Main
                    </span>
                  )}
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white text-xs flex items-center justify-center hover:bg-red-500"
                    aria-label="Remove photo"
                  >
                    ×
                  </button>
                </div>
              ))}

              {photos.length < 6 && (
                <label className="relative aspect-square rounded-xl bg-brand-dark-3 border-2 border-dashed border-brand-dark-4 hover:border-brand-orange flex flex-col items-center justify-center cursor-pointer transition-colors overflow-hidden">
                  <Camera className="w-6 h-6 text-brand-chrome mb-1 pointer-events-none" />
                  <span className="text-xs text-brand-chrome pointer-events-none">Add photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={handlePhotoSelect}
                  />
                </label>
              )}
            </div>

            {photos.length === 0 && (
              <p className="text-red-400 text-xs">At least one photo is required</p>
            )}

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 py-3.5 rounded-xl border border-brand-dark-4 text-brand-chrome font-medium hover:border-white/30 transition-colors flex items-center justify-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="button"
                disabled={photos.length === 0 || uploading}
                onClick={() => void finishOnboarding(form3.getValues())}
                className="flex-1 py-3.5 rounded-xl bg-brand-orange hover:bg-brand-orange-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition-colors"
              >
                {uploading ? 'Saving…' : 'Start matching 🏍️'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared step footer ────────────────────────────────────────

function StepFooter({
  onBack,
  loading = false,
  submitLabel = 'Continue',
}: {
  onBack: (() => void) | null;
  loading?: boolean;
  submitLabel?: string;
}) {
  return (
    <div className="flex gap-3 mt-6">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-3.5 rounded-xl border border-brand-dark-4 text-brand-chrome font-medium hover:border-white/30 transition-colors flex items-center justify-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
      )}
      <button
        type="submit"
        disabled={loading}
        className="flex-1 py-3.5 rounded-xl bg-brand-orange hover:bg-brand-orange-dark disabled:opacity-50 text-white font-bold transition-colors flex items-center justify-center gap-2"
      >
        {submitLabel} <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
