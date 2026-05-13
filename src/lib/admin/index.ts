/**
 * lib/admin/index.ts
 *
 * Shared server-side helpers for admin moderation.
 *
 * Access control rule:
 *   profiles.is_admin = true  ← sole source of truth.
 *   The admin_users table stores optional role (moderator / admin / super_admin)
 *   for UI display and super-admin guards, but the gate itself is is_admin.
 *
 * NEVER import from client components — all helpers use the admin client.
 *
 * Public surface:
 *   requireAdmin(supabase)                       → AdminContext | null
 *   logAdminAction(ctx, action, target?, ...)    → void
 *   getUserDetail(userId)                        → AdminUserDetail
 *   getSafetyIncidents(options)                  → SafetyIncidentPage
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { signPhotoUrls } from '@/lib/photos/sign';
import type { AdminActionType, AdminRoleType, Json } from '@/types/database.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdminContext {
  userId: string;
  role:   AdminRoleType | null;  // null when entry exists only in profiles
}

export interface LogAdminActionOptions {
  targetUserId?: string;
  reason?:       string;
  metadata?:     Record<string, unknown>;
}

export interface AdminUserDetail {
  profile:       Record<string, unknown>;
  photos:        unknown[];
  reports: {
    filed_against: unknown[];  // reports where this user is the reported party
    filed_by:      unknown[];  // reports this user has filed
  };
  match_count:   number;
  message_count: number;
  admin_actions: unknown[];   // audit log entries targeting this user
  badges:        unknown[];
}

export interface SafetyIncidentPage {
  incidents: unknown[];
  count:     number;
  page:      number;
  per_page:  number;
  has_more:  boolean;
}

// ---------------------------------------------------------------------------
// requireAdmin
// ---------------------------------------------------------------------------

/**
 * Verifies the authenticated session belongs to a user whose profile has
 * `is_admin = true`. Returns an AdminContext on success, or null.
 *
 * Usage in route handlers:
 *   const auth = await requireAdmin();
 *   if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
 */
export async function requireAdmin(): Promise<AdminContext | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const adminClient = createAdminClient();

  // Primary gate: profiles.is_admin
  const { data: profile } = await adminClient
    .from('profiles')
    .select('id, is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) return null;

  // Fetch optional role from admin_users (for super_admin checks)
  const { data: adminRow } = await adminClient
    .from('admin_users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  return { userId: user.id, role: adminRow?.role ?? null };
}

// ---------------------------------------------------------------------------
// logAdminAction
// ---------------------------------------------------------------------------

/**
 * Writes a row to admin_actions for audit trail purposes.
 * Fire-and-forget safe (does not throw on DB error — logs to console instead).
 */
export async function logAdminAction(
  ctx:     AdminContext,
  action:  AdminActionType,
  options: LogAdminActionOptions = {},
): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin.from('admin_actions').insert({
    admin_id:       ctx.userId,
    target_user_id: options.targetUserId ?? null,
    action,
    reason:         options.reason  ?? null,
    metadata:       (options.metadata ?? null) as Json | null,
  });

  if (error) {
    console.error('[logAdminAction] failed to write audit log:', error.message, { action, ...options });
  }
}

// ---------------------------------------------------------------------------
// getUserDetail
// ---------------------------------------------------------------------------

/**
 * Returns a comprehensive view of a single user for the admin detail panel.
 *
 * Includes:
 *   • Full profile row
 *   • All photos (any moderation status)
 *   • Reports filed against this user (paginated to last 50)
 *   • Reports this user has filed (paginated to last 20)
 *   • Active + total match count
 *   • Total message count (sent)
 *   • Recent admin_actions targeting this user
 *   • Badges earned
 *
 * Coordinates are included for admin — the hide_exact_location flag is
 * intentionally bypassed here (admins need accurate safety data).
 */
