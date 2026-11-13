// hex grid helpers (pointy-top, odd-r offset). Order of neighbours: E, SE, SW, W, NW, NE
// the world is a globe: when WRAP_W is set, the left and right edges join (x wraps around); the top and bottom stay the poles
let WRAP_W = 0;
const wrapX = (x) => (WRAP_W ? ((x % WRAP_W) + WRAP_W) % WRAP_W : x);
function hexNb(x, y) { const o = y & 1; const r = [[x + 1, y], [x + o, y + 1], [x + o - 1, y + 1], [x - 1, y], [x + o - 1, y - 1], [x + o, y - 1]]; if (WRAP_W) for (const p of r) p[0] = ((p[0] % WRAP_W) + WRAP_W) % WRAP_W; return r; }
function hexDist1(a, b) { const ax = a.x - ((a.y - (a.y & 1)) >> 1), bx = b.x - ((b.y - (b.y & 1)) >> 1), ay = -ax - a.y, by = -bx - b.y; return Math.max(Math.abs(ax - bx), Math.abs(ay - by), Math.abs(a.y - b.y)); }
function hexDist(a, b) { if (!WRAP_W) return hexDist1(a, b); return Math.min(hexDist1(a, b), hexDist1(a, { x: b.x + WRAP_W, y: b.y }), hexDist1(a, { x: b.x - WRAP_W, y: b.y })); }
'use strict';
function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function noise(R, W, H, sc0) {
  const cells = Math.max(2, Math.round(W / sc0)), sc = W / cells;   // a whole number of cells across, so the noise joins up at the left and right edges
  const gw = Math.ceil(W / sc) + 2, gh = Math.ceil(H / sc) + 2, g = [];
  for (let y = 0; y < gh; y++) { g[y] = []; for (let x = 0; x < gw; x++) g[y][x] = R(); }
  for (let y = 0; y < gh; y++) for (let x = cells; x < gw; x++) g[y][x] = g[y][x - cells];
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
// a seed that walls the player's castle into a tiny pocket (mountains, lakes) is replaced by the next one, so every game has room to play
function genMap(seed, aiFacs, diff, mo = {}) {
  const SZ = SIZES[mo.size] || SIZES.medium, sc = (SZ.w * SZ.h) / 1120;
  let G = null;
  for (let k = 0; k < 6; k++) {
    G = genMapOnce(k ? (seed + k * 7919) >>> 0 : seed, aiFacs, diff, mo);
    if (G.objs.filter(o => o.t === 'mine').length >= 8 && G.objs.length >= 70 * Math.min(sc, 4)) break;
  }
  return G;
}
function genMapOnce(seed, aiFacs = ['necropolis'], diff = 'normal', mo = {}) {
  const DM = DIFFICULTY[diff] || DIFFICULTY.normal;
  const MP = MAPS[mo.preset] || MAPS.plains, SZ = SIZES[mo.size] || SIZES.medium;
  const R = rng(seed), W = SZ.w, H = SZ.h, sc = (W * H) / 1120;
  WRAP_W = mo.wrap ? W : 0;   // globe: east and west join up
  const fs = Math.max(1, Math.pow(sc, 0.3));
  const n1 = noise(R, W, H, 6 * fs), n2 = noise(R, W, H, 3 * fs);
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
  // rivers (drawn as streams, they do not block movement): from high ground downhill to water
  const river = Array.from({ length: H }, () => new Array(W).fill(0));
  { const RR = rng(seed ^ 0x2545f491), starts = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (tiles[y][x] === T.MOUNT) starts.push({ x, y });
    const nR = Math.max(2, Math.round(2.5 * sc));
    for (let k = 0; k < nR && starts.length; k++) {
      let c = starts.splice(Math.floor(RR() * starts.length), 1)[0], steps = 0, prev = null; const seen = new Set();
      // a river tile stores a bit for each neighbour its stream really flows to (64 marks 'river'); touching tiles of another bend are not joined, so no webs
      const link = (a, b2) => { if (!a || !b2 || tiles[a.y][a.x] === T.MOUNT || tiles[a.y][a.x] === T.WATER) return; const i = hexNb(a.x, a.y).findIndex(([nx, ny]) => nx === b2.x && ny === b2.y); if (i >= 0) river[a.y][a.x] |= 64 | (1 << i); };
      while (c && steps++ < 70) {
        if (tiles[c.y][c.x] === T.WATER) { link(prev, c); break; }
        seen.add(c.y * W + c.x);
        if (tiles[c.y][c.x] !== T.MOUNT) { river[c.y][c.x] |= 64; link(c, prev); link(prev, c); }
        const nb = hexNb(c.x, c.y).filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < W && ny < H && !seen.has(ny * W + nx));
        if (!nb.length) break;
        nb.sort((p, q) => (n1[p[1]][p[0]] + RR() * 0.12) - (n1[q[1]][q[0]] + RR() * 0.12));
        const nx = nb[0]; prev = c; c = { x: nx[0], y: nx[1] };
      }
    } }
  // starting castles: in about 4 of 10 games the classic corners (the map is laid out as before and mirrored); otherwise the player's castle and the rivals' capitals
  // stand at free places, anywhere inland, far enough from each other. The bay lies along the south edge, so the player's castle stays in the southern half.
  const flipX = R() < 0.5, flipY = R() < 0.5, fx = (x) => flipX ? W - 1 - x : x, fy = (y) => flipY ? H - 1 - y : y;
  const bayRowsMax = 5, minSep = Math.max(W, H) * 0.42, nAi = Math.max(1, aiFacs.length);
  let P = { x: fx(5), y: fy(H - 6) };
  let AIPOS = [{ x: fx(W - 6), y: fy(5) }, { x: fx(5), y: fy(5) }, { x: fx(W - 6), y: fy(H - 6) }, { x: fx(Math.floor(W / 2)), y: fy(4) }];
  if (R() >= 0.4) {
    const hd = (a, b2) => Math.max(Math.abs(a.x - b2.x), Math.abs(a.y - b2.y));
    const ri = (lo, hi) => lo + Math.floor(R() * (hi - lo + 1));
    for (let attempt = 0; attempt < 40; attempt++) {
      const p = { x: fx(ri(6, W - 7)), y: fy(ri(Math.round(H * 0.45), H - bayRowsMax - 3)) }, ais = [];
      for (let k = 0; k < nAi; k++) {
        let got = null;
        for (let t = 0; t < 80 && !got; t++) {
          const c = { x: fx(ri(5, W - 6)), y: fy(ri(5, H - bayRowsMax - 3)) };
          if (hd(c, p) >= minSep * (k ? 0.85 : 1) && ais.every(o => hd(o, c) >= minSep * 0.7)) got = c;
        }
        if (!got) break; ais.push(got);
      }
      if (ais.length === nAi) { P = p; AIPOS = ais; break; }
    }
  }
  const aiStarts = aiFacs.map((f, i) => AIPOS[i]);
  const E = aiStarts[0];
  // the bay along the southern edge, reachable by boat from the player's port
  const bayRows = Math.max(3, Math.min(5, Math.round(4 * MP.bay)));
  const bayTiles = [];
  const by = (y) => flipY ? H - 1 - y : y;
  for (let x = 10; x <= W - 12; x++) {
    const top = H - bayRows + (n2[by(H - 1)][x] > 0.5 ? 0 : 1);
    for (let y = top; y < H; y++) { tiles[by(y)][x] = T.WATER; bayTiles.push({ x, y: by(y) }); }
    if (top - 1 > 0 && tiles[by(top - 1)][x] === T.GRASS) tiles[by(top - 1)][x] = T.SAND;
  }
  const clear = (c, r) => { for (let y = c.y - r; y <= c.y + r; y++) for (let x = c.x - r; x <= c.x + r; x++) if (x >= 0 && y >= 0 && x < W && y < H) tiles[y][x] = T.GRASS; };
  clear(P, 3); aiStarts.forEach(a => clear(a, 3));
  // winding roads from the player's castle to every rival capital
  // roads are one hex wide: straight hex lines through a couple of random waypoints, so every step is a true neighbour
  const toCube = (x, y) => { const q = x - ((y - (y & 1)) >> 1); return { x: q, y: -q - y, z: y }; };
  const fromCube = (c) => ({ x: c.x + ((c.z - (c.z & 1)) >> 1), y: c.z });
  const cubeRound = (c) => { let rx = Math.round(c.x), ry = Math.round(c.y), rz = Math.round(c.z); const dx = Math.abs(rx - c.x), dy = Math.abs(ry - c.y), dz = Math.abs(rz - c.z); if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry; return { x: rx, y: ry, z: rz }; };
  const hexLinePts = (A, B) => { const a = toCube(A.x, A.y), b = toCube(B.x, B.y), n = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z)), out = []; for (let i = 0; i <= n; i++) { const t = n ? i / n : 0; out.push(fromCube(cubeRound({ x: a.x + (b.x - a.x) * t + 1e-6, y: a.y + (b.y - a.y) * t + 2e-6, z: a.z + (b.z - a.z) * t - 3e-6 }))); } return out; };
  const clampPt = (p) => ({ x: Math.max(2, Math.min(W - 3, p.x)), y: Math.max(2, Math.min(H - 3, p.y)) });
  const carveRoad = (A, B) => {
    const span = Math.max(Math.abs(A.x - B.x), Math.abs(A.y - B.y)), wps = [A];
    for (let k = 1; k <= (span > 24 ? 3 : 2); k++) { const t = k / ((span > 24 ? 3 : 2) + 1); wps.push(clampPt({ x: Math.round(A.x + (B.x - A.x) * t + (R() - 0.5) * 9), y: Math.round(A.y + (B.y - A.y) * t + (R() - 0.5) * 7) })); }
    wps.push(B);
    for (let i = 0; i + 1 < wps.length; i++) for (const p of hexLinePts(wps[i], wps[i + 1])) if (p.x >= 0 && p.y >= 0 && p.x < W && p.y < H) tiles[p.y][p.x] = T.ROAD;
  };
  aiStarts.forEach(a => carveRoad(P, a));
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
      if (tiles[c.y][c.x] !== T.WATER || (flipY ? c.y > H - 2 : c.y < 1)) continue;
      const d = (c.x - P.x) ** 2 + (c.y - P.y) ** 2;
      if (d < bd) { bd = d; dock = { x: c.x, y: c.y }; shore = { x: c.x, y: flipY ? c.y + 1 : c.y - 1 }; }
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
    for (const [nx, ny] of hexNb(c.x, c.y)) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(ny * W + nx) || !passable(tiles[ny][nx])) continue;
      seen.add(ny * W + nx); q.push({ x: nx, y: ny });
    }
  }
  const dist = (a, b) => { let dx = Math.abs(a.x - b.x); if (dx > W / 2) dx = W - dx; return Math.max(dx, Math.abs(a.y - b.y)); };
  let cand = [];
  for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
    const t = tiles[yy][xx];
    if ((t === T.GRASS || t === T.SAND) && seen.has(yy * W + xx) && !reserved.has(yy * W + xx) && dist({ x: xx, y: yy }, P) > 3 && aiStarts.every(a => dist({ x: xx, y: yy }, a) > 3)) cand.push({ x: xx, y: yy });
  }
  const blocked = new Set();   // tiles next to a placed object stay free (checked lazily: no list rebuilt per pick, which made big maps slow)
  const pick = () => {
    while (cand.length) {
      const i = Math.floor(R() * cand.length), c = cand[i]; cand[i] = cand[cand.length - 1]; cand.pop();
      if (blocked.has(c.y * W + c.x)) continue;
      blocked.add(c.y * W + c.x); blocked.add(c.y * W + c.x + 1); blocked.add(c.y * W + c.x - 1); blocked.add((c.y + 1) * W + c.x); blocked.add((c.y - 1) * W + c.x);
      return c;
    }
    return null;
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
  const emptyGar = () => [null, null, null, null, null, null, null];
  const garrisonOf = (f, scale) => {
    const ti = factionTiers(f), budgets = [3000, 3500, 4000, 5000, 5500, 6000];
    return budgets.map((b, i) => { const t = i < 3 ? ti[i] : lineType(ti[i], 2); return { t, n: Math.max(2, Math.round(b * scale / C[t].v)) }; });
  };
  // town objects carry their own faction, buildings and garrison (filled in by the game)
  objs.push({ t: 'town', owner: 0, x: P.x, y: P.y, name: 'Castle Dawnwatch', zone: 0, capital: true, garrison: emptyGar() });
  aiFacs.forEach((f, i) => objs.push({ t: 'town', owner: i + 1, fac: f, x: aiStarts[i].x, y: aiStarts[i].y, name: FACTIONS[f].enemyTown, zone: i + 1, capital: true, garrison: garrisonOf(f, DM.garrison) }));
  const seeds = [{ x: P.x, y: P.y, id: 0 }, ...aiStarts.map((a, i) => ({ x: a.x, y: a.y, id: i + 1 }))];
  let nextZone = seeds.length;
  // neutral towns (capturable for new castles)
  const townNames = ['Oakhaven', 'Stonebridge', 'Redwater', 'Highmoor', 'Silverlake', 'Ashford', 'Wolfsden', 'Ironvale', 'Kingsmere', 'Dunmere', 'Eastwatch', 'Falconcrest', 'Greymarch', 'Hollowbrook', 'Ivywood', 'Larkspur', 'Mistral', 'Northgate', 'Pinehurst', 'Quarry Hill', 'Rivenford', 'Summerholt', 'Thornfield', 'Underhill'];
  const facKeys = Object.keys(FACTIONS);
  const nTowns = Math.min(24, Math.max(1, Math.round(sc * 0.9)));
  const fortNames = ['Mistvale Keep', 'Ironhold Bastion', 'Sunspire Outpost', 'Grimwatch Tower', 'Stormhaven', 'Ravenmoor Hold', 'Dawnspire Fort', 'Blackfen Redoubt', 'Emberwatch', 'Frostgate', 'Goldcrest Bastion', 'Shadowvale Keep'];
  const spacing = Math.max(7, Math.round(9 * Math.pow(sc, 0.35)));
  const nForts = Math.min(12, Math.max(4, Math.round(4 * Math.sqrt(sc))));
  const placeSeed = () => {
    let c = null;
    for (let tries = 0; tries < 500 && !c; tries++) {
      const t = cand[Math.floor(R() * cand.length)];
      if (t && seeds.every(s => dist(s, t) >= spacing)) c = t;
    }
    if (!c) return null;
    cand = cand.filter(o => dist(o, c) > 1);
    return c;
  };
  for (let i = 0; i < nTowns; i++) {
    const c = placeSeed(); if (!c) break;
    const f = facKeys[Math.floor(R() * facKeys.length)], zid = nextZone++, d = depthOf(c);
    seeds.push({ x: c.x, y: c.y, id: zid });
    objs.push({ t: 'town', owner: null, fac: f, x: c.x, y: c.y, name: `${townNames[i % townNames.length]} (${FACTIONS[f].name})`, zone: zid, guard: i % 3 === 0 ? [] : garrisonOf(f, (0.35 + d * 0.9) * DM.neutral).slice(0, 5), garrison: emptyGar() });   // every third neutral town stands empty: walk in and it is yours
  }
  for (let i = 0; i < nForts; i++) {
    const c = placeSeed(); if (!c) break;
    const zid = nextZone++;
    seeds.push({ x: c.x, y: c.y, id: zid });
    objs.push({ t: 'fort', zone: zid, name: fortNames[i % fortNames.length], owner: null, x: c.x, y: c.y, guard: [guard(c, 1.4)], garrison: emptyGar() });
  }
  const zone = [];
  for (let yy = 0; yy < H; yy++) {
    zone[yy] = [];
    for (let xx = 0; xx < W; xx++) {
      let best = 0, bd = 1e9;
      for (const s of seeds) { let ddx = Math.abs(s.x - xx); if (ddx > W / 2) ddx = W - ddx; const d = ddx ** 2 + (s.y - yy) ** 2; if (d < bd) { bd = d; best = s.id; } }
      zone[yy][xx] = best;
    }
  }

  // ---- water sources: springs, oases and fountains found on shores next to lakes and seas ----
  {
    const shore = cand.filter(c => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = c.x + dx, ny = c.y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < H && tiles[ny][nx] === T.WATER) return true; } return false; });
    const kinds = ['mana', 'oasis', 'fortune'], nSpr = Math.max(2, Math.round(4 * Math.sqrt(sc)));
    for (let i = 0; i < nSpr && shore.length; i++) {
      const c = shore.splice(Math.floor(R() * shore.length), 1)[0];
      cand = cand.filter(o => dist(o, c) > 1);
      objs.push({ t: 'spring', kind: kinds[Math.floor(R() * kinds.length)], x: c.x, y: c.y, used: {} });
      for (let j = shore.length - 1; j >= 0; j--) if (dist(shore[j], c) < 4) shore.splice(j, 1);
    }
  }

  const facKeys3 = Object.keys(FACTIONS);
  // dragon lairs and outside dwellings are placed first so they always find room on the map
  for (let i = 0, n = Math.round(6 * sc); i < n; i++) { // creature dwellings: some are free to take, others must be won by beating the guards first
    const c = pick(); if (!c) break; const d = depthOf(c), neutral = R() < 0.25;
    if (neutral) {
      const ids = Object.keys(NEUTRAL_DW), cid = ids[Math.min(ids.length - 1, Math.floor(d * ids.length * (0.7 + R() * 0.6)))];
      objs.push({ t: 'dwelling', fac: null, cid, tier: 0, owner: null, avail: NEUTRAL_DW[cid], x: c.x, y: c.y, guard: R() < 0.45 ? [] : [guard(c, 0.9)] });
    } else {
      const tier = 1 + Math.min(5, Math.floor(R() * (2 + d * 5))), free = tier <= 2 ? R() < 0.4 : tier <= 4 ? R() < 0.12 : false;
      objs.push({ t: 'dwelling', fac: facKeys3[Math.floor(R() * facKeys3.length)], tier, owner: null, avail: GROWTH[tier - 1], x: c.x, y: c.y, guard: free ? [] : [guard(c, 0.8 + 0.1 * tier)] });
    }
  }
  for (let i = 0, n = Math.max(1, Math.round(1.1 * Math.sqrt(sc))); i < n; i++) { // dragon lairs: only reachable by beating a dragon horde
    let c = null; for (let t = 0; t < 8; t++) { const k = pick(); if (!k) break; c = k; if (depthOf(k) > 0.5) break; }
    if (!c) break; const d = depthOf(c);
    objs.push({ t: 'lair', owner: null, x: c.x, y: c.y, avail: Object.assign({}, LAIR_GROWTH), guard: [{ t: 'dragon', n: Math.max(3, Math.round((2 + d * 6) * DM.neutral)) }] });
  }
  // ---- more adventure objects ----
  const facKeys2 = Object.keys(FACTIONS), spellKeys = Object.keys(SPELLS);
  for (let i = 0, n = Math.round(5 * sc); i < n; i++) { const c = pick(); if (!c) break; objs.push({ t: 'resobj', kind: ['windmill', 'waterwheel', 'garden'][Math.floor(R() * 3)], week: -1, x: c.x, y: c.y }); }
  for (let i = 0, n = Math.round(2 * sc); i < n; i++) { const c = pick(); if (!c) break; objs.push({ t: 'stone', used: {}, x: c.x, y: c.y }); }
  for (let i = 0, n = Math.round(2 * sc); i < n; i++) { const c = pick(); if (!c) break; objs.push({ t: 'shrine', spell: spellKeys[Math.floor(R() * spellKeys.length)], used: {}, x: c.x, y: c.y }); }
  for (let i = 0, n = Math.round(2 * sc); i < n; i++) { const c = pick(); if (!c) break; objs.push({ t: 'tower', used: false, x: c.x, y: c.y }); }
  for (let i = 0, n = Math.round(3 * sc); i < n; i++) { // creature banks: strong guards, rich rewards
    const c = pick(); if (!c) break; const d = depthOf(c), kind = ['crypt', 'utopia', 'stockpile'][Math.floor(R() * 3)];
    const gt = kind === 'crypt' ? 'necropolis' : kind === 'utopia' ? null : 'stronghold', ti = gt ? factionTiers(gt) : null, m = (0.8 + d * 1.2) * DM.neutral;
    const gd = kind === 'utopia' ? [{ t: 'dragon', n: Math.max(2, Math.round(m * 3)) }] : [{ t: ti[2], n: Math.max(4, Math.round(m * 18)) }, { t: ti[4], n: Math.max(2, Math.round(m * 7)) }];
    objs.push({ t: 'bank', kind, x: c.x, y: c.y, guard: gd, gold: Math.round((1500 + d * 3500) * (kind === 'utopia' ? 2 : 1)), art: R() < (kind === 'utopia' ? 0.9 : 0.4) ? randomArt(R, artTierFor(d, R)) : null });
  }
  for (let i = 0, n = Math.max(1, Math.round(sc)); i < n; i++) { // monolith pairs
    const a = pick(), b = pick(); if (!a || !b) break; objs.push({ t: 'mono', id: i, x: a.x, y: a.y }, { t: 'mono', id: i, x: b.x, y: b.y });
  }
  for (let i = 0, n = Math.round(2 * sc); i < n; i++) { // seers: bring them resources for an artifact
    const c = pick(); if (!c) break; const d = depthOf(c), k = ['wood', 'ore', 'mercury', 'sulfur', 'crystal', 'gems'][Math.floor(R() * 6)];
    objs.push({ t: 'seer', need: k, amt: k === 'wood' || k === 'ore' ? 12 + Math.floor(R() * 10) : 5 + Math.floor(R() * 4), art: randomArt(R, Math.max(2, artTierFor(d, R))), x: c.x, y: c.y });
  }

  // prisons: free a captive hero (a jailor stack guards each one)
  { const heroKeys = Object.keys(HEROES); for (let i = 0, n = Math.max(1, Math.round(1.3 * sc)); i < n; i++) { const c = pick(); if (!c) break; objs.push({ t: 'prison', hero: heroKeys[Math.floor(R() * heroKeys.length)], x: c.x, y: c.y, guard: R() < 0.5 ? [] : [guard(c, 0.9)] }); } }
  // obelisks: visit them all to piece the map together and unearth a relic
  { const nO = Math.max(4, Math.round(4 * Math.sqrt(sc))); for (let i = 0; i < nO; i++) { const c = pick(); if (!c) break; objs.push({ t: 'obelisk', seen: false, x: c.x, y: c.y }); } }
  // quest guardians: a hero of enough level earns a reward
  for (let i = 0, n = Math.max(1, Math.round(1.5 * sc)); i < n; i++) { const c = pick(); if (!c) break; const d = depthOf(c); objs.push({ t: 'questgate', need: 3 + Math.round(d * 5) + Math.floor(R() * 2), art: randomArt(R, Math.max(2, artTierFor(d, R))), gold: 2000 + Math.round(d * 4000), x: c.x, y: c.y }); }
  // key masters and border gates: the tent of a colour hands out its key, the gate of the same colour guards a vault
  { const cols = ['red', 'blue', 'green', 'gold'], nK = Math.min(4, Math.max(1, Math.round(1.2 * sc))); for (let i = 0; i < nK; i++) { const a = pick(), b = pick(); if (!a || !b) break; const d = depthOf(b); objs.push({ t: 'keytent', col: cols[i], x: a.x, y: a.y, guard: R() < 0.6 ? [] : [guard(a, 0.7)] }, { t: 'gate', col: cols[i], gold: 3000 + Math.round(d * 5000), res: RES[1 + Math.floor(R() * (RES.length - 1))], art: randomArt(R, Math.max(3, artTierFor(d, R))), x: b.x, y: b.y }); } }

  const kindsBase = ['gold', 'gold', 'gold', 'wood', 'wood', 'ore', 'ore', 'mercury', 'sulfur', 'crystal', 'gems'];
  const nMines = Math.max(8, Math.round(11 * Math.pow(sc, 0.8)));
  // every capital gets a steady supply close by, like the old games: wood and ore within ~7 hexes, gold within ~9, one rare resource within ~12
  let guaranteed = 0;
  [{ s: P, own: true }, ...aiStarts.map(s => ({ s, own: false }))].forEach(({ s, own }, si) => {
    const rare = ['mercury', 'sulfur', 'crystal', 'gems'][(si + Math.floor(R() * 4)) % 4];
    [['wood', 7], ['ore', 7], ['gold', 9], [rare, 12]].forEach(([k, maxD]) => {
      let near = cand.filter(o => hexDist(o, s) >= 4 && hexDist(o, s) <= maxD);
      if (!near.length) near = cand.filter(o => hexDist(o, s) >= 4 && hexDist(o, s) <= maxD + 5);
      if (!near.length) return;
      const c = near[Math.floor(R() * near.length)];
      cand = cand.filter(o => Math.abs(o.x - c.x) + Math.abs(o.y - c.y) > 1);
      objs.push({ t: 'mine', kind: k, owner: null, x: c.x, y: c.y, guard: own && k !== 'wood' && k !== 'ore' && R() < 0.5 ? [guard(c, 0.3)] : [] });
      guaranteed++;
    });
  });
  if (mo.food || mo.build) {   // Hero building: rich deposits invite a mine of your own (Food mode adds farms to feed the army)
   if (mo.food) {   // Food mode: farms feed the army (two close to every capital, more scattered about); rich deposits invite a mine of your own
    [P, ...aiStarts].forEach((s) => {
      const near = cand.filter(o => hexDist(o, s) >= 4 && hexDist(o, s) <= 9);
      for (let k = 0; k < 2 && near.length; k++) { const c = near.splice(Math.floor(R() * near.length), 1)[0]; cand = cand.filter(o => Math.abs(o.x - c.x) + Math.abs(o.y - c.y) > 1); objs.push({ t: 'farm', owner: null, x: c.x, y: c.y, guard: [] }); }
    });
    for (let i = 0, n = Math.max(2, Math.round(4 * Math.pow(sc, 0.8))); i < n; i++) { const c = pick(); if (!c) break; objs.push({ t: 'farm', owner: null, x: c.x, y: c.y, guard: R() < 0.5 ? [] : [guard(c, 0.7)] }); }
   }
    const dk = ['wood', 'ore', 'gold', 'mercury', 'sulfur', 'crystal', 'gems'];
    for (let i = 0, n = Math.max(3, Math.round(5 * Math.pow(sc, 0.8))); i < n; i++) { const c = pick(); if (!c) break; objs.push({ t: 'deposit', kind: dk[Math.floor(R() * dk.length)], x: c.x, y: c.y }); }
  }
  const mineKinds = Array.from({ length: Math.max(4, nMines - guaranteed) }, (_, i) => kindsBase[i % kindsBase.length]);
  for (const k of mineKinds) { const c = pick(); if (!c) break; objs.push({ t: 'mine', kind: k, owner: null, x: c.x, y: c.y, guard: R() < (k === 'gold' ? 0.3 : 0.5) ? [] : [guard(c, 0.8)] }); }
  for (let i = 0, n = sc < 0.8 ? 2 : Math.round(3 * Math.sqrt(sc)); i < n; i++) { const c = pick(); if (!c) break; objs.push({ t: 'merchant', x: c.x, y: c.y }); }
  for (let i = 0, n = Math.round(28 * sc * MP.density); i < n; i++) { const c = pick(); if (!c) break; objs.push({ t: 'monster', x: c.x, y: c.y, guard: [guard(c)] }); }
  for (let i = 0, n = Math.round(5 * Math.sqrt(sc)); i < n; i++) { const c = pick(); if (c) objs.push({ t: 'art', art: randomArt(R, artTierFor(depthOf(c), R)), x: c.x, y: c.y, guard: R() < 0.4 ? [] : [guard(c, 1.1)] }); }
  for (let i = 0, n = Math.round(20 * sc); i < n; i++) { const c = pick(); if (!c) break; const k = RES[Math.floor(R() * RES.length)]; objs.push({ t: 'pile', kind: k, amt: k === 'gold' ? 500 + 250 * Math.floor(R() * 5) : 3 + Math.floor(R() * 6), x: c.x, y: c.y }); }
  for (let i = 0, n = Math.round(5 * sc); i < n; i++) { const c = pick(); if (!c) break; objs.push({ t: 'chest', x: c.x, y: c.y, gold: 1000 + 500 * Math.floor(R() * 4) }); }

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
    const nSea = Math.max(1, Math.round(sea.length / 110));
    for (let i = 0; i < 6 * nSea; i++) { const c = spick(); if (!c) break; const k = RES[Math.floor(R() * RES.length)]; objs.push({ t: 'pile', sea: true, kind: k, amt: k === 'gold' ? 1000 + 500 * Math.floor(R() * 4) : 4 + Math.floor(R() * 6), x: c.x, y: c.y }); }
    for (let i = 0; i < 3 * nSea; i++) { const c = spick(); if (!c) break; objs.push({ t: 'chest', sea: true, x: c.x, y: c.y, gold: 1500 + 500 * Math.floor(R() * 4) }); }
    for (let i = 0; i < 2 * nSea; i++) { const c = spick(); if (!c) break; objs.push({ t: 'wreck', x: c.x, y: c.y, gold: 1500 + 500 * Math.floor(R() * 4), res: RES[1 + Math.floor(R() * (RES.length - 1))], guard: [seaGuard(c, 0.8)] }); }
    for (let i = 0; i < 3 * nSea; i++) { const c = spick(); if (!c) break; objs.push({ t: 'monster', sea: true, x: c.x, y: c.y, guard: [seaGuard(c)] }); }
    for (let i = 0; i < Math.min(4, 1 + nSea); i++) { const c = spick(); if (c) objs.push({ t: 'art', sea: true, art: randomArt(R, 2 + Math.floor(R() * 3)), x: c.x, y: c.y, guard: [seaGuard(c, 1.3)] }); }
  }

  // climate regions: patches of desert, snow, swamp and lava ground scattered over the map (never around the player's castle); fights fought there use the matching battlefield
  const biome = []; { const BR = rng(seed ^ 0x5bd1e995), one = { desert: 1, snow: 2, swamp: 3, lava: 4 }[mo.biome], kinds = one ? [one] : [1, 2, 3, 4], span = Math.max(W, H), cs = []; const warp = noise(BR, W, H, 5 * fs);
    const nC = mo.biome === 'none' ? 0 : Math.max(3, Math.round(3 + sc * 1.6)); for (let i = 0; i < nC * 4 && cs.length < nC; i++) { const c = { x: Math.floor(BR() * W), y: Math.floor(BR() * H), k: kinds[(cs.length + Math.floor(BR() * 2)) % kinds.length], r: span * (0.14 + BR() * 0.12) * (one ? 1.5 : 1) }; if (Math.hypot(c.x - P.x, c.y - P.y) > Math.max(12, span * 0.38)) cs.push(c); }
    for (let y = 0; y < H; y++) { biome[y] = []; for (let x = 0; x < W; x++) { let best = 0, bd = 1e9; for (const c of cs) { const d = Math.hypot(c.x - x, (c.y - y) * 1.15) + (warp[y][x] - 0.5) * 7; if (d < c.r && d < bd) { bd = d; best = c.k; } } biome[y][x] = best; } } }
  return { W, H, tiles, biome, river, objs, P, E, aiStarts, zone, dock };
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

