// Leaderboard API for the Cloudflare Worker that serves the game (static files come from the assets binding).
//   GET  /api/leaderboard?diff=&size=&limit=   -> { list: [{ n, s, d, z, y, f, h, t }] }
//   POST /api/score  { name, score, diff, size, day, fac, hero }
// Scores live in a KV namespace bound as SCORES (see LEADERBOARD.md). Without the binding the API answers 503
// and the game falls back to its on-device leaderboard.
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
const DIFFS = ['easy', 'normal', 'hard', 'expert'], SIZES = ['small', 'medium', 'large', 'huge', 'giant'], FACS = ['castle', 'rampart', 'tower', 'inferno', 'necropolis', 'dungeon', 'stronghold', 'fortress', 'conflux'];
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...CORS } });
const clean = (s) => String(s || '').replace(/[<>&"'`\u0000-\u001f]/g, '').trim().slice(0, 16);
const inv = (score) => String(9999999 - score).padStart(7, '0');

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS ? env.ASSETS.fetch(req) : new Response('Not found', { status: 404 });
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (!env.SCORES) return json({ error: 'leaderboard not configured' }, 503);

    if (url.pathname === '/api/leaderboard' && req.method === 'GET') {
      const diff = DIFFS.includes(url.searchParams.get('diff')) ? url.searchParams.get('diff') : '', size = SIZES.includes(url.searchParams.get('size')) ? url.searchParams.get('size') : '';
      const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit')) || 50));
      const prefix = diff && size ? `ds:${diff}:${size}:` : diff ? `d:${diff}:` : size ? `s:${size}:` : 'a:';
      const res = await env.SCORES.list({ prefix, limit });
      return json({ list: res.keys.map((k) => k.metadata).filter(Boolean) });
    }

    if (url.pathname === '/api/score' && req.method === 'POST') {
      let b; try { b = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
      const name = clean(b.name), score = Math.floor(Number(b.score)), day = Math.floor(Number(b.day));
      if (!name || !Number.isFinite(score) || score < 0 || score > 1500000) return json({ error: 'bad score' }, 400);
      if (!DIFFS.includes(b.diff) || !SIZES.includes(b.size) || !(day >= 10 && day <= 3000)) return json({ error: 'bad game' }, 400);
      const ip = req.headers.get('cf-connecting-ip') || 'x', rl = 'rl:' + ip;
      if (await env.SCORES.get(rl)) return json({ error: 'slow down' }, 429);
      await env.SCORES.put(rl, '1', { expirationTtl: 60 });
      const id = crypto.randomUUID().slice(0, 8), meta = { n: name, s: score, d: b.diff, z: b.size, y: day, f: FACS.includes(b.fac) ? b.fac : '', h: clean(b.hero), t: Date.now() };
      const keys = [`a:${inv(score)}:${id}`, `d:${b.diff}:${inv(score)}:${id}`, `s:${b.size}:${inv(score)}:${id}`, `ds:${b.diff}:${b.size}:${inv(score)}:${id}`];
      await Promise.all(keys.map((k) => env.SCORES.put(k, '1', { metadata: meta })));
      return json({ ok: true });
    }
    return json({ error: 'not found' }, 404);
  },
};
