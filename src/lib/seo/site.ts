export const siteConfig = {
  siteName: 'REVdating',
  domain: 'https://revdating.co.uk',
  defaultTitle: 'REVdating — Dating for Bikers',
  titleTemplate: '%s | REVdating',
  defaultDescription:
    'A UK biker dating app built for riders who want real connections, safer conversations, and biker-friendly matches.',
  locale: 'en_GB',
  language: 'en-GB',
  country: 'GB',
  brandName: 'REVdating',
  socialImagePath: '/opengraph-image',
} as const;

export function absoluteUrl(path = '/') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalizedPath, siteConfig.domain).toString();
}
