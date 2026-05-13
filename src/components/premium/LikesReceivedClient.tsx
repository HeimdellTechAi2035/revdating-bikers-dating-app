'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Heart, Bike, ChevronDown, BadgeCheck, Zap } from 'lucide-react';
import { formatRidingStyle } from '@/lib/utils';
import toast from 'react-hot-toast';

interface LikerUser {
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

interface Like {
  swipe_id:     string;
  swipe_action: string;
  liked_at:     string;
  user:         LikerUser;
}

export default function LikesReceivedClient() {
  const [likes, setLikes]       = useState<Like[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(0);
  const [hasMore, setHasMore]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const [liking, setLiking]     = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/likes/received?page=${p}`);
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

  async function handleLike(userId: string) {
    setLiking(userId);
    try {
      const res = await fetch('/api/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ swiped_id: userId, action: 'like' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed');

      if (json.match) {
        toast.success("It's a match! 🏍️");
      } else {
        toast.success('Liked back!');
      }
      // Remove from list
      setLikes((prev) => prev.filter((l) => l.user.id !== userId));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to like');
    } finally {
      setLiking(null);
    }
  }

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
          Riders who liked you
        </h1>
        <p className="text-brand-chrome text-sm mt-0.5">{total} {total === 1 ? 'rider' : 'riders'} waiting</p>
      </div>

      {likes.length === 0 && !loading ? (
        <div className="text-center py-12">
          <Heart className="w-10 h-10 text-brand-chrome mx-auto mb-3" />
          <p className="font-semibold">No new likes yet</p>
          <p className="text-brand-chrome text-sm mt-1">Keep your profile active to attract riders</p>
        </div>
      ) : (
        <div className="space-y-3">
          {likes.map((like) => (
            <div
              key={like.swipe_id}
              className="flex items-center gap-3 p-3 bg-brand-dark-3 rounded-2xl border border-brand-dark-4"
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
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-brand-chrome text-xl">
                    {like.user.display_name[0]}
                  </div>
                )}
                {(like.swipe_action === 'superlike' || like.swipe_action === 'rev') && (
                  <div className="absolute bottom-0 right-0 bg-brand-orange text-white rounded-tl-lg p-0.5">
                    <Zap className="w-3 h-3" />
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
                {(like.swipe_action === 'superlike' || like.swipe_action === 'rev') && (
                  <p className="text-brand-orange text-xs font-semibold mt-0.5">⭐ Rev It</p>
                )}
              </div>

              {/* Like back button */}
              <button
                onClick={() => handleLike(like.user.id)}
                disabled={liking === like.user.id}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-orange text-white text-xs font-semibold hover:bg-brand-orange/90 transition-colors disabled:opacity-50"
              >
                <Heart className="w-3.5 h-3.5" />
                {liking === like.user.id ? '…' : 'Like back'}
              </button>
            </div>
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
