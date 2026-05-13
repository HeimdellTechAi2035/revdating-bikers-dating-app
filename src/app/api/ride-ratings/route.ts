import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isDevBypassEnabled } from '@/lib/dev-bypass';

export async function POST(request: NextRequest) {
  if (isDevBypassEnabled()) {
    return NextResponse.json({ avg_stars: 4.5, rating_count: 12, your_stars: 5 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { photoId, stars } = body as Record<string, unknown>;
  if (typeof photoId !== 'string' || !photoId) {
    return NextResponse.json({ error: 'photoId is required' }, { status: 400 });
  }
  if (typeof stars !== 'number' || stars < 1 || stars > 5 || !Number.isInteger(stars)) {
    return NextResponse.json({ error: 'stars must be an integer 1–5' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: upsertError } = await (supabase.from('ride_ratings') as any)
    .upsert({ photo_id: photoId, rater_id: user.id, stars }, { onConflict: 'photo_id,rater_id' }) as
    { error: { code: string; message: string } | null };

  if (upsertError) {
    // Trigger fires for self-rating (check violation maps to 23514/P0001 depending on pg version)
    if (upsertError.message?.includes('Cannot rate your own')) {
      return NextResponse.json({ error: 'Cannot rate your own photos' }, { status: 400 });
    }
    console.error('[POST /api/ride-ratings]', upsertError.message);
    return NextResponse.json({ error: 'Failed to save rating' }, { status: 500 });
  }

  const summary = await getPhotoSummary(supabase, photoId);
  return NextResponse.json({ ...summary, your_stars: stars });
}

export async function DELETE(request: NextRequest) {
  if (isDevBypassEnabled()) {
    return NextResponse.json({ avg_stars: null, rating_count: 0, your_stars: null });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { photoId } = body as Record<string, unknown>;
  if (typeof photoId !== 'string' || !photoId) {
    return NextResponse.json({ error: 'photoId is required' }, { status: 400 });
  }

  await supabase
    .from('ride_ratings')
    .delete()
    .eq('photo_id', photoId)
    .eq('rater_id', user.id);

  const summary = await getPhotoSummary(supabase, photoId);
  return NextResponse.json({ ...summary, your_stars: null });
}

async function getPhotoSummary(
  supabase: ReturnType<typeof createClient>,
  photoId: string,
): Promise<{ avg_stars: number | null; rating_count: number }> {
  const { data } = await supabase
    .from('photo_rating_summaries')
    .select('avg_stars, rating_count')
    .eq('photo_id', photoId)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any as { avg_stars: number | null; rating_count: number } | null;
  return {
    avg_stars: row ? Number(row.avg_stars) : null,
    rating_count: row ? Number(row.rating_count) : 0,
  };
}
