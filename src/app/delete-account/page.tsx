import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'How to Delete Your REVdating Account',
  description:
    'Step-by-step instructions to permanently delete your REVdating account and all associated personal data under UK GDPR.',
  alternates: { canonical: 'https://revdating.co.uk/delete-account' },
};

export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-black text-white py-16 px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'REVdating', item: 'https://revdating.co.uk/' },
              { '@type': 'ListItem', position: 2, name: 'Delete account', item: 'https://revdating.co.uk/delete-account' },
            ],
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'HowTo',
            name: 'How to delete your REVdating account',
            description:
              'Step-by-step instructions to permanently delete your REVdating account and all personal data.',
            step: [
              {
                '@type': 'HowToStep',
                position: 1,
                name: 'Open REVdating and sign in',
                text: 'Open revdating.co.uk in your browser or from your home screen and sign in to your account.',
              },
              {
                '@type': 'HowToStep',
                position: 2,
                name: 'Go to Settings',
                text: 'Tap your profile photo or the menu icon to open Settings.',
              },
              {
                '@type': 'HowToStep',
                position: 3,
                name: 'Tap "Delete account"',
                text: 'Scroll to the bottom of Settings and tap "Delete account".',
              },
              {
                '@type': 'HowToStep',
                position: 4,
                name: 'Confirm deletion',
                text: 'Confirm you want to permanently delete your account. Your account is deactivated immediately.',
              },
            ],
          }),
        }}
      />

      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-red-400 hover:text-red-300 text-sm transition-colors">
          ← Back to REVdating
        </Link>

        <div className="mt-8 mb-10">
          <p className="text-red-500 text-sm font-bold uppercase tracking-widest mb-3">Account management</p>
          <h1 className="text-4xl md:text-5xl font-black mb-5 leading-tight">
            How to delete your<br />REVdating account
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed">
            Deleting your account permanently removes your profile, photos, matches, and
            messages. Your personal data is erased within 30 days under UK GDPR
            (Right to Erasure — Article 17).
          </p>
        </div>

        {/* Method 1 — in-app */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 mb-6">
          <h2 className="font-black text-xl text-white mb-6">
            Method 1 — Delete from within the app
            <span className="ml-2 text-xs px-2 py-1 rounded-full bg-green-500/15 border border-green-500/30 text-green-400 font-bold uppercase tracking-wide align-middle">Recommended</span>
          </h2>
          <ol className="space-y-5">
            {[
              { n: 1, title: 'Sign in to REVdating', body: 'Open revdating.co.uk in your browser or from your home screen and sign in.' },
              { n: 2, title: 'Open Settings', body: 'Tap your profile photo or the menu icon to open Settings.' },
              { n: 3, title: 'Tap "Delete account"', body: 'Scroll to the bottom of the Settings page and tap "Delete account".' },
              { n: 4, title: 'Confirm deletion', body: 'A confirmation screen will appear. Confirm that you want to permanently delete. Your account is deactivated immediately and all data is removed within 30 days.' },
            ].map(({ n, title, body }) => (
              <li key={n} className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-black text-sm flex-shrink-0 mt-0.5">
                  {n}
                </div>
                <div>
                  <p className="font-bold text-white mb-1">{title}</p>
                  <p className="text-zinc-400 text-sm leading-relaxed">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Method 2 — email */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 mb-6">
          <h2 className="font-black text-xl text-white mb-2">Method 2 — Request deletion by email</h2>
          <p className="text-zinc-400 text-sm mb-6">
            Use this method if you cannot sign in to your account.
          </p>
          <ol className="space-y-5">
            {[
              {
                n: 1,
                title: 'Email us from your registered address',
                body: (
                  <>
                    Send an email to{' '}
                    <a href="mailto:dpo@revdating.app" className="text-red-400 hover:text-red-300 transition-colors font-semibold">
                      dpo@revdating.app
                    </a>{' '}
                    from the email address you used to sign up.
                  </>
                ),
              },
              {
                n: 2,
                title: 'Use the subject: "Account deletion request"',
                body: 'This ensures your request is routed directly to our Data Protection Officer.',
              },
              {
                n: 3,
                title: 'We confirm and process within 30 days',
                body: 'We will confirm receipt by email and complete deletion within 30 days as required by UK GDPR. We will notify you when it is done.',
              },
            ].map(({ n, title, body }) => (
              <li key={n} className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-zinc-700 text-white flex items-center justify-center font-black text-sm flex-shrink-0 mt-0.5">
                  {n}
                </div>
                <div>
                  <p className="font-bold text-white mb-1">{title}</p>
                  <p className="text-zinc-400 text-sm leading-relaxed">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Important notes */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-7 mb-8">
          <h2 className="font-black text-lg text-white mb-4">Important notes</h2>
          <ul className="space-y-3 text-sm text-zinc-400">
            <li className="flex items-start gap-3">
              <span className="text-yellow-400 font-bold flex-shrink-0 mt-0.5">Premium subscription</span>
              <span>Deleting your account does not automatically cancel an active subscription. Cancel first via <strong className="text-white">Settings → Manage subscription</strong>, then delete your account.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow-400 font-bold flex-shrink-0 mt-0.5">Payment records</span>
              <span>Stripe payment records are retained for 7 years as required by UK law — this is separate from your personal profile data.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow-400 font-bold flex-shrink-0 mt-0.5">Deletion is permanent</span>
              <span>Deleted accounts cannot be recovered. If you want to use REVdating again in the future, you would need to create a new account.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow-400 font-bold flex-shrink-0 mt-0.5">Your rights</span>
              <span>Under UK GDPR, you have the right to erasure of your personal data. If you believe we have not complied, you can complain to the ICO at <a href="https://ico.org.uk/" target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-300 transition-colors">ico.org.uk</a>.</span>
            </li>
          </ul>
        </div>

        {/* Links */}
        <div className="flex flex-wrap gap-4 text-sm text-zinc-500">
          <Link href="/privacy"      className="hover:text-white transition-colors">Privacy Policy</Link>
          <Link href="/contact"      className="hover:text-white transition-colors">Contact us</Link>
          <Link href="/safety-policy" className="hover:text-white transition-colors">Safety Policy</Link>
        </div>
      </div>
    </div>
  );
}