export async function getUserDetail(userId: string): Promise<AdminUserDetail> {
  const admin = createAdminClient();

  const [
    { data: profile },
    { data: photos },
    { data: reportsAgainst },
    { data: reportsFiled },
    { count: totalMatches },
    { count: activeMatches },
    { count: messageCount },
    { data: auditLog },
    { data: badges },
  ] = await Promise.all([
    // Full profile
    admin.from('profiles').select('*').eq('id', userId).single(),

    // All photos
    admin
      .from('profile_photos')
      .select('id, storage_path, public_url, is_primary, moderation_status, rejected_reason, sort_order, created_at')
      .eq('user_id', userId)
      .order('sort_order'),

    // Reports filed against this user (last 50)
    admin
      .from('reports')
      .select('id, reason, description, status, created_at, reviewed_at, admin_notes, reporter:reporter_id(id, display_name)')
      .eq('reported_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),

    // Reports this user has filed (last 20)
    admin
      .from('reports')
      .select('id, reason, description, status, created_at, reported:reported_id(id, display_name)')
      .eq('reporter_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),

    // Total matches
    admin
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`),

    // Active matches only
    admin
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .eq('is_active', true),

    // Messages sent by this user
    admin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('sender_id', userId)
      .is('deleted_at', null),

    // Admin actions log for this user (last 30)
    admin
      .from('admin_actions')
      .select('id, action, reason, metadata, created_at, admin:admin_id(id, display_name)')
      .eq('target_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30),

    // Badges
    admin
      .from('user_badges')
      .select('badge_name, badge_type, earned_at')
      .eq('user_id', userId)
      .order('earned_at'),
  ]);

  const signedPhotos = await signPhotoUrls(
    (photos ?? []) as { id: string; storage_path: string; public_url?: string | null }[],
    'profile-photos',
  );

  return {
    profile:       (profile ?? {}) as Record<string, unknown>,
    photos:        signedPhotos,
    reports: {
      filed_against: reportsAgainst ?? [],
      filed_by:      reportsFiled   ?? [],
    },
    match_count:   totalMatches   ?? 0,
    message_count: messageCount   ?? 0,
    admin_actions: auditLog       ?? [],
    badges:        badges         ?? [],
  };
}

// ---------------------------------------------------------------------------
// getSafetyIncidents
// ---------------------------------------------------------------------------

/**
 * Returns paginated safety_checkins for admin review.
 *
 * Filters:
 *   status  — 'active' | 'overdue' | 'alert_sent' | 'resolved' | 'all' (default: all unresolved)
 *   userId  — scope to a specific user
 */
export async function getSafetyIncidents(options: {
  status?:  'active' | 'overdue' | 'alert_sent' | 'resolved' | 'all';
  userId?:  string;
  page?:    number;
  perPage?: number;
}): Promise<SafetyIncidentPage> {
  const admin = createAdminClient();
  const { status = 'all', userId, page = 1, perPage = 25 } = options;

  let query = admin
    .from('safety_checkins')
    .select(
      `id, ride_description, destination_name, destination_lat, destination_lng,
       expected_return_at, emergency_contact_name, emergency_contact_phone,
       status, resolved_at, alert_sent_at, created_at, match_id,
       user:user_id (id, display_name, city, country, is_banned)`,
      { count: 'exact' },
    );

  if (status === 'all') {
    // Default: all except resolved (admins usually want to see active issues)
    query = query.neq('status', 'resolved');
  } else {
    query = query.eq('status', status);
  }

  if (userId) query = query.eq('user_id', userId);

  const { data: incidents, count, error } = await query
    .order('expected_return_at', { ascending: true }) // most urgent first
    .range((page - 1) * perPage, page * perPage - 1);

  if (error) throw new Error(`getSafetyIncidents: ${error.message}`);

  return {
    incidents: incidents ?? [],
    count:     count ?? 0,
    page,
    per_page:  perPage,
    has_more:  (count ?? 0) > page * perPage,
  };
}
