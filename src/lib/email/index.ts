/**
 * lib/email/index.ts
 *
 * Transactional email sending for REVdating via the Resend API.
 * Server-only — never import in client components.
 *
 * Public surface:
 *   emailNewMatch(userId, matchedName, matchId)
 *   emailNewMessage(recipientId, senderName, matchId, preview)
 *   emailRideDateInvite(recipientId, inviterName, location, scheduledTime, rideDateId)
 *   emailVerificationResult(userId, 'approved'|'rejected', adminNotes?)
 *   verifyUnsubToken(token) → userId | null   (used by the unsubscribe route)
 *
 * Opt-out: every email contains an HMAC-signed unsubscribe link.
 * Clicking it sets profiles.email_notifications = false.
 *
 * Graceful degradation: if RESEND_API_KEY is absent (dev/staging),
 * emails are logged to the console and not sent.
 */

import { createHmac } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

const RESEND_API = 'https://api.resend.com/emails';

// ---------------------------------------------------------------------------
// HTML escaping
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Unsubscribe token helpers
// ---------------------------------------------------------------------------

function makeUnsubToken(userId: string): string {
  const secret = process.env.INTERNAL_WEBHOOK_SECRET ?? '';
  const sig = createHmac('sha256', secret).update(userId).digest('base64url');
  return `${Buffer.from(userId).toString('base64url')}.${sig}`;
}

/** Returns the userId embedded in the token, or null if invalid. */
export function verifyUnsubToken(token: string): string | null {
  const dot = token.indexOf('.');
  if (dot === -1) return null;
  try {
    const encodedId = token.slice(0, dot);
    const sig       = token.slice(dot + 1);
    const userId    = Buffer.from(encodedId, 'base64url').toString('utf-8');
    const expected  = createHmac('sha256', process.env.INTERNAL_WEBHOOK_SECRET ?? '')
      .update(userId)
      .digest('base64url');
    if (sig !== expected) return null;
    return userId;
  } catch {
    return null;
  }
}

function unsubUrl(userId: string): string {
  const token = makeUnsubToken(userId);
  return `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/email/unsubscribe?token=${token}`;
}

// ---------------------------------------------------------------------------
// HTML email template
// ---------------------------------------------------------------------------

interface TemplateParams {
  title: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  unsubscribeUrl: string;
}

function buildHtml(p: TemplateParams): string {
  const cta = p.ctaLabel && p.ctaUrl
    ? `<tr><td style="padding-top:28px;">
         <a href="${p.ctaUrl}" style="display:inline-block;background:#FF6B00;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 28px;border-radius:10px;">${esc(p.ctaLabel)}</a>
       </td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${esc(p.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation"
             style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">

        <!-- Logo header -->
        <tr><td style="background:#18181b;padding:24px 32px;">
          <p style="margin:0;color:#FF6B00;font-size:22px;font-weight:700;letter-spacing:-0.5px;">REVdating</p>
          <p style="margin:4px 0 0;color:#71717a;font-size:12px;">Biker Dating &middot; Ride Together</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:36px 32px;">
          <table cellpadding="0" cellspacing="0" width="100%" role="presentation">
            <tr><td>
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#18181b;line-height:1.3;">${esc(p.title)}</h1>
              <div style="font-size:15px;color:#52525b;line-height:1.65;">${p.bodyHtml}</div>
            </td></tr>
            ${cta}
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 32px;background:#fafafa;border-top:1px solid #e4e4e7;">
          <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;line-height:1.6;">
            You're receiving this because you have an account on REVdating.<br>
            <a href="${p.unsubscribeUrl}" style="color:#a1a1aa;text-decoration:underline;">Unsubscribe from email notifications</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Core send function
// ---------------------------------------------------------------------------

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey   = process.env.RESEND_API_KEY;
  const fromAddr = process.env.RESEND_FROM_EMAIL ?? 'REVdating <noreply@REVdating.app>';

  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY not set — skipping email to ${to} (${subject})`);
    return;
  }

  try {
    const res = await fetch(RESEND_API, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromAddr, to: [to], subject, html }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.error(`[email] Resend API ${res.status}:`, err);
    }
  } catch (err) {
    console.error('[email] Failed to send:', err);
  }
}

// ---------------------------------------------------------------------------
// User lookup
// ---------------------------------------------------------------------------

interface EmailPrefs {
  email: string;
  optedIn: boolean;
}

async function getPrefs(userId: string): Promise<EmailPrefs | null> {
  const admin = createAdminClient();

  const [authRes, profileRes] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from('profiles').select('email_notifications').eq('id', userId).single(),
  ]);

  const email = authRes.data?.user?.email;
  if (!email) return null;

  return {
    email,
    optedIn: (profileRes.data as any)?.email_notifications ?? true,
  };
}

// ---------------------------------------------------------------------------
// Exported notification helpers
// ---------------------------------------------------------------------------

