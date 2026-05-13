import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserEntitlements, PremiumRequiredError } from '@/lib/premium';
import { signPhotoUrls } from '@/lib/photos/sign';

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Server-side entitlement check — source of truth is subscriptions table
  let entitlements;
  try {
    entitlements = await getUserEntitlements(user.id);
    if (!entitlements.canSeeWhoLiked) throw new PremiumRequiredError();
  } catch (err) {
    if (err instanceof PremiumRequiredError) {
      return NextResponse.json(
        { error: 'Premium required', code: 'PREMIUM_REQUIRED' },
        { status: 403 }
      );
    }
    throw err;
  }

  const url = new URL(request.url);
  const page = Math.max(0, parseInt(url.searchParams.get('page') ?? '0'));
  const admin = createAdminClient();

  // Pre-fetch the IDs this user has already swiped on so we can exclude them
  const { data: alreadySwiped } = await admin
    .from('swipes')
    .select('swiped_id')
    .eq('swiper_id', user.id);
  const swipedIds = (alreadySwiped ?? []).map((s) => s.swiped_id);

  // Get users who liked (or superliked) this user, excluding already-decided ones
  let query = admin
    .from('swipes')
    .select(`
      id,
      swipe_action,
      created_at,
      swiper:swiper_id (
        id,
        display_name,
        age,
        city,
        country,
        riding_style,
        is_verified,
        is_premium,
        hide_exact_location
      )
    `, { count: 'exact' })
    .eq('swiped_id', user.id)
    .in('swipe_action', ['like', 'superlike', 'rev'])
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

  if (swipedIds.length > 0) {
    query = query.not('swiper_id', 'in', `(${swipedIds.join(',')})`);
  }

  const { data: likes, error, count } = await query;

  if (error) {
    console.error('Likes received error:', error);
    return NextResponse.json({ error: 'Failed to fetch likes' }, { status: 500 });
  }

  // Fetch primary photos for each liker
  const likerIds = (likes ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((l) => ((l.swiper as any) as { id: string } | null)?.id)
    .filter(Boolean) as string[];

  let photoMap: Record<string, string> = {};
  if (likerIds.length > 0) {
    const { data: rawPhotos } = await admin
      .from('profile_photos')
      .select('user_id, storage_path, public_url')
      .in('user_id', likerIds)
      .eq('is_primary', true)
      .eq('moderation_status', 'approved');

    const signedPhotos = await signPhotoUrls(
      (rawPhotos ?? []) as { user_id: string; storage_path: string; public_url?: string | null }[],
      'profile-photos',
    );
    photoMap = Object.fromEntries(signedPhotos.map((p) => [p.user_id, p.public_url]));
  }

  const result = (likes ?? []).map((like) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const swiper = (like.swiper as any) as {
      id: string;
      display_name: string;
      age: number | null;
      city: string | null;
      country: string;
      riding_style: string | null;
      is_verified: boolean;
      is_premium: boolean;
      hide_exact_location: boolean;
    } | null;

    return {
      swipe_id:     like.id,
      swipe_action: like.swipe_action,
      liked_at:     like.created_at,
      user: swiper ? {
        id:            swiper.id,
        display_name:  swiper.display_name,
        age:           swiper.age,
        city:          swiper.hide_exact_location ? null : swiper.city,
        country:       swiper.country,
        riding_style:  swiper.riding_style,
        is_verified:   swiper.is_verified,
        is_premium:    swiper.is_premium,
        photo_url:     photoMap[swiper.id] ?? null,
      } : null,
    };
  }).filter((l) => l.user !== null);

  return NextResponse.json({
    likes: result,
    total: count ?? 0,
    page,
    has_more: (count ?? 0) > (page + 1) * PAGE_SIZE,
  });
}