// every tile a hero can still reach with 'budget' movement points: Map(y * W + x -> cost). Same terrain costs as findPath; objects block except resource piles and chests.
function reachMap(G, sx, sy, budget, sail, caps) {
  const W = G.W, H = G.H, dist = new Map([[sy * W + sx, 0]]), open = [[0, sx, sy]];
  const cost = (nx, ny) => {
    if (caps && caps.block && caps.block(nx, ny)) return 0;   // a closed border
    const t = G.tiles[ny][nx], c = TCOST[t];
    let v;
    if (sail) v = t === T.WATER ? 100 - 10 * ((caps && caps.nav) || 0) : 0;
    else if (t === T.WATER) v = lakeAt(G, nx, ny) ? 100 : caps && caps.water ? WATERWALK_COST[caps.water] : 0;
    else if (t === T.FOREST) v = caps && caps.forest ? FOREST_COST[caps.forest] : 0;
    else if (t === T.MOUNT) v = caps && caps.mount ? MOUNT_COST[caps.mount] : 0;
    else v = c || 0;
    if (v && !sail && t !== T.ROAD && t !== T.WATER && G.biome) { const b = G.biome[ny] && G.biome[ny][nx]; if (b) v = Math.round(v * BIOME_COST[b] / 10) * 10; }
    return v;
  };
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
    const [d, cx, cy] = open.splice(bi, 1)[0];
    if (d > dist.get(cy * W + cx)) continue;
    for (const [nx, ny] of hexNb(cx, cy)) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const c = cost(nx, ny); if (!c) continue;
      const o = G.omap && G.omap.get(ny * W + nx); if (o && o.t !== 'pile' && o.t !== 'chest') continue;
      const nd = d + c; if (nd > budget) continue;
      const k = ny * W + nx; if (dist.has(k) && dist.get(k) <= nd) continue;
      dist.set(k, nd); open.push([nd, nx, ny]);
    }
  }
  dist.delete(sy * W + sx);
  return dist;
}

