import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Install REVdating — Add to Your Phone (No App Store Needed)',
  description:
    'How to install the REVdating biker dating app on your iPhone or Android phone. No App Store or Google Play required — works on any browser.',
  alternates: { canonical: 'https://revdating.co.uk/install' },
};

export default function InstallPage() {
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
              { '@type': 'ListItem', position: 2, name: 'Install the app', item: 'https://revdating.co.uk/install' },
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
            name: 'How to install REVdating on your phone',
            description:
              'Step-by-step guide to install the REVdating biker dating app on iPhone or Android without using the App Store or Google Play.',
            tool: [{ '@type': 'HowToTool', name: 'Safari (iPhone) or Chrome (Android)' }],
            step: [
              {
                '@type': 'HowToSection',
                name: 'Install on iPhone using Safari',
                itemListElement: [
                  { '@type': 'HowToStep', position: 1, name: 'Open revdating.co.uk in Safari', text: 'Open Safari on your iPhone and navigate to revdating.co.uk.' },
                  { '@type': 'HowToStep', position: 2, name: 'Tap the Share button', text: 'Tap the Share icon — the box with an arrow pointing up — at the bottom of the screen.' },
                  { '@type': 'HowToStep', position: 3, name: 'Tap Add to Home Screen', text: 'Scroll down in the Share sheet and tap "Add to Home Screen".' },
                  { '@type': 'HowToStep', position: 4, name: 'Tap Add', text: 'Tap Add in the top right corner. REVdating now appears on your home screen like a native app.' },
                ],
              },
              {
                '@type': 'HowToSection',
                name: 'Install on Android using Chrome',
                itemListElement: [
                  { '@type': 'HowToStep', position: 1, name: 'Open revdating.co.uk in Chrome', text: 'Open Chrome on your Android phone and navigate to revdating.co.uk.' },
                  { '@type': 'HowToStep', position: 2, name: 'Tap the three-dot menu', text: 'Tap the three-dot menu icon in the top right corner of Chrome.' },
                  { '@type': 'HowToStep', position: 3, name: 'Tap Add to Home screen', text: 'Tap "Add to Home screen" or "Install app" from the menu.' },
                  { '@type': 'HowToStep', position: 4, name: 'Tap Add', text: 'Tap Add to confirm. REVdating now appears on your home screen like a native app.' },
                ],
              },
            ],
          }),
        }}
      />

      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-red-400 hover:text-red-300 text-sm transition-colors">
          ← Back to REVdating
        </Link>

        <div className="mt-8 mb-12">
          <p className="text-yellow-400 text-sm font-bold uppercase tracking-widest mb-3">No App Store needed</p>
          <h1 className="text-4xl md:text-5xl font-black mb-5 leading-tight">
            Install REVdating<br />on your phone
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed max-w-xl">
            REVdating is a Progressive Web App (PWA). That means it works directly in your
            browser and can be installed on your phone&apos;s home screen — no App Store,
            no Google Play, no waiting for approval.
          </p>
        </div>

        {/* iPhone */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 text-xl">

            </div>
            <h2 className="font-black text-xl text-white">iPhone — Safari</h2>
          </div>
          <ol className="space-y-5">
            {[
              { n: 1, title: 'Open revdating.co.uk in Safari', body: 'Make sure you are using Safari — it must be Safari for "Add to Home Screen" to appear. Chrome on iPhone does not support this yet.' },
              { n: 2, title: 'Tap the Share button', body: 'Tap the Share icon at the bottom of the screen — it looks like a box with an arrow pointing upwards.' },
              { n: 3, title: 'Scroll down and tap "Add to Home Screen"', body: 'In the Share sheet that slides up, scroll down until you see "Add to Home Screen" and tap it.' },
              { n: 4, title: 'Tap Add', body: 'Tap "Add" in the top right. REVdating will appear on your iPhone home screen exactly like a native app.' },
            ].map(({ n, title, body }) => (
              <li key={n} className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-sm flex-shrink-0 mt-0.5">
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

        {/* Android */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-green-500/15 border border-green-500/30 flex items-center justify-center text-green-400 text-xl">
              A
            </div>
            <h2 className="font-black text-xl text-white">Android — Chrome</h2>
          </div>
          <ol className="space-y-5">
            {[
              { n: 1, title: 'Open revdating.co.uk in Chrome', body: 'Open Google Chrome on your Android phone and go to revdating.co.uk.' },
              { n: 2, title: 'Tap the three-dot menu', body: 'Tap the three vertical dots (⋮) in the top right corner of Chrome.' },
              { n: 3, title: 'Tap "Add to Home screen" or "Install app"', body: 'You may see either option depending on your version of Chrome. Tap whichever appears.' },
              { n: 4, title: 'Tap Add', body: 'Confirm by tapping Add. REVdating will appear on your Android home screen like a native app.' },
            ].map(({ n, title, body }) => (
              <li key={n} className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-black text-sm flex-shrink-0 mt-0.5">
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

        {/* What you get */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-7 mb-10">
          <h2 className="font-black text-lg text-white mb-4">What you get once installed</h2>
          <ul className="grid sm:grid-cols-2 gap-3 text-sm text-zinc-400">
            {[
              'Full-screen — no browser address bar',
              'Stays signed in automatically',
              'Real-time match and message notifications',
              'Works on any phone, tablet, or laptop',
              'No App Store account required',
              'Always up to date — no manual updates',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-green-400 font-bold mt-0.5 flex-shrink-0">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="text-center">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-red-600 hover:bg-red-700 text-white font-black text-lg transition-all hover:scale-105 shadow-[0_0_40px_rgba(220,38,38,0.4)]"
          >
            Create your free account →
          </Link>
          <p className="text-zinc-600 text-sm mt-4">Free to join. No credit card needed.</p>
        </div>
      </div>
    </div>
  );
}
