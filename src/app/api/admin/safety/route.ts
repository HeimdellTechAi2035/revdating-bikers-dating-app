export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getSafetyIncidents } from '@/lib/admin';
import { z } from 'zod';

const querySchema = z.object({
  status:  z.enum(['active', 'overdue', 'alert_sent', 'resolved', 'all']).default('all'),
  userId:  z.string().uuid().optional(),
  page:    z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

/**
 * GET /api/admin/safety
 * Lists safety_checkins for admin review.
 *
 * Query params:
 *   status   — active | overdue | alert_sent | resolved | all (default: all unresolved)
 *   userId   — scope to a specific user (UUID)
 *   page     — page number (default: 1)
 *   perPage  — results per page (default: 25, max: 100)
 *
 * Response:
 *   { incidents, count, page, per_page, has_more }
 *
 * Each incident includes the associated user profile (id, display_name, city, country, is_banned)
 * so the admin can immediately identify high-risk or repeat offenders.
 *
 * Sorted by expected_return_at ascending so the most overdue check-ins appear first.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const raw = {
    status:  url.searchParams.get('status')  ?? undefined,
    userId:  url.searchParams.get('userId')  ?? undefined,
    page:    url.searchParams.get('page')    ?? undefined,
    perPage: url.searchParams.get('perPage') ?? undefined,
  };

  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', details: parsed.error.format() }, { status: 400 });
  }

  try {
    const result = await getSafetyIncidents(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch safety incidents';
    console.error('[GET /api/admin/safety]', msg);
    return NextResponse.json({ error: 'Failed to fetch safety incidents' }, { status: 500 });
  }
}
