const CACHE_PREFIX = 'stackflow-';
const SCOPE_URL = new URL(self.registration.scope);
const INDEX_URL = new URL('index.html', SCOPE_URL).toString();
const CACHE_NAME = `${CACHE_PREFIX}shell-v4`;
const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Offline</title><style>body{font-family:system-ui,sans-serif;background:#0f2b20;color:#f3efe3;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center}main{max-width:28rem}h1{margin:0 0 12px;font-size:1.8rem}p{margin:0;line-height:1.5;opacity:.9}</style></head><body><main><h1>Stack Flow is offline</h1><p>The app shell is unavailable right now. Reconnect and reload once the site has been visited successfully online.</p></main></body></html>`;
const OFFLINE_RESPONSE = new Response(OFFLINE_HTML, {
  status: 503,
  statusText: 'Offline',
  headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store'
  }
});
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
        .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
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
        .catch(async () => {
          const cached = await caches.match(INDEX_URL);
          return cached || OFFLINE_RESPONSE.clone();
        })
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
        .catch(() => cached || Response.error());

      return cached || fetchPromise;
    })
  );
});
