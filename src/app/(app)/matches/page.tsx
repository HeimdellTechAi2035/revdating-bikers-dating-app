import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { signPhotoUrls } from '@/lib/photos/sign';
import MatchList from '@/components/chat/MatchList';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

const THREE_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export default async function MatchesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const accountAgeMs = Date.now() - new Date(user.created_at).getTime();
  const showWelcome = accountAgeMs < THREE_DAYS_MS;

  // Fetch all active matches
  const { data: rawMatches } = await supabase
    .from('matches')
    .select('id, is_active, created_at, last_message_at, user1_id, user2_id, user1_superliked, user2_superliked')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .eq('is_active', true)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (!rawMatches?.length) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-5 py-4 border-b border-brand-dark-4">
          <h1 className="text-xl font-bold">Messages</h1>
          <p className="text-brand-chrome text-sm">0 connections</p>
        </div>
        {showWelcome && (
          <Link
            href="/safety"
            className="flex items-center gap-3 px-4 py-3.5 border-b border-brand-dark-4 bg-brand-orange/5 hover:bg-brand-orange/10 transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-brand-orange flex items-center justify-center flex-shrink-0 shadow-md">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="font-semibold text-sm text-white">REVdating Team</span>
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-brand-orange/20 text-brand-orange font-medium">Admin</span>
              </div>
              <p className="text-xs text-brand-chrome truncate">
                👋 Welcome! Please take a moment to fill out your Safety Centre — it helps keep everyone safe on rides.
              </p>
            </div>
            <span className="text-brand-orange text-xs font-semibold flex-shrink-0">Open →</span>
          </Link>
        )}
        <div className="flex flex-col items-center justify-center flex-1 px-6 text-center">
          <span className="text-5xl mb-4">🏍️</span>
          <h2 className="text-xl font-bold mb-2">No messages yet</h2>
          <p className="text-brand-chrome text-sm">
            Match with someone to start chatting
          </p>
        </div>
      </div>
    );
  }

  const otherUserIds = rawMatches.map((m) =>
    m.user1_id === user.id ? m.user2_id : m.user1_id
  );
  const matchIds = rawMatches.map((m) => m.id);

  // Parallel: profiles, primary photos, last messages, unread counts
  const [
    { data: otherProfiles },
    { data: photos },
    { data: lastMessages },
    { data: unreadRows },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, display_name, last_active, is_verified, is_premium, show_online_status')
      .in('id', otherUserIds),
    supabase
      .from('profile_photos')
      .select('user_id, storage_path, public_url')
      .in('user_id', otherUserIds)
      .eq('is_primary', true)
      .eq('moderation_status', 'approved'),
    supabase
      .from('messages')
      .select('match_id, content, sender_id, is_read, created_at')
      .in('match_id', matchIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('messages')
      .select('match_id')
      .in('match_id', matchIds)
      .eq('is_read', false)
      .neq('sender_id', user.id),
  ]);

  const signedPhotos = await signPhotoUrls(
    (photos ?? []) as { user_id: string; storage_path: string; public_url?: string | null }[],
    'profile-photos',
  );
  const profileMap = new Map((otherProfiles ?? []).map((p) => [p.id, p]));
  const photoMap = new Map(signedPhotos.map((p) => [p.user_id, p.public_url]));

  const lastMessageMap = new Map<string, NonNullable<typeof lastMessages>[0]>();
  for (const msg of lastMessages ?? []) {
    if (!lastMessageMap.has(msg.match_id)) lastMessageMap.set(msg.match_id, msg);
  }

  const unreadMap = new Map<string, number>();
  for (const row of unreadRows ?? []) {
    unreadMap.set(row.match_id, (unreadMap.get(row.match_id) ?? 0) + 1);
  }

  const matches = rawMatches.map((m) => {
    const otherId = m.user1_id === user.id ? m.user2_id : m.user1_id;
    const profile = profileMap.get(otherId);
    const lastMsg = lastMessageMap.get(m.id) ?? null;
    return {
      id: m.id,
      created_at: m.created_at,
      last_message_at: m.last_message_at,
      other_user: {
        id: otherId,
        display_name: profile?.display_name ?? 'Unknown',
        primary_photo_url: photoMap.get(otherId) ?? null,
        last_active: profile?.last_active ?? '',
        is_verified: profile?.is_verified ?? false,
        is_premium: profile?.is_premium ?? false,
        show_online_status: profile?.show_online_status ?? true,
      },
      last_message: lastMsg
        ? { content: lastMsg.content, sender_id: lastMsg.sender_id, is_read: lastMsg.is_read, created_at: lastMsg.created_at }
        : null,
      unread_count: unreadMap.get(m.id) ?? 0,
      you_superliked: m.user1_id === user.id ? m.user1_superliked : m.user2_superliked,
      they_superliked: m.user1_id === user.id ? m.user2_superliked : m.user1_superliked,
    };
  });

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-brand-dark-4">
        <h1 className="text-xl font-bold">Messages</h1>
        <p className="text-brand-chrome text-sm">
          {matches.length} connection{matches.length !== 1 ? 's' : ''}
        </p>
      </div>

      {showWelcome && (
        <Link
          href="/safety"
          className="flex items-center gap-3 px-4 py-3.5 border-b border-brand-dark-4 bg-brand-orange/5 hover:bg-brand-orange/10 transition-colors"
        >
          <div className="w-12 h-12 rounded-full bg-brand-orange flex items-center justify-center flex-shrink-0 shadow-md">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="font-semibold text-sm text-white">REVdating Team</span>
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-brand-orange/20 text-brand-orange font-medium">Admin</span>
            </div>
            <p className="text-xs text-brand-chrome truncate">
              👋 Welcome! Please take a moment to fill out your Safety Centre — it helps keep everyone safe on rides.
            </p>
          </div>
          <span className="text-brand-orange text-xs font-semibold flex-shrink-0">Open →</span>
        </Link>
      )}

      <MatchList matches={matches} currentUserId={user.id} />
    </div>
  );
}