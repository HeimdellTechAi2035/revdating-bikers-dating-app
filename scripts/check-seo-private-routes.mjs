import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sitemapSource = readFileSync(join(root, 'src/app/sitemap.ts'), 'utf8');

const privatePatterns = [
  '/admin',
  '/api',
  '/chat',
  '/profile/',
  '/settings',
  '/matches',
  '/likes',
  '/ride-dates',
];

const routeArrayMatch = sitemapSource.match(/const publicRoutes = \[([\s\S]*?)\] as const/);
if (!routeArrayMatch) {
  console.error('Could not find the explicit publicRoutes array in src/app/sitemap.ts');
  process.exit(1);
}

const leakedPatterns = privatePatterns.filter((pattern) => routeArrayMatch[1].includes(`path: '${pattern}`));

if (leakedPatterns.length > 0) {
  console.error(`Private route patterns found in sitemap publicRoutes: ${leakedPatterns.join(', ')}`);
  process.exit(1);
}

console.log('SEO private route guard passed: sitemap publicRoutes only contains approved public URLs.');
