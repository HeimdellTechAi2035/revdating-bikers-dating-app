import type { Metadata } from 'next';
import ResetPasswordPageClient from './pageClient';
import { absoluteUrl, siteConfig } from '@/lib/seo/site';

const description = 'Choose a new REVdating password and keep your rider dating account secure.';

export const metadata: Metadata = {
  title: 'Reset password',
  description,
  alternates: { canonical: absoluteUrl('/reset-password') },
  openGraph: {
    title: `Reset password | ${siteConfig.siteName}`,
    description,
    url: absoluteUrl('/reset-password'),
    siteName: siteConfig.siteName,
    locale: siteConfig.locale,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Reset password | ${siteConfig.siteName}`,
    description,
  },
  robots: { index: true, follow: true, noarchive: true },
};

export default ResetPasswordPageClient;
