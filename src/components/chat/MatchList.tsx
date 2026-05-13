'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck, Bike, MoreVertical, ShieldOff, UserX } from 'lucide-react';
import { formatMessageTime, truncate } from '@/lib/utils';
import BlockReportSheet from '@/components/shared/BlockReportSheet';

// -- Message preview helper --------------------------------------------------

function previewContent(content: string, isMe: boolean): string {
  if (content.startsWith('{"type":"')) {
    try {
      const p = JSON.parse(content);
      if (p.type === 'gif')         return isMe ? 'You sent a GIF' : 'Sent a GIF';
      if (p.type === 'ride_invite') return isMe ? 'You sent a ride invite' : '🏍️ Ride date invite';
    } catch { /* fall through */ }
  }
  return content;
}

// -- Types -------------------------------------------------------------------

interface MatchUser {
  id: string;
  display_name: string;
  primary_photo_url: string | null;
  last_active: string;
  is_verified: boolean;
  is_premium: boolean;
  show_online_status: boolean;
}

interface LastMessage {
  content: string;
  sender_id: string;
  is_read: boolean;
  created_at: string;
}

interface Match {
  id: string;
  created_at: string;
  last_message_at: string | null;
  other_user: MatchUser;
  last_message: LastMessage | null;
  unread_count: number;
  you_superliked: boolean;
  they_superliked: boolean;
}

interface MatchListProps {
  matches: Match[];
  currentUserId: string;
}

// -- Match card row ----------------------------------------------------------

function MatchRow({ match, currentUserId, onUnmatch }: {
  match: Match;
  currentUserId: string;
  onUnmatch: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingUnmatch, setConfirmingUnmatch] = useState(false);
  const [blockSheetOpen, setBlockSheetOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const isOnline =
    match.other_user.show_online_status &&
    match.other_user.last_active
      ? Date.now() - new Date(match.other_user.last_active).getTime() < 5 * 60 * 1000
      : false;

  const eitherSuperliked = match.you_superliked || match.they_superliked;
  const hasUnread = match.unread_count > 0;

  async function handleUnmatch() {
    setLoading(true);
    try {
      const res = await fetch(`/api/matches/${match.id}`, { method: 'DELETE' });
      if (res.ok) onUnmatch(match.id);
    } finally {
      setLoading(false);
      setConfirmingUnmatch(false);
      setMenuOpen(false);
    }
  }

  return (
    <div className="relative group flex items-center gap-4 px-4 py-4 hover:bg-brand-dark-3/50 transition-colors border-b border-brand-dark-4/60">
      {/* Clickable chat area */}
      <Link href={`/chat/${match.id}`} className="flex items-center gap-4 flex-1 min-w-0">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div
            className={`w-14 h-14 rounded-full overflow-hidden ${eitherSuperliked ? 'ring-2 ring-brand-orange' : 'bg-brand-dark-4'}`}
          >
            {match.other_user.primary_photo_url ? (
              <Image
                src={match.other_user.primary_photo_url}
                alt={match.other_user.display_name}
                fill
                className="object-cover"
                sizes="56px"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl bg-brand-dark-4">
                🏍️
              </div>
            )}
          </div>

          {/* Online dot */}
          {isOnline && (
            <div className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-brand-dark" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Name row */}
          <div className="flex items-center gap-1.5">
            <span className={`font-semibold truncate ${hasUnread ? 'text-white' : 'text-brand-chrome'}`}>
              {match.other_user.display_name}
            </span>
            {match.other_user.is_verified && (
              <ShieldCheck size={13} className="shrink-0 text-blue-400" />
            )}
            {eitherSuperliked && (
              <span className="shrink-0 flex items-center gap-0.5 text-brand-orange text-[10px] font-semibold bg-brand-orange/10 border border-brand-orange/20 rounded-full px-1.5 py-0.5">
                <Bike size={9} />
                Ride With
              </span>
            )}
          </div>

          {/* Last message row */}
          <div className="flex items-center justify-between mt-0.5 gap-2">
            <p className={`text-sm truncate ${hasUnread ? 'text-white font-medium' : 'text-brand-chrome'}`}>
              {match.last_message
                ? (match.last_message.sender_id === currentUserId ? 'You: ' : '') +
                  truncate(previewContent(match.last_message.content, match.last_message.sender_id === currentUserId), 40)
                : 'Tap to say hello'}
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              {match.last_message_at && (
                <span className="text-xs text-brand-chrome">
                  {formatMessageTime(match.last_message_at)}
                </span>
              )}
              {hasUnread && (
                <span className="w-5 h-5 rounded-full bg-brand-orange text-white text-xs flex items-center justify-center font-bold">
                  {match.unread_count > 9 ? '9+' : match.unread_count}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>

      {/* Action menu — visible on hover or when open */}
      <div className={`shrink-0 transition-opacity ${menuOpen || confirmingUnmatch ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        {confirmingUnmatch ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleUnmatch}
              disabled={loading}
              className="text-xs text-red-400 font-semibold px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              {loading ? '...' : 'Unmatch'}
            </button>
            <button
              onClick={() => setConfirmingUnmatch(false)}
              className="text-xs text-brand-chrome px-2 py-1 rounded-lg hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : menuOpen ? (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.preventDefault(); setBlockSheetOpen(true); setMenuOpen(false); }}
              className="flex items-center gap-1 text-xs text-red-400 font-medium px-2 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors"
            >
              <ShieldOff size={12} /> Block
            </button>
            <button
              onClick={(e) => { e.preventDefault(); setConfirmingUnmatch(true); setMenuOpen(false); }}
              className="flex items-center gap-1 text-xs text-brand-chrome font-medium px-2 py-1.5 rounded-lg bg-brand-dark-3 border border-brand-dark-4 hover:text-white transition-colors"
            >
              <UserX size={12} /> Unmatch
            </button>
            <button
              onClick={(e) => { e.preventDefault(); setMenuOpen(false); }}
              className="text-xs text-brand-chrome px-1.5 py-1 rounded-lg hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => { e.preventDefault(); setMenuOpen(true); }}
            className="p-1.5 rounded-full text-brand-chrome hover:text-white hover:bg-brand-dark-3 transition-colors"
            aria-label="More options"
          >
            <MoreVertical size={16} />
          </button>
        )}
      </div>

      {blockSheetOpen && (
        <BlockReportSheet
          userId={match.other_user.id}
          displayName={match.other_user.display_name}
          onClose={() => setBlockSheetOpen(false)}
          onBlocked={() => onUnmatch(match.id)}
        />
      )}
    </div>
  );
}

// -- Main list ---------------------------------------------------------------

export default function MatchList({ matches: initial, currentUserId }: MatchListProps) {
  const [matches, setMatches] = useState(initial);

  function handleUnmatch(id: string) {
    setMatches((prev) => prev.filter((m) => m.id !== id));
  }

  if (!matches.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-8">
        <div className="text-4xl">🏍️</div>
        <h2 className="text-xl font-bold">No matches yet</h2>
        <p className="text-brand-chrome text-sm">Start swiping to find your riding partner</p>
        <Link
          href="/discover"
          className="px-6 py-3 rounded-2xl bg-brand-orange text-white font-semibold"
        >
          Go Discover
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {matches.map((match) => (
        <MatchRow
          key={match.id}
          match={match}
          currentUserId={currentUserId}
          onUnmatch={handleUnmatch}
        />
      ))}
    </div>
  );
}