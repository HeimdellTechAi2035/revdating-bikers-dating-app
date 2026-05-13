import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PushNotificationSettings } from './PushNotificationSettings';

export default function PushNotificationsPage() {
  return (
    <div className="flex flex-col min-h-screen pb-8">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-brand-dark-4">
        <Link
          href="/settings"
          className="flex items-center gap-1.5 text-brand-chrome hover:text-white transition-colors text-sm"
        >
          <ArrowLeft size={16} />
        </Link>
        <h1 className="font-bold text-lg">Push Notifications</h1>
      </div>

      <div className="px-5 pt-5">
        <PushNotificationSettings />
      </div>
    </div>
  );
}
