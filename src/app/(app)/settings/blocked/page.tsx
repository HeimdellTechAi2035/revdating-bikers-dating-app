import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, User2 } from 'lucide-react';
import { signPhotoUrls } from '@/lib/photos/sign';
import { UnblockButton } from './UnblockButton';

export const dynamic = 'force-dynamic';

export default async function BlockedUsersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: blocks } = await supabase
    .from('blocked_users')
    .select('blocked_id, created_at')
    .eq('blocker_id', user.id)
    .order('created_at', { ascending: false });

  const blockedIds = (blocks ?? []).map(b => (b as any).blocked_id as string);

  const photoMap: Record<string, string> = {};
  const nameMap: Record<string, string>  = {};

  if (blockedIds.length > 0) {
    const admin = createAdminClient();
    const [{ data: profiles }, { data: photos }] = await Promise.all([
      admin
        .from('profiles')
        .select('id, display_name')
        .in('id', blockedIds),
      admin
        .from('profile_photos')
        .select('user_id, storage_path, public_url')
        .in('user_id', blockedIds)
        .eq('is_primary', true)
        .eq('moderation_status', 'approved'),
    ]);

    const signedPhotos = await signPhotoUrls(
      (photos ?? []) as { user_id: string; storage_path: string; public_url?: string | null }[],
      'profile-photos',
    );
    for (const p of (profiles ?? []) as any[]) nameMap[p.id] = p.display_name;
    for (const p of signedPhotos) photoMap[p.user_id] = p.public_url;
  }

  return (
    <div className="flex flex-col min-h-screen pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-brand-dark-4">
        <Link
          href="/settings"
          className="flex items-center gap-1.5 text-brand-chrome hover:text-white transition-colors text-sm"
        >
          <ArrowLeft size={16} />
        </Link>
        <h1 className="font-bold text-lg">Blocked Users</h1>
      </div>

      <div className="px-5 pt-5">
        {blockedIds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <User2 size={40} className="text-brand-chrome/30" />
            <p className="text-brand-chrome text-sm">You haven&apos;t blocked anyone.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {blockedIds.map((id) => (
              <li
                key={id}
                className="flex items-center gap-3 p-3 rounded-2xl bg-brand-dark-3 border border-brand-dark-4"
              >
                {/* Avatar */}
                <div className="relative w-11 h-11 rounded-full overflow-hidden bg-brand-dark-4 flex-shrink-0">
                  {photoMap[id] ? (
                    <Image
                      src={photoMap[id]}
                      alt={nameMap[id] ?? 'Blocked user'}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User2 size={20} className="text-brand-chrome/40" />
                    </div>
                  )}
                </div>

                {/* Name + blocked date */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{nameMap[id] ?? 'Unknown user'}</p>
                  <p className="text-xs text-brand-chrome/50">
                    Blocked{' '}
                    {new Date(((blocks ?? []) as any[]).find(b => b.blocked_id === id)?.created_at ?? '').toLocaleDateString()}
                  </p>
                </div>

                <UnblockButton blockedId={id} />
              </li>
            ))}
          </ul>
        )}

        {blockedIds.length > 0 && (
          <p className="text-xs text-brand-chrome/40 text-center mt-6">
            Unblocking someone lets them appear in discovery again.
          </p>
        )}
      </div>
    </div>
  );
}
