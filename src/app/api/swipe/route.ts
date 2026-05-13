import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createSwipe } from '@/lib/swipe';
import { emailNewMatch } from '@/lib/email';
import { notifyNewLike, notifyNewMatch } from '@/lib/notifications';
import { signPhotoUrl } from '@/lib/photos/sign';
import { checkRateLimit, tooManyRequestsResponse } from '@/lib/rate-limit';
import { z } from 'zod';

const bodySchema = z.object({
  swiped_id: z.string().uuid(),
  // 'rev_it' is the biker-themed "Rev It" — mapped to 'rev' in the DB
  action: z.enum(['like', 'pass', 'rev_it']),
});

export async function POST(request: NextRequest) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 30 swipes per minute per user — stops automated bot swiping
  const rl = checkRateLimit(`swipe:${user.id}`, 30, 60_000);
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetAt);

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { swiped_id, action } = parsed.data;

  // Map UI action → DB enum value ('rev_it' → 'rev')
  const dbAction = action === 'rev_it' ? 'rev' : action;

  // ── Core swipe logic ─────────────────────────────────────────
  // createSwipe handles all validation, duplicate prevention,
  // match creation, and badge awarding in one call.

  let swipeResult: Awaited<ReturnType<typeof createSwipe>>;
  try {
    swipeResult = await createSwipe(user.id, swiped_id, dbAction);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Swipe failed';

    // Map validation errors to appropriate HTTP status codes
    if (message.includes('already swiped')) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    if (message.includes('Banned')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message.includes('blocked')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message.includes('Complete your profile')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    console.error('[POST /api/swipe] createSwipe error:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { match_created: isMatch, match_id: matchId } = swipeResult;

  // ── If a match was created, fetch details for the match modal ─
  const admin = createAdminClient();
  let matchInfo: { match_id: string; display_name: string; photo_url: string | null } | null = null;

  if (isMatch && matchId) {
    const [{ data: swipedProfile }, { data: swiperProfile }, { data: photo }] = await Promise.all([
      admin.from('profiles').select('display_name').eq('id', swiped_id).single(),
      admin.from('profiles').select('display_name').eq('id', user.id).single(),
      admin
        .from('profile_photos')
        .select('storage_path, public_url')
        .eq('user_id', swiped_id)
        .eq('is_primary', true)
        .eq('moderation_status', 'approved')
        .maybeSingle(),
    ]);

    const swipedName  = (swipedProfile  as any)?.display_name ?? 'Someone';
    const swiperName  = (swiperProfile  as any)?.display_name ?? 'Someone';

    const signedPhoto = (photo as any)?.storage_path
      ? await signPhotoUrl((photo as any).storage_path, 'profile-photos')
      : null;
    matchInfo = {
      match_id:     matchId,
      display_name: swipedName,
      photo_url:    (signedPhoto && signedPhoto !== '')
        ? signedPhoto
        : ((photo as any)?.public_url ?? null),
    };

    // Push + email both users about the new match (fire-and-forget)
    void Promise.all([
      notifyNewMatch(user.id,   swipedName, matchId),
      notifyNewMatch(swiped_id, swiperName, matchId),
      emailNewMatch(user.id,    swipedName, matchId),
      emailNewMatch(swiped_id,  swiperName, matchId),
    ]).catch((err) => console.warn('[swipe] match notification failed:', err));
  } else if (dbAction === 'like' || dbAction === 'rev') {
    // No match yet — notify the person who was liked/revved
    void notifyNewLike(swiped_id).catch(() => {});
  }

  // ── Return updated counters so the client stays in sync ───────

  let creditsRemaining: number | undefined;
  if (dbAction === 'rev') {
    const { data: credits } = await supabase
      .from('superlike_credits')
      .select('credits')
      .eq('user_id', user.id)
      .single();
    creditsRemaining = credits?.credits;
  }

  const today = new Date().toISOString().split('T')[0];
  const [{ data: swipeCount }, { data: viewerProfile }] = await Promise.all([
    supabase.from('daily_swipe_counts').select('count, reset_date').eq('user_id', user.id).single(),
    supabase.from('profiles').select('is_premium').eq('id', user.id).single(),
  ]);

  const todayCount = swipeCount?.reset_date === today ? (swipeCount?.count ?? 0) : 0;
  const swipesRemaining = viewerProfile?.is_premium ? null : Math.max(0, 20 - todayCount);

  return NextResponse.json({
    swipe_created: true,
    is_match: isMatch,
    match: matchInfo,
    swipes_remaining: swipesRemaining,
    credits_remaining: creditsRemaining,
  });
}

