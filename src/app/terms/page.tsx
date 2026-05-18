import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — REVdating',
  description: 'Terms and conditions for using the REVdating dating app.',
  alternates: { canonical: 'https://revdating.co.uk/terms' },
};

const LAST_UPDATED = '29 April 2026';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-brand-dark text-white py-12 px-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'REVdating', item: 'https://revdating.co.uk/' },
              { '@type': 'ListItem', position: 2, name: 'Terms of Service', item: 'https://revdating.co.uk/terms' },
            ],
          }),
        }}
      />
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <Link href="/" className="text-brand-orange hover:underline text-sm">← Back to REVdating</Link>
          <h1 className="text-3xl font-black mt-4">Terms of Service</h1>
          <p className="text-brand-chrome text-sm mt-1">Last updated: {LAST_UPDATED}</p>
        </div>

        <Section title="1. Eligibility">
          <p>REVdating is available only to users who are <strong>18 years of age or older</strong>. By using REVdating, you confirm that you are at least 18 years old. Accounts found to belong to minors will be immediately terminated and reported to relevant authorities if required.</p>
          <p>REVdating is a community for motorcycle enthusiasts. You must own, ride, or have a genuine interest in motorcycles to use this service.</p>
        </Section>

        <Section title="2. Account responsibility">
          <p>You are responsible for all activity on your account. You must keep your credentials secure and notify us immediately of any unauthorised access. You may not share your account with anyone else.</p>
        </Section>

        <Section title="3. Community guidelines">
          <p>You agree not to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Impersonate any person or misrepresent your identity</li>
            <li>Upload photos that are not of yourself or are sexually explicit</li>
            <li>Harass, threaten, or abuse other users</li>
            <li>Use REVdating for commercial solicitation or spam</li>
            <li>Attempt to circumvent our safety features or moderation systems</li>
            <li>Create fake profiles or use automated tools to interact with the service</li>
            <li>Share another user's private information without their consent</li>
          </ul>
        </Section>

        <Section title="4. Content you post">
          <p>You retain ownership of content you post (photos, bio, messages). By posting content, you grant REVdating a worldwide, royalty-free licence to display that content to other users of the service solely for operating the app. We do not sell your content to third parties.</p>
          <p>All photos are subject to automated and manual moderation. We reserve the right to remove content that violates these terms.</p>
        </Section>

        <Section title="5. Premium subscriptions">
          <p>Premium subscriptions are billed monthly or annually via Stripe. Subscriptions auto-renew until cancelled. You may cancel at any time via Settings → Manage subscription. No refunds are provided for unused portions of a billing period except where required by law (including 14-day consumer cooling-off rights under UK Consumer Contracts Regulations 2013, which are waived if you have already used premium features).</p>
        </Section>

        <Section title="6. Termination">
          <p>We reserve the right to suspend or terminate accounts that violate these terms, at our sole discretion, with or without prior notice. Serious violations (e.g., uploading CSAM, credible threats) will be reported to law enforcement.</p>
        </Section>

        <Section title="7. Limitation of liability">
          <p>REVdating is provided "as is". We are not responsible for the actions of other users you meet through REVdating. Always exercise caution when meeting someone for the first time. We recommend meeting in public places.</p>
          <p>To the maximum extent permitted by law, our liability to you is limited to the amount you paid us in the 12 months preceding any claim.</p>
        </Section>

        <Section title="8. Governing law">
          <p>These terms are governed by the laws of England and Wales. Disputes will be resolved in the courts of England and Wales.</p>
        </Section>

        <Section title="9. Changes to these terms">
          <p>We will provide at least 30 days' notice of material changes via email or in-app notification. Continued use after changes take effect constitutes acceptance.</p>
        </Section>

        <Section title="10. Contact">
          <p>For questions: <a href="mailto:legal@REVdating.app" className="text-brand-orange">legal@REVdating.app</a></p>
        </Section>

        <div className="text-brand-chrome text-sm border-t border-brand-dark-4 pt-6">
          <Link href="/privacy" className="text-brand-orange hover:underline mr-4">Privacy Policy</Link>
          <Link href="/cookies" className="text-brand-orange hover:underline mr-4">Cookie Policy</Link>
          <Link href="/community-guidelines" className="text-brand-orange hover:underline mr-4">Community Guidelines</Link>
          <Link href="/safety-policy" className="text-brand-orange hover:underline">Safety Policy</Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="text-brand-chrome space-y-2">{children}</div>
    </section>
  );
}
