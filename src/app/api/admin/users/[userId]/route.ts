export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, logAdminAction, getUserDetail } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';
import type { Database } from '@/types/database.types';

type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

interface RouteParams { params: { userId: string } }

/**
 * GET /api/admin/users/[userId]
 * Returns a comprehensive profile view for the admin detail panel:
 *   profile, photos, reports (against + filed), match count,
 *   message count, admin action log, badges.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { userId } = params;

  try {
    const detail = await getUserDetail(userId);

    if (!detail.profile || Object.keys(detail.profile).length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Log the view (non-critical — fire-and-forget)
    void logAdminAction(auth, 'profile_note', {
      targetUserId: userId,
      metadata: { action_detail: 'admin_viewed_user_detail' },
    });

    return NextResponse.json(detail);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch user detail';
    console.error('[GET /api/admin/users/[userId]]', msg);
    return NextResponse.json({ error: 'Failed to fetch user detail' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/[userId]
// Actions: ban | unban | verify | unverify | warn | add_note
// ---------------------------------------------------------------------------

const actionSchema = z.object({
  action: z.enum(['ban', 'unban', 'verify', 'unverify', 'warn', 'add_note']),
  reason: z.string().max(500).optional(),
  note:   z.string().max(1000).optional(),
});

/**
 * PATCH /api/admin/users/[userId]
 * Applies a moderation action to a user.
 *
 * action       profileUpdate               auditAction
 * ──────────── ─────────────────────────── ─────────────────────
 * ban          is_banned=true, ban_reason  ban
 * unban        is_banned=false, ban_reason unban
 * verify       is_verified=true            verification_approved
 * unverify     is_verified=false           verification_rejected
 * warn         (none)                      warn
 * add_note     (none)                      profile_note
 *
 * Banning also deactivates all the user's active matches.
 * Super-admins can action other admins; moderators/admins cannot.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { userId: targetId } = params;

  // Prevent non-super-admins from actioning other admins
  if (auth.role !== 'super_admin') {
    const adminDb = createAdminClient();
    const { data: targetProfile } = await adminDb
      .from('profiles')
      .select('is_admin')
      .eq('id', targetId)
      .single();

    if (targetProfile?.is_admin) {
      return NextResponse.json({ error: 'Cannot action another admin user' }, { status: 403 });
    }
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
  }

  const { action, reason, note } = parsed.data;
  const adminDb = createAdminClient();

  // Build profile update
  const profileUpdate: ProfileUpdate = {};
  let auditAction: Parameters<typeof logAdminAction>[1];

  switch (action) {
    case 'ban':
      profileUpdate.is_banned  = true;
      profileUpdate.ban_reason = reason ?? 'Banned by moderator';
      auditAction = 'ban';
      break;
    case 'unban':
      profileUpdate.is_banned  = false;
      profileUpdate.ban_reason = null;
      auditAction = 'unban';
      break;
    case 'verify':
      profileUpdate.is_verified = true;
      auditAction = 'verification_approved';
      break;
    case 'unverify':
      profileUpdate.is_verified = false;
      auditAction = 'verification_rejected';
      break;
    case 'warn':
      auditAction = 'warn';
      break;
    case 'add_note':
      auditAction = 'profile_note';
      break;
  }

  // Apply profile update
  if (Object.keys(profileUpdate).length > 0) {
    const { error } = await adminDb
      .from('profiles')
      .update(profileUpdate)
      .eq('id', targetId);

    if (error) {
      console.error(`[PATCH /api/admin/users/${targetId}]`, error.message);
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
  }

  // Deactivate matches on ban
  if (action === 'ban') {
    await adminDb
      .from('matches')
      .update({ is_active: false })
      .or(`user1_id.eq.${targetId},user2_id.eq.${targetId}`)
      .eq('is_active', true);
  }

  // Audit log
  await logAdminAction(auth, auditAction!, {
    targetUserId: targetId,
    reason: reason ?? note,
    metadata: { action, performed_by_role: auth.role ?? 'admin' },
  });

  return NextResponse.json({ success: true });
}
