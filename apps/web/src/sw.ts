/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision?: string }>;
};

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// App shell navigation fallback.
registerRoute(({ request }) => request.mode === 'navigate', createHandlerBoundToURL('index.html'));

// Uploaded media (avatars / voice): cache-first with background refresh.
registerRoute(
  ({ url }) => url.pathname.startsWith('/uploads/'),
  async ({ request }) => {
    const cache = await caches.open('uploads-cache');
    const cached = await cache.match(request);
    if (cached) {
      void fetch(request)
        .then((res) => {
          if (res.ok) void cache.put(request, res.clone());
        })
        .catch(() => {});
      return cached;
    }
    const res = await fetch(request);
    if (res.ok) void cache.put(request, res.clone());
    return res;
  },
  'GET',
);

/* ------------------------------------------------------------------ */
/* Web Push                                                            */
/* ------------------------------------------------------------------ */

interface PushPayload {
  title: string;
  body: string;
}

self.addEventListener('push', (event) => {
  let payload: PushPayload = { title: 'TianshangChat', body: '新消息' };
  try {
    if (event.data) payload = event.data.json() as PushPayload;
  } catch {
    /* keep defaults */
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      tag: 'tsc-msg',
      renotify: true,
    } as NotificationOptions & { renotify?: boolean }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow('/');
    }),
  );
});
