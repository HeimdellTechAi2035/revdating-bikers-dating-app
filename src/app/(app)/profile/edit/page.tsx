import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { signPhotoUrls } from '@/lib/photos/sign';
import { EditProfileForm } from '@/components/profile/EditProfileForm';
import { PhotoUploader } from '@/components/photos/PhotoUploader';
import type { PhotoRecord } from '@/components/photos/PhotoUploader';

export const dynamic = 'force-dynamic';

export default async function EditProfilePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [
    { data: profile },
    { data: primaryBike },
    { data: photos },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single(),
    supabase
      .from('bikes')
      .select('bike_brand, bike_model, bike_year, bike_type')
      .eq('user_id', user.id)
      .eq('primary_bike', true)
      .maybeSingle(),
    supabase
      .from('profile_photos')
      .select('id, storage_path, public_url, is_primary, moderation_status, rejected_reason, sort_order')
      .eq('user_id', user.id)
      .order('is_primary', { ascending: false })
      .order('sort_order', { ascending: true }),
  ]);

  if (!profile) redirect('/onboarding');

  const signedPhotos = await signPhotoUrls(
    (photos ?? []) as { id: string; storage_path: string; is_primary: boolean; moderation_status: string; rejected_reason: string | null; sort_order: number }[],
    'profile-photos',
  );

  return (
    <div className="px-5 py-4 pb-32">
      <h1 className="text-xl font-bold mb-6">Edit Profile</h1>

      {/* Photos section */}
      <section className="mb-8">
        <h2 className="font-bold text-brand-chrome uppercase text-xs tracking-widest mb-4">
          My Photos
        </h2>
        <PhotoUploader
          userId={user.id}
          initialPhotos={signedPhotos as PhotoRecord[]}
          maxPhotos={6}
        />
      </section>

      <EditProfileForm profile={profile as any} bike={primaryBike as any} />
    </div>
  );
}
