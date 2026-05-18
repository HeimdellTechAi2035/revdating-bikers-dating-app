import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url:             'https://revdating.co.uk',
      lastModified:    new Date(),
      changeFrequency: 'weekly',
      priority:        1,
    },
    {
      url:             'https://revdating.co.uk/register',
      lastModified:    new Date(),
      changeFrequency: 'monthly',
      priority:        0.6,
    },
    {
      url:             'https://revdating.co.uk/privacy',
      lastModified:    new Date(),
      changeFrequency: 'yearly',
      priority:        0.3,
    },
    {
      url:             'https://revdating.co.uk/terms',
      lastModified:    new Date(),
      changeFrequency: 'yearly',
      priority:        0.3,
    },
    {
      url:             'https://revdating.co.uk/community-guidelines',
      lastModified:    new Date(),
      changeFrequency: 'yearly',
      priority:        0.3,
    },
    {
      url:             'https://revdating.co.uk/safety-policy',
      lastModified:    new Date(),
      changeFrequency: 'yearly',
      priority:        0.3,
    },
    {
      url:             'https://revdating.co.uk/cookies',
      lastModified:    new Date(),
      changeFrequency: 'yearly',
      priority:        0.2,
    },
    {
      url:             'https://revdating.co.uk/contact',
      lastModified:    new Date(),
      changeFrequency: 'yearly',
      priority:        0.4,
    },
    {
      url:             'https://revdating.co.uk/delete-account',
      lastModified:    new Date(),
      changeFrequency: 'yearly',
      priority:        0.4,
    },
    {
      url:             'https://revdating.co.uk/install',
      lastModified:    new Date(),
      changeFrequency: 'yearly',
      priority:        0.5,
    },
  ];
}
