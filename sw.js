const CACHE_NAME = 'copio-cache-v22'; // bump this on every deploy

// --------------------------------------------------------
// install: fetch files-to-cache.json & cache all listed files
// --------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    fetch('/files-to-cache.json')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch files-to-cache.json');
        }
        return response.json();
      })
      .then((files) =>
        caches.open(CACHE_NAME).then((cache) => cache.addAll(files)),
      )
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.error('Service Worker install failed:', err);
        throw err; // re-throw so the SW install is properly rejected (not silently broken)
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
// fetch: cache-first with runtime caching for on-demand assets
// --------------------------------------------------------
self.addEventListener('fetch', (event) => {
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        });
      }),
    );
  }
});
