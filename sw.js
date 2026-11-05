/* Offline shell: caches the app and the two map libraries. Map tiles and
 * Overpass responses are NOT cached here (app.js keeps its own data cache). */
const VERSION = 'lev-v1';
const SHELL = ['./', 'index.html', 'css/styles.css', 'js/data.js', 'js/core.js', 'js/app.js',
  'favicon.svg', 'manifest.webmanifest'];
const LIBS = ['unpkg.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const ok = url.origin === location.origin || LIBS.includes(url.hostname);
  if (!ok) return;
  // stale-while-revalidate
  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(req);
    const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) cache.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
