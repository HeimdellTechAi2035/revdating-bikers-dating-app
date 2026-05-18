import Link from 'next/link';

export const metadata = {
  title: 'Community Guidelines — REVdating',
  description: 'The rules and standards that keep REVdating a safe, welcoming community for bikers.',
  alternates: { canonical: 'https://revdating.co.uk/community-guidelines' },
};

const LAST_UPDATED = '27 April 2026';

export default function CommunityGuidelinesPage() {
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
              { '@type': 'ListItem', position: 2, name: 'Community Guidelines', item: 'https://revdating.co.uk/community-guidelines' },
            ],
          }),
        }}
      />
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <Link href="/" className="text-brand-orange hover:underline text-sm">← Back to REVdating</Link>
          <h1 className="text-3xl font-black mt-4">Community Guidelines</h1>
          <p className="text-brand-chrome text-sm mt-1">Last updated: {LAST_UPDATED}</p>
          <p className="text-brand-chrome mt-3 leading-relaxed">
            REVdating exists to connect genuine motorcycle enthusiasts in a safe, respectful space. These guidelines apply to every user — whether you ride a cruiser, a sportbike, or an electric. Violations may result in a warning, temporary suspension, or permanent ban.
          </p>
        </div>

        <Section title="1. Be who you say you are">
          <p>Use real photos of yourself. Your primary photo must be a clear, recent image of your face. Do not use photos of vehicles, pets, celebrities, or other people as your profile picture.</p>
          <p>Provide accurate information about yourself, your age, and your motorcycle experience. Creating a fake or misleading profile — including using someone else's identity — is grounds for immediate permanent ban.</p>
          <p>You must be at least <strong className="text-white">18 years old</strong> to use REVdating. Accounts found to belong to minors will be terminated immediately and referred to relevant authorities.</p>
        </Section>

        <Section title="2. Treat everyone with respect">
          <p>Every rider on REVdating deserves to be treated with basic human dignity. We do not tolerate:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Harassment, abuse, or threatening language — in messages, profiles, or anywhere on the platform</li>
            <li>Hate speech based on race, ethnicity, religion, gender, sexual orientation, disability, nationality, or any other protected characteristic</li>
            <li>Body shaming, slut-shaming, or any content designed to humiliate another person</li>
            <li>Persistent unwanted contact after someone asks you to stop</li>
            <li>Sharing someone else's private photos or personal information without their consent ("doxxing")</li>
          </ul>
        </Section>

        <Section title="3. Keep it appropriate">
          <p>REVdating is a dating and social app, not an adult content platform. The following are prohibited:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Nudity or sexually explicit photos in profile pictures or public areas of the app</li>
            <li>Solicitation of sexual services or any content that could constitute sex work advertising</li>
            <li>Graphic violence, gore, or disturbing imagery</li>
            <li>Content that glorifies or promotes self-harm or suicide</li>
          </ul>
          <p>All photos are reviewed by automated moderation and our human trust and safety team. Violating content is removed without notice.</p>
        </Section>

        <Section title="4. No spam or commercial activity">
          <p>REVdating is for genuine personal connections. The following commercial activities are not allowed:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Promoting products, services, websites, or social media accounts</li>
            <li>Sending copy-paste or scripted messages to multiple users</li>
            <li>Soliciting money, gifts, or financial transactions of any kind</li>
            <li>Using automated bots or scripts to interact with the platform or other users</li>
            <li>Running escort, companion, or webcam services</li>
          </ul>
        </Section>

        <Section title="5. Biker community values">
          <p>REVdating is built on the culture of motorcycling — respect for the road, for machines, and for fellow riders. We expect members to embody the spirit of the biker community:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Honesty about your riding experience — don't claim to be an experienced rider if you're not</li>
            <li>Respect for all types of bikes — no gatekeeping about what constitutes a "real" motorcycle</li>
            <li>Safety first — do not encourage dangerous riding behaviour, stunts on public roads, or riding under the influence</li>
            <li>Inclusion — REVdating welcomes all genders, sexualities, and backgrounds within the biker community</li>
          </ul>
        </Section>

        <Section title="6. Protect yourself and others">
          <p>When meeting someone from REVdating in person for the first time:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Always meet in a public place</li>
            <li>Tell a friend or family member where you're going and who you're meeting</li>
            <li>Use our Ride Check-in feature to share your expected return time with an emergency contact</li>
            <li>Do not share your home address, workplace, or financial details with someone you have just met</li>
            <li>Trust your instincts — if something feels wrong, leave</li>
          </ul>
          <p>If a rider you met through REVdating has made you feel unsafe, use the in-app Report button or contact us at <a href="mailto:safety@REVdating.app" className="text-brand-orange">safety@REVdating.app</a>.</p>
        </Section>

        <Section title="7. Report what you see">
          <p>If you encounter content or behaviour that violates these guidelines, please report it. We rely on our community to help keep REVdating safe.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Use the <strong className="text-white">…</strong> menu on any profile or message to report or block a user</li>
            <li>For potentially illegal content (e.g., child sexual abuse material, terrorism), use our <Link href="/safety-policy#illegal-content" className="text-brand-orange">urgent illegal content report</Link> pathway</li>
            <li>All reports are confidential</li>
          </ul>
          <p>False or malicious reports that abuse the reporting system are themselves a violation of these guidelines.</p>
        </Section>

        <Section title="8. Consequences of violations">
          <p>We enforce these guidelines using a combination of automated detection and human review. Depending on the severity and history of violations:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-white">Warning</strong> — for minor or first-time breaches</li>
            <li><strong className="text-white">Feature restriction</strong> — temporary limits on messaging or matching</li>
            <li><strong className="text-white">Temporary suspension</strong> — usually 1–30 days</li>
            <li><strong className="text-white">Permanent ban</strong> — for serious or repeated violations</li>
            <li><strong className="text-white">Law enforcement referral</strong> — for illegal content or credible threats of violence</li>
          </ul>
          <p>If your account has been actioned and you believe this was a mistake, contact us at <a href="mailto:appeals@REVdating.app" className="text-brand-orange">appeals@REVdating.app</a>. We aim to review appeals within 5 working days.</p>
        </Section>

        <Section title="9. Keeping guidelines up to date">
          <p>We review and update these guidelines as the platform grows and as best practices evolve. Material changes will be communicated via email or in-app notification at least 30 days before they take effect.</p>
          <p>Continued use of REVdating after the effective date constitutes acceptance of the updated guidelines.</p>
        </Section>

        <div className="bg-brand-dark-3 border border-brand-dark-4 rounded-2xl p-5 space-y-1">
          <p className="font-semibold">Questions or concerns?</p>
          <p className="text-brand-chrome text-sm">Trust &amp; Safety team: <a href="mailto:safety@REVdating.app" className="text-brand-orange">safety@REVdating.app</a></p>
          <p className="text-brand-chrome text-sm">Appeals: <a href="mailto:appeals@REVdating.app" className="text-brand-orange">appeals@REVdating.app</a></p>
          <p className="text-brand-chrome text-sm">Legal: <a href="mailto:legal@REVdating.app" className="text-brand-orange">legal@REVdating.app</a></p>
        </div>

        <div className="text-brand-chrome text-sm border-t border-brand-dark-4 pt-6 flex flex-wrap gap-4">
          <Link href="/terms" className="text-brand-orange hover:underline">Terms of Service</Link>
          <Link href="/privacy" className="text-brand-orange hover:underline">Privacy Policy</Link>
          <Link href="/safety-policy" className="text-brand-orange hover:underline">Safety Policy</Link>
          <Link href="/cookies" className="text-brand-orange hover:underline">Cookie Policy</Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="text-brand-chrome space-y-2 leading-relaxed">{children}</div>
    </section>
  );
}
