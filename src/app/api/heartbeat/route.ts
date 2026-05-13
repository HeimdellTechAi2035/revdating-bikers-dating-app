import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const admin = createAdminClient();
  await admin
    .from('profiles')
    .update({ last_active: new Date().toISOString() })
    .eq('id', user.id);

  return NextResponse.json({ ok: true });
}
