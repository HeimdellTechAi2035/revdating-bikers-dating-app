export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin';
import { z } from 'zod';
import type { Database } from '@/types/database.types';

type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

const banSchema = z.object({
  user_id: z.string().uuid(),
  action: z.enum(['ban', 'unban', 'verify', 'unverify', 'warn', 'profile_note']),
  reason: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const admin = createAdminClient();

  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = banSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
  }

  const { user_id, action, reason } = parsed.data;

  // Prevent admins from actioning other admins (unless super_admin)
  if (auth.role !== 'super_admin') {
    const { data: targetProfile } = await admin
      .from('profiles')
      .select('is_admin')
      .eq('id', user_id)
      .single();

    if (targetProfile?.is_admin) {
      return NextResponse.json({ error: 'Cannot action another admin user' }, { status: 403 });
    }
  }

  let profileUpdate: ProfileUpdate = {};
  let adminActionType: string = action;

  switch (action) {
    case 'ban':
      profileUpdate = { is_banned: true, ban_reason: reason ?? null };
      break;
    case 'unban':
      profileUpdate = { is_banned: false, ban_reason: null };
      break;
    case 'verify':
      profileUpdate = { is_verified: true };
      adminActionType = 'verification_approved';
      break;
    case 'unverify':
      profileUpdate = { is_verified: false };
      adminActionType = 'verification_rejected';
      break;
    case 'warn':
      // Warn doesn't change profile — just logs the action
      break;
    case 'profile_note':
      // Note-only — just logs the action, no profile change
      adminActionType = 'profile_note';
      break;
  }

  if (Object.keys(profileUpdate).length) {
    const { error } = await admin.from('profiles').update(profileUpdate).eq('id', user_id);
    if (error) {
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
  }

  // Log admin action
  await admin.from('admin_actions').insert({
    admin_id: auth.userId,
    target_user_id: user_id,
    action: adminActionType as any,
    reason: reason ?? null,
    metadata: { action, performed_by_role: auth.role },
  });

  // If banning, deactivate all their matches
  if (action === 'ban') {
    await admin
      .from('matches')
      .update({ is_active: false })
      .or(`user1_id.eq.${user_id},user2_id.eq.${user_id}`);
  }

  return NextResponse.json({ success: true });
}
