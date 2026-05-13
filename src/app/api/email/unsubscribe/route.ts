import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyUnsubToken } from '@/lib/email';

export async function GET(request: NextRequest) {
  const token  = request.nextUrl.searchParams.get('token') ?? '';
  const userId = verifyUnsubToken(token);

  if (!userId) {
    return new NextResponse(page('Invalid link', `
      <h1 style="color:#18181b">Invalid unsubscribe link</h1>
      <p style="color:#52525b">This link is not valid or has already been used.</p>
    `), { headers: { 'Content-Type': 'text/html' }, status: 400 });
  }

  const admin = createAdminClient();
  await (admin.from('profiles') as any)
    .update({ email_notifications: false })
    .eq('id', userId);

  return new NextResponse(page('Unsubscribed', `
    <h1 style="color:#18181b">You've been unsubscribed</h1>
    <p style="color:#52525b">You'll no longer receive email notifications from REVdating.</p>
    <p style="margin-top:8px;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/settings"
         style="color:#FF6B00;text-decoration:none;font-weight:600;">
        Manage notification settings ↗
      </a>
    </p>
  `), { headers: { 'Content-Type': 'text/html' } });
}

function page(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${title} · REVdating</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px 16px;">
    <div style="max-width:420px;width:100%;background:#fff;padding:40px;border-radius:16px;border:1px solid #e4e4e7;text-align:center;">
      <p style="margin:0 0 20px;color:#FF6B00;font-size:22px;font-weight:700;">REVdating</p>
      ${content}
    </div>
  </div>
</body>
</html>`;
}
