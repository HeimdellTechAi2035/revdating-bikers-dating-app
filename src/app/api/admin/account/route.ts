export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin';
import { z } from 'zod';

const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('reset_password'),
    user_id: z.string().uuid(),
  }),
  z.object({
    action: z.literal('change_email'),
    user_id: z.string().uuid(),
    new_email: z.string().email(),
  }),
  z.object({
    action: z.literal('change_password'),
    user_id: z.string().uuid(),
    new_password: z.string().min(8),
  }),
]);

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { action, user_id } = parsed.data;

  if (action === 'reset_password') {
    // Fetch the user's email then send a reset link
    const { data: authUser, error: fetchErr } = await admin.auth.admin.getUserById(user_id);
    if (fetchErr || !authUser?.user?.email) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const { error } = await admin.auth.resetPasswordForEmail(authUser.user.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, message: `Password reset email sent to ${authUser.user.email}` });
  }

  if (action === 'change_email') {
    const { new_email } = parsed.data as { action: 'change_email'; user_id: string; new_email: string };
    const { error } = await admin.auth.admin.updateUserById(user_id, { email: new_email });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, message: `Email updated to ${new_email}` });
  }

  if (action === 'change_password') {
    const { new_password } = parsed.data as { action: 'change_password'; user_id: string; new_password: string };
    const { error } = await admin.auth.admin.updateUserById(user_id, { password: new_password });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, message: 'Password updated successfully' });
  }
}
