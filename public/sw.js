const CACHE_NAME = 'elitea-shell-v0.33.0';
const CORE_ASSETS = [
  '/', '/index.html', '/styles.css?v=0.33.0', '/app.js?v=0.33.0', '/cloud.js?v=0.33.0', '/activity.js', '/outcomes.js',
  '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png', '/og-elitea.png',
  '/fonts/bodoni-moda-latin-ext.woff2', '/fonts/bodoni-moda-latin.woff2',
  '/fonts/cormorant-garamond-latin-ext.woff2', '/fonts/cormorant-garamond-latin.woff2',
  '/fonts/dm-sans-latin-ext.woff2', '/fonts/dm-sans-latin.woff2',
  '/fonts/manrope-latin-ext.woff2', '/fonts/manrope-latin.woff2',
  '/legal/legal.css', '/legal/privacy.html', '/legal/terms.html', '/legal/withdrawal.html',
  '/legal/cookies.html', '/legal/ai.html', '/legal/public-test.html',
  '/coach-test', '/coach-test.html', '/coach-test.css', '/coach-eval.js',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith('elitea-shell-') && key !== CACHE_NAME).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        return response;
      })
      .catch(async () => (await caches.match(request)) || caches.match('/index.html')));
    return;
  }

  // Application code must not stay pinned to an old production deployment.
  // Prefer the network for mutable shell files and keep the cached response
  // only as an offline fallback. Images and fonts remain cache-first below.
  if (/\.(?:js|css|html|webmanifest)$/.test(url.pathname)) {
    event.respondWith(fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request)));
    return;
  }

  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    }
    return response;
  })));
});
