export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin';
import { z } from 'zod';

export async function GET(request: NextRequest) {
  const admin = createAdminClient();

  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(request.url);
  const search = url.searchParams.get('search') ?? '';
  const filter = url.searchParams.get('filter') ?? 'all'; // all | banned | active | premium | unverified
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const perPage = 20;

  let query = admin
    .from('profiles')
    .select('id, display_name, date_of_birth, gender, city, country, is_verified, is_premium, is_banned, ban_reason, is_active, onboarding_complete, created_at, last_active', { count: 'exact' });

  if (search) {
    query = query.ilike('display_name', `%${search}%`);
  }

  if (filter === 'banned') query = query.eq('is_banned', true);
  else if (filter === 'active') query = query.eq('is_active', true).eq('is_banned', false);
  else if (filter === 'premium') query = query.eq('is_premium', true);
  else if (filter === 'unverified') query = query.eq('is_verified', false);

  const { data: users, count, error } = await query
    .order('created_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch emails from auth.users for each profile
  const ids = (users ?? []).map((u) => u.id);
  const emailMap: Record<string, string> = {};
  if (ids.length > 0) {
    const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 });
    (authList?.users ?? []).forEach((u) => { emailMap[u.id] = u.email ?? ''; });
  }

  const usersWithEmail = (users ?? []).map((u) => ({
    ...u,
    email: emailMap[u.id] ?? '',
  }));

  return NextResponse.json({
    users: usersWithEmail,
    count,
    page,
    per_page: perPage,
    has_more: (count ?? 0) > page * perPage,
  });
}