export async function emailNewMatch(
  userId:      string,
  matchedName: string,
  matchId:     string,
): Promise<void> {
  const prefs = await getPrefs(userId);
  if (!prefs?.optedIn) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  await sendEmail(
    prefs.email,
    `It's a match! You and ${matchedName} liked each other 🔥`,
    buildHtml({
      title:    `It's a match! 🔥`,
      bodyHtml: `<p>You and <strong>${esc(matchedName)}</strong> have liked each other on REVdating.</p>
                 <p>Start a conversation and plan your first ride together!</p>`,
      ctaLabel: `Message ${matchedName}`,
      ctaUrl:   `${appUrl}/chat/${matchId}`,
      unsubscribeUrl: unsubUrl(userId),
    }),
  );
}

export async function emailNewMessage(
  recipientId: string,
  senderName:  string,
  matchId:     string,
  preview:     string,
): Promise<void> {
  const prefs = await getPrefs(recipientId);
  if (!prefs?.optedIn) return;

  const appUrl       = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const safePreview  = preview.length > 120 ? `${preview.slice(0, 117)}…` : preview;

  await sendEmail(
    prefs.email,
    `${senderName} sent you a message on REVdating`,
    buildHtml({
      title:    `New message from ${esc(senderName)}`,
      bodyHtml: `<p><strong>${esc(senderName)}</strong> says:</p>
                 <blockquote style="margin:12px 0;padding:12px 16px;background:#f4f4f5;border-left:3px solid #FF6B00;border-radius:4px;font-style:italic;color:#3f3f46;">&ldquo;${esc(safePreview)}&rdquo;</blockquote>`,
      ctaLabel: 'Reply now',
      ctaUrl:   `${appUrl}/chat/${matchId}`,
      unsubscribeUrl: unsubUrl(recipientId),
    }),
  );
}

export async function emailRideDateInvite(
  recipientId:   string,
  inviterName:   string,
  location:      string,
  scheduledTime: string,
  rideDateId:    string,
): Promise<void> {
  const prefs = await getPrefs(recipientId);
  if (!prefs?.optedIn) return;

  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const formatted = new Date(scheduledTime).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  await sendEmail(
    prefs.email,
    `${inviterName} invited you on a ride date 🏍️`,
    buildHtml({
      title:    `You've got a ride date invite!`,
      bodyHtml: `<p><strong>${esc(inviterName)}</strong> wants to meet you for a ride!</p>
                 <table cellpadding="0" cellspacing="0" role="presentation" style="margin:20px 0;width:100%;">
                   <tr><td style="padding:14px 16px;background:#f4f4f5;border-radius:8px;">
                     <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:.5px;">Meeting point</p>
                     <p style="margin:0;font-weight:600;color:#18181b;">${esc(location)}</p>
                   </td></tr>
                   <tr><td style="height:8px;"></td></tr>
                   <tr><td style="padding:14px 16px;background:#f4f4f5;border-radius:8px;">
                     <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:.5px;">Date &amp; time</p>
                     <p style="margin:0;font-weight:600;color:#18181b;">${esc(formatted)}</p>
                   </td></tr>
                 </table>`,
      ctaLabel: 'View invite',
      ctaUrl:   `${appUrl}/ride-dates/${rideDateId}`,
      unsubscribeUrl: unsubUrl(recipientId),
    }),
  );
}

export async function emailVerificationResult(
  userId:     string,
  status:     'approved' | 'rejected',
  adminNotes?: string | null,
): Promise<void> {
  const prefs = await getPrefs(userId);
  if (!prefs?.optedIn) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  if (status === 'approved') {
    await sendEmail(
      prefs.email,
      'Your REVdating profile is now verified ✓',
      buildHtml({
        title:    'Profile verified ✓',
        bodyHtml: `<p>Your selfie verification has been approved — congratulations!</p>
                   <p>A verified badge now appears on your profile, helping other riders know you&apos;re the real deal.</p>`,
        ctaLabel: 'View your profile',
        ctaUrl:   `${appUrl}/profile`,
        unsubscribeUrl: unsubUrl(userId),
      }),
    );
  } else {
    const noteBlock = adminNotes?.trim()
      ? `<p style="margin:12px 0 0;padding:12px 16px;background:#fef2f2;border-radius:8px;color:#dc2626;font-size:14px;">
           <strong>Reason:</strong> ${esc(adminNotes.trim())}
         </p>`
      : `<p style="margin:12px 0 0;">Please ensure your face is clearly visible, well-lit, and unobstructed, then try again.</p>`;

    await sendEmail(
      prefs.email,
      'Update on your REVdating verification',
      buildHtml({
        title:    'Verification not approved',
        bodyHtml: `<p>Unfortunately your selfie verification was not approved this time.</p>${noteBlock}`,
        ctaLabel: 'Try again',
        ctaUrl:   `${appUrl}/safety/verify-selfie`,
        unsubscribeUrl: unsubUrl(userId),
      }),
    );
  }
}
