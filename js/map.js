'use strict';
function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function noise(R, W, H, sc) {
  const gw = Math.ceil(W / sc) + 2, gh = Math.ceil(H / sc) + 2, g = [];
  for (let y = 0; y < gh; y++) { g[y] = []; for (let x = 0; x < gw; x++) g[y][x] = R(); }
  const out = [];
  for (let y = 0; y < H; y++) {
    out[y] = [];
    for (let x = 0; x < W; x++) {
      const fx = x / sc, fy = y / sc, x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = g[y0][x0] + (g[y0][x0 + 1] - g[y0][x0]) * sx;
      const b = g[y0 + 1][x0] + (g[y0 + 1][x0 + 1] - g[y0 + 1][x0]) * sx;
      out[y][x] = a + (b - a) * sy;
    }
  }
  return out;
}

const NEUTRAL_BY_DEPTH = [['goblin', 'wolf'], ['orc', 'golem'], ['ogre', 'wolf'], ['troll', 'naga'], ['naga', 'dragon'], ['dragon', 'troll']];

function genMap(seed) {
  const R = rng(seed), W = 40, H = 28;
  const n1 = noise(R, W, H, 6), n2 = noise(R, W, H, 3);
  const tiles = [];
  for (let y = 0; y < H; y++) {
    tiles[y] = [];
    for (let x = 0; x < W; x++) {
      let t = T.GRASS;
      if (n1[y][x] < 0.30) t = T.WATER;
      else if (n1[y][x] > 0.72) t = T.MOUNT;
      else if (n2[y][x] > 0.60) t = T.FOREST;
      else if (n2[y][x] < 0.22) t = T.SAND;
      tiles[y][x] = t;
    }
  }
  const P = { x: 5, y: 22 }, E = { x: 34, y: 5 };
  const clear = (c, r) => { for (let y = c.y - r; y <= c.y + r; y++) for (let x = c.x - r; x <= c.x + r; x++) if (x >= 0 && y >= 0 && x < W && y < H) tiles[y][x] = T.GRASS; };
  clear(P, 3); clear(E, 3);
  // winding road
  let x = P.x, y = P.y;
  while (x !== E.x || y !== E.y) {
    tiles[y][x] = T.ROAD; if (x + 1 < W) tiles[y][x + 1] = T.ROAD;
    const dx = Math.sign(E.x - x), dy = Math.sign(E.y - y);
    const r = R();
    if (dx && (!dy || r < 0.55)) x += dx; else if (dy) y += dy; else x += dx;
    if (R() < 0.12) { const j = R() < 0.5 ? -1 : 1; if (y + j > 1 && y + j < H - 1 && !dy) y += j; }
  }
  tiles[E.y][E.x] = T.ROAD;
  tiles[P.y][P.x] = T.ROAD;

  const passable = (t) => t === T.GRASS || t === T.ROAD || t === T.SAND;
  // reachable flood from P
  const seen = new Set([P.y * W + P.x]), q = [P];
  while (q.length) {
    const c = q.shift();
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = c.x + dx, ny = c.y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(ny * W + nx) || !passable(tiles[ny][nx])) continue;
      seen.add(ny * W + nx); q.push({ x: nx, y: ny });
    }
  }
  const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  let cand = [];
  for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
    const t = tiles[yy][xx];
    if ((t === T.GRASS || t === T.SAND) && seen.has(yy * W + xx) && dist({ x: xx, y: yy }, P) > 3 && dist({ x: xx, y: yy }, E) > 3) cand.push({ x: xx, y: yy });
  }
  const pick = () => {
    if (!cand.length) return null;
    const i = Math.floor(R() * cand.length), c = cand[i];
    cand = cand.filter(o => dist(o, c) > 1);
    return c;
  };
  const depthOf = (c) => Math.min(1, dist(c, P) / dist(P, E));
  const guard = (c, mul = 1) => {
    const d = depthOf(c), row = NEUTRAL_BY_DEPTH[Math.min(5, Math.floor(d * 6))];
    const t = row[Math.floor(R() * row.length)];
    const budget = (500 + d * 7500) * (0.7 + R() * 0.6) * mul;
    return { t, n: Math.max(2, Math.round(budget / C[t].v)) };
  };

  const objs = [];
  objs.push({ t: 'town', owner: 0, x: P.x, y: P.y, name: 'Castle Dawnwatch' });
  objs.push({ t: 'town', owner: 1, x: E.x, y: E.y, name: 'Necropolis Blackspire',
    guard: [{ t: 'zombie', n: 40 }, { t: 'wraith', n: 14 }, { t: 'vampire', n: 12 }, { t: 'lich', n: 9 }, { t: 'skeleton', n: 60 }] });

  const mineKinds = ['gold', 'gold', 'gold', 'wood', 'wood', 'ore', 'ore', 'gems'];
  for (const k of mineKinds) { const c = pick(); if (!c) break; objs.push({ t: 'mine', kind: k, owner: null, x: c.x, y: c.y, guard: [guard(c, 0.8)] }); }
  for (let i = 0; i < 16; i++) { const c = pick(); if (!c) break; const k = RES[Math.floor(R() * 4)]; objs.push({ t: 'pile', kind: k, amt: k === 'gold' ? 500 + 250 * Math.floor(R() * 5) : 3 + Math.floor(R() * 6), x: c.x, y: c.y }); }
  for (let i = 0; i < 5; i++) { const c = pick(); if (!c) break; objs.push({ t: 'chest', x: c.x, y: c.y, gold: 1000 + 500 * Math.floor(R() * 4) }); }
  ARTIFACTS.forEach((a, i) => { const c = pick(); if (c) objs.push({ t: 'art', art: i, x: c.x, y: c.y, guard: [guard(c, 1.1)] }); });
  for (let i = 0; i < 28; i++) { const c = pick(); if (!c) break; objs.push({ t: 'monster', x: c.x, y: c.y, guard: [guard(c)] }); }

  return { W, H, tiles, objs, P, E };
}

