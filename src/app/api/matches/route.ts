import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { signPhotoUrls } from '@/lib/photos/sign';

export const dynamic = 'force-dynamic';

/**
 * GET /api/matches
 * Returns the current user's active matches with other-user profile data.
 * Used by client components that need to refresh after an unmatch.
 */
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: rawMatches, error } = await supabase
    .from('matches')
    .select('id, is_active, created_at, last_message_at, user1_id, user2_id, user1_superliked, user2_superliked')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .eq('is_active', true)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!rawMatches?.length) {
    return NextResponse.json({ matches: [] });
  }

  const otherUserIds = rawMatches.map((m) =>
    m.user1_id === user.id ? m.user2_id : m.user1_id
  );
  const matchIds = rawMatches.map((m) => m.id);

  const [
    { data: otherProfiles },
    { data: lastMessages },
    { data: unreadRows },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, display_name, last_active, is_verified, is_premium, show_online_status')
      .in('id', otherUserIds),
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

  // Fetch primary approved photos, then sign them
  const { data: rawPhotos } = await supabase
    .from('profile_photos')
    .select('user_id, storage_path, public_url')
    .in('user_id', otherUserIds)
    .eq('is_primary', true)
    .eq('moderation_status', 'approved');

  const signedPhotos = await signPhotoUrls(
    (rawPhotos ?? []) as { user_id: string; storage_path: string }[],
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

  return NextResponse.json({ matches });
}
