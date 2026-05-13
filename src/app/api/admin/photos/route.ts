export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { adminApprovePhoto, adminRejectPhoto } from '@/lib/photos';
import { signPhotoUrls } from '@/lib/photos/sign';
import { requireAdmin } from '@/lib/admin';
import { z } from 'zod';
import type { Database } from '@/types/database.types';

// ── GET — list photos by moderation status ─────────────────────
export async function GET(request: NextRequest) {
  const admin = createAdminClient();

  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? 'pending';
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const perPage = 20;

  const { data: rawPhotos, count } = await admin
    .from('profile_photos')
    .select(
      `id, user_id, storage_path, public_url, moderation_status,
       moderation_provider, moderation_response, rejected_reason,
       is_primary, sort_order, created_at,
       profiles:user_id (display_name, is_banned)`,
      { count: 'exact' },
    )
    .eq('moderation_status', status as Database['public']['Enums']['moderation_status_type'])
    .order('created_at', { ascending: true })
    .range((page - 1) * perPage, page * perPage - 1);

  const photos = await signPhotoUrls(
    (rawPhotos ?? []) as { id: string; storage_path: string; public_url?: string | null }[],
    'profile-photos',
  );

  return NextResponse.json({ photos, count, page, per_page: perPage });
}

const actionSchema = z.object({
  photo_id: z.string().uuid(),
  action: z.enum(['approved', 'rejected']),
  reason: z.string().max(200).optional(),
});

// ── PATCH — approve or reject a photo ─────────────────────────
export async function PATCH(request: NextRequest) {
  const admin = createAdminClient();

  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { photo_id, action, reason } = parsed.data;

  try {
    if (action === 'approved') {
      await adminApprovePhoto(photo_id, auth.userId);
    } else {
      await adminRejectPhoto(photo_id, auth.userId, reason);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('not found')) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }
    console.error('[PATCH /api/admin/photos]', message);
    return NextResponse.json({ error: 'Failed to update photo' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// ── DELETE — hard delete a photo (admin only) ─────────────────
export async function DELETE(request: NextRequest) {
  const admin = createAdminClient();

  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(request.url);
  const photoId = url.searchParams.get('id');
  if (!photoId) return NextResponse.json({ error: 'Missing photo ID' }, { status: 400 });

  const { data: photo } = await admin
    .from('profile_photos')
    .select('id, user_id, storage_path')
    .eq('id', photoId)
    .single();

  if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404 });

  await admin.storage.from('profile-photos').remove([photo.storage_path]);
  await admin.from('profile_photos').delete().eq('id', photoId);

  await admin.from('admin_actions').insert({
    admin_id: auth.userId,
    target_user_id: photo.user_id,
    action: 'photo_rejected',
    reason: null,
    metadata: { photo_id: photoId },
  });

  return NextResponse.json({ success: true });
}
