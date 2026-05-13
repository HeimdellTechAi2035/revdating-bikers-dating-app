export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getPendingReportStats } from '@/lib/moderation/index';

/**
 * GET /api/admin/reports/stats
 * Returns pending report counts for the admin dashboard notification badge.
 *
 * Response: { total, profile, photo }
 * - total:   all pending reports
 * - profile: pending reports with no photo attached (user/message reports)
 * - photo:   pending reports with a photo_id (photo-specific reports)
 */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const stats = await getPendingReportStats();
  return NextResponse.json(stats);
}