// small lakes inside the land (water that does not reach the map edge and is at most 30 tiles) are shallow: heroes wade through them for 100 movement
// without a boat or skill. Computed once per map and cached on G, so saved games get it too.
function lakeAt(G, x, y) {
  if (!G.lakeMask) {
    const W = G.W, H = G.H, m = new Uint8Array(W * H), seen = new Uint8Array(W * H);
    for (let s0 = 0; s0 < W * H; s0++) {
      if (seen[s0] || G.tiles[(s0 / W) | 0][s0 % W] !== T.WATER) continue;
      const comp = [], st = [s0]; seen[s0] = 1; let edge = false;
      while (st.length) { const p = st.pop(); comp.push(p); const px = p % W, py = (p / W) | 0; if (px === 0 || py === 0 || px === W - 1 || py === H - 1) edge = true;
        for (const [nx, ny] of hexNb(px, py)) { if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const q = ny * W + nx; if (!seen[q] && G.tiles[ny][nx] === T.WATER) { seen[q] = 1; st.push(q); } } }
      if (!edge && comp.length <= 30) for (const p of comp) m[p] = 1;
    }
    G.lakeMask = m;
  }
  return G.lakeMask[y * G.W + x] === 1;
}
// perk-based terrain costs per rank (index = rank): forests, mountains, walking on water
const FOREST_COST = [0, 200, 150, 100], MOUNT_COST = [0, 300, 250, 200], WATERWALK_COST = [0, 160, 130, 100];
// sail: the hero travels by boat (water tiles; a land tile only as the final step to disembark)
// caps: { forest, mount, water } perk ranks letting the hero cross otherwise blocked terrain
function findPath(G, sx, sy, tx, ty, ignoreObjs, sail, caps) {
  const W = G.W, H = G.H, N = W * H, k = (x, y) => y * W + x;
  if (tx < 0 || ty < 0 || tx >= W || ty >= H) return null;
  const target = k(tx, ty);
  const tcost0 = (nx, ny, nk) => {
    if (caps && caps.block && caps.block(nx, ny)) return 0;   // a closed border
    const t = G.tiles[ny][nx], c = TCOST[t];
    if (sail) return t === T.WATER ? 100 - 10 * ((caps && caps.nav) || 0) : (c && nk === target ? c : 0);
    if (t === T.WATER) {
      if (lakeAt(G, nx, ny)) return 100;
      if (!ignoreObjs && nk === target && G.boats && G.boats.some(b => b.x === nx && b.y === ny)) return 100;
      return caps && caps.water ? WATERWALK_COST[caps.water] : 0;
    }
    if (t === T.FOREST) return caps && caps.forest ? FOREST_COST[caps.forest] : 0;
    if (t === T.MOUNT) return caps && caps.mount ? MOUNT_COST[caps.mount] : 0;
    return c || 0;
  };
  // climate multiplier on the ground cost (roads and boats are unaffected)
  const tcost = (nx, ny, nk) => { const c = tcost0(nx, ny, nk), t = G.tiles[ny][nx]; if (!c || sail || t === T.ROAD || t === T.WATER || !G.biome) return c; const b = G.biome[ny] && G.biome[ny][nx]; return b ? Math.round(c * BIOME_COST[b] / 10) * 10 : c; };
  if (!tcost(tx, ty, target)) return null;
  const g = new Float32Array(N).fill(Infinity), f = new Float32Array(N).fill(Infinity), bc = new Float32Array(N);
  const prev = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const heur = (x, y) => hexDist({ x, y }, { x: tx, y: ty }) * 50;
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
    for (const [nx, ny] of hexNb(cx, cy)) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const nk = k(nx, ny), cost = tcost(nx, ny, nk);
      if (!cost) continue;
      if (!ignoreObjs && nk !== target) {
        const o = G.omap.get(nk);
        if (o && o.t !== 'pile' && o.t !== 'chest') continue;
      }
      const ng = g[cur] + cost;
      if (ng < g[nk]) { g[nk] = ng; f[nk] = ng + heur(nx, ny); prev[nk] = cur; bc[nk] = cost; open.push(nk); }
    }
  }
  if (prev[target] === -1 && target !== s) return null;
  const path = [];
  for (let c = target; c !== s; c = prev[c]) {
    const p = prev[c], px = p % W, py = (p / W) | 0, cx = c % W, cy = (c / W) | 0;
    path.push({ x: cx, y: cy, cost: Math.round(bc[c]) });
  }
  return path.reverse();
}
