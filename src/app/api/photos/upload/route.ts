import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { uploadPhoto } from '@/lib/photos';
import { checkRateLimit, tooManyRequestsResponse } from '@/lib/rate-limit';
import { z } from 'zod';

const schema = z.object({
  // Path inside the 'profile-photos' bucket: {userId}/{timestamp}-{random}.{ext}
  storage_path: z.string().min(1).max(500),
  /** 'profile' = selfie/portrait, 'bike' = motorcycle photo. Default: 'profile' */
  photo_type:   z.enum(['profile', 'bike']).optional().default('profile'),
  is_primary:   z.boolean().optional().default(false),
  sort_order:   z.number().int().min(0).max(5).optional().default(0),
});

// â”€â”€ POST â€” register an already-uploaded photo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Clients upload directly to Supabase Storage via a signed URL first,
// then call this endpoint to create the profile_photos row and trigger
// async NSFW moderation.
export async function POST(request: NextRequest) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 10 photo registrations per minute per user
  const rl = checkRateLimit(`photo-upload:${user.id}`, 10, 60_000);
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetAt);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { storage_path, photo_type, is_primary, sort_order } = parsed.data;

  // Ensure the storage path is scoped to the authenticated user to prevent
  // cross-user injection (e.g. registering someone else's file as your photo)
  if (!storage_path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: 'Storage path must be scoped to your user ID' }, { status: 403 });
  }

  try {
    const photo = await uploadPhoto(user.id, storage_path, {
      photo_type,
      is_primary,
      sort_order,
    });

    return NextResponse.json({
      success: true,
      photo: {
        id:                photo.id,
        public_url:        photo.public_url,
        photo_type:        photo_type,
        moderation_status: photo.moderation_status,
        is_primary:        photo.is_primary,
        sort_order:        photo.sort_order,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    if (message.includes('Maximum of')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (message.includes('not found in storage')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error('[POST /api/photos/upload]', message);
    return NextResponse.json({ error: 'Failed to save photo' }, { status: 500 });
  }
}

// â”€â”€ PATCH â€” set primary photo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = z.object({ photo_id: z.string().uuid() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const { photo_id } = parsed.data;

  // Verify the photo belongs to this user and is approved
  const { data: photo } = await admin
    .from('profile_photos')
    .select('id, user_id, moderation_status')
    .eq('id', photo_id)
    .eq('user_id', user.id)
    .single();

  if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
  if (photo.moderation_status !== 'approved') {
    return NextResponse.json(
      { error: 'Only approved photos can be set as primary' },
      { status: 400 },
    );
  }

  // Clear old primary then set new one (two-step to avoid constraint violation)
  await admin.from('profile_photos').update({ is_primary: false }).eq('user_id', user.id).eq('is_primary', true);
  await admin.from('profile_photos').update({ is_primary: true }).eq('id', photo_id);

  return NextResponse.json({ success: true });
}

// â”€â”€ DELETE â€” remove a photo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const photoId = url.searchParams.get('id');
  if (!photoId) return NextResponse.json({ error: 'Missing photo ID' }, { status: 400 });

  // Verify ownership before touching storage
  const { data: photo } = await admin
    .from('profile_photos')
    .select('id, user_id, storage_path, is_primary')
    .eq('id', photoId)
    .eq('user_id', user.id)
    .single();

  if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404 });

  // Remove from storage, then remove DB row
  await admin.storage.from('profile-photos').remove([photo.storage_path]);
  await admin.from('profile_photos').delete().eq('id', photoId);

  // Promote next approved photo to primary if needed
  if (photo.is_primary) {
    const { data: nextPhoto } = await admin
      .from('profile_photos')
      .select('id')
      .eq('user_id', user.id)
      .eq('moderation_status', 'approved')
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextPhoto) {
      await admin.from('profile_photos').update({ is_primary: true }).eq('id', nextPhoto.id);
    }
  }


  return NextResponse.json({ success: true });}
