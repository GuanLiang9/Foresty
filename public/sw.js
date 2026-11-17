const CACHE = 'evergrove-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './manifest.webmanifest', './icon.svg', './icon-192.png'])));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

// The page reports the hashed assets it loaded so the first visit is enough to go offline.
self.addEventListener('message', (e) => {
  if (!e.data?.cache) return;
  const keep = new Set(e.data.cache);
  e.waitUntil(caches.open(CACHE).then(async (c) => {
    // Only fetch what isn't saved yet. (Re-adding everything re-downloaded the whole app on every launch.)
    await Promise.allSettled(e.data.cache.map(async (u) => { if (!(await c.match(u))) await c.add(u); }));
    // Hashed bundles from older releases are never requested again; drop them.
    for (const r of await c.keys()) if (r.url.includes('/assets/') && !keep.has(r.url)) await c.delete(r);
  }));
});

// How long a page load waits for the network before opening the saved copy instead (weak signal, "lie-fi").
const NAV_TIMEOUT = 2000;

self.addEventListener('fetch', (e) => {
  const r = e.request;
  const u = new URL(r.url);
  // API responses are live data (scores, accounts): always go to the network, never cache.
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/api/')) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const nav = r.mode === 'navigate';
    const hit = await c.match(nav ? './' : r);
    // Files in assets/ have a hash of their contents in the name, so a saved copy can never be out of date:
    // serve it straight from the cache without touching the network.
    if (hit && !nav && u.pathname.includes('/assets/')) return hit;
    const net = fetch(r).then((res) => { if (res.ok) c.put(nav ? './' : r, res.clone()); return res; });
    if (nav) {
      // Network first so a new release shows up right away, but don't hang on a bad connection:
      // after NAV_TIMEOUT open the saved copy (the network answer still refreshes the cache for next time).
      if (!hit) return net;
      net.catch(() => {});
      return Promise.race([net.catch(() => hit), new Promise((done) => setTimeout(() => done(hit), NAV_TIMEOUT))]);
    }
    // Icons and the manifest: answer from the cache now, refresh it in the background.
    if (hit) { net.catch(() => {}); return hit; }
    return net;
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cs) => (cs[0] ? cs[0].focus() : self.clients.openWindow('./'))));
});
