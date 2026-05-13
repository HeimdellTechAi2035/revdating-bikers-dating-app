import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { isDevBypassEnabled } from '@/lib/dev-bypass';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  // DEV PREVIEW: return zeroed stats so the admin UI is visible without Supabase
  if (isDevBypassEnabled()) {
    const stats = [
      { label: 'Total users',           value: 0, color: 'text-white' },
      { label: 'Active users',          value: 0, color: 'text-green-400' },
      { label: 'Pending reports',       value: 0, color: 'text-white', href: '/admin/reports' },
      { label: 'Photos to review',      value: 0, color: 'text-white', href: '/admin/photos' },
      { label: 'Pending verifications', value: 0, color: 'text-blue-400', href: '/admin/verifications' },
      { label: 'Banned users',          value: 0, color: 'text-red-400' },
      { label: 'Premium users',         value: 0, color: 'text-brand-orange' },
    ];
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-medium">DEV PREVIEW</span>
        </div>
        <p className="text-brand-chrome text-sm">All stats are zero — connect a real Supabase project to see live data.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="p-5 rounded-2xl bg-brand-dark-3 border border-brand-dark-4">
              {stat.href ? (
                <Link href={stat.href} className="block group">
                  <p className={`text-3xl font-bold ${stat.color} group-hover:opacity-80`}>{stat.value}</p>
                  <p className="text-brand-chrome text-sm mt-1">{stat.label}</p>
                </Link>
              ) : (
                <>
                  <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-brand-chrome text-sm mt-1">{stat.label}</p>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <QuickLink href="/admin/reports"       title="Review Reports"       description="0 pending reports need review" />
          <QuickLink href="/admin/photos"        title="Moderate Photos"      description="0 photos awaiting review" />
          <QuickLink href="/admin/verifications" title="Review Verifications" description="0 verification requests pending" />
          <QuickLink href="/admin/users"         title="Manage Users"         description="Search, ban, warn, verify, or review user profiles" />
        </div>
      </div>
    );
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Summary stats
  const [
    { count: totalUsers },
    { count: activeUsers },
    { count: pendingReports },
    { count: pendingPhotos },
    { count: bannedUsers },
    { count: premiumUsers },
    { count: pendingVerifications },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', true).eq('is_banned', false),
    supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('profile_photos').select('*', { count: 'exact', head: true }).eq('moderation_status', 'pending'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_banned', true),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_premium', true),
    supabase.from('verifications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  const stats = [
    { label: 'Total users', value: totalUsers ?? 0, color: 'text-white' },
    { label: 'Active users', value: activeUsers ?? 0, color: 'text-green-400' },
    { label: 'Pending reports', value: pendingReports ?? 0, color: pendingReports ? 'text-red-400' : 'text-white', href: '/admin/reports' },
    { label: 'Photos to review', value: pendingPhotos ?? 0, color: pendingPhotos ? 'text-yellow-400' : 'text-white', href: '/admin/photos' },
    { label: 'Pending verifications', value: pendingVerifications ?? 0, color: pendingVerifications ? 'text-blue-400' : 'text-white', href: '/admin/verifications' },
    { label: 'Banned users', value: bannedUsers ?? 0, color: 'text-red-400' },
    { label: 'Premium users', value: premiumUsers ?? 0, color: 'text-brand-orange' },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="p-5 rounded-2xl bg-brand-dark-3 border border-brand-dark-4">
            {stat.href ? (
              <Link href={stat.href} className="block group">
                <p className={`text-3xl font-bold ${stat.color} group-hover:opacity-80`}>{stat.value}</p>
                <p className="text-brand-chrome text-sm mt-1">{stat.label}</p>
              </Link>
            ) : (
              <>
                <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-brand-chrome text-sm mt-1">{stat.label}</p>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <QuickLink href="/admin/reports" title="Review Reports" description={`${pendingReports ?? 0} pending reports need review`} urgent={!!(pendingReports && pendingReports > 0)} />
        <QuickLink href="/admin/photos" title="Moderate Photos" description={`${pendingPhotos ?? 0} photos awaiting review`} urgent={!!(pendingPhotos && pendingPhotos > 0)} />
        <QuickLink href="/admin/verifications" title="Review Verifications" description={`${pendingVerifications ?? 0} verification requests pending`} urgent={!!(pendingVerifications && pendingVerifications > 0)} />
        <QuickLink href="/admin/users" title="Manage Users" description="Search, ban, warn, verify, or review user profiles" />
      </div>
    </div>
  );
}

function QuickLink({ href, title, description, urgent = false }: {
  href: string; title: string; description: string; urgent?: boolean;
}) {
  return (
    <Link href={href} className={`block p-5 rounded-2xl border transition-colors hover:border-brand-orange/50 ${urgent ? 'bg-red-500/5 border-red-500/20' : 'bg-brand-dark-3 border-brand-dark-4'}`}>
      <h2 className="font-bold text-lg mb-1">{title}</h2>
      <p className={`text-sm ${urgent ? 'text-red-400' : 'text-brand-chrome'}`}>{description}</p>
    </Link>
  );
}
