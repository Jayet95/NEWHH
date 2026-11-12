'use strict';
// Optional hand-made art in art/ (see ART.md): when an image exists it replaces the picture painted in code.
// art/manifest.json (written by `npm run art` and by the build) lists the files. Big sets (battle poses, mounted heroes,
// large backgrounds) are all loaded up front behind the title-screen loading bar; Assets.need() then resolves at once.
document.documentElement.classList.add('assets-loading');
const Assets = (() => {
  const BASE = 'art/', stems = {}, files = {}, pending = {};
  const stem = (f) => f.replace(/\.(png|webp|jpe?g|svg|gif)$/i, '');
  const LATER = /^(poses|mounted|anim)\/|^ui\/(castle_select|hero_select|adventure|town_)/;
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
      const all = Object.keys(files), eager = all.filter(s => !LATER.test(s)); let done = 0, next = 0;   // the loader bar covers the essentials; the big sets (battle poses, animations, mounted heroes, large backdrops) stream in quietly afterwards
      const tick = () => { try { document.dispatchEvent(new CustomEvent('assets-progress', { detail: { done, total: eager.length } })); } catch (e) { /* ignore */ } };
      const worker = async () => { while (next < eager.length) { const s = eager[next++]; await loadOne(s); if (++done % 25 === 0 || done === eager.length) tick(); } };
      await Promise.all(Array.from({ length: 48 }, worker));   // 48 at a time keeps the browser responsive and the bar moving
      return eager.length;
    })
    .then((n) => {
      // background pass: everything else, 6 at a time, backdrops and poses before animation frames; Assets.need() still jumps the queue for what a screen asks for
      const rest = Object.keys(files).filter(k => !stems[k]).sort((a, b) => (/^anim\//.test(a) - /^anim\//.test(b)) || (a < b ? -1 : 1)); let bi = 0;
      const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 400 }) : setTimeout(fn, 30));
      const bg = () => { if (bi >= rest.length) return; const k = rest[bi++]; loadOne(k).then(() => idle(bg)); };
      setTimeout(() => { for (let i = 0; i < 6; i++) bg(); }, 1500);
      document.documentElement.classList.remove('assets-loading'); if (n) { try { document.dispatchEvent(new Event('assets-ready')); } catch (e) { /* ignore */ } } return n; });
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
