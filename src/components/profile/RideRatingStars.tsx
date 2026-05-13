'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';

interface RideRatingStarsProps {
  photoId: string;
  /** Average stars across all raters (null = no ratings yet). */
  avgStars: number | null;
  ratingCount: number;
  /** The current user's existing rating, or null if not yet rated. */
  yourStars: number | null;
  /** False when viewing own profile — shows read-only average only. */
  canRate: boolean;
}

export function RideRatingStars({
  photoId,
  avgStars: initialAvg,
  ratingCount: initialCount,
  yourStars: initialYours,
  canRate,
}: RideRatingStarsProps) {
  const [avgStars, setAvgStars]       = useState(initialAvg);
  const [ratingCount, setRatingCount] = useState(initialCount);
  const [yourStars, setYourStars]     = useState(initialYours);
  const [hovered, setHovered]         = useState<number | null>(null);
  const [pending, setPending]         = useState(false);

  async function handleRate(stars: number) {
    if (pending) return;
    // Clicking the same star again removes the rating
    const isToggleOff = stars === yourStars;
    setPending(true);
    try {
      const res = await fetch('/api/ride-ratings', {
        method: isToggleOff ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isToggleOff ? { photoId } : { photoId, stars }),
      });
      if (!res.ok) throw new Error('Request failed');
      const data: { avg_stars: number | null; rating_count: number; your_stars: number | null } =
        await res.json();
      setAvgStars(data.avg_stars);
      setRatingCount(data.rating_count);
      setYourStars(data.your_stars);
    } finally {
      setPending(false);
    }
  }

  const displayStars = hovered ?? yourStars ?? 0;

  if (!canRate) {
    // Read-only: show average with fractional fill
    return (
      <div className="flex items-center gap-1.5 mt-1">
        <StarRow filled={avgStars ?? 0} readOnly />
        {avgStars !== null ? (
          <span className="text-xs text-brand-chrome">
            {avgStars.toFixed(1)} ({ratingCount})
          </span>
        ) : (
          <span className="text-xs text-brand-chrome/50">No ratings yet</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 mt-1">
      <div
        className={`flex items-center gap-0.5 ${pending ? 'opacity-60 pointer-events-none' : ''}`}
        onMouseLeave={() => setHovered(null)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
            onClick={() => handleRate(n)}
            onMouseEnter={() => setHovered(n)}
            className="p-0.5 transition-transform hover:scale-110 active:scale-95"
          >
            <Star
              size={18}
              className={
                n <= displayStars
                  ? 'fill-brand-orange text-brand-orange'
                  : 'text-brand-chrome/40'
              }
            />
          </button>
        ))}
      </div>
      {avgStars !== null && (
        <span className="text-xs text-brand-chrome">
          Avg {avgStars.toFixed(1)} · {ratingCount} {ratingCount === 1 ? 'rating' : 'ratings'}
        </span>
      )}
    </div>
  );
}

// Renders a fixed 5-star row with partial-fill support for averages
function StarRow({ filled, readOnly }: { filled: number; readOnly?: boolean }) {
  return (
    <div className={`flex items-center gap-0.5 ${readOnly ? '' : ''}`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const isFullFill   = filled >= n;
        const isPartialFill = !isFullFill && filled > n - 1;
        const pct = isPartialFill ? Math.round((filled - (n - 1)) * 100) : 0;

        return (
          <span key={n} className="relative inline-block">
            {/* Base (empty) star */}
            <Star size={14} className="text-brand-chrome/30" />
            {/* Filled overlay */}
            {(isFullFill || isPartialFill) && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: isFullFill ? '100%' : `${pct}%` }}
              >
                <Star size={14} className="fill-brand-orange text-brand-orange" />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
