'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, Bike, ChevronDown, BadgeCheck, Zap, Users, X } from 'lucide-react';
import { formatRidingStyle } from '@/lib/utils';
import toast from 'react-hot-toast';

interface LikedUser {
  id:           string;
  display_name: string;
  age:          number | null;
  city:         string | null;
  country:      string;
  riding_style: string | null;
  is_verified:  boolean;
  is_premium:   boolean;
  photo_url:    string | null;
}

interface SentLike {
  swipe_id:     string;
  swipe_action: string;
  liked_at:     string;
  is_match:     boolean;
  user:         LikedUser;
}

function LikeSentCard({ like, onRemove }: { like: SentLike; onRemove: (swipeId: string) => void }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    setDeleting(true);
    try {
      const res = await fetch(`/api/likes/sent?swipe_id=${like.swipe_id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      onRemove(like.swipe_id);
    } catch {
      toast.error('Failed to remove like');
      setDeleting(false);
    }
  }

  return (
    <div className="relative">
      <Link
        href={`/profile/${like.user.id}`}
        className="flex items-center gap-3 p-3 bg-brand-dark-3 rounded-2xl border border-brand-dark-4 hover:border-brand-orange/40 transition-colors pr-10"
      >
        {/* Photo */}
        <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-brand-dark-4 flex-shrink-0">
          {like.user.photo_url ? (
            <Image
              src={like.user.photo_url}
              alt={like.user.display_name}
              fill
              className="object-cover"
              sizes="64px"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-brand-chrome text-xl">
              {like.user.display_name[0]}
            </div>
          )}
          {like.swipe_action === 'superlike' && (
            <div className="absolute bottom-0 right-0 bg-brand-orange text-white rounded-tl-lg p-0.5">
              <Zap className="w-3 h-3" />
            </div>
          )}
          {like.is_match && (
            <div className="absolute top-0 right-0 bg-green-500 text-white rounded-bl-lg p-0.5">
              <Heart className="w-3 h-3" fill="currentColor" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="font-semibold truncate">{like.user.display_name}</span>
            {like.user.is_verified && (
              <BadgeCheck className="w-4 h-4 text-brand-orange flex-shrink-0" />
            )}
          </div>
          <p className="text-brand-chrome text-xs">
            {like.user.age ? `${like.user.age} · ` : ''}
            {like.user.city ?? like.user.country}
          </p>
          {like.user.riding_style && (
            <div className="flex items-center gap-1 mt-0.5">
              <Bike className="w-3 h-3 text-brand-chrome" />
              <span className="text-brand-chrome text-xs">
                {formatRidingStyle(like.user.riding_style)}
              </span>
            </div>
          )}
          {like.is_match ? (
            <p className="text-green-400 text-xs font-semibold mt-0.5">Matched!</p>
          ) : (like.swipe_action === 'superlike' || like.swipe_action === 'rev') ? (
            <p className="text-brand-orange text-xs font-semibold mt-0.5">⭐ Rev It sent</p>
          ) : (
            <p className="text-brand-chrome text-xs mt-0.5">Waiting for them to like back</p>
          )}
        </div>
      </Link>

      {/* Delete button — outside the Link to avoid nested interactive elements */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-brand-chrome hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
        aria-label="Remove like"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function LikesSentClient() {
  const [likes, setLikes]     = useState<SentLike[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/likes/sent?page=${p}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (p === 0) {
        setLikes(json.likes ?? []);
      } else {
        setLikes((prev) => [...prev, ...(json.likes ?? [])]);
      }
      setTotal(json.total ?? 0);
      setHasMore(json.has_more ?? false);
      setPage(p);
    } catch {
      toast.error('Failed to load likes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(0); }, [load]);

  if (loading && likes.length === 0) {
    return (
      <div className="px-5 py-8 space-y-3">
        <div className="h-6 bg-brand-dark-3 rounded-xl w-40 animate-pulse" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-brand-dark-3 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="px-5 py-4 space-y-4 pb-10">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Heart className="w-5 h-5 text-brand-orange" />
          Riders you liked
        </h1>
        <p className="text-brand-chrome text-sm mt-0.5">{total} {total === 1 ? 'rider' : 'riders'} liked</p>
      </div>

      {likes.length === 0 && !loading ? (
        <div className="text-center py-12">
          <Users className="w-10 h-10 text-brand-chrome mx-auto mb-3" />
          <p className="font-semibold">No likes sent yet</p>
          <p className="text-brand-chrome text-sm mt-1">Start swiping to find your riding match</p>
        </div>
      ) : (
        <div className="space-y-3">
          {likes.map((like) => (
            <LikeSentCard
              key={like.swipe_id}
              like={like}
              onRemove={(id) => {
                setLikes((prev) => prev.filter((l) => l.swipe_id !== id));
                setTotal((t) => t - 1);
              }}
            />
          ))}

          {hasMore && (
            <button
              onClick={() => load(page + 1)}
              disabled={loading}
              className="w-full py-3 rounded-2xl border border-brand-dark-4 text-brand-chrome text-sm hover:border-brand-orange/50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <ChevronDown className="w-4 h-4" />
              {loading ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
