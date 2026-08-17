const CACHE_NAME = 'barbin-v7';

const isDevHost = (hostname) => hostname === 'localhost' || hostname === '127.0.0.1';
const isDevAsset = (pathname) => pathname.startsWith('/@vite') || pathname.startsWith('/src/') || pathname.startsWith('/node_modules/.vite');

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(['/', '/index.html'])
    ).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Never proxy/cache third-party API traffic. Safari must talk to market and
  // Supabase endpoints directly; only application assets belong in this cache.
  if (url.origin !== self.location.origin) return;
  if (isDevHost(url.hostname) || isDevAsset(url.pathname)) return;

  if (event.request.mode === 'navigate' || event.request.destination === 'document' || url.pathname === '/manifest.json') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
