import type { Metadata } from 'next';
import RegisterPageClient from './pageClient';
import { absoluteUrl, siteConfig } from '@/lib/seo/site';

const description = 'Join REVdating, a UK biker dating app for motorcyclists who want real connections, safer conversations, and rider-friendly matches.';

export const metadata: Metadata = {
  title: 'Create an account',
  description,
  alternates: { canonical: absoluteUrl('/register') },
  openGraph: {
    title: `Create an account | ${siteConfig.siteName}`,
    description,
    url: absoluteUrl('/register'),
    siteName: siteConfig.siteName,
    locale: siteConfig.locale,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Create an account | ${siteConfig.siteName}`,
    description,
  },
  robots: { index: true, follow: true },
};

export default RegisterPageClient;
