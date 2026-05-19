import type { MetadataRoute } from 'next';
import { absoluteUrl, siteConfig } from '@/lib/seo/site';

const disallow = [
  '/admin/',
  '/api/',
  '/chat/',
  '/matches',
  '/likes',
  '/profile',
  '/profile/',
  '/settings/',
  '/onboarding',
  '/safety/checkin',
  '/ride-dates/',
  '/premium',
  '/verify-email',
  '/account-deleted',
  '/banned',
  '/offline',
];

// robots.txt helps crawlers avoid private areas, but it is not a security
// mechanism. Authentication, RLS, middleware, and API checks still protect data.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow,
    },
    sitemap: absoluteUrl('/sitemap.xml'),
    host: siteConfig.domain,
  };
}
