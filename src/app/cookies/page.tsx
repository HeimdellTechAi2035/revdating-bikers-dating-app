import Link from 'next/link';

export const metadata = {
  title: 'Cookie Policy — REVdating',
};

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-brand-dark text-white py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <Link href="/" className="text-brand-orange hover:underline text-sm">← Back to REVdating</Link>
          <h1 className="text-3xl font-black mt-4">Cookie Policy</h1>
          <p className="text-brand-chrome text-sm mt-1">Last updated: 29 April 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">What are cookies?</h2>
          <p className="text-brand-chrome">Cookies are small text files placed on your device when you use a website or app. REVdating uses minimal cookies to operate securely.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">Cookies we use</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-brand-dark-3 text-brand-chrome">
                  <th className="px-4 py-3 text-left">Cookie</th>
                  <th className="px-4 py-3 text-left">Purpose</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-dark-4">
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">sb-*</td>
                  <td className="px-4 py-3 text-brand-chrome">Authentication session (Supabase)</td>
                  <td className="px-4 py-3"><span className="text-green-400">Essential</span></td>
                  <td className="px-4 py-3 text-brand-chrome">Session / 7 days</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">__stripe_mid</td>
                  <td className="px-4 py-3 text-brand-chrome">Stripe fraud prevention</td>
                  <td className="px-4 py-3"><span className="text-green-400">Essential</span></td>
                  <td className="px-4 py-3 text-brand-chrome">1 year</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">__stripe_sid</td>
                  <td className="px-4 py-3 text-brand-chrome">Stripe session identification</td>
                  <td className="px-4 py-3"><span className="text-green-400">Essential</span></td>
                  <td className="px-4 py-3 text-brand-chrome">30 minutes</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-brand-chrome text-sm">We do not use tracking cookies, advertising cookies, or third-party analytics cookies. We do not use cookie consent banners because all cookies listed are strictly necessary.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">Analytics</h2>
          <p className="text-brand-chrome">We use PostHog for product analytics. PostHog is configured to not use cookies and to not capture personally identifiable information (PII). Data is processed in the EU.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">How to control cookies</h2>
          <p className="text-brand-chrome">Essential cookies cannot be disabled as they are required for the service to function. You can clear cookies via your browser settings, but this will sign you out of REVdating.</p>
        </section>

        <div className="text-brand-chrome text-sm border-t border-brand-dark-4 pt-6 flex flex-wrap gap-4">
          <Link href="/privacy" className="text-brand-orange hover:underline">Privacy Policy</Link>
          <Link href="/terms" className="text-brand-orange hover:underline">Terms of Service</Link>
          <Link href="/community-guidelines" className="text-brand-orange hover:underline">Community Guidelines</Link>
          <Link href="/safety-policy" className="text-brand-orange hover:underline">Safety Policy</Link>
        </div>
      </div>
    </div>
  );
}
