'use strict';
// Optional hand-made art in art/ (see ART.md): when an image exists it replaces the picture painted in code.
// art/manifest.json (written by `npm run art` and by the build) lists the files. Big sets (battle poses, mounted heroes,
// large backgrounds) are loaded on demand with Assets.need(); everything else is loaded up front.
const Assets = (() => {
  const BASE = 'art/', stems = {}, files = {}, pending = {};
  const stem = (f) => f.replace(/\.(png|webp|jpe?g|svg|gif)$/i, '');
  const LAZY = /^(poses|mounted)\/|^ui\/(castle_select|hero_select|adventure|town_)/;
  const loadOne = (s) => {
    if (stems[s]) return Promise.resolve(stems[s]);
    if (!files[s]) return Promise.resolve(null);
    return pending[s] || (pending[s] = new Promise((res) => { const i = new Image(); i.onload = () => { stems[s] = i; res(i); }; i.onerror = () => res(null); i.src = BASE + files[s]; }));
  };
  const ready = fetch(BASE + 'manifest.json', { cache: 'no-cache' })
    .then(r => (r.ok ? r.json() : null)).catch(() => null)
    .then(async (m) => {
      const list = (m && m.files) || []; if (!list.length) return 0;
      list.forEach(f => { files[stem(f)] = f; });
      const eager = Object.keys(files).filter(s => !LAZY.test(s)); let done = 0;
      const tick = () => { try { document.dispatchEvent(new CustomEvent('assets-progress', { detail: { done, total: eager.length } })); } catch (e) { /* ignore */ } };
      await Promise.all(eager.map(s => loadOne(s).then(() => { if (++done % 20 === 0 || done === eager.length) tick(); })));
      return eager.length;
    })
    .then((n) => { if (n) { try { document.dispatchEvent(new Event('assets-ready')); } catch (e) { /* ignore */ } } return n; });
  return {
    ready,
    // first loaded image among the stems (e.g. 'portraits/castle1_up', 'portraits/castle1')
    get(...names) { for (const n of names) if (stems[n]) return stems[n]; return null; },
    need: (list) => Promise.all(list.map(loadOne)),
    url: (s) => (files[s] ? BASE + files[s] : null),
    has: (s) => !!files[s],
    count: () => Object.keys(stems).length,
  };
})();
