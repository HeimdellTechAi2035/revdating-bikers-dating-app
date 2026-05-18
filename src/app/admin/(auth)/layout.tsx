import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import AdminNav from '@/components/admin/AdminNav';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/admin/login');

  // Use admin client to bypass RLS on admin_users table
  const adminDb = createAdminClient();
  const { data: adminUser } = await adminDb
    .from('admin_users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!adminUser) redirect('/admin/login');

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <AdminNav role={adminUser.role ?? 'admin'} />
      <main className="pt-14 p-4 max-w-7xl mx-auto">{children}</main>
    </div>
  );
}
