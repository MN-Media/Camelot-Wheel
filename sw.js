// Camelot Wheel Pro — Service Worker
// Cache-first strategy for full offline support

const CACHE_NAME = 'camelot-wheel-v27';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/favicon.ico',
  '/favicon.svg',
  '/favicon-32.png',
];

// ── Install: pre-cache all assets ───────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// ── Activate: remove old caches ─────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: cache-first, fall back to network ─────────────────────────────
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Seite zuerst aus dem Netz (24.10.2026): Updates sofort, offline weiter aus dem Speicher
  // (eigene Anfrage per Adresse – eine navigate-Anfrage darf keine Optionen bekommen)
  const url = new URL(event.request.url);
  if (event.request.mode === 'navigate' || (url.origin === location.origin && (url.pathname === '/' || url.pathname === '/index.html'))) {
    event.respondWith(
      fetch(url.href, { cache: 'no-store', credentials: 'same-origin' }).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('/index.html', clone));
        }
        return response;
      }).catch(() => caches.match('/index.html').then(c => c || caches.match('/')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Cache valid responses
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // Offline fallback: return cached index.html for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
