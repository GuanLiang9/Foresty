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
    await Promise.allSettled(e.data.cache.map((u) => c.add(u)));
    // Hashed bundles from older releases are never requested again; drop them.
    for (const r of await c.keys()) if (r.url.includes('/assets/') && !keep.has(r.url)) await c.delete(r);
  }));
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const nav = r.mode === 'navigate';
    const hit = await c.match(nav ? './' : r);
    const net = fetch(r).then((res) => { if (res.ok) c.put(nav ? './' : r, res.clone()); return res; });
    if (nav) return net.catch(() => hit);
    return hit || net;
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cs) => (cs[0] ? cs[0].focus() : self.clients.openWindow('./'))));
});
