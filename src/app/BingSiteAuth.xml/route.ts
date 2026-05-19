import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function GET() {
  const verificationCode = escapeXml(process.env.BING_SITE_AUTH_CODE ?? '');
  const body = `<?xml version="1.0"?>\n<users>\n  <user>${verificationCode}</user>\n</users>\n`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
