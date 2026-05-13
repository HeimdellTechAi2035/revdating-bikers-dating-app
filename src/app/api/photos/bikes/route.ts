import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { signPhotoUrl } from '@/lib/photos/sign';
import { z } from 'zod';

const postSchema = z.object({
  bike_id: z.string().uuid(),
  // Path inside the 'bike-photos' bucket: {userId}/{bikeId}/{filename}
  storage_path: z.string().min(1).max(500),
});

// ── POST — attach a photo to a bike ───────────────────────────
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const { bike_id, storage_path } = parsed.data;

  // Path must be scoped to this user to prevent cross-user writes
  if (!storage_path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: 'Invalid storage path' }, { status: 403 });
  }

  // Verify the bike belongs to this user
  const { data: bike } = await admin
    .from('bikes')
    .select('id, user_id, photo_url')
    .eq('id', bike_id)
    .eq('user_id', user.id)
    .single();

  if (!bike) return NextResponse.json({ error: 'Bike not found' }, { status: 404 });

  // Verify the file exists in the bike-photos bucket
  const folder = storage_path.substring(0, storage_path.lastIndexOf('/'));
  const fileName = storage_path.split('/').pop() ?? '';
  const { data: storageFiles, error: storageError } = await admin.storage
    .from('bike-photos')
    .list(folder, { search: fileName });

  if (storageError || !storageFiles?.length) {
    return NextResponse.json({ error: 'File not found in storage' }, { status: 404 });
  }

  // Delete the old bike photo from storage if it exists
  if (bike.photo_url) {
    const oldPath = extractStoragePath(bike.photo_url);
    if (oldPath) {
      await admin.storage.from('bike-photos').remove([oldPath]);
    }
  }

  // Store the raw storage path — signed URLs are generated at serve-time
  const { error: updateError } = await admin
    .from('bikes')
    .update({ photo_url: storage_path })
    .eq('id', bike_id);

  if (updateError) {
    console.error('Bike photo update error:', updateError);
    return NextResponse.json({ error: 'Failed to update bike photo' }, { status: 500 });
  }

  // Return a fresh signed URL for immediate display in the client
  const signed_url = await signPhotoUrl(storage_path, 'bike-photos');
  return NextResponse.json({ success: true, signed_url });
}

// ── DELETE — remove a bike photo ──────────────────────────────
export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const bikeId = url.searchParams.get('bike_id');
  if (!bikeId) return NextResponse.json({ error: 'Missing bike_id' }, { status: 400 });

  // Verify ownership
  const { data: bike } = await admin
    .from('bikes')
    .select('id, user_id, photo_url')
    .eq('id', bikeId)
    .eq('user_id', user.id)
    .single();

  if (!bike) return NextResponse.json({ error: 'Bike not found' }, { status: 404 });

  if (bike.photo_url) {
    const oldPath = extractStoragePath(bike.photo_url);
    if (oldPath) {
      await admin.storage.from('bike-photos').remove([oldPath]);
    }
  }

  await admin.from('bikes').update({ photo_url: null }).eq('id', bikeId);

  return NextResponse.json({ success: true });
}

/**
 * Extract the storage path from a stored value.
 * Handles three formats:
 *   1. Plain path (new format): "userId/bikeId/filename.jpg"
 *   2. Old public URL: "https://.../object/public/bike-photos/<path>"
 *   3. Old signed URL: "https://.../object/sign/bike-photos/<path>?token=..."
 */
function extractStoragePath(value: string): string | null {
  if (!value.startsWith('http')) return value; // already a path
  try {
    for (const marker of ['/object/public/bike-photos/', '/object/sign/bike-photos/']) {
      const idx = value.indexOf(marker);
      if (idx !== -1) {
        const path = value.substring(idx + marker.length);
        return path.split('?')[0]; // strip query string from signed URLs
      }
    }
    return null;
  } catch {
    return null;
  }
}
