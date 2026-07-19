/**
 * sw.js — Service worker: deixa o app funcionar offline (cache do "app shell").
 *
 * Estratégia: cache-first para os arquivos do app; para navegação, cai de volta
 * para o index.html quando estiver offline. Ao mudar o app, suba o CACHE_VERSION
 * para invalidar o cache antigo.
 */
const CACHE_VERSION = 'constancia-v1';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/app.js',
  'js/store.js',
  'js/model.js',
  'js/constants.js',
  'js/charts.js',
  'js/notifications.js',
  'js/dom.js',
  'js/habit-dialog.js',
  'js/views/today.js',
  'js/views/week.js',
  'js/views/stats.js',
  'js/views/habits.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          // Guarda cópias de recursos do mesmo domínio para uso offline futuro.
          if (response.ok && new URL(request.url).origin === self.location.origin) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          // Offline e sem cache: para navegação, devolve o app shell.
          if (request.mode === 'navigate') return caches.match('index.html');
          return Response.error();
        });
    }),
  );
});
