import Link from 'next/link';
import { CheckCircle, Bike } from 'lucide-react';

export const metadata = {
  title: 'Account Deleted — REVdating',
  robots: { index: false, follow: false },
};

export default function AccountDeletedPage() {
  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
          <CheckCircle className="w-10 h-10 text-green-400" />
        </div>

        <div>
          <h1 className="text-2xl font-bold">Account deleted</h1>
          <p className="text-brand-chrome mt-2 leading-relaxed">
            Your REVdating account and personal data have been deleted. We're sorry to see you go — keep the shiny side up. 🏍️
          </p>
        </div>

        <div className="bg-brand-dark-3 border border-brand-dark-4 rounded-2xl p-4 text-left space-y-2">
          <p className="text-sm font-semibold">What happens next</p>
          <ul className="text-brand-chrome text-xs space-y-1.5">
            <li>• Your profile is no longer visible to other riders</li>
            <li>• Your photos have been removed from our servers</li>
            <li>• Any open matches and messages have been deleted</li>
            <li>• Payment records are retained for 7 years as required by UK law</li>
          </ul>
        </div>

        <p className="text-brand-chrome text-xs">
          For any data queries, contact{' '}
          <a href="mailto:privacy@REVdating.app" className="text-brand-orange">
            privacy@REVdating.app
          </a>
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/register"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-brand-orange text-white font-bold hover:bg-brand-orange/90 transition-colors"
          >
            <Bike className="w-5 h-5" />
            Create a new account
          </Link>
          <Link
            href="/"
            className="w-full py-3 rounded-xl border border-brand-dark-4 text-brand-chrome text-sm hover:border-brand-orange/50 transition-colors"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
