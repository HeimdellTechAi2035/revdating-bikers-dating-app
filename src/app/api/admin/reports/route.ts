export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { reviewReport } from '@/lib/moderation/index';
import { signPhotoUrls } from '@/lib/photos/sign';
import { requireAdmin } from '@/lib/admin';
import { z } from 'zod';
import type { Database } from '@/types/database.types';

export async function GET(request: NextRequest) {
  const admin = createAdminClient();

  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? 'pending';
  const reportType = url.searchParams.get('type') ?? 'all'; // all | photo | profile
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const perPage = 20;

  let query = admin
    .from('reports')
    .select(`
      id, reason, description, status, created_at, reviewed_at, admin_notes,
      reporter:reporter_id (id, display_name),
      reported:reported_id (id, display_name, is_banned),
      photo:photo_id (storage_path)
    `, { count: 'exact' })
    .eq('status', status as Database['public']['Enums']['report_status_type']);

  if (reportType === 'photo') {
    query = query.not('photo_id', 'is', null);
  } else if (reportType === 'profile') {
    query = query.is('photo_id', null);
  }

  const { data: rawReports, count } = await query
    .order('created_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  // Sign any attached photo storage paths
  const photoPaths = (rawReports ?? [])
    .map((r) => (r.photo as any)?.storage_path as string | undefined)
    .filter((p): p is string => Boolean(p));

  const signedPhotoMap = new Map<string, string>();
  if (photoPaths.length) {
    const signed = await signPhotoUrls(
      photoPaths.map((p) => ({ storage_path: p })),
      'profile-photos',
    );
    signed.forEach((s, i) => signedPhotoMap.set(photoPaths[i], s.public_url));
  }

  const reports = (rawReports ?? []).map((r) => {
    const path = (r.photo as any)?.storage_path as string | undefined;
    return {
      ...r,
      photo: path ? { public_url: signedPhotoMap.get(path) ?? '' } : r.photo,
    };
  });

  return NextResponse.json({
    reports,
    count,
    page,
    per_page: perPage,
    has_more: (count ?? 0) > page * perPage,
  });
}

const actionSchema = z.object({
  report_id: z.string().uuid(),
  action: z.enum(['reviewed', 'actioned', 'dismissed']),
  admin_notes: z.string().max(500).optional(),
  ban_user: z.boolean().optional().default(false),
});

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

  const { report_id, action, admin_notes, ban_user } = parsed.data;

  try {
    await reviewReport(report_id, auth.userId, action, admin_notes, ban_user);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('not found')) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }
    console.error('[PATCH /api/admin/reports]', message);
    return NextResponse.json({ error: 'Failed to update report' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
