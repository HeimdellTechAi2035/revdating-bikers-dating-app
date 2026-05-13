'use client';

import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import Image from 'next/image';
import { MapPin, Bike, Heart, ShieldCheck, Sparkles, MoreVertical, UserCheck, Zap, Flame } from 'lucide-react';
import type { DiscoveryCandidate } from '@/types/database.types';
import type { CompatibilityResult } from '@/lib/compatibility';
import { formatRidingStyle } from '@/lib/utils';

// -- Types -------------------------------------------------------------------

interface SwipeCardProps {
  candidate: DiscoveryCandidate;
  onSwipe: (action: 'like' | 'pass' | 'rev_it') => void;
  isTop: boolean;
  /** Full compatibility result (score + labels). Only rendered on the top card. */
  compatibility?: CompatibilityResult;
  /** Triggered when the user taps ⋮ on the top card to report/block. */
  onMoreOptions?: () => void;
}

// -- Sub-components ----------------------------------------------------------

function CompatibilityBadge({ result }: { result: CompatibilityResult }) {
  const { score, tier } = result;
  const colour =
    tier === 'high'   ? 'bg-green-500/20 text-green-400 border-green-500/30' :
    tier === 'medium' ? 'bg-brand-orange/20 text-brand-orange border-brand-orange/30' :
                        'bg-brand-dark-4/80 text-brand-chrome border-brand-dark-4';

  return (
    <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-bold backdrop-blur-sm ${colour}`}>
      <Sparkles size={10} />
      <span>{score}% match</span>
    </div>
  );
}

function CompatibilityLabels({ labels }: { labels: string[] }) {
  if (!labels.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {labels.slice(0, 2).map((label) => (
        <span
          key={label}
          className="bg-brand-orange/10 border border-brand-orange/20 backdrop-blur-sm text-brand-orange text-xs px-2.5 py-0.5 rounded-full"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

// -- Main card ---------------------------------------------------------------

export function SwipeCard({ candidate, onSwipe, isTop, compatibility, onMoreOptions }: SwipeCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-20, 20]);
  const likeOpacity = useTransform(x, [40, 120], [0, 1]);
  const passOpacity = useTransform(x, [-120, -40], [1, 0]);
  const revItOpacity = useTransform(y, [-120, -40], [1, 0]);

  function handleDragEnd(_: PointerEvent, info: PanInfo) {
    if (info.offset.x > 120) {
      onSwipe('like');
    } else if (info.offset.x < -120) {
      onSwipe('pass');
    } else if (info.offset.y < -120) {
      onSwipe('rev_it');
    }
  }

  const distanceMiles = candidate.distance_miles;
  const distanceLabel =
    distanceMiles !== null && distanceMiles !== undefined
      ? `${Math.round(distanceMiles)} mi away`
      : null;

  const bikeLabel =
    [candidate.primary_bike_brand, candidate.primary_bike_model].filter(Boolean).join(' ') || null;

  return (
    <motion.div
      style={{ x, y, rotate, touchAction: 'none' }}
      drag={isTop}
      dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      whileTap={{ cursor: 'grabbing' }}
      className="absolute inset-0 cursor-grab select-none"
    >
      <div className="relative h-full rounded-3xl overflow-hidden shadow-2xl bg-brand-dark-3">
        {/* Primary photo */}
        {candidate.primary_photo_url ? (
          <Image
            src={candidate.primary_photo_url}
            alt={candidate.display_name}
            fill
            className="object-cover"
            sizes="(max-width: 480px) 100vw, 480px"
            draggable={false}
            priority={isTop}
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-brand-dark-4 gap-3">
            <Bike size={56} className="text-brand-chrome/30" />
            <p className="text-xs text-brand-chrome/50">No photo yet</p>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent" />

        {/* Swipe gesture overlays */}
        <motion.div
          style={{ opacity: likeOpacity }}
          className="absolute top-10 left-5 border-4 border-green-400 rounded-2xl px-4 py-2 rotate-[-12deg] backdrop-blur-sm"
        >
          <span className="text-green-400 text-3xl font-black tracking-wide">LIKE</span>
        </motion.div>

        <motion.div
          style={{ opacity: passOpacity }}
          className="absolute top-10 right-5 border-4 border-red-400 rounded-2xl px-4 py-2 rotate-[12deg] backdrop-blur-sm"
        >
          <span className="text-red-400 text-3xl font-black tracking-wide">NOPE</span>
        </motion.div>

        <motion.div
          style={{ opacity: revItOpacity }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-4 border-brand-orange rounded-2xl px-5 py-2 backdrop-blur-sm"
        >
          <span className="text-brand-orange text-2xl font-black tracking-wide flex items-center gap-2">
            <Bike size={22} /> REV IT!
          </span>
        </motion.div>

        {/* Top badges */}
        <div className="absolute top-4 inset-x-4 flex items-start justify-between gap-2 pointer-events-none">
          <div className="flex flex-col gap-1.5">
            {candidate.is_verified && (
              <span className="flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1 text-xs font-semibold text-brand-orange">
                <ShieldCheck size={12} /> Verified
              </span>
            )}
            {candidate.is_premium && (
              <span className="bg-brand-orange/90 rounded-full px-2.5 py-1 text-xs font-bold text-white">
                Premium
              </span>
            )}
            {candidate.club_type && candidate.club_type !== 'none' && candidate.club_type !== 'independent' && (
              <span className="flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1 text-xs font-semibold text-white">
                🏍️ {candidate.club_type}
              </span>
            )}
            {candidate.trust_status === 'trusted_rider' && (
              <span className="flex items-center gap-1 bg-green-500/25 backdrop-blur-sm rounded-full px-2.5 py-1 text-xs font-semibold text-green-400">
                <UserCheck size={12} /> Trusted
              </span>
            )}
            {candidate.trust_status === 'active_rider' && (
              <span className="flex items-center gap-1 bg-blue-500/20 backdrop-blur-sm rounded-full px-2.5 py-1 text-xs font-semibold text-blue-400">
                <Zap size={12} /> Active
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {compatibility && <CompatibilityBadge result={compatibility} />}
            {isTop && onMoreOptions && (
              <button
                className="pointer-events-auto w-8 h-8 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-full text-white/80 hover:text-white hover:bg-black/70 transition-colors"
                onClick={(e) => { e.stopPropagation(); onMoreOptions(); }}
                aria-label="Report or block"
              >
                <MoreVertical size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Profile info */}
        <div className="absolute bottom-0 inset-x-0 p-5 space-y-1.5">
          {/* Name + age + revs */}
          <div className="flex items-end gap-2 flex-wrap">
            <h2 className="text-2xl font-bold leading-none">{candidate.display_name}</h2>
            {candidate.age !== null && (
              <span className="text-xl text-white/75 leading-none">{candidate.age}</span>
            )}
            {!!candidate.rev_count && (
              <span className="flex items-center gap-0.5 text-brand-orange/90 text-sm leading-none">
                <Flame size={13} aria-hidden />
                <span>{candidate.rev_count}</span>
              </span>
            )}
          </div>

          {/* Location / distance */}
          {(candidate.city || distanceLabel) && (
            <div className="flex items-center gap-1.5 text-sm text-white/70">
              <MapPin size={13} />
              <span>{[candidate.city, distanceLabel].filter(Boolean).join(' · ')}</span>
            </div>
          )}

          {/* Riding style + bike */}
          {(candidate.riding_style || bikeLabel) && (
            <div className="flex items-center gap-1.5 text-sm text-white/70">
              <Bike size={13} />
              <span>
                {[
                  candidate.riding_style ? formatRidingStyle(candidate.riding_style) : null,
                  bikeLabel,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>
          )}

          {/* Bio */}
          {candidate.bio && (
            <p className="text-sm text-white/80 line-clamp-2 pt-0.5">{candidate.bio}</p>
          )}

          {/* Mood */}
          {candidate.mood && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-orange/15 border border-brand-orange/25 backdrop-blur-sm">
              <span className="text-xs font-semibold text-brand-orange">{candidate.mood}</span>
            </div>
          )}

          {/* Dating intent */}
          {candidate.dating_intent && !candidate.mood && (
            <div className="flex items-center gap-1.5 pt-1">
              <Heart size={12} className="text-brand-orange" />
              <span className="text-xs text-white/60 capitalize">
                {candidate.dating_intent.replace(/_/g, ' ')}
              </span>
            </div>
          )}

          {/* Compatibility labels (shown on top card only) */}
          {compatibility && compatibility.labels.length > 0 && (
            <CompatibilityLabels labels={compatibility.labels} />
          )}

          {/* Lifestyle pills (shown when no compatibility labels) */}
          {(!compatibility || compatibility.labels.length === 0) && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {candidate.attends_rallies && (
                <span className="bg-brand-dark-3/80 backdrop-blur-sm text-white/70 text-xs px-2 py-0.5 rounded-full">
                  Rally goer
                </span>
              )}
              {candidate.has_passenger_helmet && (
                <span className="bg-brand-dark-3/80 backdrop-blur-sm text-white/70 text-xs px-2 py-0.5 rounded-full">
                  Has pillion helmet
                </span>
              )}
              {candidate.smoker === false && (
                <span className="bg-brand-dark-3/80 backdrop-blur-sm text-white/70 text-xs px-2 py-0.5 rounded-full">
                  Non-smoker
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}