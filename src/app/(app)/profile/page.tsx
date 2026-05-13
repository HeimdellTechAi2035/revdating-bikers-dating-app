import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Edit2, Settings, BadgeCheck, Crown, Bike, MapPin, Calendar, ShieldCheck, Zap, User2, Clock, ChevronRight } from 'lucide-react';
import { getAge, formatRidingStyle } from '@/lib/utils';
import { signPhotoUrls } from '@/lib/photos/sign';
import { UserBadges } from '@/components/profile/UserBadges';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const { data: rawPhotos } = await supabase
    .from('profile_photos')
    .select('id, storage_path, public_url, is_primary, moderation_status, sort_order')
    .eq('user_id', user.id)
    .order('is_primary', { ascending: false })
    .order('sort_order', { ascending: true });
  const photos = await signPhotoUrls(
    (rawPhotos ?? []) as { id: string; storage_path: string; is_primary: boolean; moderation_status: string; sort_order: number }[],
    'profile-photos',
  );

  const { data: primaryBike } = await supabase
    .from('bikes')
    .select('bike_brand, bike_model, bike_year')
    .eq('user_id', user.id)
    .eq('primary_bike', true)
    .maybeSingle();

  const { data: credits } = await supabase
    .from('superlike_credits')
    .select('credits')
    .eq('user_id', user.id)
    .single();

  const { data: badges } = await supabase
    .from('user_badges')
    .select('*')
    .eq('user_id', user.id)
    .order('earned_at', { ascending: true });

  const { data: selfieVerification } = await supabase
    .from('verifications')
    .select('status')
    .eq('user_id', user.id)
    .eq('verification_type', 'face_selfie')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const selfieStatus = selfieVerification?.status ?? 'not_started';

  const approvedPhotos = photos?.filter((p) => p.moderation_status === 'approved') ?? [];
  const pendingPhotos = photos?.filter((p) => p.moderation_status === 'pending') ?? [];

  if (!profile) redirect('/onboarding');

  return (
    <div className="flex flex-col pb-8">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <h1 className="text-xl font-bold">My Profile</h1>
        <div className="flex gap-2">
          <Link href="/profile/edit" className="p-2 rounded-xl bg-brand-dark-3 border border-brand-dark-4 hover:border-brand-orange/50 transition-colors">
            <Edit2 className="w-5 h-5 text-brand-chrome" />
          </Link>
          <Link href="/settings" className="p-2 rounded-xl bg-brand-dark-3 border border-brand-dark-4 hover:border-brand-orange/50 transition-colors">
            <Settings className="w-5 h-5 text-brand-chrome" />
          </Link>
        </div>
      </div>

      {/* Photo grid */}
      <div className="px-5">
        <div className="grid grid-cols-3 gap-2 mb-5">
          {approvedPhotos.map((photo, i) => (
            <div key={photo.id} className={`relative rounded-xl overflow-hidden bg-brand-dark-3 ${i === 0 ? 'col-span-2 row-span-2' : ''}`} style={{ aspectRatio: i === 0 ? '1' : '1' }}>
              <Image
                src={photo.public_url}
                alt={`Photo ${i + 1}`}
                fill
                className="object-cover"
                unoptimized
              />
              {photo.is_primary && (
                <span className="absolute bottom-1.5 left-1.5 text-xs bg-brand-orange text-white px-2 py-0.5 rounded-full font-medium">
                  Main
                </span>
              )}
            </div>
          ))}

          <Link href="/profile/edit" className="aspect-square rounded-xl bg-brand-dark-3 border-2 border-dashed border-brand-dark-4 hover:border-brand-orange flex items-center justify-center transition-colors">
            <span className="text-brand-chrome text-2xl">+</span>
          </Link>
        </div>

        {pendingPhotos.length > 0 && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <p className="text-yellow-400 text-sm font-medium">
              {pendingPhotos.length} photo{pendingPhotos.length !== 1 ? 's' : ''} pending moderation
            </p>
            <p className="text-yellow-400/70 text-xs mt-0.5">Usually approved within a few hours</p>
          </div>
        )}
      </div>

      {/* Verification prompt */}
      {!profile.is_verified && (
        <div className="px-5 mb-1">
          {selfieStatus === 'pending' ? (
            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-3">
              <Clock className="w-5 h-5 text-yellow-400 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm text-yellow-400">Selfie under review</p>
                <p className="text-xs text-yellow-400/70 mt-0.5">Usually approved within 24 hours — we&apos;ll update your badge once done</p>
              </div>
            </div>
          ) : selfieStatus === 'rejected' ? (
            <Link href="/safety/verify-selfie" className="block p-4 rounded-xl bg-red-500/10 border border-red-500/20 hover:opacity-90 transition-opacity">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-red-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-sm text-red-400">Verification rejected — try again</p>
                  <p className="text-xs text-red-400/70 mt-0.5">Submit a new clear selfie to get your verified badge</p>
                </div>
                <ChevronRight className="w-4 h-4 text-red-400 flex-shrink-0" />
              </div>
            </Link>
          ) : (
            <Link href="/safety/verify-selfie" className="block p-4 rounded-xl bg-brand-orange/10 border border-brand-orange/30 hover:opacity-90 transition-opacity">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-brand-orange flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">Get your verified badge</p>
                  <p className="text-xs text-brand-chrome mt-0.5">A selfie verification earns a ✓ badge and builds trust with other riders</p>
                </div>
                <ChevronRight className="w-4 h-4 text-brand-chrome flex-shrink-0" />
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Profile info */}
      <div className="px-5 space-y-4">
        {/* Name, age, badges */}
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-bold">{profile.display_name}</h2>
            <span className="text-xl text-brand-chrome">{getAge(profile.date_of_birth)}</span>
            {profile.is_verified && (
              <BadgeCheck className="w-5 h-5 text-blue-400" aria-label="Verified" />
            )}
            {profile.is_premium && (
              <Crown className="w-5 h-5 text-brand-orange" aria-label="Premium" />
            )}
          </div>
          <UserBadges badges={badges ?? []} />
          {profile.city && (
            <p className="flex items-center gap-1.5 text-brand-chrome text-sm mt-1">
              <MapPin className="w-3.5 h-3.5" /> {profile.city}{profile.country ? `, ${profile.country}` : ''}
            </p>
          )}
        </div>

        {/* Trust Status */}
        <TrustStatusCard status={profile.trust_status ?? 'new_rider'} />

        {/* Bio */}
        {profile.bio && (
          <div className="p-4 rounded-xl bg-brand-dark-3 border border-brand-dark-4">
            <p className="text-sm text-brand-chrome leading-relaxed">{profile.bio}</p>
          </div>
        )}

        {/* Premium upsell */}
        {!profile.is_premium && (
          <Link href="/premium" className="block p-4 rounded-xl bg-gradient-brand border border-brand-orange/30 hover:opacity-90 transition-opacity">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-white">Upgrade to Premium</p>
                <p className="text-white/70 text-sm">See who likes you · More superlikes · Profile boost</p>
              </div>
              <Crown className="w-6 h-6 text-white flex-shrink-0" />
            </div>
          </Link>
        )}

        {/* Bike info */}
        {(primaryBike || profile.riding_style) && (
          <div className="p-4 rounded-xl bg-brand-dark-3 border border-brand-dark-4">
            <div className="flex items-center gap-2 mb-3">
              <Bike className="w-4 h-4 text-brand-orange" />
              <h3 className="font-semibold">My Ride</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {primaryBike?.bike_brand && (
                <InfoRow label="Make" value={primaryBike.bike_brand} />
              )}
              {primaryBike?.bike_model && (
                <InfoRow label="Model" value={primaryBike.bike_model} />
              )}
              {primaryBike?.bike_year && (
                <InfoRow label="Year" value={String(primaryBike.bike_year)} />
              )}
              {profile.riding_style && (
                <InfoRow label="Style" value={formatRidingStyle(profile.riding_style)} />
              )}
              {profile.years_riding !== null && (
                <InfoRow label="Experience" value={`${profile.years_riding} years`} />
              )}
              {profile.club_type && profile.club_type !== 'none' && (
                <InfoRow label="Club type" value={profile.club_type === 'MC' ? 'Motorcycle Club (MC)' : profile.club_type === 'RC' ? 'Riding Club (RC)' : 'Independent'} />
              )}
            </div>
          </div>
        )}

        {/* Superlikes */}
        <div className="p-4 rounded-xl bg-brand-dark-3 border border-brand-dark-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">⭐</span>
              <div>
                <p className="font-semibold text-sm">Superlikes remaining</p>
                <p className="text-xs text-brand-chrome">Resets weekly</p>
              </div>
            </div>
            <span className="text-2xl font-bold text-brand-orange">{credits?.credits ?? 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-brand-chrome-dark text-xs">{label}</p>
      <p className="text-white font-medium">{value}</p>
    </div>
  );
}

type TrustStatus = 'new_rider' | 'active_rider' | 'trusted_rider';

const TRUST_CONFIG: Record<TrustStatus, { label: string; desc: string; iconColor: string; bg: string; border: string }> = {
  trusted_rider: {
    label: 'Trusted Rider',
    desc:  'Verified · No reports · Active messaging · Completed a ride date',
    iconColor: 'text-green-400',
    bg:        'bg-green-500/10',
    border:    'border-green-500/20',
  },
  active_rider: {
    label: 'Active Rider',
    desc:  'Actively messaging or has completed a ride date',
    iconColor: 'text-blue-400',
    bg:        'bg-blue-500/10',
    border:    'border-blue-500/20',
  },
  new_rider: {
    label: 'New Rider',
    desc:  'Send messages or plan a ride date to level up your status',
    iconColor: 'text-brand-chrome',
    bg:        'bg-brand-dark-3',
    border:    'border-brand-dark-4',
  },
};

function TrustStatusCard({ status }: { status: TrustStatus }) {
  const cfg = TRUST_CONFIG[status];
  const Icon = status === 'trusted_rider' ? ShieldCheck : status === 'active_rider' ? Zap : User2;

  return (
    <div className={`p-4 rounded-xl border ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 flex-shrink-0 ${cfg.iconColor}`} />
        <div>
          <p className={`font-semibold text-sm ${cfg.iconColor}`}>{cfg.label}</p>
          <p className="text-xs text-brand-chrome mt-0.5">{cfg.desc}</p>
        </div>
      </div>
    </div>
  );
}
