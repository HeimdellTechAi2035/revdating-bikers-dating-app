import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkSelfie } from '@/lib/image-moderation';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Parse multipart form
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const selfie = formData.get('selfie');
  if (!(selfie instanceof File)) {
    return NextResponse.json({ error: 'No selfie file provided' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(selfie.type)) {
    return NextResponse.json({ error: 'Invalid file type. Use JPG, PNG or WebP.' }, { status: 400 });
  }

  if (selfie.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File must be under 10 MB' }, { status: 400 });
  }

  // Prevent duplicate pending submission
  const { data: existing } = await supabase
    .from('verifications')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('verification_type', 'face_selfie')
    .in('status', ['pending', 'approved'])
    .maybeSingle();

  if (existing?.status === 'approved') {
    return NextResponse.json({ error: 'Already verified' }, { status: 409 });
  }
  if (existing?.status === 'pending') {
    return NextResponse.json({ error: 'Verification already under review' }, { status: 409 });
  }

  // Upload to private storage bucket
  const ext = selfie.type === 'image/png' ? 'png' : selfie.type === 'image/webp' ? 'webp' : 'jpg';
  const storagePath = `selfies/${user.id}/${Date.now()}.${ext}`;
  const bytes = await selfie.arrayBuffer();

  const { error: uploadError } = await admin.storage
    .from('verifications')
    .upload(storagePath, bytes, {
      contentType: selfie.type,
      upsert: true,
    });

  if (uploadError) {
    console.error('Selfie upload error:', uploadError);
    return NextResponse.json({ error: 'Failed to upload selfie' }, { status: 500 });
  }

  // ── Face detection check (advisory only — never blocks submission) ──────────
  let autoCheckNote: string | null = null;
  const { data: signedData } = await admin.storage
    .from('verifications')
    .createSignedUrl(storagePath, 90);

  if (signedData?.signedUrl) {
    const faceCheck = await checkSelfie(signedData.signedUrl);
    if (!faceCheck.hasFace) {
      // Flag for manual review instead of hard-rejecting
      autoCheckNote = `Automated check flagged: ${faceCheck.reason ?? 'No face detected'} — manual review required`;
    }
  }

  // Create verification record (replaces any previous rejected one)
  const { error: upsertError } = await admin
    .from('verifications')
    .upsert(
      {
        user_id:           user.id,
        verification_type: 'face_selfie',
        status:            'pending',
        selfie_path:       storagePath,
        admin_notes:       autoCheckNote,
        updated_at:        new Date().toISOString(),
      },
      { onConflict: 'user_id,verification_type' }
    );

  if (upsertError) {
    console.error('Verification upsert error:', upsertError);
    return NextResponse.json({ error: 'Failed to submit verification' }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
