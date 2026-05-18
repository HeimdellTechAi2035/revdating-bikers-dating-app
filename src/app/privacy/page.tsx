import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — REVdating',
  description: 'How REVdating collects, uses, and protects your personal data.',
  alternates: { canonical: 'https://revdating.co.uk/privacy' },
};

const LAST_UPDATED = '29 April 2026';
const CONTROLLER = 'Heimdell Tech Ai Ltd, trading as REVdating';
const CONTACT_EMAIL = 'privacy@REVdating.app';
const DPO_EMAIL = 'dpo@REVdating.app';

export default function PrivacyPage() {
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
              { '@type': 'ListItem', position: 2, name: 'Privacy Policy', item: 'https://revdating.co.uk/privacy' },
            ],
          }),
        }}
      />
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <Link href="/" className="text-brand-orange hover:underline text-sm">← Back to REVdating</Link>
          <h1 className="text-3xl font-black mt-4">Privacy Policy</h1>
          <p className="text-brand-chrome text-sm mt-1">Last updated: {LAST_UPDATED}</p>
        </div>

        <Section title="1. Who we are">
          <p>{CONTROLLER} ("REVdating", "we", "us") is the data controller for personal information collected through the REVdating mobile application and website ("Service").</p>
          <p>Contact: <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-orange">{CONTACT_EMAIL}</a></p>
          <p>Data Protection Officer: <a href={`mailto:${DPO_EMAIL}`} className="text-brand-orange">{DPO_EMAIL}</a></p>
        </Section>

        <Section title="2. Legal basis (UK GDPR)">
          <p>We process your personal data under the following legal bases:</p>
          <ul className="list-disc pl-5 space-y-1 text-brand-chrome">
            <li><strong className="text-white">Contract performance</strong> — providing the dating service you signed up for</li>
            <li><strong className="text-white">Legitimate interests</strong> — fraud prevention, safety, security, and service improvement</li>
            <li><strong className="text-white">Legal obligation</strong> — compliance with applicable laws</li>
            <li><strong className="text-white">Consent</strong> — marketing communications and optional analytics (you may withdraw at any time)</li>
          </ul>
        </Section>

        <Section title="3. Data we collect">
          <ul className="list-disc pl-5 space-y-1 text-brand-chrome">
            <li>Account information: email, hashed password, display name, date of birth, gender</li>
            <li>Profile information: bio, photos, location (approximate city/coordinates), bike details</li>
            <li>Usage data: swipes, matches, messages, session timestamps</li>
            <li>Device data: push notification tokens, IP address (for security)</li>
            <li>Payment data: processed via Stripe — we do not store card details</li>
          </ul>
          <p className="mt-2 text-brand-chrome">We do not collect special category data (e.g., health, religion) beyond what you voluntarily include in your bio.</p>
        </Section>

        <Section title="4. How we use your data">
          <ul className="list-disc pl-5 space-y-1 text-brand-chrome">
            <li>To operate the matching and messaging features</li>
            <li>To moderate content and enforce community standards</li>
            <li>To send push notifications about matches and messages</li>
            <li>To process subscription payments</li>
            <li>To detect and prevent fraud and abuse</li>
            <li>To comply with legal obligations</li>
          </ul>
        </Section>

        <Section title="5. Location data">
          <p>We collect your approximate location to show you nearby riders. Your precise GPS coordinates are stored server-side and are never shared with other users. Other users see only an approximate distance (e.g., "within 10 miles"). You may turn off location sharing in Settings at any time.</p>
        </Section>

        <Section title="6. Photos and moderation">
          <p>Uploaded photos are automatically scanned for nudity, violence, and offensive content using Sightengine. Photos may also be reviewed by our moderation team. Rejected photos are deleted from our servers within 30 days.</p>
        </Section>

        <Section title="7. Data sharing">
          <p>We do not sell your personal data. We share data only with:</p>
          <ul className="list-disc pl-5 space-y-1 text-brand-chrome">
            <li>Supabase (database and authentication hosting, EU/US)</li>
            <li>Stripe (payment processing)</li>
            <li>Sightengine (image moderation)</li>
            <li>Web Push/VAPID (push notifications)</li>
            <li>Law enforcement or regulators when legally required</li>
          </ul>
        </Section>

        <Section title="8. Data retention">
          <ul className="list-disc pl-5 space-y-1 text-brand-chrome">
            <li>Active accounts: retained while your account is active</li>
            <li>Deleted accounts: data removed within 30 days, except where retention is required by law</li>
            <li>Messages: deleted with the match or your account</li>
            <li>Payment records: retained for 7 years (legal requirement)</li>
          </ul>
        </Section>

        <Section title="9. Your rights (UK GDPR)">
          <p>You have the right to:</p>
          <ul className="list-disc pl-5 space-y-1 text-brand-chrome">
            <li><strong className="text-white">Access</strong> — request a copy of your data (via Settings → Download my data)</li>
            <li><strong className="text-white">Rectification</strong> — correct inaccurate data (via your profile)</li>
            <li><strong className="text-white">Erasure</strong> — delete your account and data (via Settings → Delete account)</li>
            <li><strong className="text-white">Restriction</strong> — request we limit processing while you dispute accuracy</li>
            <li><strong className="text-white">Portability</strong> — receive your data in machine-readable format</li>
            <li><strong className="text-white">Object</strong> — opt out of legitimate interest processing</li>
            <li><strong className="text-white">Withdraw consent</strong> — at any time for consent-based processing</li>
          </ul>
          <p className="mt-2">To exercise rights, contact <a href={`mailto:${DPO_EMAIL}`} className="text-brand-orange">{DPO_EMAIL}</a>. We will respond within 30 days. You may also complain to the ICO at <a href="https://ico.org.uk" className="text-brand-orange" target="_blank" rel="noopener noreferrer">ico.org.uk</a>.</p>
        </Section>

        <Section title="10. Age restriction">
          <p>REVdating is strictly for users aged 18 and over. We verify date of birth at registration and will delete accounts found to belong to minors. If you believe a minor has registered, contact us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-orange">{CONTACT_EMAIL}</a> immediately.</p>
        </Section>

        <Section title="11. Cookies">
          <p>We use essential cookies for authentication and security. See our <Link href="/cookies" className="text-brand-orange">Cookie Policy</Link> for details.</p>
        </Section>

        <Section title="12. Changes to this policy">
          <p>We will notify you of material changes via email or in-app notification at least 30 days before they take effect.</p>
        </Section>

        <div className="text-brand-chrome text-sm border-t border-brand-dark-4 pt-6">
          <Link href="/terms" className="text-brand-orange hover:underline mr-4">Terms of Service</Link>
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
