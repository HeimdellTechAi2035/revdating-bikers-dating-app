import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact REVdating — Get in Touch',
  description:
    'Contact the REVdating team for support, safety reports, data requests, or general enquiries. We are a small UK team and we read every email.',
  alternates: { canonical: 'https://revdating.co.uk/contact' },
};

export default function ContactPage() {
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
              { '@type': 'ListItem', position: 2, name: 'Contact', item: 'https://revdating.co.uk/contact' },
            ],
          }),
        }}
      />

      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-red-400 hover:text-red-300 text-sm transition-colors">
          ← Back to REVdating
        </Link>

        <div className="mt-8 mb-12">
          <p className="text-red-500 text-sm font-bold uppercase tracking-widest mb-3">Get in touch</p>
          <h1 className="text-4xl md:text-5xl font-black mb-5 leading-tight">
            Contact REVdating
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed max-w-xl">
            We are a small, UK-based team and we read every email. Choose the right address
            below and we will get back to you as quickly as we can.
          </p>
        </div>

        {/* Contact cards */}
        <div className="space-y-4 mb-12">
          <ContactCard
            label="General enquiries"
            description="Questions about REVdating, feedback, partnerships, or press."
            email="hello@revdating.app"
            colour="border-red-600"
          />
          <ContactCard
            label="Safety &amp; reporting"
            description={
              <>
                Report a user, abusive content, or a safety concern. For urgent matters,
                write <strong>URGENT</strong> in the subject line — urgent reports are
                reviewed within 2 hours.
              </>
            }
            email="safety@revdating.app"
            colour="border-blue-500"
            urgent
          />
          <ContactCard
            label="Premium &amp; billing"
            description="Questions about your subscription, payments, or refunds."
            email="support@revdating.app"
            colour="border-yellow-400"
          />
          <ContactCard
            label="Data &amp; GDPR"
            description="Data access requests, account deletion requests, or questions about how we handle your personal data."
            email="dpo@revdating.app"
            colour="border-blue-500"
          />
          <ContactCard
            label="Legal"
            description="Legal enquiries, copyright claims, or law enforcement requests."
            email="legal@revdating.app"
            colour="border-zinc-500"
          />
        </div>

        {/* Response times */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 mb-10">
          <h2 className="font-black text-lg text-white mb-4">Response times</h2>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li className="flex items-start gap-3">
              <span className="text-red-500 font-bold flex-shrink-0 mt-0.5">Urgent safety</span>
              <span>— within 2 hours</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow-400 font-bold flex-shrink-0 mt-0.5">Support &amp; billing</span>
              <span>— within 1 working day</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-zinc-300 font-bold flex-shrink-0 mt-0.5">General enquiries</span>
              <span>— within 2 working days</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-zinc-300 font-bold flex-shrink-0 mt-0.5">GDPR requests</span>
              <span>— within 30 days as required by law (usually much sooner)</span>
            </li>
          </ul>
          <p className="text-zinc-600 text-xs mt-6">
            If someone is in immediate danger, always call <strong className="text-white">999</strong> first.
            Do not wait for our response.
          </p>
        </div>

        {/* Registered details */}
        <div className="border-t border-zinc-900 pt-8 text-xs text-zinc-600 leading-relaxed">
          <p className="font-bold text-zinc-500 mb-1">Registered office</p>
          <p>Heimdell Tech Ai Ltd, 11 Lower Croft, Preston, PR1 9DJ</p>
          <p className="mt-1">Registered in England &amp; Wales. Company No. 16478408. ICO Reg: ZC079121.</p>
        </div>

        {/* Quick links */}
        <div className="mt-10 flex flex-wrap gap-4 text-sm text-zinc-500">
          <Link href="/privacy"              className="hover:text-white transition-colors">Privacy Policy</Link>
          <Link href="/safety-policy"        className="hover:text-white transition-colors">Safety Policy</Link>
          <Link href="/community-guidelines" className="hover:text-white transition-colors">Community Guidelines</Link>
          <Link href="/delete-account"       className="hover:text-white transition-colors">Delete my account</Link>
        </div>
      </div>
    </div>
  );
}

/* ─── sub-component ─── */
function ContactCard({
  label,
  description,
  email,
  colour,
  urgent = false,
}: {
  label: string;
  description: React.ReactNode;
  email: string;
  colour: string;
  urgent?: boolean;
}) {
  return (
    <div className={`bg-zinc-900 border-l-4 ${colour} rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
      <div className="flex-1">
        <p className="font-black text-white text-base mb-1">
          {label}
          {urgent && (
            <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-red-600/20 text-red-400 border border-red-600/30 font-bold uppercase tracking-wide align-middle">
              Urgent
            </span>
          )}
        </p>
        <p className="text-zinc-400 text-sm leading-relaxed">{description}</p>
      </div>
      <a
        href={`mailto:${email}`}
        className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-bold transition-colors"
      >
        {email}
      </a>
    </div>
  );
}
