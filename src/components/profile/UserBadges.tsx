import { Heart, Flame, MessageCircle, Bike, ShieldCheck, Star, Zap } from 'lucide-react';
import type { BadgeNameType, UserBadgeRow } from '@/types/database.types';

const BADGE_CONFIG: Record<
  BadgeNameType,
  { label: string; icon: React.ReactNode; className: string; title: string }
> = {
  first_match: {
    label: 'First Match',
    icon: <Heart className="w-3.5 h-3.5" />,
    className: 'bg-red-500/15 border-red-500/30 text-red-400',
    title: 'Earned your first mutual match',
  },
  five_matches: {
    label: '5 Matches',
    icon: <Flame className="w-3.5 h-3.5" />,
    className: 'bg-orange-500/15 border-orange-500/30 text-orange-400',
    title: 'Earned 5 mutual matches',
  },
  first_message: {
    label: 'Messenger',
    icon: <MessageCircle className="w-3.5 h-3.5" />,
    className: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
    title: 'Sent your first message',
  },
  first_ride_date: {
    label: 'Ride Date',
    icon: <Bike className="w-3.5 h-3.5" />,
    className: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400',
    title: 'Planned your first ride date',
  },
  verified_rider: {
    label: 'Verified Rider',
    icon: <ShieldCheck className="w-3.5 h-3.5" />,
    className: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400',
    title: 'Identity verified',
  },
  trusted_rider: {
    label: 'Trusted Rider',
    icon: <Star className="w-3.5 h-3.5" />,
    className: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
    title: 'Verified with 5+ matches',
  },
  revved_up: {
    label: 'Revved Up',
    icon: <Zap className="w-3.5 h-3.5" />,
    className: 'bg-purple-500/15 border-purple-500/30 text-purple-400',
    title: 'Received your first engine rev',
  },
};

interface UserBadgesProps {
  badges: UserBadgeRow[];
}

export function UserBadges({ badges }: UserBadgesProps) {
  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {badges.map((badge) => {
        const config = BADGE_CONFIG[badge.badge_name];
        if (!config) return null;
        return (
          <span
            key={badge.id}
            title={config.title}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.className}`}
          >
            {config.icon}
            {config.label}
          </span>
        );
      })}
    </div>
  );
}
