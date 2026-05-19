import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';
import CookieBanner from '@/components/compliance/CookieBanner';
import AnalyticsProvider from '@/components/analytics/AnalyticsProvider';
import DisableDevTools from '@/components/security/DisableDevTools';
import InstallPrompt from '@/components/pwa/InstallPrompt';
import { absoluteUrl, siteConfig } from '@/lib/seo/site';
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
  metadataBase: new URL(siteConfig.domain),
  title: {
    default: siteConfig.defaultTitle,
    template: siteConfig.titleTemplate,
  },
  description: siteConfig.defaultDescription,
  keywords: [
    'UK biker dating',
    'biker dating',
    'motorcycle dating',
    'motorcyclist dating app',
    'biker singles',
    'REVdating',
  ],
  authors: [{ name: siteConfig.brandName }],
  creator: siteConfig.brandName,
  publisher: siteConfig.brandName,
  alternates: {
    canonical: siteConfig.domain,
  },
  openGraph: {
    type: 'website',
    locale: siteConfig.locale,
    url: siteConfig.domain,
    title: siteConfig.defaultTitle,
    description: siteConfig.defaultDescription,
    siteName: siteConfig.siteName,
    images: [
      {
        url: absoluteUrl(siteConfig.socialImagePath),
        width: 1200,
        height: 630,
        alt: 'REVdating — Dating for Bikers',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteConfig.defaultTitle,
    description: siteConfig.defaultDescription,
    images: [absoluteUrl(siteConfig.socialImagePath)],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  // PWA / app install metadata
  applicationName: siteConfig.siteName,
  appleWebApp: {
    capable: true,
    title: siteConfig.siteName,
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
