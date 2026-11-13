/**
 * Service Worker PERBASI Bendahara (PWA).
 * Strategi: app shell cache-first, /api selalu network (data keuangan harus fresh).
 */
const CACHE_VERSION = 'perbasasi-v5';
const APP_SHELL = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/api.js',
  '/js/util.js',
  '/js/charts.js',
  '/js/pages/dashboard.js',
  '/js/pages/transaksi.js',
  '/js/pages/kas.js',
  '/js/pages/anggota.js',
  '/js/pages/iuran.js',
  '/js/pages/persuratan.js',
  '/js/pages/laporan.js',
  '/js/pages/pengaturan.js',
  '/manifest.webmanifest',
  '/icons/logo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // API → selalu dari jaringan (jangan cache data keuangan)
  if (url.pathname.startsWith('/api/')) return;

  // App shell → cache first, lalu network (dan simpan ke cache)
  event.respondWith(
    caches.match(request, { ignoreSearch: url.pathname === '/' }).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        // Fallback offline untuk navigasi → index.html
        if (request.mode === 'navigate') return caches.match('/index.html');
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      });
    })
  );
});
