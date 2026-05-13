import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft, Bike, MapPin, BadgeCheck, Crown,
  ShieldCheck, Zap, User2, Heart, Music, Baby, Cigarette, Wine, HardHat, Flag,
} from 'lucide-react';
import { getAge, formatRidingStyle } from '@/lib/utils';
import type { ProfilePhotoRow } from '@/types/database.types';
import { RevButton } from '@/components/profile/RevButton';
import { RideRatingStars } from '@/components/profile/RideRatingStars';
import { ProfileBlockButton } from '@/components/profile/ProfileBlockButton';
import { ProfileDials, calcCompletion } from '@/components/profile/ProfileDials';
import { isDevBypassEnabled } from '@/lib/dev-bypass';
import { signPhotoUrls } from '@/lib/photos/sign';
import type { TrustStatusType } from '@/types/database.types';

export const dynamic = 'force-dynamic';

export default async function UserProfilePage({ params }: { params: { userId: string } }) {
  const { userId } = params;

  if (isDevBypassEnabled()) {
    return (
      <div className="flex flex-col pb-8">
        <div className="flex items-center px-4 py-3">
          <Link href="/discover" className="flex items-center gap-1.5 text-brand-chrome hover:text-white transition-colors text-sm">
            <ArrowLeft size={16} /> Back
          </Link>
        </div>
        <div className="px-5 pt-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Dev Profile</h1>
              <p className="text-brand-chrome text-sm mt-0.5">Dev bypass active</p>
            </div>
            <RevButton receiverId={userId} initialCount={0} initialRevved={false} />
          </div>
        </div>
      </div>
    );
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const isOwnProfile = userId === user.id;

  const [
    { data: profile },
    { data: allPhotos },
    { data: primaryBike },
    revCount,
    hasRevved,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, display_name, date_of_birth, bio, city, country, riding_style, years_riding, is_verified, is_premium, trust_status, club_type, is_banned, smoker, drinker, has_passenger_helmet, attends_rallies, dating_intent, music_taste, children_status, mood')
      .eq('id', userId)
      .single(),
    supabase
      .from('profile_photos')
      .select('id, storage_path, public_url, is_primary, sort_order')
      .eq('user_id', userId)
      .eq('moderation_status', 'approved')
      .order('is_primary', { ascending: false })
      .order('sort_order', { ascending: true }),
    supabase
      .from('bikes')
      .select('bike_brand, bike_model, bike_year, bike_type')
      .eq('user_id', userId)
      .eq('primary_bike', true)
      .maybeSingle(),
    getRevCount(supabase, userId),
    isOwnProfile
      ? Promise.resolve(false)
      : checkHasRevved(supabase, user.id, userId),
  ]);

  if (!profile || profile.is_banned) redirect('/discover');

  // Sign all photo URLs (allPhotos contains storage_path, not public_url)
  const allPhotosSigned = await signPhotoUrls(
    (allPhotos ?? []) as { id: string; storage_path: string; is_primary: boolean; sort_order: number }[],
    'profile-photos',
  );

  // All profile_photos are user photos (bike photos live in bikes.photo_url)
  const typedPhotos   = allPhotosSigned as unknown as ProfilePhotoRow[];
  const profilePhotos = typedPhotos;
  const bikePhotos: ProfilePhotoRow[] = [];

  const primaryPhoto = profilePhotos[0] ?? null;
  const extraPhotos  = profilePhotos.slice(1);

  const completionPct = calcCompletion(profile, !!primaryPhoto, !!primaryBike);

  // Prefetch ratings for all bike photos in one query
  const bikePhotoIds = bikePhotos.map(p => p.id);
  const [ratingSummaries, myRatings] = await Promise.all([
    bikePhotoIds.length
      ? supabase
          .from('photo_rating_summaries')
          .select('photo_id, avg_stars, rating_count')
          .in('photo_id', bikePhotoIds)
      : Promise.resolve({ data: [] }),
    (!isOwnProfile && bikePhotoIds.length)
      ? supabase
          .from('ride_ratings')
          .select('photo_id, stars')
          .eq('rater_id', user.id)
          .in('photo_id', bikePhotoIds)
      : Promise.resolve({ data: [] }),
  ]);

  type SummaryRow = { photo_id: string; avg_stars: number | null; rating_count: number };
  type RatingRow  = { photo_id: string; stars: number };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summaryMap = Object.fromEntries(
    ((ratingSummaries.data ?? []) as any[] as SummaryRow[]).map(s => [s.photo_id, s])
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const myRatingMap = Object.fromEntries(
    ((myRatings.data ?? []) as any[] as RatingRow[]).map(r => [r.photo_id, r.stars])
  );

  return (
    <div className="flex flex-col pb-8">
      {/* Back + block menu */}
      <div className="flex items-center justify-between px-4 py-3">
        <Link
          href="/discover"
          className="flex items-center gap-1.5 text-brand-chrome hover:text-white transition-colors text-sm"
        >
          <ArrowLeft size={16} /> Back
        </Link>
        {!isOwnProfile && (
          <ProfileBlockButton userId={userId} displayName={profile.display_name} />
        )}
      </div>

      {/* Primary photo */}
      <div className="relative w-full bg-brand-dark-3" style={{ aspectRatio: '3/4', maxHeight: '70vh' }}>
        {primaryPhoto ? (
          <Image
            src={primaryPhoto.public_url ?? ''}
            alt={profile.display_name}
            fill
            className="object-cover"
            sizes="(max-width: 512px) 100vw, 512px"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Bike size={56} className="text-brand-chrome/30" />
            <p className="text-xs text-brand-chrome/50">No photo yet</p>
          </div>
        )}
      </div>

      {/* Profile info */}
      <div className="px-5 pt-5 space-y-4">

        {/* Name / age / badges + RevButton */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{profile.display_name}</h1>
              <span className="text-xl text-brand-chrome">{getAge(profile.date_of_birth)}</span>
              {profile.is_verified && (
                <BadgeCheck className="w-5 h-5 text-blue-400" aria-label="Verified" />
              )}
              {profile.is_premium && (
                <Crown className="w-5 h-5 text-brand-orange" aria-label="Premium" />
              )}
            </div>
            {profile.city && (
              <p className="flex items-center gap-1.5 text-brand-chrome text-sm mt-1">
                <MapPin className="w-3.5 h-3.5" />
                {profile.city}{profile.country ? `, ${profile.country}` : ''}
              </p>
            )}
          </div>
          <div className="flex-shrink-0 pt-1">
            <RevButton
              receiverId={userId}
              initialCount={revCount}
              initialRevved={hasRevved}
              disabled={isOwnProfile}
            />
          </div>
        </div>

        {/* Mood */}
        {profile.mood && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-orange/10 border border-brand-orange/20">
            <span className="text-sm font-semibold text-brand-orange">{profile.mood}</span>
          </div>
        )}

        {/* Trust status */}
        <TrustBadge status={profile.trust_status ?? 'new_rider'} />

        {/* Speed + Oil dials */}
        <ProfileDials revCount={revCount} completionPct={completionPct} />

        {/* Bio */}
        {profile.bio && (
          <div className="p-4 rounded-xl bg-brand-dark-3 border border-brand-dark-4">
            <p className="text-sm text-brand-chrome leading-relaxed">{profile.bio}</p>
          </div>
        )}

        {/* Lifestyle */}
        {(profile.dating_intent || profile.smoker !== null || profile.drinker !== null || profile.has_passenger_helmet !== null || profile.attends_rallies !== null || profile.children_status || (profile.music_taste && profile.music_taste.length > 0)) && (
          <div className="p-4 rounded-xl bg-brand-dark-3 border border-brand-dark-4">
            <div className="flex items-center gap-2 mb-3">
              <Heart className="w-4 h-4 text-brand-orange" />
              <h3 className="font-semibold">About</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {profile.dating_intent && (
                <InfoRow label="Looking for" value={profile.dating_intent.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} />
              )}
              {profile.children_status && (
                <InfoRow label="Children" value={profile.children_status} />
              )}
              {profile.smoker !== null && (
                <InfoRow label="Smoking" value={profile.smoker ? 'Smoker' : 'Non-smoker'} />
              )}
              {profile.drinker !== null && (
                <InfoRow label="Drinking" value={profile.drinker ? 'Drinks' : "Doesn't drink"} />
              )}
              {profile.has_passenger_helmet !== null && (
                <InfoRow label="Pillion" value={profile.has_passenger_helmet ? 'Has helmet' : 'No helmet'} />
              )}
              {profile.attends_rallies !== null && (
                <InfoRow label="Rallies" value={profile.attends_rallies ? 'Goes to rallies' : 'Skips rallies'} />
              )}
            </div>
            {profile.music_taste && profile.music_taste.length > 0 && (
              <div className="mt-3 pt-3 border-t border-brand-dark-4">
                <p className="text-xs text-brand-chrome-dark mb-2">Music</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.music_taste.map((genre) => (
                    <span key={genre} className="px-2.5 py-1 rounded-full bg-brand-dark-4 text-xs text-brand-chrome border border-brand-dark-4/50">
                      {genre}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bike info */}
        {(primaryBike || profile.riding_style) && (
          <div className="p-4 rounded-xl bg-brand-dark-3 border border-brand-dark-4">
            <div className="flex items-center gap-2 mb-3">
              <Bike className="w-4 h-4 text-brand-orange" />
              <h3 className="font-semibold">Their Ride</h3>
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
                <InfoRow
                  label="Club"
                  value={
                    profile.club_type === 'MC' ? 'Motorcycle Club (MC)' :
                    profile.club_type === 'RC' ? 'Riding Club (RC)' :
                    'Independent'
                  }
                />
              )}
            </div>
          </div>
        )}

        {/* Bike photos with Rate My Ride */}
        {bikePhotos.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3 text-sm text-brand-chrome uppercase tracking-wide">
              Rate My Ride
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {bikePhotos.map((photo) => {
                const summary = summaryMap[photo.id];
                return (
                  <div key={photo.id} className="flex flex-col">
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-brand-dark-3">
                      <Image
                        src={photo.public_url ?? ''}
                        alt="Bike photo"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <RideRatingStars
                      photoId={photo.id}
                      avgStars={summary ? Number(summary.avg_stars) : null}
                      ratingCount={summary ? Number(summary.rating_count) : 0}
                      yourStars={myRatingMap[photo.id] ?? null}
                      canRate={!isOwnProfile}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Extra profile photos */}
        {extraPhotos.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3 text-sm text-brand-chrome uppercase tracking-wide">
              More photos
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {extraPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative aspect-square rounded-xl overflow-hidden bg-brand-dark-3"
                >
                  <Image
                    src={photo.public_url ?? ''}
                    alt=""
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getRevCount(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<number> {
  const { count } = await supabase
    .from('engine_revs')
    .select('*', { count: 'exact', head: true })
    .eq('receiver_id', userId);
  return count ?? 0;
}

async function checkHasRevved(
  supabase: ReturnType<typeof createClient>,
  giverId: string,
  receiverId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('engine_revs')
    .select('id')
    .eq('giver_id', giverId)
    .eq('receiver_id', receiverId)
    .maybeSingle();
  return data !== null;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-brand-chrome-dark text-xs">{label}</p>
      <p className="text-white font-medium">{value}</p>
    </div>
  );
}

const TRUST_CONFIG: Record<
  TrustStatusType,
  { label: string; iconColor: string; bg: string; border: string }
> = {
  trusted_rider: {
    label: 'Trusted Rider',
    iconColor: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
  },
  active_rider: {
    label: 'Active Rider',
    iconColor: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  new_rider: {
    label: 'New Rider',
    iconColor: 'text-brand-chrome',
    bg: 'bg-brand-dark-3',
    border: 'border-brand-dark-4',
  },
};

function TrustBadge({ status }: { status: TrustStatusType }) {
  const cfg = TRUST_CONFIG[status];
  const Icon =
    status === 'trusted_rider' ? ShieldCheck :
    status === 'active_rider'  ? Zap :
    User2;
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${cfg.bg} ${cfg.border} w-fit`}>
      <Icon className={`w-4 h-4 flex-shrink-0 ${cfg.iconColor}`} />
      <span className={`text-xs font-semibold ${cfg.iconColor}`}>{cfg.label}</span>
    </div>
  );
}
