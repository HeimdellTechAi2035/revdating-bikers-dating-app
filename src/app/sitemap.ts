import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo/site';

const lastModified = new Date('2026-05-15T00:00:00.000Z');

const publicRoutes = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/login', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/register', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/forgot-password', changeFrequency: 'yearly', priority: 0.2 },
  { path: '/reset-password', changeFrequency: 'yearly', priority: 0.2 },
  { path: '/privacy', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/terms', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/cookies', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/community-guidelines', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/safety-policy', changeFrequency: 'monthly', priority: 0.5 },
] as const satisfies ReadonlyArray<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
}>;

// Keep this sitemap intentionally explicit: never add authenticated routes,
// API routes, dynamic user profiles, private media URLs, or admin pages here.
export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
