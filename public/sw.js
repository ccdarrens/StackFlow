const SCOPE_URL = new URL(self.registration.scope);
const INDEX_URL = new URL('index.html', SCOPE_URL).toString();
const CACHE_NAME = 'stackflow-shell-v3';
const APP_SHELL = [
  new URL('./', SCOPE_URL).toString(),
  INDEX_URL,
  new URL('manifest.webmanifest', SCOPE_URL).toString(),
  new URL('favicon.ico', SCOPE_URL).toString(),
  new URL('icons/icon-192.png', SCOPE_URL).toString(),
  new URL('icons/icon-512.png', SCOPE_URL).toString(),
  new URL('icons/icon-maskable-512.png', SCOPE_URL).toString(),
  new URL('icons/apple-touch-icon.png', SCOPE_URL).toString(),
  new URL('audio/cha-ching.mp3', SCOPE_URL).toString()
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(key => key !== CACHE_NAME)
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== SCOPE_URL.origin) {
    return;
  }

  if (!url.pathname.startsWith(SCOPE_URL.pathname)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(
              caches.open(CACHE_NAME).then(cache => cache.put(INDEX_URL, copy))
            );
          }
          return response;
        })
        .catch(() => caches.match(INDEX_URL))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(
              caches.open(CACHE_NAME).then(cache => cache.put(request, copy))
            );
          }
          return response;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
