const BASE_PATH = '/StackFlow';
const INDEX_URL = `${BASE_PATH}/index.html`;
const CACHE_NAME = 'stackflow-shell-v2';
const APP_SHELL = [
  `${BASE_PATH}/`,
  INDEX_URL,
  `${BASE_PATH}/manifest.webmanifest`,
  `${BASE_PATH}/favicon.ico`,
  `${BASE_PATH}/icons/icon-192.png`,
  `${BASE_PATH}/icons/icon-512.png`,
  `${BASE_PATH}/icons/icon-maskable-512.png`,
  `${BASE_PATH}/icons/apple-touch-icon.png`,
  `${BASE_PATH}/audio/cha-ching.mp3`
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
  if (url.origin !== self.location.origin) {
    return;
  }

  if (!url.pathname.startsWith(BASE_PATH)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(INDEX_URL, copy));
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
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
