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

// mo = { preset: key of MAPS, size: key of SIZES }
function genMap(seed, ef = 'necropolis', diff = 'normal', mo = {}) {
  const DM = DIFFICULTY[diff] || DIFFICULTY.normal;
  const MP = MAPS[mo.preset] || MAPS.plains, SZ = SIZES[mo.size] || SIZES.medium;
  const R = rng(seed), W = SZ.w, H = SZ.h, sc = (W * H) / 1120;
  const n1 = noise(R, W, H, 6), n2 = noise(R, W, H, 3);
  const tiles = [];
  for (let y = 0; y < H; y++) {
    tiles[y] = [];
    for (let x = 0; x < W; x++) {
      let t = T.GRASS;
      if (n1[y][x] < MP.water) t = T.WATER;
      else if (n1[y][x] > MP.mount) t = T.MOUNT;
      else if (n2[y][x] > MP.forest) t = T.FOREST;
      else if (n2[y][x] < 0.22) t = T.SAND;
      tiles[y][x] = t;
    }
  }
  const P = { x: 5, y: H - 6 }, E = { x: W - 6, y: 5 };
  // the bay along the southern edge, reachable by boat from the player's port
  const bayRows = Math.max(3, Math.min(5, Math.round(4 * MP.bay)));
  const bayTiles = [];
  for (let x = 10; x <= W - 12; x++) {
    const top = H - bayRows + (n2[H - 1][x] > 0.5 ? 0 : 1);
    for (let y = top; y < H; y++) { tiles[y][x] = T.WATER; bayTiles.push({ x, y }); }
    if (top - 1 > 0 && tiles[top - 1][x] === T.GRASS) tiles[top - 1][x] = T.SAND;
  }
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

  // port: the bay tile nearest to the castle that touches land; a footpath is carved so a hero can always reach it
  let dock = null, shore = null, bd = 1e9;
  const reserved = new Set();
  for (const c of bayTiles) {
    if (tiles[c.y][c.x] !== T.WATER) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = c.x + dx, ny = c.y + dy;
      if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= W || ny >= H || tiles[ny][nx] === T.WATER) continue;
      const d = (c.x - P.x) ** 2 + (c.y - P.y) ** 2;
      if (d < bd) { bd = d; dock = { x: c.x, y: c.y }; shore = { x: nx, y: ny }; }
    }
  }
  if (!dock) {
    for (const c of bayTiles) {
      if (tiles[c.y][c.x] !== T.WATER || c.y < 1) continue;
      const d = (c.x - P.x) ** 2 + (c.y - P.y) ** 2;
      if (d < bd) { bd = d; dock = { x: c.x, y: c.y }; shore = { x: c.x, y: c.y - 1 }; }
    }
  }
  if (dock) {
    if (tiles[shore.y][shore.x] !== T.ROAD) tiles[shore.y][shore.x] = T.SAND;
    let px = P.x, py = P.y;
    while (px !== shore.x || py !== shore.y) {
      px += Math.sign(shore.x - px); py += Math.sign(shore.y - py);
      if (tiles[py][px] !== T.ROAD) tiles[py][px] = T.GRASS;
      reserved.add(py * W + px);
    }
  }

  const passable = (t) => t === T.GRASS || t === T.ROAD || t === T.SAND;
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
    if ((t === T.GRASS || t === T.SAND) && seen.has(yy * W + xx) && !reserved.has(yy * W + xx) && dist({ x: xx, y: yy }, P) > 3 && dist({ x: xx, y: yy }, E) > 3) cand.push({ x: xx, y: yy });
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
    const budget = (500 + d * 7500) * (0.7 + R() * 0.6) * mul * DM.neutral;
    return { t, n: Math.max(2, Math.round(budget / C[t].v)) };
  };
  const seaGuard = (c, mul = 1) => {
    const d = depthOf(c), t = d > 0.45 ? 'kraken' : 'shark';
    const budget = (600 + d * 5000) * (0.7 + R() * 0.6) * mul * DM.neutral;
    return { t, n: Math.max(2, Math.round(budget / C[t].v)) };
  };

  const objs = [];
  objs.push({ t: 'town', owner: 0, x: P.x, y: P.y, name: 'Castle Dawnwatch' });
  const eti = factionTiers(ef), budgets = [3000, 3500, 4000, 5000, 5500, 6000];
  const eGuard = budgets.map((b, i) => { const t = i < 3 ? eti[i] : lineType(eti[i], 2); return { t, n: Math.max(2, Math.round(b * DM.garrison / C[t].v)) }; });
  objs.push({ t: 'town', owner: 1, x: E.x, y: E.y, name: FACTIONS[ef].enemyTown, guard: eGuard });

  objs[0].zone = 0; objs[1].zone = 1;
  const seeds = [{ x: P.x, y: P.y, id: 0 }, { x: E.x, y: E.y, id: 1 }];
  const fortNames = ['Mistvale Keep', 'Ironhold Bastion', 'Sunspire Outpost', 'Grimwatch Tower'];
  const spacing = Math.max(7, Math.round(10 * Math.sqrt(sc)));
  for (let i = 0; i < 4; i++) {
    let c = null;
    for (let tries = 0; tries < 400 && !c; tries++) {
      const t = cand[Math.floor(R() * cand.length)];
      if (t && seeds.every(s => dist(s, t) >= spacing)) c = t;
    }
    if (!c) break;
    cand = cand.filter(o => dist(o, c) > 1);
    seeds.push({ x: c.x, y: c.y, id: 2 + i });
    objs.push({ t: 'fort', zone: 2 + i, name: fortNames[i], owner: null, x: c.x, y: c.y, guard: [guard(c, 1.4)], garrison: [null, null, null, null, null, null, null] });
  }
  const zone = [];
  for (let yy = 0; yy < H; yy++) {
    zone[yy] = [];
    for (let xx = 0; xx < W; xx++) {
      let best = 0, bd = 1e9;
      for (const s of seeds) { const d = (s.x - xx) ** 2 + (s.y - yy) ** 2; if (d < bd) { bd = d; best = s.id; } }
      zone[yy][xx] = best;
    }
  }

  const mineKinds = ['gold', 'gold', 'gold', 'wood', 'wood', 'ore', 'ore', 'mercury', 'sulfur', 'crystal', 'gems'].slice(0, Math.max(8, Math.round(11 * Math.sqrt(sc))));
  for (const k of mineKinds) { const c = pick(); if (!c) break; objs.push({ t: 'mine', kind: k, owner: null, x: c.x, y: c.y, guard: [guard(c, 0.8)] }); }
  for (let i = 0, n = sc < 0.8 ? 2 : 3; i < n; i++) { const c = pick(); if (!c) break; objs.push({ t: 'merchant', x: c.x, y: c.y }); }
  for (let i = 0, n = Math.round(20 * sc); i < n; i++) { const c = pick(); if (!c) break; const k = RES[Math.floor(R() * RES.length)]; objs.push({ t: 'pile', kind: k, amt: k === 'gold' ? 500 + 250 * Math.floor(R() * 5) : 3 + Math.floor(R() * 6), x: c.x, y: c.y }); }
  for (let i = 0, n = Math.round(5 * sc); i < n; i++) { const c = pick(); if (!c) break; objs.push({ t: 'chest', x: c.x, y: c.y, gold: 1000 + 500 * Math.floor(R() * 4) }); }
  for (let i = 0; i < LAND_ARTS; i++) { const c = pick(); if (c) objs.push({ t: 'art', art: i, x: c.x, y: c.y, guard: [guard(c, 1.1)] }); }
  for (let i = 0, n = Math.round(28 * sc * MP.density); i < n; i++) { const c = pick(); if (!c) break; objs.push({ t: 'monster', x: c.x, y: c.y, guard: [guard(c)] }); }

  // ---- the sea: nearest bay tile to the castle is the dock; collectibles float in the connected water ----
  if (dock) {
    const sea = [], sseen = new Set([dock.y * W + dock.x]), sq = [dock];
    while (sq.length) {
      const c = sq.shift(); sea.push(c);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = c.x + dx, ny = c.y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || sseen.has(ny * W + nx) || tiles[ny][nx] !== T.WATER) continue;
        sseen.add(ny * W + nx); sq.push({ x: nx, y: ny });
      }
    }
    let scand = sea.filter(c => dist(c, dock) > 2);
    const spick = () => { if (!scand.length) return null; const c = scand[Math.floor(R() * scand.length)]; scand = scand.filter(o => dist(o, c) > 1); return c; };
    const nSea = Math.max(1, Math.round(Math.min(1.4, sea.length / 120)));
    for (let i = 0; i < 6 * nSea; i++) { const c = spick(); if (!c) break; const k = RES[Math.floor(R() * RES.length)]; objs.push({ t: 'pile', sea: true, kind: k, amt: k === 'gold' ? 1000 + 500 * Math.floor(R() * 4) : 4 + Math.floor(R() * 6), x: c.x, y: c.y }); }
    for (let i = 0; i < 3 * nSea; i++) { const c = spick(); if (!c) break; objs.push({ t: 'chest', sea: true, x: c.x, y: c.y, gold: 1500 + 500 * Math.floor(R() * 4) }); }
    for (let i = 0; i < 2 * nSea; i++) { const c = spick(); if (!c) break; objs.push({ t: 'wreck', x: c.x, y: c.y, gold: 1500 + 500 * Math.floor(R() * 4), res: RES[1 + Math.floor(R() * (RES.length - 1))], guard: [seaGuard(c, 0.8)] }); }
    for (let i = 0; i < 3 * nSea; i++) { const c = spick(); if (!c) break; objs.push({ t: 'monster', sea: true, x: c.x, y: c.y, guard: [seaGuard(c)] }); }
    for (let i = 0; i < 2; i++) { const c = spick(); if (c) objs.push({ t: 'art', sea: true, art: LAND_ARTS + i, x: c.x, y: c.y, guard: [seaGuard(c, 1.3)] }); }
  }

  return { W, H, tiles, objs, P, E, zone, dock };
}

