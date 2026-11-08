/* RAY BATTLE 2 service worker. VERSION and PRECACHE are injected at build time. */
const VERSION = '__VERSION__';
const PRECACHE = self.__PRECACHE || [];
const CACHE = `rgb2-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(PRECACHE.map((p) => new Request(p, { cache: 'reload' })));
      // First install: take over immediately. Updates wait for the game's go-ahead.
      if (!self.registration.active) await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('rgb2-') && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data && event.data.type === 'GET_VERSION' && event.source) event.source.postMessage({ type: 'VERSION', version: VERSION });
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/sw.js') || url.pathname.endsWith('/version.json')) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (req.mode === 'navigate') {
        const hit = (await cache.match(req, { ignoreSearch: true, ignoreVary: true })) || (await cache.match("./index.html", { ignoreVary: true })) || (await cache.match("./", { ignoreVary: true }));
        if (hit) return hit;
        return fetch(req);
      }
      const hit = await cache.match(req, { ignoreSearch: true, ignoreVary: true });
      if (hit) return hit;
      const res = await fetch(req);
      if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    })(),
  );
});