function reindex(G) {
  G.omap = new Map();
  for (const o of G.objs) G.omap.set(o.y * G.W + o.x, o);
}
function objAt(G, x, y) { return G.omap.get(y * G.W + x); }

function findPath(G, sx, sy, tx, ty, ignoreObjs) {
  const W = G.W, H = G.H, N = W * H, k = (x, y) => y * W + x;
  if (tx < 0 || ty < 0 || tx >= W || ty >= H) return null;
  if (!TCOST[G.tiles[ty][tx]]) return null;
  const g = new Float32Array(N).fill(Infinity), f = new Float32Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const heur = (x, y) => Math.max(Math.abs(x - tx), Math.abs(y - ty)) * 70;
  const s = k(sx, sy); g[s] = 0; f[s] = heur(sx, sy);
  const open = [s], target = k(tx, ty);
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur === target) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % W, cy = (cur / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const cost = TCOST[G.tiles[ny][nx]];
      if (!cost) continue;
      const nk = k(nx, ny);
      if (!ignoreObjs && nk !== target) {
        const o = G.omap.get(nk);
        if (o && o.t !== 'pile' && o.t !== 'chest') continue;
      }
      const ng = g[cur] + cost * (dx && dy ? 1.41 : 1);
      if (ng < g[nk]) { g[nk] = ng; f[nk] = ng + heur(nx, ny); prev[nk] = cur; open.push(nk); }
    }
  }
  if (prev[target] === -1 && target !== s) return null;
  const path = [];
  for (let c = target; c !== s; c = prev[c]) {
    const p = prev[c], px = p % W, py = (p / W) | 0, cx = c % W, cy = (c / W) | 0;
    path.push({ x: cx, y: cy, cost: Math.round(TCOST[G.tiles[cy][cx]] * (px !== cx && py !== cy ? 1.41 : 1)) });
  }
  return path.reverse();
}
