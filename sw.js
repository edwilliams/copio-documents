const CACHE_NAME = 'copio-cache-v25'; // bump this on every deploy

// --------------------------------------------------------
// install: fetch files-to-cache.json & cache all listed files
// --------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    fetch('/files-to-cache.json', { cache: 'no-cache' })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch files-to-cache.json');
        }
        return response.json();
      })
      .then(async (files) => {
        const cache = await caches.open(CACHE_NAME);
        await Promise.allSettled(
          files.map(async (file) => {
            try {
              const res = await fetch(file, { cache: 'no-cache' });
              if (res.ok) {
                await cache.put(file, res);
              }
            } catch (err) {
              console.warn(`[SW] Precache fetch error for ${file}:`, err);
            }
          }),
        );
      })
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('Service Worker install notice:', err);
      }),
  );
});

// --------------------------------------------------------
// activate: delete any caches from old versions
// --------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// --------------------------------------------------------
// fetch: cache-first with graceful offline fallback
// --------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle GET requests originating from same origin
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Bypass Netlify internal scripts and telemetry (e.g. /.netlify/scripts/cdp)
  if (url.pathname.startsWith('/.netlify/')) {
    return;
  }

  // Handle SPA navigation requests (fallback to cached index.html when offline)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true })
        .then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return caches.match('/index.html')
            .then((cachedIndex) => cachedIndex || caches.match('/'));
        })
        .then((response) => {
          if (response) return response;
          return fetch(event.request).catch(() =>
            caches.match('/index.html').then((cached) => cached || caches.match('/')),
          );
        }),
    );
    return;
  }

  // Cache-first strategy for static assets with safe offline catch
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Graceful fallback for offline: prevent unhandled promise rejection
          return new Response('', { status: 408, statusText: 'Offline' });
        });
    }),
  );
});
