import Link from 'next/link';

export const metadata = {
  title: 'Safety Policy — REVdating',
  description: 'How REVdating protects its users and handles harmful content.',
  alternates: { canonical: 'https://revdating.co.uk/safety-policy' },
};

const LAST_UPDATED = '27 April 2026';

export default function SafetyPolicyPage() {
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
              { '@type': 'ListItem', position: 2, name: 'Safety Policy', item: 'https://revdating.co.uk/safety-policy' },
            ],
          }),
        }}
      />
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <Link href="/" className="text-brand-orange hover:underline text-sm">← Back to REVdating</Link>
          <h1 className="text-3xl font-black mt-4">Safety Policy</h1>
          <p className="text-brand-chrome text-sm mt-1">Last updated: {LAST_UPDATED}</p>
          <p className="text-brand-chrome mt-3 leading-relaxed">
            The safety of our users is the most important thing we do. This policy explains what we do to protect you, how we handle reports of harmful content, and what legal obligations we comply with as a UK-based platform.
          </p>
        </div>

        <Section title="1. Our commitment to safety">
          <p>REVdating is designed with safety at its core. We operate under UK law, including the Online Safety Act 2023, the UK GDPR, and applicable ICO guidance for online dating services. We take a proactive approach to platform safety — not just reactive.</p>
          <p>We are committed to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Preventing harm before it occurs through design, moderation, and verification</li>
            <li>Acting quickly when harm is reported</li>
            <li>Co-operating fully with law enforcement when required</li>
            <li>Being transparent with users about how we manage safety</li>
          </ul>
        </Section>

        <Section title="2. Age verification">
          <p>REVdating is strictly for users aged <strong className="text-white">18 and over</strong>. We enforce this in multiple ways:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Date of birth is collected at registration and validated in our database with an 18+ constraint</li>
            <li>Users must confirm they are 18 or older when agreeing to our Terms of Service</li>
            <li>Our moderation team flags profiles that appear to belong to minors</li>
            <li>Any account confirmed or suspected to belong to a minor is immediately terminated and referred to the relevant authority (e.g., NCMEC, NCA)</li>
          </ul>
          <p>If you believe a minor has registered on REVdating, please report it immediately to <a href="mailto:safety@REVdating.app" className="text-brand-orange">safety@REVdating.app</a>.</p>
        </Section>

        <Section title="3. Photo moderation">
          <p>All photos uploaded to REVdating are reviewed using automated content detection tools before becoming visible to other users. Our systems check for:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Nudity and sexually explicit content</li>
            <li>Child sexual abuse material (CSAM) — using hashing technology matched against known databases</li>
            <li>Graphic violence or disturbing imagery</li>
            <li>Spam watermarks or commercial advertisements</li>
          </ul>
          <p>Photos that fail automated checks are held for human review. Our moderation team reviews flagged photos within 24 hours. Photos confirmed to violate our policies are deleted and the uploader's account may be suspended or banned.</p>
        </Section>

        <Section title="4. User reports">
          <p>You can report any user or piece of content from within the app. Reports are reviewed by our Trust &amp; Safety team, typically within 48 hours for standard reports and within 2 hours for urgent/illegal content reports.</p>
          <p>When you make a report, we may:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Review the reported content and the context</li>
            <li>Look at the reported user's history on our platform</li>
            <li>Issue a warning, restrict features, suspend, or permanently ban the reported user</li>
            <li>Preserve evidence and refer to law enforcement where legally required</li>
          </ul>
          <p>You will receive an email update when your report has been reviewed.</p>
        </Section>

        <Section title="5. Illegal content — mandatory reporting" id="illegal-content">
          <p>Certain categories of illegal content require us to act immediately and report to authorities. We have <strong className="text-white">zero tolerance</strong> for:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-white">Child Sexual Abuse Material (CSAM)</strong> — reported to the National Crime Agency (NCA), the Internet Watch Foundation (IWF), and NCMEC's CyberTipline within 24 hours of identification. Evidence is preserved and provided to authorities.</li>
            <li><strong className="text-white">Terrorism and violent extremism</strong> — reported to Counter Terrorism Internet Referral Unit (CTIRU)</li>
            <li><strong className="text-white">Human trafficking</strong> — reported to the National Referral Mechanism (NRM) and relevant law enforcement</li>
            <li><strong className="text-white">Credible threats of violence</strong> — reported to police (999 or 101) and/or relevant agencies</li>
          </ul>
          <p className="mt-2">To report illegal content urgently, use the in-app report function or contact us directly at <a href="mailto:safety@REVdating.app" className="text-brand-orange">safety@REVdating.app</a>.</p>
          <p>If a child or any person is in <strong className="text-white">immediate danger</strong>, always call <strong className="text-white">999</strong> first. Do not wait for our response.</p>
        </Section>

        <Section title="6. Safety features">
          <p>REVdating provides built-in safety tools for every user:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-white">Selfie verification</strong> — optional photo verification helps confirm you're talking to the person in the photos</li>
            <li><strong className="text-white">Ride Check-In</strong> — set an expected return time before a ride or date. If you don't check in, your emergency contact is alerted</li>
            <li><strong className="text-white">Emergency contact</strong> — store a trusted contact within the app, used by the check-in system</li>
            <li><strong className="text-white">Hide exact location</strong> — only approximate distances are ever shown to other users; your precise coordinates are never shared</li>
            <li><strong className="text-white">Block and report</strong> — block any user instantly from their profile. Blocked users cannot see your profile or contact you</li>
          </ul>
          <p>All safety tools are available in <strong className="text-white">Settings → Safety Centre</strong>.</p>
        </Section>

        <Section title="7. Location data">
          <p>We collect your location to enable distance-based matching. Your precise GPS coordinates are stored securely server-side and are <strong className="text-white">never</strong> shared with other users. Other users see only an approximate distance (e.g., "within 10 miles").</p>
          <p>You can enable "Hide exact location" in your settings to prevent even your city name from being displayed to other users.</p>
        </Section>

        <Section title="8. Data protection and privacy">
          <p>All personal data collected by REVdating is processed in accordance with the UK GDPR. For full details of what data we collect, how we use it, and your rights, see our <Link href="/privacy" className="text-brand-orange">Privacy Policy</Link>.</p>
          <p>You have the right to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Download a copy of all your data (Settings → Download my data)</li>
            <li>Delete your account and all associated personal data (Settings → Delete account)</li>
            <li>Complain to the Information Commissioner's Office (ICO) at <a href="https://ico.org.uk" className="text-brand-orange" target="_blank" rel="noopener noreferrer">ico.org.uk</a></li>
          </ul>
        </Section>

        <Section title="9. Law enforcement co-operation">
          <p>REVdating will co-operate with law enforcement requests in accordance with applicable UK law. When we receive a lawful request (court order, police production order, etc.), we will:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Preserve the relevant data while the request is reviewed by our legal team</li>
            <li>Respond within any legally required timeframe</li>
            <li>Notify the affected user (unless prohibited from doing so by court order)</li>
          </ul>
          <p>Law enforcement can contact us at <a href="mailto:lawenforcement@REVdating.app" className="text-brand-orange">lawenforcement@REVdating.app</a>.</p>
        </Section>

        <Section title="10. Online Safety Act 2023">
          <p>REVdating operates as a "user-to-user" service under the UK Online Safety Act 2023. We are subject to the duties set out for providers of such services, including:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Risk assessment of illegal content and content harmful to adults</li>
            <li>Proportionate safety measures based on our risk assessment</li>
            <li>Clear and accessible user reporting mechanisms</li>
            <li>Transparency reporting (published annually)</li>
          </ul>
        </Section>

        <Section title="11. Contact us about safety">
          <p>Our Trust &amp; Safety team is available by email:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>General safety concerns: <a href="mailto:safety@REVdating.app" className="text-brand-orange">safety@REVdating.app</a></li>
            <li>Urgent/illegal content: <a href="mailto:safety@REVdating.app" className="text-brand-orange">safety@REVdating.app</a> (subject: URGENT)</li>
            <li>Law enforcement: <a href="mailto:lawenforcement@REVdating.app" className="text-brand-orange">lawenforcement@REVdating.app</a></li>
            <li>Data protection: <a href="mailto:dpo@REVdating.app" className="text-brand-orange">dpo@REVdating.app</a></li>
          </ul>
          <p>If someone is in <strong className="text-white">immediate danger</strong>, always call <strong className="text-white">999</strong> first.</p>
        </Section>

        <div className="text-brand-chrome text-sm border-t border-brand-dark-4 pt-6 flex flex-wrap gap-4">
          <Link href="/community-guidelines" className="text-brand-orange hover:underline">Community Guidelines</Link>
          <Link href="/privacy" className="text-brand-orange hover:underline">Privacy Policy</Link>
          <Link href="/terms" className="text-brand-orange hover:underline">Terms of Service</Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section className="space-y-3" id={id}>
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="text-brand-chrome space-y-2 leading-relaxed">{children}</div>
    </section>
  );
}
