import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             'REVdating — Dating for Bikers',
    short_name:       'REVdating',
    description:      'Find your perfect riding companion. The dating app built exclusively for the biker community.',
    start_url:        '/',
    scope:            '/',
    display:          'standalone',
    orientation:      'portrait',
    theme_color:      '#FF6B00',
    background_color: '#0A0A0A',
    lang:             'en-GB',
    dir:              'ltr',
    categories:       ['lifestyle', 'social', 'dating'],
    prefer_related_applications: false,
    icons: [
      {
        src:     '/icons/icon-48x48.png',
        sizes:   '48x48',
        type:    'image/png',
        purpose: 'any',
      },
      {
        src:     '/icons/icon-72x72.png',
        sizes:   '72x72',
        type:    'image/png',
        purpose: 'any',
      },
      {
        src:     '/icons/icon-96x96.png',
        sizes:   '96x96',
        type:    'image/png',
        purpose: 'any',
      },
      {
        src:     '/icons/icon-128x128.png',
        sizes:   '128x128',
        type:    'image/png',
        purpose: 'any',
      },
      {
        src:     '/icons/icon-144x144.png',
        sizes:   '144x144',
        type:    'image/png',
        purpose: 'any',
      },
      {
        src:     '/icons/icon-152x152.png',
        sizes:   '152x152',
        type:    'image/png',
        purpose: 'any',
      },
      {
        src:     '/icons/icon-192x192.png',
        sizes:   '192x192',
        type:    'image/png',
        purpose: 'any',
      },
      {
        src:     '/icons/icon-384x384.png',
        sizes:   '384x384',
        type:    'image/png',
        purpose: 'any',
      },
      {
        src:     '/icons/icon-512x512.png',
        sizes:   '512x512',
        type:    'image/png',
        purpose: 'any',
      },
      // Maskable icons — required by Google Play for adaptive icons
      {
        src:     '/icons/icon-192x192-maskable.png',
        sizes:   '192x192',
        type:    'image/png',
        purpose: 'maskable',
      },
      {
        src:     '/icons/icon-512x512-maskable.png',
        sizes:   '512x512',
        type:    'image/png',
        purpose: 'maskable',
      },
    ],
    screenshots: [
      {
        src:          '/screenshots/discover.png',
        sizes:        '1080x1920',
        type:         'image/png',
        // @ts-expect-error — form_factor is valid but not yet in TS types
        form_factor:  'narrow',
        label:        'Discover riders near you',
      },
      {
        src:          '/screenshots/profile.png',
        sizes:        '1080x1920',
        type:         'image/png',
        // @ts-expect-error
        form_factor:  'narrow',
        label:        'Your biker profile',
      },
    ],
    shortcuts: [
      {
        name:      'Discover',
        short_name:'Discover',
        url:       '/discover',
        icons:     [{ src: '/icons/icon-96x96.png', sizes: '96x96' }],
      },
      {
        name:      'Messages',
        short_name:'Messages',
        url:       '/messages',
        icons:     [{ src: '/icons/icon-96x96.png', sizes: '96x96' }],
      },
    ],
  };
}
