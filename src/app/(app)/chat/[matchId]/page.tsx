import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { signPhotoUrl } from '@/lib/photos/sign';
import ChatWindow from '@/components/chat/ChatWindow';
export const dynamic = 'force-dynamic';

interface Props {
  params: { matchId: string };
}

export default async function ChatPage({ params }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Verify user is a participant in this match
  // Cast needed: Supabase drops the inferred type to `never` when .or() uses a template literal
  const { data: matchRaw } = await supabase
    .from('matches')
    .select('id, user1_id, user2_id, is_active')
    .eq('id', params.matchId)
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .single();
  const match = matchRaw as { id: string; user1_id: string; user2_id: string; is_active: boolean } | null;

  if (!match) notFound();
  if (!match.is_active) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <span className="text-4xl mb-4">🔒</span>
        <h2 className="text-xl font-bold mb-2">Chat unavailable</h2>
        <p className="text-brand-chrome text-sm">This match is no longer active.</p>
      </div>
    );
  }

  const otherId = match.user1_id === user.id ? match.user2_id : match.user1_id;

  // Fetch other user's profile
  const { data: otherProfile } = await supabase
    .from('profiles')
    .select('id, display_name, last_active, is_verified, is_premium, show_online_status')
    .eq('id', otherId)
    .single();

  // Fetch other user's primary photo and generate a signed URL
  const { data: primaryPhoto } = await supabase
    .from('profile_photos')
    .select('storage_path, public_url')
    .eq('user_id', otherId)
    .eq('is_primary', true)
    .eq('moderation_status', 'approved')
    .single();
  const signed = primaryPhoto?.storage_path
    ? await signPhotoUrl(primaryPhoto.storage_path, 'profile-photos')
    : null;
  const primaryPhotoUrl = (signed && signed !== '') ? signed : ((primaryPhoto as any)?.public_url ?? null);

  // Fetch initial messages (last 50, excluding soft-deleted)
  const { data: messages } = await supabase
    .from('messages')
    .select('id, match_id, sender_id, content, is_read, read_at, created_at')
    .eq('match_id', params.matchId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(50);

  // Mark the other user's messages as read on open
  await supabase.rpc('mark_messages_read', { p_match_id: params.matchId });

  return (
    <ChatWindow
      matchId={params.matchId}
      currentUserId={user.id}
      otherUser={{
        id: otherId,
        display_name: otherProfile?.display_name ?? 'Unknown',
        primary_photo_url: primaryPhotoUrl,
        last_active: otherProfile?.last_active ?? '',
        is_verified: otherProfile?.is_verified ?? false,
        show_online_status: otherProfile?.show_online_status ?? true,
      }}
      initialMessages={(messages ?? []).map((m) => ({
        ...m,
        is_mine: m.sender_id === user.id,
        deleted_at: null,
        read_at: m.read_at ?? null,
      }))}
    />
  );
}
