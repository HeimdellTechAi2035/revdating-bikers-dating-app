'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, LayoutDashboard, Users, Flag, Image, ShieldCheck, Rocket, ChevronLeft, HeartPulse } from 'lucide-react';

const NAV_LINKS = [
  { href: '/admin',               label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/admin/users',         label: 'Users',         icon: Users },
  { href: '/admin/reports',       label: 'Reports',       icon: Flag },
  { href: '/admin/photos',        label: 'Photos',        icon: Image },
  { href: '/admin/verifications', label: 'Verifications', icon: ShieldCheck },
  { href: '/admin/safety',        label: 'Safety',        icon: HeartPulse },
  { href: '/admin/launch',        label: 'Launch',        icon: Rocket },
];

export default function AdminNav({ role }: { role: string }) {
  const [open, setOpen] = useState(false);
  const [pendingReports, setPendingReports] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    fetch('/api/admin/reports/stats')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.total) setPendingReports(d.total); })
      .catch(() => {});
  }, []);

  return (
    <>
      {/* Top bar */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#111] border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpen((o) => !o)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Open menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <span className="font-bold text-brand-orange text-base">REVdating Admin</span>
          <span className="hidden sm:inline text-xs px-2 py-0.5 rounded-full bg-brand-orange/20 text-brand-orange font-medium">
            {role}
          </span>
        </div>
        <Link href="/discover" className="flex items-center gap-1 text-xs text-white/50 hover:text-white transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to app
        </Link>
      </nav>

      {/* Slide-out drawer */}
      {open && (
        <div className="fixed inset-0 z-40 flex" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="relative z-50 w-64 bg-[#111] border-r border-white/10 pt-16 pb-6 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <nav className="flex-1 px-3 space-y-1">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || (href !== '/admin' && pathname.startsWith(href));
                const badge = href === '/admin/reports' && pendingReports > 0 ? pendingReports : 0;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                      active
                        ? 'bg-brand-orange text-white'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1">{label}</span>
                    {badge > 0 && (
                      <span className="ml-auto min-w-[20px] text-center text-xs font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
            <div className="px-3 pt-4 border-t border-white/10 mt-4">
              <Link
                href="/discover"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white/50 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to app
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
