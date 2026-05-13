import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requestDataExport, hashIp } from '@/lib/gdpr';

/**
 * GET /api/gdpr/export  (also accepts POST for backward compat)
 *
 * Generates a GDPR Art. 20 data portability export for the authenticated user.
 * Returns a JSON file download containing all personal data held by REVdating.
 *
 * Each call is logged to data_export_requests for audit purposes.
 */
export async function GET(request: NextRequest) {
  return handler(request);
}
export async function POST(request: NextRequest) {
  return handler(request);
}

async function handler(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Hash the IP for the audit record (never store raw)
  const forwarded = request.headers.get('x-forwarded-for');
  const rawIp     = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  const ipHash    = await hashIp(rawIp);
  const userAgent = request.headers.get('user-agent') ?? undefined;

  const exportData = await requestDataExport(user.id, user.email!, ipHash, userAgent);

  const filename = `REVdating-data-export-${new Date().toISOString().split('T')[0]}.json`;
  const json     = JSON.stringify(exportData, null, 2);

  return new NextResponse(json, {
    headers: {
      'Content-Type':        'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control':       'no-store',
    },
  });
}
