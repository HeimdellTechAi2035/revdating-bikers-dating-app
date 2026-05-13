// Service worker: handle push notifications and notification clicks.
// This file is compiled by @ducanh2912/next-pwa and merged into the
// Workbox service worker bundle.

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    return;
  }

  const title = data.title || 'REVdating';
  const options = {
    body: data.body || '',
    tag: data.tag || 'general',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data: { url: data.url || '/' },
    // vibrate and actions are not supported on iOS — safe to omit
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus an existing window and navigate it to the target URL
        if (clientList.length > 0) {
          const client = clientList[0];
          if ('navigate' in client) {
            return client.navigate(url).then((c) => c && c.focus());
          }
          return client.focus();
        }
        // No open window — open a new one
        return self.clients.openWindow(url);
      }),
  );
});
