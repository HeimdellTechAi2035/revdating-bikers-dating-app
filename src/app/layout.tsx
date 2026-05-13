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
  maximumScale:        1,
  userScalable:        false,
  viewportFit:         'cover',   // safe-area insets for notched phones
};

export const metadata: Metadata = {
  title: {
    default: 'REVdating — Dating for Bikers',
    template: '%s | REVdating',
  },
  description:
    'Find your perfect riding companion. REVdating is the dating app built exclusively for the biker community.',
  keywords: ['biker dating', 'motorcycle dating', 'biker singles', 'REVdating'],
  authors: [{ name: 'REVdating' }],
  creator: 'REVdating',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: process.env.NEXT_PUBLIC_APP_URL,
    title: 'REVdating — Dating for Bikers',
    description: 'Find your perfect riding companion.',
    siteName: 'REVdating',
    // opengraph-image.tsx in this directory auto-generates the og:image tag
  },
  twitter: {
    card: 'summary_large_image',
    title: 'REVdating — Dating for Bikers',
    description: 'Find your perfect riding companion.',
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
    <html lang="en">
      <head>
        {/* Favicon served automatically by src/app/icon.tsx */}
        {/* Apple PWA icons */}
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
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
