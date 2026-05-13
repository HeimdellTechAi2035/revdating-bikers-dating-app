/**
 * lib/auth/index.ts
 *
 * Server-side auth helpers for REVdating.
 *
 * All functions read from the cookie-based SSR session.
 * For operations that bypass RLS (admin tasks), use lib/supabase/admin.ts directly.
 *
 * NEVER import from client components — this file is server-only.
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { User } from '@supabase/supabase-js';
import type { ProfileRow } from '@/types/database.types';

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export interface AuthUser {
  user: User;
}

export interface AuthUserWithProfile {
  user: User;
  profile: ProfileRow;
}

// ---------------------------------------------------------------------------
// Soft read helpers — return null on failure (safe for public/optional pages)
// ---------------------------------------------------------------------------

/**
 * Returns the current authenticated user from the session cookie, or null.
 * Does NOT redirect. Use on pages that work for both authed and anonymous visitors.
 */
export async function getUser(): Promise<User | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

/**
 * Returns the authenticated user AND their profile row in a single round-trip,
 * or null if either is missing.
 * Does NOT redirect.
 */
export async function getUserWithProfile(): Promise<AuthUserWithProfile | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) return null;
  return { user, profile };
}

// ---------------------------------------------------------------------------
// Guard helpers — redirect on failure (use in protected pages and layouts)
// ---------------------------------------------------------------------------

/**
 * Returns the current user. Redirects to /login if not authenticated.
 * Use in layouts and server pages that always require auth.
 */
export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect('/login');
  return user;
}

/**
 * Returns the user + their profile row.
 *
 * Redirect behaviour:
 *   - /login           if not authenticated
 *   - /onboarding      if profile doesn't exist or onboarding_complete is false
 *                      (skipped when enforceOnboarding = false — use on onboarding pages)
 *   - /banned          if the account has been banned
 *
 * @param enforceOnboarding - pass false on the onboarding page itself so it
 *   doesn't create an infinite redirect loop (default: true)
 */
export async function requireUserWithProfile(
  enforceOnboarding = true,
): Promise<AuthUserWithProfile> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/onboarding');

  if (profile.is_banned) redirect('/banned');

  if (enforceOnboarding && !profile.onboarding_complete) {
    redirect('/onboarding');
  }

  return { user, profile };
}

// ---------------------------------------------------------------------------
// Session actions (call from Server Actions or Route Handlers)
// ---------------------------------------------------------------------------

/**
 * Signs the user out and redirects to /login.
 * Designed for use inside a Server Action.
 */
export async function signOutAndRedirect(): Promise<never> {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

/**
 * Signs the user out without redirecting.
 * Returns true on success, false on error.
 * Useful when the caller controls navigation (e.g. API routes).
 */
export async function signOut(): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  return !error;
}

// ---------------------------------------------------------------------------
// Admin account management (service-role, bypasses RLS)
// ---------------------------------------------------------------------------

/**
 * Checks whether an email address is already registered.
 * Uses the admin client so RLS does not block the lookup.
 *
 * @returns true if the email is available (no account found)
 */
export async function isEmailAvailable(email: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const taken = data?.users?.some(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  return !taken;
}

/**
 * Hard-deletes the auth.users row for the given userId.
 * All profile data is removed via ON DELETE CASCADE foreign keys.
 *
 * Only call after confirming the user's identity (GDPR deletion flow).
 * @throws if Supabase returns an error
 */
export async function deleteAuthUser(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    throw new Error(`Failed to delete auth user ${userId}: ${error.message}`);
  }
}

/**
 * Soft-bans a user: sets profiles.is_banned = true and records a reason.
 * The account is NOT deleted — the user is blocked from accessing the app.
 * Admin use only.
 */
export async function banUser(userId: string, reason: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('profiles')
    .update({ is_banned: true, ban_reason: reason })
    .eq('id', userId);
  if (error) {
    throw new Error(`Failed to ban user ${userId}: ${error.message}`);
  }
}

/**
 * Lifts an existing ban: clears profiles.is_banned and profiles.ban_reason.
 * Admin use only.
 */
export async function unbanUser(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('profiles')
    .update({ is_banned: false, ban_reason: null })
    .eq('id', userId);
  if (error) {
    throw new Error(`Failed to unban user ${userId}: ${error.message}`);
  }
}
