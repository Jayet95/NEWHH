'use strict';
// Leaderboard client: wins are stored on the device and (when the Worker has its KV namespace) sent to the global board.
const Board = (() => {
  const KEY = 'h3js_board_v1', NAME = 'h3js_name', DEFAULT_BASE = 'https://newhh.jayet95.workers.dev';
  const base = () => (location.protocol === 'https:' && !/^(localhost|127\.0\.0\.1)/.test(location.hostname) && !window.Capacitor) ? '' : DEFAULT_BASE;
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } };
  const timeout = (ms) => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; };
  return {
    get name() { try { return localStorage.getItem(NAME) || ''; } catch (e) { return ''; } },
    set name(v) { try { localStorage.setItem(NAME, v); } catch (e) { /* ignore */ } },
    local(f = {}) { return read().filter(e => (!f.diff || e.d === f.diff) && (!f.size || e.z === f.size)).sort((a, b) => b.s - a.s).slice(0, 50); },
    async submit(e) {
      const all = read(); all.push({ n: e.name, s: e.score, d: e.diff, z: e.size, y: e.day, f: e.fac, h: e.hero, t: Date.now() });
      all.sort((a, b) => b.s - a.s); try { localStorage.setItem(KEY, JSON.stringify(all.slice(0, 200))); } catch (err) { /* ignore */ }
      try { const r = await fetch(base() + '/api/score', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(e), signal: timeout(7000) }); return { ok: r.ok, status: r.status }; } catch (err) { return { ok: false, status: 0 }; }
    },
    async global(f = {}) {
      try { const q = new URLSearchParams(); if (f.diff) q.set('diff', f.diff); if (f.size) q.set('size', f.size); const r = await fetch(base() + '/api/leaderboard?' + q, { signal: timeout(7000) }); if (!r.ok) return { ok: false, status: r.status }; return { ok: true, list: (await r.json()).list || [] }; } catch (err) { return { ok: false, status: 0 }; }
    },
  };
})();
