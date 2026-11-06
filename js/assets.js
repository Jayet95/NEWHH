'use strict';
// Optional hand-made art: drop images into art/ (see ART.md for names) and they replace the painted-in-code art.
// art/manifest.json (written by `npm run art`, and automatically by the build) lists the files that exist.
const Assets = (() => {
  const BASE = 'art/', stems = {};
  const stem = (f) => f.replace(/\.(png|webp|jpe?g|svg|gif)$/i, '');
  const ready = fetch(BASE + 'manifest.json', { cache: 'no-cache' })
    .then(r => (r.ok ? r.json() : null)).catch(() => null)
    .then(async (m) => {
      const files = (m && m.files) || []; if (!files.length) return 0;
      await Promise.all(files.map(f => new Promise((res) => { const i = new Image(); i.onload = () => { stems[stem(f)] = i; res(); }; i.onerror = res; i.src = BASE + f; })));
      return files.length;
    })
    .then((n) => {
      if (n) { try { document.dispatchEvent(new Event('assets-ready')); } catch (e) { /* ignore */ } }
      return n;
    });
  return {
    ready,
    // first existing image among the stems (e.g. 'creatures/castle1_2', 'creatures/castle1')
    get(...names) { for (const n of names) if (stems[n]) return stems[n]; return null; },
    count: () => Object.keys(stems).length,
  };
})();
