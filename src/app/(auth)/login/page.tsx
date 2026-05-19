import type { Metadata } from 'next';
import LoginPageClient from './pageClient';
import { absoluteUrl, siteConfig } from '@/lib/seo/site';

const description = 'Sign in to REVdating, the UK biker dating app for riders looking for safer conversations and biker-friendly matches.';

export const metadata: Metadata = {
  title: 'Sign in',
  description,
  alternates: { canonical: absoluteUrl('/login') },
  openGraph: {
    title: `Sign in | ${siteConfig.siteName}`,
    description,
    url: absoluteUrl('/login'),
    siteName: siteConfig.siteName,
    locale: siteConfig.locale,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Sign in | ${siteConfig.siteName}`,
    description,
  },
  robots: { index: true, follow: true },
};

export default LoginPageClient;
