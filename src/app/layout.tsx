import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';
import CookieBanner from '@/components/compliance/CookieBanner';
import AnalyticsProvider from '@/components/analytics/AnalyticsProvider';
import DisableDevTools from '@/components/security/DisableDevTools';
import InstallPrompt from '@/components/pwa/InstallPrompt';
import './globals.css';

export const viewport: Viewport = {
  themeColor:          '#FF6B00',
  width:               'device-width',
  initialScale:        1,
  maximumScale:        5,
  userScalable:        true,
  viewportFit:         'cover',   // safe-area insets for notched phones
};

export const metadata: Metadata = {
  title: {
    default: 'REVdating — Biker Dating App for UK Motorcycle Riders',
    template: '%s | REVdating',
  },
  description:
    'REVdating is the UK biker dating app for motorcycle riders. Match with bikers near you, chat in real time, and find someone who loves the ride as much as you do. Free to join.',
  keywords: [
    'biker dating app',
    'biker dating UK',
    'motorcycle dating app',
    'motorcycle dating UK',
    'dating app for bikers',
    'biker singles UK',
    'motorcycle singles UK',
    'biker dating site',
    'meet bikers UK',
    'biker community dating',
    'REVdating',
  ],
  authors: [{ name: 'REVdating' }],
  creator: 'REVdating',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://revdating.co.uk'),
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: process.env.NEXT_PUBLIC_APP_URL ?? 'https://revdating.co.uk',
    title: 'REVdating — Biker Dating App for UK Motorcycle Riders',
    description: 'The UK dating app built exclusively for bikers. Match with motorcycle riders near you, chat in real time, and find someone who truly gets the ride.',
    siteName: 'REVdating',
    // opengraph-image.tsx in this directory auto-generates the og:image tag
  },
  twitter: {
    card: 'summary_large_image',
    title: 'REVdating — Biker Dating App for UK Motorcycle Riders',
    description: 'The UK dating app built exclusively for bikers. Match with motorcycle riders near you, chat in real time, and find someone who truly gets the ride.',
    // opengraph-image.tsx also covers the twitter:image tag automatically
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  // PWA / app install metadata
  applicationName: 'REVdating',
  appleWebApp: {
    capable: true,
    title: 'REVdating',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
  other: {
    // Android TWA chrome-origin-trial (optional, for enhanced TWA features)
    'mobile-web-app-capable': 'yes',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <head>
        {/* Favicon served automatically by src/app/icon.tsx */}
        {/* Apple PWA icons */}
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        {/* UK geo-targeting */}
        <link rel="alternate" hrefLang="en-GB" href="https://revdating.co.uk/" />
        {/* Structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'Organization',
                  '@id': 'https://revdating.co.uk/#organization',
                  name: 'REVdating',
                  legalName: 'Heimdell Tech Ai Ltd',
                  url: 'https://revdating.co.uk',
                  logo: {
                    '@type': 'ImageObject',
                    '@id': 'https://revdating.co.uk/#logo',
                    url: 'https://revdating.co.uk/icons/icon-512x512.png',
                    contentUrl: 'https://revdating.co.uk/icons/icon-512x512.png',
                    width: 512,
                    height: 512,
                    caption: 'REVdating',
                  },
                  description:
                    'REVdating is the UK dedicated biker dating app, built exclusively for motorcycle riders and biker singles across the United Kingdom. Operated by Heimdell Tech Ai Ltd, registered in England and Wales (Company No. 16478408).',
                  address: {
                    '@type': 'PostalAddress',
                    streetAddress: '11 Lower Croft',
                    addressLocality: 'Preston',
                    postalCode: 'PR1 9DJ',
                    addressCountry: 'GB',
                  },
                  email: 'legal@revdating.app',
                  contactPoint: {
                    '@type': 'ContactPoint',
                    contactType: 'customer support',
                    email: 'safety@revdating.app',
                    availableLanguage: 'en-GB',
                  },
                  foundingLocation: { '@type': 'Country', name: 'United Kingdom' },
                  areaServed: { '@type': 'Country', name: 'United Kingdom' },
                  knowsLanguage: 'en-GB',
                  sameAs: [
                    'https://www.facebook.com/profile.php?id=61579858422337',
                    'https://www.linkedin.com/in/andrew-j-72b96a312/',
                  ],
                },
                {
                  '@type': 'WebSite',
                  '@id': 'https://revdating.co.uk/#website',
                  name: 'REVdating',
                  url: 'https://revdating.co.uk',
                  description: 'The UK biker dating app built exclusively for motorcycle riders.',
                  inLanguage: 'en-GB',
                  publisher:       { '@id': 'https://revdating.co.uk/#organization' },
                  copyrightHolder: { '@id': 'https://revdating.co.uk/#organization' },
                },
                {
                  '@type': 'SoftwareApplication',
                  '@id': 'https://revdating.co.uk/#app',
                  name: 'REVdating',
                  description:
                    'REVdating is the UK biker dating app built exclusively for motorcycle riders. Match with real bikers near you, chat in real time, and find love on two wheels. Free to join — no App Store download required.',
                  url: 'https://revdating.co.uk',
                  applicationCategory: 'SocialApplication',
                  applicationSubCategory: 'DatingApplication',
                  operatingSystem: 'Any — works in any browser (Progressive Web App)',
                  inLanguage: 'en-GB',
                  countriesSupported: 'GB',
                  availableOnDevice: ['Desktop', 'Mobile', 'Tablet'],
                  dateModified: '2026-05-17',
                  featureList: [
                    'Biker profile with bike type, riding style, photos, and location',
                    'Location-based matching for UK motorcycle riders',
                    'Rev It super-like to signal serious interest',
                    'Mutual matching — message only people who matched you',
                    'Real-time chat between matched riders',
                    'Photo moderation to remove fake or inappropriate images',
                    'Report and block controls reviewed by a human moderation team',
                    'Premium subscription with profile boost and extra Rev It credits',
                    'Progressive Web App — no App Store download required',
                  ],
                  offers: [
                    {
                      '@type': 'Offer',
                      name: 'Free',
                      price: '0',
                      priceCurrency: 'GBP',
                      availability: 'https://schema.org/InStock',
                      url: 'https://revdating.co.uk/register',
                    },
                  ],
                  publisher: { '@id': 'https://revdating.co.uk/#organization' },
                  creator:   { '@id': 'https://revdating.co.uk/#organization' },
                },
              ],
            }),
          }}
        />
        {/* Splash screens — iOS adds to home screen */}
        <link rel="apple-touch-startup-image" href="/icons/icon-512x512.png" />
        {/* Tile colour for Windows / Android */}
        <meta name="msapplication-TileColor" content="#FF6B00" />
        <meta name="msapplication-TileImage" content="/icons/icon-144x144.png" />
      </head>
      <body className="bg-brand-dark text-white antialiased min-h-screen">
        {children}
        <DisableDevTools />
        <InstallPrompt />
        <CookieBanner />
        <AnalyticsProvider />
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#1E1E1E',
              color: '#FFFFFF',
              border: '1px solid #2A2A2A',
              borderRadius: '12px',
            },
            success: {
              iconTheme: { primary: '#FF6B00', secondary: '#FFFFFF' },
            },
            error: {
              iconTheme: { primary: '#EF4444', secondary: '#FFFFFF' },
            },
          }}
        />
      </body>
    </html>
  );
}
