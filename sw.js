'use strict';
// Offline-first service worker. __VERSION__ is replaced at build time (tools/build.js) so every deploy refreshes the cache.
const VERSION = '__VERSION__';
const CACHE = 'heroes3-js-' + VERSION;
const ASSETS = ['./', './index.html', './style.css', './manifest.webmanifest', './js/settings.js', './js/assets.js', './js/sfx.js', './js/fx.js', './js/data.js', './js/art.js', './js/figures.js', './js/townart.js', './js/icons.js', './js/ach.js', './js/board.js', './js/map.js', './js/battle.js', './js/main.js', './js/uifx.js', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('heroes3-js-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// network-first for the app shell so a deploy never mixes old and new files; the cache is the offline fallback
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(fetch(req).then((res) => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true })));
});
