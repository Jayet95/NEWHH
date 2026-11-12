'use strict';
// Offline-first service worker. __VERSION__ is replaced at build time (tools/build.js) so every deploy refreshes the cache.
const VERSION = '__VERSION__';
const CACHE = 'heroes3-js-' + VERSION;
const ART = 'heroes3-art';          // art/audio keep their own cache across deploys (refreshed in the background), so an update never re-downloads them all
const ASSETS = ['./', './index.html', './style.css', './manifest.webmanifest', './js/settings.js', './js/assets.js', './js/sfx.js', './js/fx.js', './js/data.js', './js/names.js', './js/art.js', './js/figures.js', './js/townart.js', './js/icons.js', './js/gi.js', './js/ach.js', './js/board.js', './js/map.js', './js/battle.js', './js/main.js', './js/uifx.js', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('heroes3-js-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// heavy static files (art, audio, fonts, themes, icons) are served from the cache at once, then refreshed in the background, so a returning player
// skips the download and a changed file arrives on the next visit. Code and pages stay network-first so a deploy never mixes old and new files.
const HEAVY = /\/(art|audio|fonts|themes|icons)\//;
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.headers.has('range')) return;                       // media range requests go straight to the network
  const heavy = HEAVY.test(req.url), store = (res) => { if (res && res.status === 200) { const copy = res.clone(); caches.open(heavy ? ART : CACHE).then((c) => c.put(req, copy)); } return res; };
  if (heavy) {
    e.respondWith(caches.open(ART).then((c) => c.match(req, { ignoreSearch: true })).then((hit) => {
      // a cached file is served at once; it is checked again (a tiny 304 answer) only when the copy is over a day old, so a visit does not fire thousands of background requests
      const age = hit ? Date.now() - (Date.parse(hit.headers.get('date') || '') || 0) : 0;
      if (hit && age < 864e5) return hit;
      const net = fetch(req, hit ? { cache: 'no-cache' } : undefined).then(store).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  e.respondWith(fetch(req).then(store).catch(() => caches.match(req, { ignoreSearch: true })));
});