function zoneOwner(G, z) {
  const o = G.objs.find(o => (o.t === 'fort' || o.t === 'town') && o.zone === z);
  return o ? o.owner : null;
}

function reindex(G) {
  G.omap = new Map();
  for (const o of G.objs) G.omap.set(o.y * G.W + o.x, o);
}
function objAt(G, x, y) { return G.omap.get(y * G.W + x); }

// sail: the hero travels by boat (water tiles; a land tile only as the final step to disembark)
function findPath(G, sx, sy, tx, ty, ignoreObjs, sail) {
  const W = G.W, H = G.H, N = W * H, k = (x, y) => y * W + x;
  if (tx < 0 || ty < 0 || tx >= W || ty >= H) return null;
  const target = k(tx, ty);
  const tcost = (nx, ny, nk) => {
    const t = G.tiles[ny][nx], c = TCOST[t];
    if (sail) return t === T.WATER ? 100 : (c && nk === target ? c : 0);
    if (t === T.WATER) return (!ignoreObjs && nk === target && G.boats && G.boats.some(b => b.x === nx && b.y === ny)) ? 100 : 0;
    return c || 0;
  };
  if (!tcost(tx, ty, target)) return null;
  const g = new Float32Array(N).fill(Infinity), f = new Float32Array(N).fill(Infinity), bc = new Float32Array(N);
  const prev = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const heur = (x, y) => Math.max(Math.abs(x - tx), Math.abs(y - ty)) * 70;
  const s = k(sx, sy); g[s] = 0; f[s] = heur(sx, sy);
  const open = [s];
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
      const nk = k(nx, ny), cost = tcost(nx, ny, nk);
      if (!cost) continue;
      if (!ignoreObjs && nk !== target) {
        const o = G.omap.get(nk);
        if (o && o.t !== 'pile' && o.t !== 'chest') continue;
      }
      const ng = g[cur] + cost * (dx && dy ? 1.41 : 1);
      if (ng < g[nk]) { g[nk] = ng; f[nk] = ng + heur(nx, ny); prev[nk] = cur; bc[nk] = cost; open.push(nk); }
    }
  }
  if (prev[target] === -1 && target !== s) return null;
  const path = [];
  for (let c = target; c !== s; c = prev[c]) {
    const p = prev[c], px = p % W, py = (p / W) | 0, cx = c % W, cy = (c / W) | 0;
    path.push({ x: cx, y: cy, cost: Math.round(bc[c] * (px !== cx && py !== cy ? 1.41 : 1)) });
  }
  return path.reverse();
}
