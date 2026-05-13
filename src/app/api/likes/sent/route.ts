import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { signPhotoUrls } from '@/lib/photos/sign';

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const page = Math.max(0, parseInt(url.searchParams.get('page') ?? '0'));
  const admin = createAdminClient();

  // Get users this person liked or superliked
  const { data: swipes, error, count } = await admin
    .from('swipes')
    .select(`
      id,
      swipe_action,
      created_at,
      swiped:swiped_id (
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
    .eq('swiper_id', user.id)
    .in('swipe_action', ['like', 'superlike', 'rev'])
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

  if (error) {
    console.error('Likes sent error:', error);
    return NextResponse.json({ error: 'Failed to fetch likes' }, { status: 500 });
  }

  // Fetch primary photos for each liked user
  const swipedIds = (swipes ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((s) => ((s.swiped as any) as { id: string } | null)?.id)
    .filter(Boolean) as string[];

  let photoMap: Record<string, string> = {};
  if (swipedIds.length > 0) {
    const { data: rawPhotos } = await admin
      .from('profile_photos')
      .select('user_id, storage_path, public_url')
      .in('user_id', swipedIds)
      .eq('is_primary', true)
      .eq('moderation_status', 'approved');

    const signedPhotos = await signPhotoUrls(
      (rawPhotos ?? []) as { user_id: string; storage_path: string; public_url?: string | null }[],
      'profile-photos',
    );
    photoMap = Object.fromEntries(signedPhotos.map((p) => [p.user_id, p.public_url]));
  }

  // Check which of these are mutual matches (both swiped right on each other)
  let matchedIds = new Set<string>();
  if (swipedIds.length > 0) {
    const { data: mutualSwipes } = await admin
      .from('swipes')
      .select('swiper_id')
      .in('swiper_id', swipedIds)
      .eq('swiped_id', user.id)
      .in('swipe_action', ['like', 'superlike', 'rev']);

    matchedIds = new Set((mutualSwipes ?? []).map((s) => s.swiper_id));
  }

  const result = (swipes ?? []).map((swipe) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const swiped = (swipe.swiped as any) as {
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
      swipe_id:     swipe.id,
      swipe_action: swipe.swipe_action,
      liked_at:     swipe.created_at,
      is_match:     swiped ? matchedIds.has(swiped.id) : false,
      user: swiped ? {
        id:            swiped.id,
        display_name:  swiped.display_name,
        age:           swiped.age,
        city:          swiped.hide_exact_location ? null : swiped.city,
        country:       swiped.country,
        riding_style:  swiped.riding_style,
        is_verified:   swiped.is_verified,
        is_premium:    swiped.is_premium,
        photo_url:     photoMap[swiped.id] ?? null,
      } : null,
    };
  }).filter((s) => s.user !== null);

  return NextResponse.json({
    likes: result,
    total: count ?? 0,
    page,
    has_more: (count ?? 0) > (page + 1) * PAGE_SIZE,
  });
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const swipeId = url.searchParams.get('swipe_id');
  if (!swipeId) return NextResponse.json({ error: 'swipe_id required' }, { status: 400 });

  const admin = createAdminClient();

  // Verify the swipe belongs to this user and get the swiped_id
  const { data: swipe, error: lookupError } = await admin
    .from('swipes')
    .select('id, swiped_id')
    .eq('id', swipeId)
    .eq('swiper_id', user.id)
    .maybeSingle();

  if (lookupError) {
    console.error('[DELETE /api/likes/sent] lookup error:', lookupError);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
  if (!swipe) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Delete the swipe so this person re-enters the discovery deck
  const { error: deleteError } = await admin
    .from('swipes')
    .delete()
    .eq('id', swipeId)
    .eq('swiper_id', user.id);

  if (deleteError) {
    console.error('[DELETE /api/likes/sent] delete error:', deleteError);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }

  // Deactivate any match between these two users
  await admin
    .from('matches')
    .update({ is_active: false })
    .or(
      `and(user1_id.eq.${user.id},user2_id.eq.${swipe.swiped_id}),and(user1_id.eq.${swipe.swiped_id},user2_id.eq.${user.id})`
    );

  return NextResponse.json({ ok: true });
}
