import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Account Suspended — REVdating',
  robots: { index: false, follow: false },
};

export default function BannedPage() {
  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-6">
        <div className="text-6xl">🚫</div>
        <h1 className="text-3xl font-black text-red-400">Account Suspended</h1>
        <p className="text-brand-chrome">
          Your REVdating account has been suspended due to a violation of our{' '}
          <Link href="/terms" className="text-brand-orange hover:underline">Terms of Service</Link> or{' '}
          <Link href="/community-guidelines" className="text-brand-orange hover:underline">Community Guidelines</Link>.
        </p>
        <p className="text-brand-chrome text-sm">
          If you believe this was an error, please contact our support team at{' '}
          <a href="mailto:support@REVdating.app" className="text-brand-orange hover:underline">support@REVdating.app</a>{' '}
          with your registered email address and we'll review your case.
        </p>
        <div className="pt-4 border-t border-brand-dark-4 text-xs text-brand-chrome space-y-1">
          <p>Under UK GDPR, you have the right to request your data even if your account is suspended.</p>
          <a href="mailto:privacy@REVdating.app" className="text-brand-orange hover:underline">Contact our Data Protection team</a>
        </div>
      </div>
    </div>
  );
}
