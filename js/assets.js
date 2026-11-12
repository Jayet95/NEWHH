'use strict';
// Optional hand-made art in art/ (see ART.md): when an image exists it replaces the picture painted in code.
// art/manifest.json (written by `npm run art` and by the build) lists the files. A build also bundles them into a few big
// packs (art/packs/*.bin + index.json, see tools/pack_art.js): a phone then makes a handful of requests instead of thousands.
// Without packs (the plain dev server) the single files are loaded. The loader bar covers the essentials ("core");
// battle poses, animations, buildings and large backdrops stream in quietly afterwards, and Assets.need() jumps the queue.
document.documentElement.classList.add('assets-loading');
const Assets = (() => {
  const BASE = 'art/', stems = {}, files = {}, pending = {};
  let index = null; const packP = {};
  const stem = (f) => f.replace(/\.(png|webp|jpe?g|svg|gif)$/i, '');
  const LATER = /^(poses|mounted|anim|buildings)\/|^ui\/(castle_select|hero_select|adventure|town_)/;
  const MIME = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', gif: 'image/gif' };
  const progress = (done, total) => { try { document.dispatchEvent(new CustomEvent('assets-progress', { detail: { done, total } })); } catch (e) { /* ignore */ } };
  // download one pack (streamed, so the bar moves with the bytes); resolves to its ArrayBuffer or null
  const packBuf = (pi, onBytes) => packP[pi] || (packP[pi] = (async () => {
    try {
      const r = await fetch(BASE + 'packs/' + index.packs[pi].f); if (!r.ok) return null;
      if (!r.body || !onBytes) return await r.arrayBuffer();
      const rd = r.body.getReader(), parts = []; let got = 0;
      for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; onBytes(got); }
      const out = new Uint8Array(got); let o = 0; parts.forEach(p => { out.set(p, o); o += p.length; }); return out.buffer;
    } catch (e) { return null; }
  })());
  const fromImg = (s, url, fallback) => new Promise((res) => { const i = new Image(); i.onload = () => { stems[s] = i; res(i); }; i.onerror = () => (fallback ? fallback().then(res) : res(null)); i.src = url; });
  const single = (s) => fromImg(s, BASE + files[s]);
  const loadOne = (s) => {
    if (stems[s]) return Promise.resolve(stems[s]);
    if (!files[s]) return Promise.resolve(null);
    if (pending[s]) return pending[s];
    const e = index && index.files[s];
    return (pending[s] = !e ? single(s) : packBuf(e[0]).then((buf) => {
      if (!buf) return single(s);
      return fromImg(s, URL.createObjectURL(new Blob([new Uint8Array(buf, e[1], e[2])], { type: MIME[e[3]] || 'image/png' })), () => single(s));
    }));
  };
  const pool = async (list, n, each) => { let k = 0; const w = async () => { while (k < list.length) { const s = list[k++]; await loadOne(s); if (each) each(); } }; await Promise.all(Array.from({ length: n }, w)); };
  const ready = fetch(BASE + 'manifest.json', { cache: 'no-cache' })
    .then(r => (r.ok ? r.json() : null)).catch(() => null)
    .then(async (m) => {
      const list = (m && m.files) || []; if (!list.length) return 0;
      list.forEach(f => { files[stem(f)] = f; });
      try { const r = await fetch(BASE + 'packs/index.json', { cache: 'no-cache' }); if (r.ok) index = await r.json(); } catch (e) { index = null; }
      const all = Object.keys(files);
      let eager;
      if (index) {
        eager = all.filter(s => index.files[s] && index.packs[index.files[s][0]].core).concat(all.filter(s => !index.files[s] && !LATER.test(s)));
        const corePacks = index.packs.map((p, i) => (p.core ? i : -1)).filter(i => i >= 0), total = corePacks.reduce((a, i) => a + index.packs[i].n, 0) * 1.12, got = {};
        const sum = () => Object.values(got).reduce((a, v) => a + v, 0);
        await Promise.all(corePacks.map(i => packBuf(i, (b) => { got[i] = b; progress(sum(), total); })));
        let done = 0;
        await pool(eager, 16, () => { if (++done % 40 === 0) progress(sum() + (total - sum()) * done / eager.length, total); });
      } else {
        eager = all.filter(s => !LATER.test(s)); let done = 0;
        await pool(eager, 48, () => { if (++done % 25 === 0 || done === eager.length) progress(done, eager.length); });
      }
      return eager.length;
    })
    .then((n) => {
      // background pass: backdrops, buildings and poses before animation frames; Assets.need() still jumps the queue for what a screen asks for
      const rank = (k) => (/^buildings\//.test(k) ? 0 : /^anim\//.test(k) ? 3 : /^(poses|mounted)\//.test(k) ? 2 : 1);
      const rest = Object.keys(files).filter(k => !stems[k]).sort((a, b) => (rank(a) - rank(b)) || (a < b ? -1 : 1)); let bi = 0, bLeft = rest.filter(k => rank(k) === 0).length;
      const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 400 }) : setTimeout(fn, 30));
      const bg = () => { if (bi >= rest.length) return; const k = rest[bi++]; loadOne(k).then(() => { if (rank(k) === 0 && --bLeft === 0) { try { document.dispatchEvent(new Event('assets-ready')); } catch (e) { /* ignore */ } } idle(bg); }); };
      setTimeout(() => { for (let i = 0; i < (index ? 4 : 6); i++) bg(); }, 1500);
      document.documentElement.classList.remove('assets-loading');
      if (n) { try { document.dispatchEvent(new Event('assets-ready')); } catch (e) { /* ignore */ } }
      return n;
    });
  return {
    ready,
    // first loaded image among the stems (e.g. 'portraits/castle1_up', 'portraits/castle1')
    get(...names) { for (const n of names) if (stems[n]) return stems[n]; return null; },
    need: (list) => Promise.all(list.map(loadOne)),
    url: (s) => (files[s] ? BASE + files[s] : null),
    has: (s) => !!files[s],
    list: (prefix) => Object.keys(files).filter(k => k.startsWith(prefix)),
    count: () => Object.keys(stems).length,
  };
})();
