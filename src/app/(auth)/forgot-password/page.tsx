import type { Metadata } from 'next';
import ForgotPasswordPageClient from './pageClient';
import { absoluteUrl, siteConfig } from '@/lib/seo/site';

const description = 'Reset access to your REVdating account safely.';

export const metadata: Metadata = {
  title: 'Forgot password',
  description,
  alternates: { canonical: absoluteUrl('/forgot-password') },
  openGraph: {
    title: `Forgot password | ${siteConfig.siteName}`,
    description,
    url: absoluteUrl('/forgot-password'),
    siteName: siteConfig.siteName,
    locale: siteConfig.locale,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Forgot password | ${siteConfig.siteName}`,
    description,
  },
  robots: { index: true, follow: true },
};

export default ForgotPasswordPageClient;
