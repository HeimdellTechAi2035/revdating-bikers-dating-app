export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin';
import { emailVerificationResult } from '@/lib/email';
import { z } from 'zod';
import type { Database } from '@/types/database.types';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const admin = createAdminClient();
  const url   = new URL(request.url);
  const status = url.searchParams.get('status') ?? 'pending';
  const type   = url.searchParams.get('type')   ?? 'all';
  const page   = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const perPage = 20;

  let query = admin
    .from('verifications')
    .select(
      `id, verification_type, status, selfie_path, document_path,
       admin_notes, reviewed_at, created_at,
       user:user_id (id, display_name, is_verified)`,
      { count: 'exact' },
    )
    .eq('status', status as Database['public']['Enums']['verification_status_type']);

  if (type !== 'all') {
    query = (query as any).eq('verification_type', type);
  }

  const { data: rows, count } = await query
    .order('created_at', { ascending: true })
    .range((page - 1) * perPage, page * perPage - 1);

  // Generate signed URLs for stored images (private bucket, 1-hour expiry)
  const verifications = await Promise.all(
    ((rows ?? []) as any[]).map(async (v) => {
      let selfie_url:   string | null = null;
      let document_url: string | null = null;

      if (v.selfie_path) {
        const { data } = await admin.storage
          .from('verifications')
          .createSignedUrl(v.selfie_path, 3600);
        selfie_url = data?.signedUrl ?? null;
      }

      if (v.document_path) {
        const { data } = await admin.storage
          .from('verifications')
          .createSignedUrl(v.document_path, 3600);
        document_url = data?.signedUrl ?? null;
      }

      return { ...v, selfie_url, document_url };
    }),
  );

  return NextResponse.json({ verifications, count, page, per_page: perPage });
}

const actionSchema = z.object({
  verification_id: z.string().uuid(),
  action:          z.enum(['approved', 'rejected']),
  admin_notes:     z.string().max(500).optional(),
});

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const admin = createAdminClient();

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { verification_id, action, admin_notes } = parsed.data;

  // Fetch the verification to get user_id
  const { data: verification } = await admin
    .from('verifications')
    .select('id, user_id, verification_type')
    .eq('id', verification_id)
    .single();

  if (!verification) {
    return NextResponse.json({ error: 'Verification not found' }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (admin.from('verifications') as any)
    .update({
      status:      action,
      admin_notes: admin_notes ?? null,
      reviewed_by: auth.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', verification_id) as { error: { message: string } | null };

  if (updateError) {
    console.error('[PATCH /api/admin/verifications]', updateError.message);
    return NextResponse.json({ error: 'Failed to update verification' }, { status: 500 });
  }

  // Approve: mark user as verified on their profile
  if (action === 'approved') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.from('profiles') as any)
      .update({ is_verified: true })
      .eq('id', (verification as any).user_id);
  }

  // Email the user the result (fire-and-forget, respects opt-out)
  void emailVerificationResult(
    (verification as any).user_id,
    action,
    admin_notes ?? null,
  ).catch((err) => console.warn('[admin/verifications] result email failed:', err));

  return NextResponse.json({ success: true });
}
