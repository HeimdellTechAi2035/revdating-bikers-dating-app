'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Flame, MessageCircle, Heart, User, Settings } from 'lucide-react';

const nav = [
  { href: '/discover', icon: Flame,          label: 'Discover',  matchPaths: ['/discover'] },
  { href: '/matches',  icon: MessageCircle,  label: 'Messages',  matchPaths: ['/matches', '/chat'] },
  { href: '/likes',    icon: Heart,          label: 'Likes',     matchPaths: ['/likes'] },
  { href: '/profile',  icon: User,           label: 'Profile',   matchPaths: ['/profile'] },
  { href: '/settings', icon: Settings,       label: 'Settings',  matchPaths: ['/settings', '/safety'] },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-brand-dark-2/95 backdrop-blur-md border-t border-brand-dark-4 safe-area-pb">
      <div className="flex">
        {nav.map(({ href, icon: Icon, label, matchPaths }) => {
          const active = matchPaths.some((p) => pathname === p || pathname.startsWith(p + '/'));
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
                active ? 'text-brand-orange' : 'text-brand-chrome hover:text-white'
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
