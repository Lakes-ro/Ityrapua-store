const VERSION = 'maestro-v1';
const SHELL = [
  './', 'index.html', 'manifest.json', 'icons/icon.svg',
  'css/variables.css', 'css/base.css', 'css/components.css',
  'js/supabase.js', 'js/auth.js', 'js/router.js', 'js/ui.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Rede primeiro, cache como fallback offline. Só arquivos do próprio Maestro:
// Supabase, CDN e os sistemas embutidos (outras origens) nunca passam pelo cache.
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(request, copy)); }
        return res;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('index.html'))),
  );
});
