const CACHE = 'receiptsafe-cloud-v3';
const SB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
const ASSETS = ['./', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(ASSETS);
    // The login library comes from a CDN. Keep a copy so the app can start offline.
    try { const r = await fetch(new Request(SB, { mode: 'no-cors' })); await c.put(SB, r); } catch (_) {}
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Network first (so updates arrive), cache as the offline fallback.
// Data, logins and /api/ calls always go straight to the network.
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  const isLib = req.url === SB;
  if (!isLib && (url.origin !== location.origin || url.pathname.startsWith('/api/'))) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(isLib ? SB : req, copy)); }
      return res;
    }).catch(() => caches.match(isLib ? SB : req, { ignoreSearch: true })
      .then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});