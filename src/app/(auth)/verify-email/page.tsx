import Link from 'next/link';
import { Bike, Mail } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Verify your email' };

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { email?: string };
}) {
  const email = searchParams.email;

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center px-4 text-center">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-brand-orange/10 flex items-center justify-center mb-4">
            <Bike className="w-8 h-8 text-brand-orange" />
          </div>
          <h1 className="text-3xl font-bold gradient-text">REVdating</h1>
        </div>

        {/* Icon */}
        <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
          <Mail className="w-10 h-10 text-green-400" />
        </div>

        <h2 className="text-2xl font-bold mb-3">Check your inbox</h2>

        <p className="text-brand-chrome text-sm leading-relaxed mb-2">
          We&apos;ve sent a verification link to
        </p>
        {email && (
          <p className="text-white font-semibold mb-4 break-all">{decodeURIComponent(email)}</p>
        )}
        <p className="text-brand-chrome text-sm leading-relaxed">
          Click the link in the email to activate your account. It may take a minute or two to arrive.
          Check your spam folder if you don&apos;t see it.
        </p>

        {/* Steps */}
        <div className="mt-8 bg-brand-dark-2 rounded-2xl p-4 text-left space-y-3">
          {[
            'Open the email from REVdating',
            'Click the "Verify email" button',
            "You'll be taken to complete your profile",
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-brand-orange/20 text-brand-orange text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="text-sm text-brand-chrome">{step}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 space-y-3">
          <p className="text-brand-chrome text-xs">Wrong email address?</p>
          <Link
            href="/register"
            className="block text-brand-orange hover:underline text-sm font-medium"
          >
            Go back and try again
          </Link>
        </div>

        <div className="mt-6 border-t border-brand-dark-4 pt-6">
          <p className="text-brand-chrome-dark text-xs">
            Already verified?{' '}
            <Link href="/login" className="text-brand-orange hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
