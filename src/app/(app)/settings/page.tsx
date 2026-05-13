import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { LogOut, Crown, Shield, Download, Trash2, Bell, MapPin, Lock } from 'lucide-react';
import { SignOutButton } from '@/components/auth/SignOutButton';
import SubscriptionSuccessTracker from '@/components/analytics/SubscriptionSuccessTracker';
import OnlineStatusToggle from '@/components/settings/OnlineStatusToggle';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, is_premium, show_online_status')
    .eq('id', user.id)
    .single();

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('status, current_period_end, cancel_at_period_end, stripe_customer_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single();

  return (
    <div className="px-5 py-4 space-y-6">
      <Suspense fallback={null}><SubscriptionSuccessTracker /></Suspense>
      <h1 className="text-xl font-bold">Settings</h1>

      {/* Account */}
      <Section title="Account">
        <SettingRow icon={<Lock className="w-4 h-4" />} label="Email" value={user.email ?? ''} />
        <SettingRow
          icon={<Crown className="w-4 h-4 text-brand-orange" />}
          label="Subscription"
          value={profile?.is_premium ? 'Premium' : 'Free'}
          href={profile?.is_premium ? undefined : '/premium'}
          linkLabel={profile?.is_premium ? undefined : 'Upgrade'}
        />
        {subscription?.stripe_customer_id && (
          <form action="/api/stripe/portal" method="POST">
            <button type="submit" className="w-full text-left flex items-center gap-3 p-3 rounded-xl hover:bg-brand-dark-3 transition-colors text-sm">
              <Crown className="w-4 h-4 text-brand-orange" />
              <div className="flex-1">
                <p className="font-medium">Manage billing</p>
                {subscription.cancel_at_period_end && (
                  <p className="text-xs text-red-400">Cancels at end of period</p>
                )}
              </div>
              <span className="text-brand-chrome text-xs">→</span>
            </button>
          </form>
        )}
      </Section>

      {/* Discovery */}
      <Section title="Discovery">
        <SettingRow icon={<MapPin className="w-4 h-4" />} label="Location preferences" href="/profile/edit" linkLabel="Edit" />
        <SettingRow icon={<Bell className="w-4 h-4" />} label="Push notifications" href="/settings/push-notifications" linkLabel="Manage" />
      </Section>

      {/* Privacy */}
      <Section title="Privacy">
        <OnlineStatusToggle initial={profile?.show_online_status ?? true} />
      </Section>

      {/* Safety */}
      <Section title="Safety">
        <SettingRow icon={<Shield className="w-4 h-4 text-brand-orange" />} label="Safety Centre" href="/safety" linkLabel="Open" />
        <SettingRow icon={<Shield className="w-4 h-4" />} label="Blocked users" href="/settings/blocked" linkLabel="View" />
        <SettingRow icon={<Shield className="w-4 h-4 text-red-400" />} label="Report illegal content" href="/safety/report-illegal" linkLabel="Report" />
      </Section>

      {/* Data & Privacy */}
      <Section title="Data & Privacy">
        <form action="/api/gdpr/export" method="POST">
          <button type="submit" className="w-full text-left flex items-center gap-3 p-3 rounded-xl hover:bg-brand-dark-3 transition-colors text-sm">
            <Download className="w-4 h-4 text-brand-chrome" />
            <span className="flex-1 font-medium">Download my data</span>
            <span className="text-brand-chrome text-xs">→</span>
          </button>
        </form>
        <Link href="/settings/delete-account" className="flex items-center gap-3 p-3 rounded-xl hover:bg-red-500/10 transition-colors text-sm text-red-400">
          <Trash2 className="w-4 h-4" />
          <span className="flex-1 font-medium">Delete account</span>
          <span className="text-xs">→</span>
        </Link>
      </Section>

      {/* Legal */}
      <Section title="Legal">
        <SettingRow label="Privacy Policy" href="/privacy" />
        <SettingRow label="Terms of Service" href="/terms" />
        <SettingRow label="Community Guidelines" href="/community-guidelines" />
        <SettingRow label="Safety Policy" href="/safety-policy" />
        <SettingRow label="Cookie Policy" href="/cookies" />
      </Section>

      {/* Sign out */}
      <SignOutButton />

      <p className="text-center text-brand-chrome-dark text-xs">
        REVdating v0.1.0 · Made for riders 🏍️
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-semibold text-brand-chrome uppercase tracking-wider mb-2 px-1">{title}</h2>
      <div className="bg-brand-dark-3 border border-brand-dark-4 rounded-2xl divide-y divide-brand-dark-4">
        {children}
      </div>
    </div>
  );
}

function SettingRow({
  icon,
  label,
  value,
  href,
  linkLabel,
}: {
  icon?: React.ReactNode;
  label: string;
  value?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 text-sm">
      {icon && <span className="text-brand-chrome">{icon}</span>}
      <span className="flex-1 font-medium">{label}</span>
      {value && <span className="text-brand-chrome">{value}</span>}
      {href && linkLabel && (
        <Link href={href} className="text-brand-orange text-xs font-medium hover:underline">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}
