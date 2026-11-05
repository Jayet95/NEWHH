'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const TS = 32, FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
  const COARSE = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  let VW = 960, VH = 640, Z = (COARSE || window.innerWidth < 700) ? 1.5 : 1;
  const SAVE = 'h3js_save_v5';
  const MOVE_PER_DAY = 1700;
  const FLEE_RATIO = 3;
  const cmap = $('map'), cx = cmap.getContext('2d'), mini = $('mini'), mx = mini.getContext('2d');
  let G = null, cam = { x: 0, y: 0 }, hover = null, busy = false, selSlot = -1, terrain = null;

  // ---------- helpers ----------
  window.toast = (t) => {
    const d = document.createElement('div'); d.textContent = t; $('toast').appendChild(d);
    setTimeout(() => d.remove(), 2800);
  };
  window.showModal = (html, buttons = ['OK']) => new Promise(res => {
    $('mbox').innerHTML = html + '<div class="mb"></div>';
    buttons.forEach((b, i) => {
      const el = document.createElement('button'); el.textContent = b; if (i === 0) el.className = 'primary';
      el.onclick = () => { $('modal').classList.add('hide'); res(i); };
      $('mbox').lastChild.appendChild(el);
    });
    $('modal').classList.remove('hide');
  });
  const perk = (h, id) => (h.perks && h.perks[id]) || 0;
  const myTowns = () => G.objs.filter(o => o.t === 'town' && o.owner === 0);
  const town = () => myTowns()[0] || null;
  const townAt = (x, y) => { const o = objAt(G, x, y); return o && o.t === 'town' && o.owner === 0 ? o : null; };
  const nearestTown = (x, y) => myTowns().sort((a, b) => Math.max(Math.abs(a.x - x), Math.abs(a.y - y)) - Math.max(Math.abs(b.x - x), Math.abs(b.y - y)))[0] || null;
  const tiersOf = (t) => factionTiers(t.fac || G.faction);
  const aiById = (id) => G.ais.find(a => a.id === id);
  const allAiHeroes = () => G.ais.flatMap(a => a.heroes);
  const aiHeroAt = (x, y) => allAiHeroes().find(h => h.x === x && h.y === y);
  const AICOL = ['#e03a3a', '#e0a030', '#a050e0', '#30b0a0'];
  const ownCol = (o) => (o === null || o === undefined) ? '#999' : o === 0 ? '#3a8aff' : AICOL[(o - 1) % 4];
  const ownFill = (o, a) => { const c = ownCol(o); return `rgba(${parseInt(c.slice(1, 3), 16)},${parseInt(c.slice(3, 5), 16)},${parseInt(c.slice(5, 7), 16)},${a})`; };
  const armyCount = (h) => h.army.reduce((s, a) => s + (a ? a.n : 0), 0);
  const maxMana = (h) => h.kn * 10 + 15 * perk(h, 'wisdom');
  const heroMorale = (h) => {
    const facs = new Set(h.army.filter(Boolean).map(a => C[a.t].fac).filter(Boolean));
    return Math.max(-3, Math.min(3, perk(h, 'leadership') - Math.max(0, facs.size - 1)));
  };
  const heroLuck = (h) => Math.min(3, perk(h, 'fortune'));
  const capsOf = (h) => ({ forest: perk(h, 'forester'), mount: perk(h, 'mountaineer'), water: perk(h, 'waterwalk') });
  const sgn = (n) => (n > 0 ? '+' : '') + n;
  const sizeMv = () => (G && SIZES[G.size] && SIZES[G.size].mv) || 1;
  const maxMove = (h) => Math.round(MOVE_PER_DAY * sizeMv() * (1 + 0.1 * perk(h, 'logistics')));
  const need = (l) => 150 * l * l;
  const heroesAt = (x, y) => G.heroes.filter(h => h.x === x && h.y === y);
  const heroAtTown = (h) => !!townAt(h.x, h.y);
  const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const setActive = (i) => { G.sel = i; G.hero = G.heroes[i]; };
  const townHero = (t) => { const at = heroesAt(t.x, t.y); return at.includes(G.hero) ? G.hero : at[0] || null; };
  const emptyArmy = () => [null, null, null, null, null, null, null];
  const sfx = (n) => { if (typeof Sfx !== 'undefined') Sfx.play(n); };
  const fmtN = (n) => n >= 100000 ? Math.round(n / 1000) + 'k' : n >= 10000 ? (n / 1000).toFixed(1) + 'k' : String(n);
  function banner(text, sub) {
    const b = $('banner'); b.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  }
  document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('button') && !e.target.closest('#bat')) sfx('click'); });
  $('bSnd').onclick = () => { const on = Sfx.toggle(); $('bSnd').textContent = on ? '🔊' : '🔇'; };
  $('bSnd').textContent = Sfx.on ? '🔊' : '🔇';
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  function addToArmy(h, t, n) {
    const a = h.army;
    let i = a.findIndex(s => s && s.t === t);
    if (i < 0) i = a.findIndex(s => !s);
    if (i < 0) return false;
    if (a[i]) a[i].n += n; else a[i] = { t, n };
    return true;
  }
  function mergeArmy(h) {
    const out = [];
    for (const s of h.army) if (s) { const f = out.find(o => o.t === s.t); if (f) f.n += s.n; else out.push({ ...s }); }
    h.army = out.concat(Array(7 - out.length).fill(null));
  }
  function makeHero(def, x, y) {
    return { id: def.id, name: def.name, cls: def.cls, icon: def.i, x, y, att: def.att, def: def.def, sp: def.sp, kn: def.kn,
      lvl: 1, xp: 0, mana: def.kn * 10, move: MOVE_PER_DAY, army: emptyArmy(), perks: {} };
  }
  function learn(spells) { for (const k of spells) if (!G.spells.includes(k)) G.spells.push(k); }
  function rollTavern() {
    const pool = Object.values(HEROES).filter(d => !G.heroes.some(h => h.id === d.id));
    G.tavern = shuffle(pool).slice(0, 3).map(d => d.id);
  }

  // ---------- new game / save ----------
  const DF = () => DIFFICULTY[(G && G.diff) || 'normal'];
  function seedFrom(s) {
    s = String(s || '').trim();
    if (!s) return Math.floor(Math.random() * 1e9);
    if (/^\d+$/.test(s)) return parseInt(s, 10) % 2147483647;
    let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
    return Math.abs(h);
  }
  function initTown(t, level) {
    t.b = { 1: 1, 2: 1, 3: level ? 1 : 0, 4: 0, 5: 0, 6: 0, 7: 0, hall: level ? 1 : 0, guild: 0, market: 0, ship: 0 };
    t.up = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1 };
    t.avail = { 1: GROWTH[0], 2: GROWTH[1] };
    if (level) t.avail[3] = GROWTH[2];
    if (!t.garrison) t.garrison = emptyArmy();
    t.fort = level ? 1 : 0; t.minel = 0;
  }
  function newGame(faction, heroId, diff = 'normal', map = {}) {
    const D = DIFFICULTY[diff], r = (n) => Math.max(1, Math.round(n * D.res));
    const preset = map.preset || 'plains', size = map.size || 'medium', seed = seedFrom(map.seed);
    const nAI = Math.max(1, Math.min(4, map.ais || { small: 1, medium: 1, large: 2, huge: 3, giant: 4 }[size] || 1));
    const aiFacs = shuffle(Object.keys(FACTIONS).filter(f => f !== faction)).slice(0, nAI);
    const m = genMap(seed, aiFacs, diff, { preset, size });
    setFaction(faction);
    G = { seed, preset, size, W: m.W, H: m.H, tiles: m.tiles, zone: m.zone, objs: m.objs, dock: m.dock, boats: [], nextBoat: 1, day: 1, over: false, path: null, faction, diff,
      res: { gold: D.gold, wood: r(20), ore: r(20), mercury: r(5), sulfur: r(5), crystal: r(5), gems: r(5) }, spells: [...START_SPELLS],
      wk: {}, heroes: [], sel: 0, hero: null, tavern: [], noTown: 0,
      ais: aiFacs.map((f, i) => ({ id: i + 1, fac: f, name: FACTIONS[f].name, gold: Math.round(3000 * D.aiInc), heroes: [], alive: true, spawnWait: 0 })) };
    for (const o of G.objs) if (o.t === 'town') {
      if (o.owner === 0) { o.fac = faction; o.name = FACTIONS[faction].town; initTown(o, 0); }
      else initTown(o, o.owner ? 1 : 0);
    }
    for (const ai of G.ais) spawnAiHero(ai, G.objs.find(o => o.t === 'town' && o.owner === ai.id));
    const def = HEROES[heroId], h = makeHero(def, m.P.x, m.P.y), ti = factionTiers(faction);
    h.army = [{ t: ti[0], n: 20 }, { t: ti[1], n: 10 }, { t: ti[2], n: 5 }, null, null, null, null];
    h.move = maxMove(h);
    G.heroes.push(h); setActive(0); learn(def.spells); rollTavern();
    reindex(G); buildTerrain(); sizeMini(); centerOn(h.x, h.y); renderAll();
    toast(`${MAPS[preset].name} (${SIZES[size].name}, seed ${seed}) · ${D.name}: defeat ${nAI > 1 ? 'all ' + nAI + ' rivals by capturing their towns' : 'the rival by capturing their towns'}. Good luck, ${h.name}!`);
  }
  const saveJSON = () => JSON.stringify(G, (k, v) => (k === 'omap' || k === 'hero') ? undefined : v);
  function save() { try { localStorage.setItem(SAVE, saveJSON()); toast('Game saved.'); } catch (e) { toast('Save failed.'); } }
  function load() {
    try {
      const s = localStorage.getItem(SAVE); if (!s) return false;
      G = JSON.parse(s); if (!G.zone || !G.heroes || !G.ais) return false;
      G.path = null; G.boats = G.boats || []; setFaction(G.faction); setActive(Math.min(G.sel, G.heroes.length - 1));
      reindex(G); buildTerrain(); sizeMini(); centerOn(G.hero.x, G.hero.y); renderAll(); return true;
    } catch (e) { return false; }
  }

  // ---------- terrain rendering ----------
  function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function buildTerrain() {
    terrain = document.createElement('canvas'); terrain.width = G.W * TS; terrain.height = G.H * TS;
    const c = terrain.getContext('2d');
    for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) {
      const t = G.tiles[y][x], h = hash(x, y), px = x * TS, py = y * TS;
      const base = { [T.GRASS]: [74, 124, 58], [T.FOREST]: [52, 98, 46], [T.MOUNT]: [96, 90, 84], [T.WATER]: [40, 92, 146], [T.ROAD]: [168, 138, 90], [T.SAND]: [200, 178, 108] }[t];
      const v = (h - 0.5) * 16;
      c.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v})`; c.fillRect(px, py, TS, TS);
      if (t === T.WATER) { c.strokeStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.moveTo(px + 4, py + 10 + h * 8); c.quadraticCurveTo(px + 12, py + 4 + h * 8, px + 20, py + 10 + h * 8); c.stroke(); }
      if (t === T.GRASS && h > 0.8) { c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(px + h * 20, py + h * 24, 2, 2); }
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `26px ${FONT}`;
      if (t === T.FOREST) c.fillText('🌲', px + 16, py + 17);
      if (t === T.MOUNT) c.fillText('⛰️', px + 16, py + 17);
    }
  }
  let MK = 6, miniTerr = null, miniCache = null, miniSig = '';
  function sizeMini() {
    MK = Math.max(3, Math.floor(240 / G.W)); mini.width = G.W * MK; mini.height = G.H * MK; miniSig = '';
    miniTerr = document.createElement('canvas'); miniTerr.width = mini.width; miniTerr.height = mini.height;
    const t = miniTerr.getContext('2d');
    for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) { t.fillStyle = MC[G.tiles[y][x]]; t.fillRect(x * MK, y * MK, MK, MK); }
    miniCache = document.createElement('canvas'); miniCache.width = mini.width; miniCache.height = mini.height;
  }
  function clampCam() {
    cam.x = G.W * TS <= VW ? -(VW - G.W * TS) / 2 : Math.max(0, Math.min(G.W * TS - VW, cam.x));
    cam.y = G.H * TS <= VH ? -(VH - G.H * TS) / 2 : Math.max(0, Math.min(G.H * TS - VH, cam.y));
  }
  function centerOn(x, y) { resizeMap(); cam.x = x * TS + TS / 2 - VW / 2; cam.y = y * TS + TS / 2 - VH / 2; clampCam(); }
  function resizeMap() {
    const w = cmap.clientWidth, h = cmap.clientHeight; if (w < 50 || h < 50) return;
    if (cmap.width === w && cmap.height === h && VW === w / Z) return;
    const mx0 = cam.x + VW / 2, my0 = cam.y + VH / 2;
    cmap.width = w; cmap.height = h; VW = w / Z; VH = h / Z;
    if (G) { cam.x = mx0 - VW / 2; cam.y = my0 - VH / 2; clampCam(); }
  }
  function setZoom(nz, ax, ay) {
    nz = Math.max(0.3, Math.min(3, nz)); const wx = ax / Z + cam.x, wy = ay / Z + cam.y; Z = nz; resizeMap();
    cam.x = wx - ax / Z; cam.y = wy - ay / Z; clampCam();
  }

  function objIcon(o) {
    switch (o.t) {
      case 'town': return '🏰';
      case 'fort': return '🏯';
      case 'merchant': return '⛺';
      case 'wreck': return '🚢';
      case 'mine': return MINE_ICON[o.kind];
      case 'pile': return RES_ICON[o.kind];
      case 'chest': return '🧰';
      case 'art': return ARTIFACTS[o.art].i;
      case 'monster': return C[o.guard[0].t].i;
    }
  }
  function draw() {
    if (!G) return;
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.fillStyle = '#000'; cx.fillRect(0, 0, cmap.width, cmap.height); cx.setTransform(Z, 0, 0, Z, 0, 0);
    cx.imageSmoothingEnabled = Z < 1.4;
    cx.drawImage(terrain, cam.x, cam.y, VW, VH, 0, 0, VW, VH);
    const x0 = Math.floor(cam.x / TS), y0 = Math.floor(cam.y / TS), vx = Math.ceil(VW / TS) + 2, vy = Math.ceil(VH / TS) + 2;
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.lineWidth = 2; cx.strokeStyle = 'rgba(255,255,255,.45)';
    const zo = {}; for (const o of G.objs) if (o.t === 'fort' || o.t === 'town') zo[o.zone] = o.owner;
    for (let y = Math.max(0, y0); y < Math.min(G.H, y0 + vy); y++) for (let x = Math.max(0, x0); x < Math.min(G.W, x0 + vx); x++) {
      const z = G.zone[y][x], ow = zo[z], px = x * TS - cam.x, py = y * TS - cam.y;
      if (ow !== null && ow !== undefined && G.tiles[y][x] !== T.WATER) { cx.fillStyle = ownFill(ow, 0.2); cx.fillRect(px, py, TS, TS); }
      if (x + 1 < G.W && G.zone[y][x + 1] !== z) { cx.beginPath(); cx.moveTo(px + TS, py); cx.lineTo(px + TS, py + TS); cx.stroke(); }
      if (y + 1 < G.H && G.zone[y + 1][x] !== z) { cx.beginPath(); cx.moveTo(px, py + TS); cx.lineTo(px + TS, py + TS); cx.stroke(); }
    }
    if (G.path) {
      let left = G.hero.move;
      G.path.forEach((s, i) => {
        left -= s.cost; const ok = left >= 0;
        const px = s.x * TS - cam.x + TS / 2, py = s.y * TS - cam.y + TS / 2;
        cx.beginPath(); cx.arc(px, py, i === G.path.length - 1 ? 7 : 4, 0, 7);
        cx.fillStyle = ok ? 'rgba(140,255,140,.9)' : 'rgba(255,110,90,.9)'; cx.fill();
      });
      const total = G.path.reduce((s, p) => s + p.cost, 0), days = total <= G.hero.move ? 0 : Math.ceil((total - G.hero.move) / maxMove(G.hero));
      const end = G.path[G.path.length - 1], lx = end.x * TS - cam.x + TS / 2, ly = end.y * TS - cam.y - 6, txt = days ? `${days + 1} days — click to go` : '✓ today — click to go';
      cx.font = 'bold 11px sans-serif'; const tw = cx.measureText(txt).width + 12;
      cx.fillStyle = days ? 'rgba(120,30,20,.9)' : 'rgba(20,80,30,.9)'; cx.fillRect(lx - tw / 2, ly - 9, tw, 18);
      cx.fillStyle = '#fff'; cx.fillText(txt, lx, ly);
    }
    for (const o of G.objs) {
      if (o.x < x0 - 1 || o.x > x0 + vx || o.y < y0 - 1 || o.y > y0 + vy) continue;
      const px = o.x * TS - cam.x + TS / 2, py = o.y * TS - cam.y + TS / 2;
      if (o.t === 'monster' || o.t === 'art' || o.t === 'mine' || o.t === 'wreck') {
        cx.beginPath(); cx.arc(px, py, 15, 0, 7);
        cx.fillStyle = o.t === 'monster' ? 'rgba(90,10,10,.65)' : 'rgba(0,0,0,.45)'; cx.fill();
      }
      cx.font = `${o.t === 'town' ? 40 : o.t === 'fort' ? 34 : 26}px ${FONT}`; cx.fillStyle = '#fff';
      cx.fillText(objIcon(o), px, py + 1);
      if (o.t === 'fort') {
        cx.beginPath(); cx.arc(px + 14, py - 16, 6, 0, 7); cx.fillStyle = ownCol(o.owner); cx.fill(); cx.strokeStyle = '#000'; cx.lineWidth = 1; cx.stroke();
        const gn = o.garrison.reduce((s, a) => s + (a ? a.n : 0), 0);
        if (o.owner === 0 && gn) { cx.font = 'bold 11px sans-serif'; cx.fillStyle = '#000b'; cx.fillRect(px - 14, py + 10, 28, 13); cx.fillStyle = '#fff'; cx.fillText(gn, px, py + 17); }
      }
      if (o.t === 'mine') { cx.beginPath(); cx.arc(px + 12, py - 12, 5, 0, 7); cx.fillStyle = ownCol(o.owner); cx.fill(); cx.strokeStyle = '#000'; cx.lineWidth = 1; cx.stroke(); }
      if (o.t === 'town') { cx.beginPath(); cx.arc(px + 16, py - 18, 6, 0, 7); cx.fillStyle = ownCol(o.owner); cx.fill(); cx.strokeStyle = '#000'; cx.lineWidth = 1; cx.stroke(); }
      if (o.t === 'town' || o.t === 'fort') {
        cx.font = 'bold 11px sans-serif'; cx.lineWidth = 3; cx.strokeStyle = '#000'; cx.fillStyle = o.owner === 0 ? '#bcd8ff' : o.owner ? '#ffb3a8' : '#f3e7bd';
        cx.strokeText(o.name, px, py - 27); cx.fillText(o.name, px, py - 27);
      }
    }
    for (const b of G.boats) {
      const px = b.x * TS - cam.x + TS / 2, py = b.y * TS - cam.y + TS / 2;
      cx.font = `30px ${FONT}`; cx.fillStyle = '#fff'; cx.fillText('⛵', px, py + 2);
    }
    for (const ai of G.ais) for (const eh of ai.heroes) {
      const px = eh.x * TS - cam.x + TS / 2, py = eh.y * TS - cam.y + TS / 2;
      cx.beginPath(); cx.arc(px, py, 15, 0, 7); cx.fillStyle = ownCol(ai.id); cx.fill(); cx.strokeStyle = '#000'; cx.lineWidth = 2; cx.stroke();
      cx.font = `22px ${FONT}`; cx.fillStyle = '#fff'; cx.fillText(eh.icon, px, py + 1);
    }
    G.heroes.forEach((h, i) => {
      const px = h.x * TS - cam.x + TS / 2 + (G.heroes.filter((o, j) => j < i && o.x === h.x && o.y === h.y).length * 6), py = h.y * TS - cam.y + TS / 2;
      const rr = h.boat != null ? 11 : 15;
      cx.beginPath(); cx.arc(px, py - (h.boat != null ? 6 : 0), rr, 0, 7); cx.fillStyle = '#2a5fb0'; cx.fill();
      cx.strokeStyle = h === G.hero ? '#ffd24a' : '#fff'; cx.lineWidth = h === G.hero ? 3 : 1.5; cx.stroke();
      cx.font = `${h.boat != null ? 16 : 22}px ${FONT}`; cx.fillStyle = '#fff'; cx.fillText(h.icon, px, py + 1 - (h.boat != null ? 6 : 0));
    });
    if (hover) { cx.strokeStyle = 'rgba(255,255,255,.8)'; cx.lineWidth = 2; cx.strokeRect(hover.x * TS - cam.x + 1, hover.y * TS - cam.y + 1, TS - 2, TS - 2); }
    drawMini();
  }
  const MC = { [T.GRASS]: '#4a7c3a', [T.FOREST]: '#2f5a2a', [T.MOUNT]: '#666', [T.WATER]: '#285c92', [T.ROAD]: '#a88a5a', [T.SAND]: '#c8b26c' };
  function drawMini() {
    const k = MK;
    const zo = {}; for (const o of G.objs) if (o.t === 'fort' || o.t === 'town') zo[o.zone] = o.owner;
    const sig = Object.keys(zo).map(z => zo[z]).join(',');
    if (sig !== miniSig) {
      miniSig = sig;
      const c = miniCache.getContext('2d'); c.drawImage(miniTerr, 0, 0);
      for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) {
        const ow = zo[G.zone[y][x]];
        if (ow !== null && ow !== undefined) { c.fillStyle = ownFill(ow, 0.4); c.fillRect(x * k, y * k, k, k); }
      }
    }
    mx.drawImage(miniCache, 0, 0);
    for (const o of G.objs) {
      mx.fillStyle = (o.t === 'fort' || o.t === 'town') ? ownCol(o.owner) : o.t === 'monster' ? '#a33' : o.t === 'mine' ? (o.owner !== null ? ownCol(o.owner) : '#ddd') : o.t === 'merchant' ? '#fa0' : '#ee6';
      mx.fillRect(o.x * k - (o.t === 'town' ? 1 : 0), o.y * k - (o.t === 'town' ? 1 : 0), k + (o.t === 'town' ? 2 : 0), k + (o.t === 'town' ? 2 : 0));
    }
    mx.fillStyle = '#8df'; for (const b of G.boats) mx.fillRect(b.x * k, b.y * k, k, k);
    for (const ai of G.ais) for (const eh of ai.heroes) { mx.fillStyle = ownCol(ai.id); mx.fillRect(eh.x * k - 1, eh.y * k - 1, k + 2, k + 2); mx.strokeStyle = '#000'; mx.strokeRect(eh.x * k - 1, eh.y * k - 1, k + 2, k + 2); }
    mx.fillStyle = '#fff'; for (const h of G.heroes) mx.fillRect(h.x * k - 1, h.y * k - 1, k + 2, k + 2);
    mx.strokeStyle = '#fff'; mx.lineWidth = 1; mx.strokeRect(cam.x / TS * k, cam.y / TS * k, VW / TS * k, VH / TS * k);
  }
  function loop() {
    if (G && !document.body.classList.contains('inbattle')) {
      if (cmap.clientWidth && (cmap.clientWidth !== cmap.width || cmap.clientHeight !== cmap.height)) resizeMap();
      draw();
    }
    requestAnimationFrame(loop);
  }

  // ---------- UI panels ----------
  function renderAll() {
    if (!G) return;
    const gn = computeGain();
    $('res').innerHTML = RES.map(k => `<span class="chip" title="${k[0].toUpperCase() + k.slice(1)}: ${G.res[k]}${gn[k] ? ` (+${gn[k]}/day)` : ''}">${RES_ICON[k]} <b>${fmtN(G.res[k])}</b></span>`).join('');
    $('income').innerHTML = `📈 ${RES.filter(k => gn[k]).map(k => `+${fmtN(gn[k])}${RES_ICON[k]}`).join(' ') || 'no income'}<small>/day</small>`;
    const d = G.day - 1;
    $('date').textContent = `Month ${Math.floor(d / 28) + 1} · Week ${Math.floor(d % 28 / 7) + 1} · Day ${d % 7 + 1} · ${DF().icon} ${DF().name}`;
    const h = G.hero;
    const perkTxt = Object.keys(h.perks).filter(k => h.perks[k]).map(k => `${PERKS[k].i}${PERKS[k].n} ${'★'.repeat(h.perks[k])}`).join(' · ');
    $('hero').innerHTML = `<div class="hlist">${G.heroes.map((x, i) => `<button class="hbtn${x === h ? ' on' : ''}" data-h="${i}" title="${x.name} (${x.cls})">${x.icon}</button>`).join('')}</div>
      <h3>${h.icon} ${h.name} <span class="small">${h.cls} — Level ${h.lvl}</span></h3>
      <div class="stats"><span>⚔️ Attack ${h.att}</span><span>🛡 Defense ${h.def}</span><span>✨ Spell Pow ${h.sp}</span><span>📚 Knowledge ${h.kn}</span></div>
      <div class="small" title="Morale: each point = 4% chance of an extra turn (negative: of skipping a turn). Mixing creatures from different castles lowers it; undead and golems are immune. Luck: each point = 4% chance of double damage.">😀 Morale ${sgn(heroMorale(h))} · 🍀 Luck ${sgn(heroLuck(h))}</div>
      <div class="small">Movement ${h.move}/${maxMove(h)}</div><div class="bar mv"><i style="width:${Math.min(100, h.move / maxMove(h) * 100)}%"></i></div>
      ${h.boat != null ? '<div class="small">⛵ Sailing — walk onto a shore tile to disembark</div>' : ''}
      <div class="small">Mana ${h.mana}/${maxMana(h)}</div><div class="bar mn"><i style="width:${Math.min(100, h.mana / maxMana(h) * 100)}%"></i></div>
      <div class="small">XP ${h.xp}/${need(h.lvl)}</div><div class="bar xp"><i style="width:${Math.min(100, h.xp / need(h.lvl) * 100)}%"></i></div>
      ${perkTxt ? `<div class="small">${perkTxt}</div>` : ''}
      <div class="small" title="${G.spells.map(k => SPELLS[k].n).join(', ')}">Spells: ${G.spells.map(k => SPELLS[k].i).join(' ')}</div>
      <button id="bPortal" class="small-btn" title="Teleport to your castle">🌀 Town Portal (${PORTAL_COST} mana)</button>`;
    $('hero').querySelectorAll('[data-h]').forEach(b => b.onclick = () => { if (busy) return; setActive(+b.dataset.h); G.path = null; centerOn(G.hero.x, G.hero.y); renderAll(); });
    $('bPortal').onclick = townPortal;
    const zs = G.objs.filter(o => o.t === 'fort' || o.t === 'town').sort((a, b) => a.zone - b.zone);
    const mineIncome = G.objs.filter(o => o.t === 'mine' && o.owner === 0 && zoneOwner(G, G.zone[o.y][o.x]) === 0).length;
    const mine = zs.filter(z => z.owner === 0), rest = zs.length - mine.length;
    $('terr').innerHTML = `<h3>🗺 Territory — ${mine.length}/${zs.length} zones</h3>` +
      mine.map(z => { const gn = z.garrison ? z.garrison.reduce((s, a) => s + (a ? a.n : 0), 0) : 0;
        return `<div class="zrow"><span class="zdot" style="background:${ownCol(0)};color:${ownCol(0)}"></span>${z.t === 'town' ? '🏰' : '🏯'} ${z.name} <span class="small">garrison ${gn}</span></div>`; }).join('') +
      `<div class="small">Paying mines: ${mineIncome} · other zones: ${rest}</div>` +
      G.ais.map(ai => { const tw = G.objs.filter(o => o.t === 'town' && o.owner === ai.id).length, fr = G.objs.filter(o => o.t === 'fort' && o.owner === ai.id).length;
        return `<div class="zrow" title="Rival: ${FACTIONS[ai.fac].name}"><span class="zdot" style="background:${ownCol(ai.id)};color:${ownCol(ai.id)}"></span>${FACTIONS[ai.fac].icon} ${ai.alive ? `${tw} towns, ${fr} forts, ${ai.heroes.length} heroes` : '<s>eliminated</s>'}</div>`; }).join('');
    const el = $('army'); el.innerHTML = '';
    h.army.forEach((a, i) => {
      const b = document.createElement('button');
      b.className = 'slot' + (a ? '' : ' empty') + (i === selSlot ? ' sel' : '');
      if (a) { const c = C[a.t]; b.innerHTML = `${c.i}<small>${a.n}${c.lv > 1 ? ' ' + '★'.repeat(c.lv - 1) : ''}</small>`; b.title = `${c.n}\nAtt ${c.a} Def ${c.d} Dmg ${c.lo}-${c.hi} HP ${c.hp} Spd ${c.s}${c.shoot ? '\nShooter' : ''}${c.fly ? '\nFlying' : ''}`; }
      b.onclick = () => slotClick(i);
      el.appendChild(b);
    });
    const sw = document.createElement('div'); sw.className = 'small'; sw.style.gridColumn = '1/-1'; sw.textContent = 'Click two slots to swap / merge.'; el.appendChild(sw);
  }
  function slotClick(i) {
    if (busy) return;
    const a = G.hero.army;
    if (selSlot < 0) { if (a[i]) selSlot = i; }
    else {
      if (selSlot !== i) {
        if (a[selSlot] && a[i] && a[selSlot].t === a[i].t) { a[i].n += a[selSlot].n; a[selSlot] = null; }
        else [a[selSlot], a[i]] = [a[i], a[selSlot]];
      }
      selSlot = -1;
    }
    renderAll();
  }
  function townPortal() {
    const h = G.hero;
    if (busy) return;
    if (heroAtTown(h)) return toast('Already in a town.');
    if (h.mana < PORTAL_COST) return toast(`Town Portal needs ${PORTAL_COST} mana.`);
    const tw = nearestTown(h.x, h.y); if (!tw) return toast('You own no town to teleport to.');
    h.mana -= PORTAL_COST; h.x = tw.x; h.y = tw.y; h.boat = null; h.move = Math.min(h.move, 400); G.path = null;
    centerOn(h.x, h.y); renderAll(); toast(`${h.name} teleports home.`);
  }

  // ---------- map input ----------
  function tileFromEvent(ev) {
    const r = cmap.getBoundingClientRect();
    const px = (ev.clientX - r.left) * (cmap.width / r.width) / Z + cam.x, py = (ev.clientY - r.top) * (cmap.height / r.height) / Z + cam.y;
    const x = Math.floor(px / TS), y = Math.floor(py / TS);
    return x >= 0 && y >= 0 && x < G.W && y < G.H ? { x, y } : null;
  }
  function armyList(arr, vague) { return arr.filter(Boolean).map(a => vague ? `${groupLabel(a.n)} ${C[a.t].n}s` : `${a.n} ${C[a.t].n}`).join(', '); }
  function describe(x, y) {
    const ah = aiHeroAt(x, y); if (ah) return `<b>${ah.name}</b> (rival ${FACTIONS[aiById(ah.ai).fac].name} hero, L${ah.lvl})<br>${armyList(ah.army, true)}`;
    const hs = heroesAt(x, y); if (hs.length) return hs.map(h => `<b>${h.name}</b> (${h.cls} L${h.lvl})${h.boat != null ? ' ⛵ sailing' : ''}`).join('<br>');
    if (G.boats.some(b => b.x === x && b.y === y)) return '<b>⛵ Your boat</b><br>Walk onto it from the shore to set sail.';
    const o = objAt(G, x, y);
    if (!o) return ['Grass', 'Forest (needs Forester)', 'Mountains (needs Mountaineer)', 'Water (needs a boat or Water Walk)', 'Road (fast)', 'Sand (slow)'][G.tiles[y][x]];
    const g = o.guard && o.guard.length ? `<br>Guarded by: ${armyList(o.guard, true)}` : '';
    switch (o.t) {
      case 'town': {
        const fn = FACTIONS[o.fac || G.faction].name, gn = (o.garrison || []).reduce((s, a) => s + (a ? a.n : 0), 0);
        return o.owner === 0 ? `<b>${o.name}</b> — your ${fn} town (garrison ${gn})`
          : o.owner ? `<b>${o.name}</b> — rival ${fn} town${gn ? ' — garrison: ' + armyList(o.garrison, true) : ''}<br>Assaulting it is a siege battle.`
            : `<b>${o.name}</b> — neutral ${fn} town${g}<br>Capture it for a new castle (siege battle).`;
      }
      case 'merchant': return '<b>Wandering Merchant</b><br>Buy missing resources';
      case 'wreck': return `<b>Shipwreck</b><br>Salvage: ${RES_ICON.gold}${o.gold} + ${RES_ICON[o.res]}${g}`;
      case 'mine': {
        const supplied = o.owner === 0 && zoneOwner(G, G.zone[o.y][o.x]) === 0;
        return `<b>${o.kind[0].toUpperCase() + o.kind.slice(1)} mine</b> (${o.owner === 0 ? 'yours' : o.owner ? 'held by a rival' : 'unclaimed'}) +${MINE_YIELD[o.kind]}/day` +
          (o.owner === 0 && !supplied ? '<br>⚠ Pays nothing: you do not hold this zone' : o.owner !== 0 ? '<br>Pays only if you also hold its zone' : '') + g;
      }
      case 'fort': {
        const gn = o.garrison.reduce((s, a) => s + (a ? a.n : 0), 0);
        return `<b>${o.name}</b> — ${o.owner === 0 ? `your fort (garrison ${gn})` : o.owner ? `held by a rival${gn ? ' — garrison: ' + armyList(o.garrison, true) : ''}` : 'neutral zone stronghold'}<br>Holding it: +${FORT_INCOME} 🪙/day and zone mine income${o.owner === null ? g : ''}<br>Assault = siege battle`;
      }
      case 'pile': return `${RES_ICON[o.kind]} ${o.amt} ${o.kind}`;
      case 'chest': return 'Treasure chest';
      case 'art': return `<b>${ARTIFACTS[o.art].n}</b> (+${ARTIFACTS[o.art].v} ${ARTIFACTS[o.art].stat})${g}`;
      case 'monster': return `Monsters: ${armyList(o.guard, true)}`;
    }
  }
  function updateHover(ev) {
    if (!G) return;
    hover = tileFromEvent(ev);
    if (!hover) cmap.style.cursor = 'default';
    else {
      const o = objAt(G, hover.x, hover.y), tt = G.tiles[hover.y][hover.x];
      const cp = capsOf(G.hero);
      const blocked = (tt === T.FOREST && !cp.forest) || (tt === T.MOUNT && !cp.mount) || (tt === T.WATER && !cp.water && G.hero.boat == null && !G.boats.some(b => b.x === hover.x && b.y === hover.y));
      cmap.style.cursor = (o || heroesAt(hover.x, hover.y).length || aiHeroAt(hover.x, hover.y)) ? 'pointer' : blocked ? 'not-allowed' : 'crosshair';
    }
    const tip = $('tip');
    if (hover) {
      tip.innerHTML = describe(hover.x, hover.y);
      const r = $('stage').getBoundingClientRect();
      tip.style.left = Math.min(ev.clientX - r.left + 14, r.width - 270) + 'px'; tip.style.top = (ev.clientY - r.top + 14) + 'px';
      tip.classList.remove('hide');
    } else tip.classList.add('hide');
  }
  cmap.addEventListener('mousemove', updateHover);
  cmap.addEventListener('mouseleave', () => { hover = null; $('tip').classList.add('hide'); });
  // drag to pan, pinch / wheel / buttons to zoom
  const ptrs = new Map(); let drag = null, pinch = null, suppress = false;
  const pdist = () => { const a = [...ptrs.values()]; return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); };
  cmap.addEventListener('pointerdown', (e) => {
    if (!G) return;
    try { cmap.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.pointerType !== 'mouse') updateHover(e);
    if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false };
    else if (ptrs.size === 2) { pinch = { d: pdist(), z: Z }; drag = null; suppress = true; }
  });
  cmap.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size === 2) {
      const r = cmap.getBoundingClientRect(), a = [...ptrs.values()];
      setZoom(pinch.z * pdist() / pinch.d, (a[0].x + a[1].x) / 2 - r.left, (a[0].y + a[1].y) / 2 - r.top); suppress = true;
    } else if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 7) { drag.moved = true; $('tip').classList.add('hide'); }
      if (drag.moved) { cam.x = drag.cx - dx / Z; cam.y = drag.cy - dy / Z; clampCam(); suppress = true; }
    }
  });
  const endPtr = (e) => {
    ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
    if (ptrs.size === 0) { drag = null; setTimeout(() => { suppress = false; }, 0); }
    else if (ptrs.size === 1) { const p = [...ptrs.values()][0]; drag = { x: p.x, y: p.y, cx: cam.x, cy: cam.y, moved: true }; }
  };
  cmap.addEventListener('pointerup', endPtr); cmap.addEventListener('pointercancel', endPtr);
  cmap.addEventListener('wheel', (e) => {
    if (!G) return; e.preventDefault();
    const r = cmap.getBoundingClientRect(); setZoom(Z * (e.deltaY < 0 ? 1.12 : 1 / 1.12), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  const zoomMid = (f) => setZoom(Z * f, cmap.width / 2, cmap.height / 2);
  $('zIn').onclick = () => zoomMid(1.25); $('zOut').onclick = () => zoomMid(0.8);
  $('zHome').onclick = () => { if (G) centerOn(G.hero.x, G.hero.y); };
  window.addEventListener('resize', resizeMap); window.addEventListener('orientationchange', () => setTimeout(resizeMap, 200));
  cmap.addEventListener('click', (ev) => {
    if (suppress) return;
    if (!G || busy || G.over) return;
    const t = tileFromEvent(ev); if (!t) return;
    const here = heroesAt(t.x, t.y);
    if (here.length) {
      if (!here.includes(G.hero)) { setActive(G.heroes.indexOf(here[0])); G.path = null; renderAll(); return; }
      const o = objAt(G, t.x, t.y);
      if (heroAtTown(G.hero)) openTown(townAt(G.hero.x, G.hero.y)); else if (o && o.t === 'fort' && o.owner === 0) openFort(o, G.hero);
      return;
    }
    const last = G.path && G.path[G.path.length - 1];
    if (last && last.x === t.x && last.y === t.y) return moveHero();
    const p = findPath(G, G.hero.x, G.hero.y, t.x, t.y, false, G.hero.boat != null, capsOf(G.hero));
    if (!p || !p.length) { G.path = null; return toast(G.hero.boat != null ? 'Cannot sail there — disembark on a shore tile.' : "Can't reach there. (Water needs a boat.)"); }
    G.path = p;
  });
  mini.addEventListener('click', (ev) => {
    if (!G) return; const r = mini.getBoundingClientRect();
    centerOn((ev.clientX - r.left) / r.width * G.W, (ev.clientY - r.top) / r.height * G.H);
  });
  document.addEventListener('keydown', (e) => {
    if (!G || document.body.classList.contains('inbattle') || !$('modal').classList.contains('hide') || !$('title').classList.contains('hide')) return;
    const k = e.key.toLowerCase(), s = TS * 2;
    if (k === 'arrowleft' || k === 'a') { cam.x -= s; clampCam(); }
    else if (k === 'arrowright' || k === 'd') { cam.x += s; clampCam(); }
    else if (k === 'arrowup' || k === 'w') { cam.y -= s; clampCam(); }
    else if (k === 'arrowdown' || k === 's') { cam.y += s; clampCam(); }
    else if (k === '+' || k === '=') zoomMid(1.25);
    else if (k === '-') zoomMid(0.8);
    else if (k === 'e') endTurn();
    else if (k === 't') openTown();
    else if (k === 'h') centerOn(G.hero.x, G.hero.y);
    else if (k === 'tab') { e.preventDefault(); if (!busy) { setActive((G.sel + 1) % G.heroes.length); G.path = null; centerOn(G.hero.x, G.hero.y); renderAll(); } }
    else if (k === ' ' && G.path) { e.preventDefault(); moveHero(); }
  });

  // ---------- hero movement & interaction ----------
  async function moveHero() {
    if (busy || !G.path) return;
    busy = true;
    const h = G.hero, path = G.path; G.path = null;
    for (let i = 0; i < path.length; i++) {
      const s = path[i];
      if (s.cost > h.move) { G.path = path.slice(i); toast('Out of movement — end turn to continue.'); break; }
      h.move -= s.cost;
      const water = G.tiles[s.y][s.x] === T.WATER;
      if (h.boat != null) {
        if (water) { const bt = G.boats.find(b => b.id === h.boat); if (bt) { bt.x = s.x; bt.y = s.y; } }
        else { h.boat = null; toast(`${h.name} disembarks.`); }
      } else if (water) {
        const bt = G.boats.find(b => b.x === s.x && b.y === s.y);
        if (bt) { h.boat = bt.id; toast(`${h.name} sets sail!`); }
      }
      h.x = s.x; h.y = s.y; centerOn(h.x, h.y); renderAll(); sfx('step');
      await sleep(70);
      const last = i === path.length - 1, o = objAt(G, s.x, s.y);
      const eh = aiHeroAt(s.x, s.y);
      if (eh) {
        if (o && (o.t === 'town' || o.t === 'fort') && o.owner === eh.ai) await interact(o, h, eh);
        else await fightAiHero(h, eh, true);
        break;
      }
      if (o && (o.t === 'pile' || o.t === 'chest')) { collect(o); continue; }
      if (o && last) { await interact(o, h); break; }
    }
    busy = false; renderAll();
  }
  function collect(o) {
    sfx('coin');
    if (o.t === 'pile') { G.res[o.kind] += o.amt; toast(`Collected ${o.amt} ${RES_ICON[o.kind]} ${o.kind}.`); }
    else { G.res.gold += o.gold; toast(`The chest holds ${o.gold} 🪙 gold!`); }
    G.objs.splice(G.objs.indexOf(o), 1); reindex(G);
  }
  // defenders of a town/fort: its garrison (or neutral guard), plus a rival hero standing inside
  function defendersOf(o, eh) {
    const base = o.owner ? o.garrison.filter(Boolean) : (o.guard || []);
    if (!eh) return base;
    const tmp = emptyArmy();
    [...eh.army, ...o.garrison].forEach(s => { if (s) addToArmy({ army: tmp }, s.t, s.n); });
    return tmp.filter(Boolean);
  }
  async function interact(o, h, eh) {
    if (o.t === 'wreck') {
      if (o.guard && o.guard.length) { if (!(await fight(h, o.guard, { att: 0, def: 0 }, 'Shipwreck guardians'))) return; o.guard = []; }
      const n = 3 + Math.floor(Math.random() * 4);
      G.res.gold += o.gold; G.res[o.res] += n; G.objs.splice(G.objs.indexOf(o), 1); reindex(G); renderAll();
      return showModal(`<h2>🚢 Shipwreck salvaged</h2><p>${h.name}'s crew recovers ${RES_ICON.gold}${o.gold} and ${RES_ICON[o.res]}${n} from the wreck.</p>`);
    }
    if (o.t === 'merchant') return openMarket(MERCHANT_RATE + ((G.wk && G.wk.rateBonus) || 0), 'Wandering Merchant', false);
    if (o.t === 'town') {
      if (o.owner === 0) { for (const x of heroesAt(o.x, o.y)) x.mana = maxMana(x); return openTown(o); }
      return conquerTown(h, o, eh);
    }
    if (o.t === 'fort') {
      if (o.owner === 0) return openFort(o, h);
      const army = defendersOf(o, eh);
      if (army.length && !(await fight(h, army, { att: eh ? eh.att : o.owner ? 4 : 0, def: eh ? eh.def : o.owner ? 4 : 0 }, `Siege of ${o.name}`, siegeOf(o, 1), eh))) { if (eh) shrinkArmy(eh.army, 0.5); return; }
      if (eh) removeAiHero(eh);
      o.owner = 0; o.guard = []; o.garrison = emptyArmy();
      renderAll();
      await showModal(`<h2>🏯 ${o.name} captured!</h2><p>The zone is yours: +${FORT_INCOME} 🪙/day, mine income in the zone, and +${MILITIA} militia per week. Station troops here to defend it from the enemy hero.</p>`);
      return openFort(o, h);
    }
    if (o.t === 'mine') {
      if (o.owner === 0) return toast('This mine is already yours.');
      if (o.guard && o.guard.length) { if (!(await fight(h, o.guard, { att: 0, def: 0 }, 'Mine guardians'))) return; o.guard = []; }
      o.owner = 0; return toast(`You now own the ${o.kind} mine!`);
    }
    if (o.t === 'art') {
      if (o.guard && o.guard.length) { if (!(await fight(h, o.guard, { att: 0, def: 0 }, 'Artifact guardians'))) return; o.guard = []; }
      const a = ARTIFACTS[o.art]; h[a.stat] += a.v;
      G.objs.splice(G.objs.indexOf(o), 1); reindex(G);
      return showModal(`<h2>${a.i} ${a.n}</h2><p>Found by ${h.name}! +${a.v} ${a.stat === 'att' ? 'Attack' : a.stat === 'def' ? 'Defense' : a.stat === 'sp' ? 'Spell Power' : 'Knowledge'}.</p>`);
    }
    if (o.t === 'monster') {
      const ratio = armyValue(h.army) / Math.max(1, armyValue(o.guard)), cr = perk(h, 'charisma');
      const canFlee = ratio >= FLEE_RATIO, canJoin = cr > 0 && ratio >= FLEE_RATIO - 0.5 * cr - 0.5;
      if (canFlee || canJoin) {
        const opts = ['⚔ Fight'], acts = ['fight'];
        if (canJoin) { opts.push('🤝 Recruit them'); acts.push('join'); }
        if (canFlee) { opts.push('🕊 Let them go'); acts.push('go'); }
        const names = armyList(o.guard, true);
        const pct = Math.round((0.5 + 0.25 * (cr - 1)) * 100);
        const i = await showModal(`<h2>😨 They tremble before you</h2><p>${names} cower before ${h.name}'s army (${ratio.toFixed(1)}× stronger).</p>
          <p class="small">${canJoin ? `Your Charisma lets ${pct}% of them join your army.` : 'You may spare them — no fight, no experience.'}${cr ? '' : ' (The Charisma perk would let them join you.)'}</p>`, opts);
        const act = acts[i];
        if (act === 'go') { G.objs.splice(G.objs.indexOf(o), 1); reindex(G); return toast('The monsters scatter and flee.'); }
        if (act === 'join') {
          let joined = 0;
          for (const g of o.guard) {
            const n = Math.max(1, Math.floor(g.n * (0.5 + 0.25 * (cr - 1))));
            if (addToArmy(h, g.t, n)) joined += n; else toast(`No free army slot for ${C[g.t].n}.`);
          }
          if (joined) { G.objs.splice(G.objs.indexOf(o), 1); reindex(G); renderAll(); return toast(`${joined} creatures join ${h.name}!`); }
          return;
        }
      }
      if (await fight(h, o.guard, { att: 0, def: 0 }, 'Wandering monsters')) { G.objs.splice(G.objs.indexOf(o), 1); reindex(G); }
    }
  }
  function retreat(h) {
    h.army = emptyArmy(); h.boat = null; G.path = null;
    const tw = nearestTown(h.x, h.y);
    if (tw) { h.x = tw.x; h.y = tw.y; }
    if (h === G.hero) centerOn(h.x, h.y);
    toast(tw ? `${h.name} returns to ${tw.name} with no army. Recruit new troops!` : `${h.name} has lost the army and has no town to return to!`);
  }
  async function conquerTown(h, o, hero) {
    const defenders = defendersOf(o, hero);
    const cmd = hero ? { name: hero.name, icon: hero.icon, att: hero.att, def: hero.def } : { name: 'Garrison commander', icon: '🏰', att: 4, def: 4 };
    if (defenders.length && !(await fight(h, defenders, { att: cmd.att, def: cmd.def }, `Siege of ${o.name}`, siegeOf(o, 1), cmd))) { if (hero) shrinkArmy(hero.army, 0.5); return; }
    if (hero) removeAiHero(hero);
    takeTown(o, 0);
    await showModal(`<h2>🏰 ${o.name} captured!</h2><p>A new ${FACTIONS[o.fac].name} town joins your realm. Recruit its creatures, build up its Town Hall, and garrison it against the rivals.</p>`);
    if (!checkVictory()) openTown(o);
  }
  function takeTown(o, newOwner) {
    o.owner = newOwner; o.guard = []; o.garrison = emptyArmy(); o.avail = {};
    for (let i = 1; i <= 7; i++) if (o.b[i]) o.avail[i] = GROWTH[i - 1];
    if (newOwner === 0) G.noTown = 0;
    reindex(G); renderAll();
  }
  // victory: every rival has lost all of its towns
  function checkVictory() {
    for (const ai of G.ais) if (ai.alive && !G.objs.some(o => o.t === 'town' && o.owner === ai.id)) { ai.alive = false; ai.heroes = []; toast(`${FACTIONS[ai.fac].name} rival is eliminated!`); }
    if (!G.over && G.ais.every(a => !a.alive)) { endGame(true); return true; }
    return false;
  }
  async function fight(h, guard, eStats, title, siege, eHero) {
    if (!armyCount(h)) { toast(`${h.name} has no army! Recruit in town first.`); return false; }
    const res = await Battle.run({ hero: { att: h.att, def: h.def, sp: h.sp, mana: h.mana, spells: G.spells, perks: h.perks, name: h.name, icon: h.icon, morale: heroMorale(h), luck: heroLuck(h) },
      army: h.army, enemy: guard.filter(Boolean).map(a => ({ ...a })), eStats, eHero, title, siege, canRetreat: true });
    h.mana = res.mana;
    if (res.win) {
      res.survivors.forEach((n, i) => { if (h.army[i]) { if (n > 0) h.army[i].n = n; else h.army[i] = null; } });
      await gainXp(h, res.xp);
    } else retreat(h);
    renderAll();
    return res.win;
  }
  async function gainXp(h, xp) {
    h.xp += xp;
    while (h.xp >= need(h.lvl)) {
      h.xp -= need(h.lvl); h.lvl++; sfx('level');
      const r = Math.random(), st = r < .3 ? 'att' : r < .6 ? 'def' : r < .8 ? 'sp' : 'kn';
      h[st]++;
      const statName = { att: 'Attack', def: 'Defense', sp: 'Spell Power', kn: 'Knowledge' }[st];
      const opts = shuffle(Object.keys(PERKS).filter(k => perk(h, k) < MAX_PERK && (!PERKS[k].minLvl || h.lvl >= PERKS[k].minLvl))).slice(0, 2);
      const head = `<h2>⭐ ${h.name} reaches level ${h.lvl}!</h2><p>+1 ${statName}</p>`;
      if (!opts.length) { await showModal(head); continue; }
      const i = await showModal(`${head}<p>Choose a perk:</p><div class="small">${opts.map(k => `${PERKS[k].i} <b>${PERKS[k].n}</b> (rank ${perk(h, k) + 1}) — ${PERKS[k].d}`).join('<br>')}</div>`, opts.map(k => `${PERKS[k].i} ${PERKS[k].n}`));
      h.perks[opts[i]] = perk(h, opts[i]) + 1;
    }
  }
  // a player hero fights a rival hero (open field, or a siege when the rival attacks a town/fort the hero stands in)
  async function fightAiHero(h, e, playerAttacks) {
    const atTown = heroAtTown(h), fo = objAt(G, h.x, h.y), atFort = fo && fo.t === 'fort' && fo.owner === 0;
    if (!armyCount(h)) { retreat(h); return false; }
    const siege = !playerAttacks && (atTown || atFort) ? siegeOf(townAt(h.x, h.y) || fo, 0) : null;
    const win = await fight(h, e.army, { att: e.att, def: e.def }, `${e.name}'s army`, siege, e);
    if (win) { removeAiHero(e); toast(`${e.name} is defeated!`); return true; }
    shrinkArmy(e.army, 0.5);
    return false;
  }
  function removeAiHero(e) { const ai = aiById(e.ai); if (ai) { ai.heroes = ai.heroes.filter(x => x !== e); ai.spawnWait = 3; } }

  // ---------- generic army exchange ----------
  function openExchange(title, note, A, nameA, B, nameB, back, extra) {
    let sel = null;
    const arr = (r) => r === 'a' ? A : B;
    const render = () => {
      const row = (a, rk) => a.map((s, i) => `<button class="slot${s ? '' : ' empty'}${sel && sel.r === rk && sel.i === i ? ' sel' : ''}" data-r="${rk}" data-i="${i}">${s ? `${C[s.t].i}<small>${s.n}</small>` : ''}</button>`).join('');
      $('mbox').innerHTML = `<h2>${title}</h2><div class="small">${note}</div>${extra ? extra.html : ''}
        <h4>${nameA}</h4><div class="armyrow">${row(A, 'a')}</div><h4>${nameB}</h4><div class="armyrow">${row(B, 'b')}</div>
        <div class="small">Click a slot, then another: move / merge / swap.</div>
        <div class="mb"><button class="primary" id="xClose">${back ? 'Back' : 'Close'}</button></div>`;
      $('xClose').onclick = () => { if (back) back(); else { $('modal').classList.add('hide'); renderAll(); } };
      if (extra) extra.bind();
      $('mbox').querySelectorAll('.slot').forEach(b => b.onclick = () => {
        const r = b.dataset.r, i = +b.dataset.i;
        if (!sel) { if (arr(r)[i]) sel = { r, i }; }
        else {
          if (!(sel.r === r && sel.i === i)) {
            const X = arr(sel.r), Y = arr(r);
            if (X[sel.i] && Y[i] && X[sel.i].t === Y[i].t) { Y[i].n += X[sel.i].n; X[sel.i] = null; }
            else { const tmp = X[sel.i]; X[sel.i] = Y[i]; Y[i] = tmp; }
          }
          sel = null;
        }
        render();
      });
    };
    render(); $('modal').classList.remove('hide');
  }

  // ---------- town ----------
  let townAnim = null, townLoop = false;
  const LV_COL = ['#7a6a50', '#8c7a58', '#9e8a60', '#b49c62', '#d4b252'];
  const SLOTS = 11;
  const TIER_HALL = [null, 0, 0, 1, 2, 3, 4, 5];
  const UP_HALL = { 2: 1, 3: 2, 4: 3, 5: 4 };
  let curTown = null;
  const defaultTown = () => townAt(G.hero.x, G.hero.y) || nearestTown(G.hero.x, G.hero.y);
  const tierType = (t, tier) => lineType(tiersOf(t)[tier - 1], (t.up && t.up[tier]) || 1);
  const starStr = (lv, max = MAX_LV) => '★'.repeat(lv) + '☆'.repeat(max - lv);
  function startTownAnim(kind, slot) { townAnim = { kind, slot, t0: performance.now() }; sfx(kind === 'upgrade' ? 'level' : 'build'); }
  function slotInfo(t, i) {
    if (i < 7) return { built: !!t.b[i + 1], lv: t.up[i + 1] || 1, max: MAX_LV, icon: C[tierType(t, i + 1)].i };
    if (i === 7) return { built: t.b.hall > 0, lv: t.b.hall, max: 5, icon: '🏛️' };
    if (i === 8) return { built: t.b.guild > 0, lv: t.b.guild, max: 3, icon: '🔮' };
    if (i === 9) return { built: !!t.b.market, lv: t.b.market ? 1 : 0, max: 1, icon: '⚖️' };
    return { built: !!t.b.ship, lv: t.b.ship ? 1 : 0, max: 1, icon: '⚓' };
  }
  function drawTown() {
    const cv = $('tcv');
    if (!cv || $('modal').classList.contains('hide')) { townLoop = false; return; }
    const g = cv.getContext('2d'), now = performance.now(), t = curTown, W = cv.width, H = cv.height;
    if (!t) return;
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#2a3f6a'); sky.addColorStop(0.7, '#c98f5a'); sky.addColorStop(1, '#4a6a3a');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(30,25,40,.55)'; g.fillRect(W / 2 - 160, 40, 320, 62);
    for (let k = 0; k < 6; k++) g.fillRect(W / 2 - 160 + k * 62, 28, 40, 14);
    g.fillRect(W / 2 - 22, 8, 44, 44);
    g.fillStyle = '#3d5a2e'; g.fillRect(0, 118, W, H - 118);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (townAnim && now - townAnim.t0 > 1600) townAnim = null;
    for (let i = 0; i < SLOTS; i++) {
      const x = 40 + i * 70, base = 120, s = slotInfo(t, i);
      const an = townAnim && townAnim.slot === i ? townAnim : null, p = an ? Math.min(1, (now - an.t0) / 1500) : 1;
      if (!s.built) {
        g.setLineDash([4, 4]); g.strokeStyle = 'rgba(255,255,255,.35)'; g.strokeRect(x - 28, base - 54, 56, 54); g.setLineDash([]);
        g.font = '22px ' + FONT; g.fillStyle = '#fff'; g.globalAlpha = 0.6; g.fillText('🚧', x, base - 27); g.globalAlpha = 1;
        continue;
      }
      const bw = 56, bh = 54, hgt = an && an.kind === 'build' ? bh * Math.min(1, p * 1.5) : bh;
      g.fillStyle = LV_COL[Math.min(4, Math.max(0, s.lv - 1) * (s.max === 3 ? 2 : 1))]; g.fillRect(x - bw / 2, base - hgt, bw, hgt);
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x - bw / 2, base - hgt, 4, hgt);
      if (hgt >= bh * 0.99) { g.fillStyle = '#6a2c2c'; g.beginPath(); g.moveTo(x - 32, base - bh); g.lineTo(x, base - bh - 20); g.lineTo(x + 32, base - bh); g.closePath(); g.fill(); }
      let size = 28;
      if (an && an.kind === 'upgrade') size = 28 * (1 + 0.7 * Math.sin(p * Math.PI));
      const bob = Math.sin(now / 400 + i) * 2;
      if (hgt >= bh * 0.6) { g.font = `${size}px ${FONT}`; g.fillStyle = '#fff'; g.fillText(s.icon, x, base - 28 + bob); }
      if (an && an.kind === 'upgrade') {
        const rg = g.createRadialGradient(x, base - 30, 2, x, base - 30, 14 + p * 70);
        rg.addColorStop(0, `rgba(255,240,150,${0.9 * (1 - p)})`); rg.addColorStop(1, 'rgba(255,200,60,0)');
        g.fillStyle = rg; g.beginPath(); g.arc(x, base - 30, 14 + p * 70, 0, 7); g.fill();
        g.font = '14px ' + FONT; g.fillStyle = '#ffe680';
        for (let k = 0; k < 6; k++) { g.globalAlpha = 1 - p; g.fillText('✦', x + Math.cos(k * 1.1) * 34 * p, base - 30 - p * 55 + Math.sin(k * 2.3) * 12); }
        g.globalAlpha = 1;
      }
      if (an && an.kind === 'build') {
        g.font = '20px ' + FONT; g.fillStyle = '#fff'; g.fillText('🔨', x + 26, base - hgt - 6 + Math.sin(now / 90) * 5);
        g.fillStyle = 'rgba(210,200,180,.5)';
        for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x - 30 + k * 15, base - 3 - p * 8 * (k % 2 + 1), 3 + p * 5, 0, 7); g.fill(); }
      }
      if (s.max > 1) { g.font = '11px sans-serif'; g.fillStyle = '#ffd24a'; g.fillText(starStr(s.lv, s.max), x, base + 12); }
    }
    requestAnimationFrame(drawTown);
  }

  function openMarket(rate, title, back) {
    const st = openMarket.st || (openMarket.st = { get: 'wood', give: 'gold', qty: 1 });
    const opts = (sel) => RES.map(k => `<option value="${k}"${k === sel ? ' selected' : ''}>${RES_ICON[k]} ${k}</option>`).join('');
    $('mbox').innerHTML = `<h2>⚖️ ${title}</h2>
      <p class="small">Rate: ${Math.round(rate * 100)}% of market value. Pay with any resource to buy the ones you are missing.</p>
      <div class="trow" style="grid-template-columns:1fr 1fr 100px"><div>Buy<br><select id="mGet">${opts(st.get)}</select></div>
      <div>Pay with<br><select id="mGive">${opts(st.give)}</select></div><div>Quantity<br><input type="number" id="mQty" min="1" value="${st.qty}"></div></div>
      <div id="mCost" style="margin:10px 0"></div>
      <div class="small">${RES.map(k => RES_ICON[k] + ' ' + G.res[k]).join('  ')}</div>
      <div class="mb"><button id="mBuy" class="primary">Trade</button><button id="mClose">${back ? 'Back to town' : 'Close'}</button></div>`;
    const cost = () => Math.ceil(st.qty * RES_VALUE[st.get] / (RES_VALUE[st.give] * rate));
    const upd = () => {
      st.get = $('mGet').value; st.give = $('mGive').value; st.qty = Math.max(1, parseInt($('mQty').value) || 1);
      const same = st.get === st.give, c = cost();
      $('mCost').innerHTML = same ? 'Choose two different resources.' : `Cost: <b>${RES_ICON[st.give]} ${c}</b> for ${RES_ICON[st.get]} ${st.qty}` + (G.res[st.give] < c ? ' <span style="color:#f88">(not enough)</span>' : '');
      $('mBuy').disabled = same || G.res[st.give] < c;
    };
    ['mGet', 'mGive', 'mQty'].forEach(id => { $(id).oninput = upd; $(id).onchange = upd; });
    $('mBuy').onclick = () => { upd(); const c = cost(); if (st.get === st.give || G.res[st.give] < c) return; G.res[st.give] -= c; G.res[st.get] += st.qty; toast(`Bought ${st.qty} ${RES_ICON[st.get]} for ${c} ${RES_ICON[st.give]}.`); renderAll(); openMarket(rate, title, back); };
    $('mClose').onclick = () => { if (back) openTown(curTown); else { $('modal').classList.add('hide'); renderAll(); } };
    upd(); $('modal').classList.remove('hide');
  }

  function openTavern() {
    const premium = G.tavern.length === 0;
    const ids = premium ? Object.keys(HEROES).filter(id => !G.heroes.some(h => h.id === id)) : G.tavern, price = premium ? HIRE_COST * 2 : HIRE_COST;
    const cards = ids.map(id => { const d = HEROES[id];
      return `<div class="trow" style="grid-template-columns:36px 1fr auto"><div class="ic">${d.i}</div>
        <div><b>${d.name}</b> <span class="small">${d.cls} (${FACTIONS[d.fac].name})</span><br><span class="small">⚔️${d.att} 🛡${d.def} ✨${d.sp} 📚${d.kn}${d.spells.length ? ' · knows ' + d.spells.map(k => SPELLS[k].n).join(', ') : ''}</span></div>
        <div class="acts"><button data-hire="${id}">Hire ${RES_ICON.gold}${price}</button></div></div>`; }).join('');
    $('mbox').innerHTML = `<h2>🍺 Tavern</h2><p class="small">Heroes: ${G.heroes.length}/${MAX_HEROES}. New heroes arrive at the castle without an army — recruit troops and use the exchange to equip them. Heroes level up independently. The tavern offers new heroes every week.</p>${premium ? `<p>No heroes are waiting at the tavern right now — mercenary captains from across the realm will serve for <b>double</b> the price (${RES_ICON.gold}${price}).</p>` : ''}${cards}
      <div class="mb"><button class="primary" id="hBack">Back to town</button></div>`;
    $('hBack').onclick = () => openTown(curTown);
    $('mbox').querySelectorAll('[data-hire]').forEach(b => b.onclick = () => {
      if (G.heroes.length >= MAX_HEROES) return toast(`You can command at most ${MAX_HEROES} heroes.`);
      if (G.res.gold < price) return toast('Not enough gold.');
      const d = HEROES[b.dataset.hire], t = curTown;
      G.res.gold -= price; G.heroes.push(makeHero(d, t.x, t.y)); learn(d.spells); setActive(G.heroes.length - 1);
      G.tavern = G.tavern.filter(x => x !== d.id); toast(`${d.name} joins your cause!`); renderAll(); openTavern();
    });
    $('modal').classList.remove('hide');
  }

  function freeWater() {
    const seen = new Set([G.dock.y * G.W + G.dock.x]), q = [G.dock];
    while (q.length) {
      const c = q.shift();
      if (!G.boats.some(b => b.x === c.x && b.y === c.y) && !objAt(G, c.x, c.y) && !heroesAt(c.x, c.y).length) return c;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = c.x + dx, ny = c.y + dy;
        if (nx < 0 || ny < 0 || nx >= G.W || ny >= G.H || seen.has(ny * G.W + nx) || G.tiles[ny][nx] !== T.WATER) continue;
        seen.add(ny * G.W + nx); q.push({ x: nx, y: ny });
      }
    }
    return null;
  }

  function openTown(t) {
    t = t || (curTown && curTown.owner === 0 ? curTown : defaultTown());
    if (!t) return toast('You do not own a town.');
    curTown = t;
    const th = townHero(t), here = !!th, mt = myTowns(), coastal = !!G.dock && t === mt[0];
    const tabs = mt.length > 1 ? `<div class="hlist">${mt.map((x, i) => `<button class="hbtn${x === t ? ' on' : ''}" data-tab="${i}" title="${x.name}">${FACTIONS[x.fac].icon}</button>`).join('')}</div>` : '';
    let html = `${tabs}<h2>🏰 ${t.name} <span class="small">${FACTIONS[t.fac].name} · ${t.b.hall ? HALL_LEVELS[t.b.hall].n : 'Settlement'}</span></h2><canvas id="tcv" width="780" height="150" style="width:100%;border-radius:6px;border:1px solid #6b4f24"></canvas>
      <div class="small">${here ? `${th.name} is in town — recruits join the army.` : '⚠ No hero in this town; bring a hero to recruit or upgrade troops (or garrison it).'} Higher Town Hall levels unlock new dwellings and creature upgrades.</div>`;
    tiersOf(t).forEach((id, i) => {
      const tier = i + 1, lv = t.up[tier], c = C[lineType(id, lv)], built = t.b[tier], av = t.avail[tier] || 0;
      const needHall = TIER_HALL[tier], locked = t.b.hall < needHall;
      const nextLv = lv + 1, upC = lv < MAX_LV ? upgradeCost(tier, nextLv) : null, upLocked = lv < MAX_LV && t.b.hall < UP_HALL[nextLv];
      let upArmy = null;
      if (built && here) {
        let cost = 0, count = 0;
        for (const s of th.army) if (s && C[s.t].line === id && C[s.t].lv < lv) { cost += (c.cost.gold - C[s.t].cost.gold) * s.n; count += s.n; }
        if (count) upArmy = { cost, count };
      }
      html += `<div class="trow"><div class="ic">${c.i}</div>
        <div><b>${c.n}</b> <span class="stars">${built ? starStr(lv) : ''}</span> <span class="small">Att ${c.a} Def ${c.d} Dmg ${c.lo}-${c.hi} HP ${c.hp} Spd ${c.s}${c.shoot ? ' · Shooter' : ''}${c.fly ? ' · Flying' : ''}</span><br>
        <span class="small">${built ? `Available: <b>${av}</b> · ${fmtCost(c.cost)} each · +${c.gr}/week` : locked ? `🔒 Requires ${HALL_LEVELS[needHall].n} (Town Hall level ${needHall})` : `Dwelling not built — ${fmtCost(DWELL_COST[tier])}`}</span></div>
        <div class="acts">${built
          ? `<input type="number" min="1" max="${av}" value="${av}" id="n${tier}"><button data-buy="${tier}">Recruit</button>
             ${upC ? (upLocked ? `<button disabled title="Requires Town Hall level ${UP_HALL[nextLv]}">🔒 Lv${nextLv} (Hall ${UP_HALL[nextLv]})</button>` : `<button data-up="${tier}" title="${fmtCost(upC)}">⬆ Lv${nextLv} ${fmtCost(upC)}</button>`) : '<span class="small">MAX</span>'}
             ${upArmy ? `<button data-uparmy="${tier}">🪖 Upgrade ${upArmy.count} troops ${RES_ICON.gold}${upArmy.cost}</button>` : ''}`
          : (locked ? `<button disabled>🔒 Hall ${needHall}</button>` : `<button data-build="${tier}">Build</button>`)}</div></div>`;
    });
    const hl = t.b.hall, hNext = hl < 5 ? HALL_LEVELS[hl + 1] : null;
    const gl = t.b.guild, gNext = gl < 3 ? GUILD_COST[gl + 1] : null;
    html += `<div class="trow"><div class="ic">🏛️</div><div><b>${hl ? HALL_LEVELS[hl].n : 'Town Hall'}</b> <span class="stars">${starStr(hl, 5)}</span><br>
        <span class="small">${hl ? `+${HALL_LEVELS[hl].inc} 🪙/day.` : 'No income yet.'}${hNext ? ` Next: ${hNext.n} (+${hNext.inc} 🪙/day) — unlocks ${hl + 1 >= 1 && TIER_HALL.indexOf(hl + 1) > 0 ? 'tier ' + TIER_HALL.indexOf(hl + 1) + ' dwelling' : ''}${UP_HALL[hl + 2] ? ' and Lv' + (hl + 2) + ' upgrades' : ''}.` : ''}</span></div>
        <div class="acts">${hNext ? `<button data-hall="1" title="${fmtCost(hNext.cost)}">${hl ? 'Upgrade' : 'Build'} ${fmtCost(hNext.cost)}</button>` : '<span class="small">MAX</span>'}</div></div>
      <div class="trow"><div class="ic">🔮</div><div><b>Mage Guild</b> <span class="stars">${starStr(gl, 3)}</span><br>
        <span class="small">Spellbook: ${G.spells.map(k => SPELLS[k].i + ' ' + SPELLS[k].n).join(', ')}${gl < 3 ? `<br>Next level teaches: ${GUILD_SPELLS[gl + 1].map(k => SPELLS[k].i + ' ' + SPELLS[k].n).join(', ')}` : ''}</span></div>
        <div class="acts">${gNext ? `<button data-guild="1" title="${fmtCost(gNext)}">${gl ? 'Upgrade' : 'Build'} ${fmtCost(gNext)}</button>` : '<span class="small">MAX</span>'}</div></div>
      <div class="trow"><div class="ic">⚖️</div><div><b>Marketplace</b><br><span class="small">${t.b.market ? `Buy missing resources at ${Math.round(MARKET_RATE * 100)}% rate.` : `Trade resources — ${fmtCost(MARKET_COST)}`}</span></div>
        <div class="acts">${t.b.market ? '<button data-trade="1">Trade</button>' : '<button data-build="market">Build</button>'}</div></div>
      <div class="trow"><div class="ic">⚓</div><div><b>Shipyard</b><br><span class="small">${t.b.ship ? `Boats ${G.boats.length}/${MAX_BOATS}. A new boat appears at the port by the bay (${fmtCost(BOAT_COST)} each). Walk a hero onto a boat to sail; collect treasures at sea.` : coastal ? `Build boats to sail the sea and collect its treasures — ${fmtCost(SHIPYARD_COST)}` : 'There is no coast near this town.'}</span></div>
        <div class="acts">${!coastal ? '' : t.b.ship ? `<button data-boat="1" ${G.boats.length >= MAX_BOATS ? 'disabled' : ''}>⛵ Build boat</button>` : '<button data-build="ship">Build</button>'}</div></div>
      <div class="trow"><div class="ic">🛡️</div><div><b>Garrison</b><br><span class="small">${armyList(t.garrison, false) || 'No troops stationed.'} The garrison defends the town when no hero is inside${here ? '' : ' (bring a hero to move troops)'}.</span></div>
        <div class="acts"><button data-garr="1">Manage garrison</button></div></div>
      <div class="trow"><div class="ic">🧱</div><div><b>${FORT_LEVELS[t.fort || 0].n}</b> <span class="stars">${starStr(t.fort || 0, 3)}</span><br>
        <span class="small">Walls, gate and arrow towers are ×${FORT_LEVELS[t.fort || 0].hp} as strong in a siege${(t.fort || 0) < 3 ? ` — next: ${FORT_LEVELS[(t.fort || 0) + 1].n} (×${FORT_LEVELS[(t.fort || 0) + 1].hp} walls, ×${FORT_LEVELS[(t.fort || 0) + 1].tower} tower fire)` : ''}.</span></div>
        <div class="acts">${(t.fort || 0) < 3 ? `<button data-fortify="1" title="${fmtCost(FORT_LEVELS[(t.fort || 0) + 1].cost)}">⬆ ${fmtCost(FORT_LEVELS[(t.fort || 0) + 1].cost)}</button>` : '<span class="small">MAX</span>'}</div></div>
      <div class="trow"><div class="ic">💣</div><div><b>${MINE_LEVELS[t.minel || 0].n}</b> <span class="stars">${starStr(t.minel || 0, 3)}</span><br>
        <span class="small">Hidden mines (${MINE_LEVELS[t.minel || 0].stock}) in front of the walls hurt and halt attackers. A defending hero can lay ${EMERGENCY_MINES} extra mines even without a minefield${(t.minel || 0) < 3 ? ` — next: ${MINE_LEVELS[(t.minel || 0) + 1].n} (${MINE_LEVELS[(t.minel || 0) + 1].stock} mines)` : ''}.</span></div>
        <div class="acts">${(t.minel || 0) < 3 ? `<button data-minefield="1" title="${fmtCost(MINE_LEVELS[(t.minel || 0) + 1].cost)}">⬆ ${fmtCost(MINE_LEVELS[(t.minel || 0) + 1].cost)}</button>` : '<span class="small">MAX</span>'}</div></div>
      <div class="trow"><div class="ic">🍺</div><div><b>Tavern</b><br><span class="small">Heroes ${G.heroes.length}/${MAX_HEROES}. Hire more heroes and exchange troops between heroes in town.</span></div>
        <div class="acts"><button data-tavern="1">Hire heroes</button>${heroesAt(t.x, t.y).length > 1 ? '<button data-xhero="1">Exchange troops</button>' : ''}</div></div>
      <div class="small" style="margin-top:8px">${RES.map(k => RES_ICON[k] + ' ' + G.res[k]).join('  ')}</div>
      <div class="mb"><button class="primary" id="tClose">Leave town</button></div>`;
    $('mbox').innerHTML = html; $('modal').classList.remove('hide');
    if (!townLoop) { townLoop = true; requestAnimationFrame(drawTown); }
    $('tClose').onclick = () => { $('modal').classList.add('hide'); renderAll(); };
    const again = () => { openTown(t); renderAll(); };
    const q = (sel, fn) => $('mbox').querySelectorAll(sel).forEach(fn);
    q('[data-tab]', b => b.onclick = () => openTown(mt[+b.dataset.tab]));
    q('[data-fortify]', b => b.onclick = () => {
      const nx = FORT_LEVELS[(t.fort || 0) + 1]; if (!canAfford(G.res, nx.cost)) return toast('Not enough resources.');
      pay(G.res, nx.cost); t.fort = (t.fort || 0) + 1; sfx('build'); toast(`${nx.n} built — the walls are stronger.`); again();
    });
    q('[data-minefield]', b => b.onclick = () => {
      const nx = MINE_LEVELS[(t.minel || 0) + 1]; if (!canAfford(G.res, nx.cost)) return toast('Not enough resources.');
      pay(G.res, nx.cost); t.minel = (t.minel || 0) + 1; sfx('build'); toast(`${nx.n} laid: ${nx.stock} mines guard the approach.`); again();
    });
    q('[data-garr]', b => b.onclick = () => {
      if (!th) { toast('A hero must be in the town to move troops.'); return; }
      openExchange(`🛡️ ${t.name} garrison`, 'The garrison defends the town when no hero is inside.', t.garrison, 'Garrison', th.army, th.name, () => openTown(t));
    });
    q('[data-build]', b => b.onclick = () => {
      const k = b.dataset.build, cost = k === 'market' ? MARKET_COST : k === 'ship' ? SHIPYARD_COST : DWELL_COST[+k];
      if (!canAfford(G.res, cost)) return toast('Not enough resources.');
      pay(G.res, cost);
      if (k === 'market') { t.b.market = 1; startTownAnim('build', 9); }
      else if (k === 'ship') { t.b.ship = 1; startTownAnim('build', 10); }
      else { t.b[k] = 1; t.avail[k] = GROWTH[+k - 1]; startTownAnim('build', +k - 1); }
      again();
    });
    q('[data-hall]', b => b.onclick = () => {
      const nx = HALL_LEVELS[t.b.hall + 1];
      if (!canAfford(G.res, nx.cost)) return toast('Not enough resources.');
      pay(G.res, nx.cost); t.b.hall++;
      toast(`${nx.n} built! Income +${nx.inc}/day. New buildings unlocked.`); startTownAnim('upgrade', 7); again();
    });
    q('[data-guild]', b => b.onclick = () => {
      const cost = GUILD_COST[t.b.guild + 1];
      if (!canAfford(G.res, cost)) return toast('Not enough resources.');
      pay(G.res, cost); t.b.guild++;
      const learned = GUILD_SPELLS[t.b.guild].filter(k => !G.spells.includes(k)); learn(learned);
      toast(`Mage Guild level ${t.b.guild}! Learned: ${learned.map(k => SPELLS[k].n).join(', ')}`);
      startTownAnim('build', 8); again();
    });
    q('[data-up]', b => b.onclick = () => {
      const tier = +b.dataset.up, cost = upgradeCost(tier, t.up[tier] + 1);
      if (!canAfford(G.res, cost)) return toast('Not enough resources.');
      pay(G.res, cost); t.up[tier]++;
      toast(`${C[lineType(tiersOf(t)[tier - 1], t.up[tier])].n} unlocked!`);
      startTownAnim('upgrade', tier - 1); again();
    });
    q('[data-uparmy]', b => b.onclick = () => {
      const tier = +b.dataset.uparmy, id = tiersOf(t)[tier - 1], to = lineType(id, t.up[tier]);
      let cost = 0;
      for (const s of th.army) if (s && C[s.t].line === id && C[s.t].lv < t.up[tier]) cost += (C[to].cost.gold - C[s.t].cost.gold) * s.n;
      if (G.res.gold < cost) return toast('Not enough gold.');
      G.res.gold -= cost;
      for (const s of th.army) if (s && C[s.t].line === id && C[s.t].lv < t.up[tier]) s.t = to;
      mergeArmy(th); toast('Your troops have been upgraded!'); startTownAnim('upgrade', tier - 1); again();
    });
    q('[data-buy]', b => b.onclick = () => {
      const tier = +b.dataset.buy, type = tierType(t, tier), c = C[type];
      if (!here) return toast('A hero must be in the castle.');
      let n = Math.min(parseInt($('n' + tier).value) || 0, t.avail[tier] || 0);
      while (n > 0 && !canAfford(G.res, Object.fromEntries(Object.entries(c.cost).map(([k, v]) => [k, v * n])))) n--;
      if (n <= 0) return toast('Cannot recruit (resources or availability).');
      if (!addToArmy(th, type, n)) return toast('No free army slot.');
      pay(G.res, c.cost, n); t.avail[tier] -= n; toast(`Recruited ${n} ${c.n}${n > 1 ? 's' : ''}.`);
      again();
    });
    q('[data-boat]', b => b.onclick = () => {
      if (G.boats.length >= MAX_BOATS) return toast(`You can own at most ${MAX_BOATS} boats.`);
      if (!canAfford(G.res, BOAT_COST)) return toast('Not enough resources.');
      const spot = freeWater();
      if (!spot) return toast('The port is blocked.');
      pay(G.res, BOAT_COST); G.boats.push({ id: G.nextBoat++, x: spot.x, y: spot.y });
      toast(`A boat is launched at (${spot.x}, ${spot.y}). Walk a hero onto it to sail.`); again();
    });
    q('[data-trade]', b => b.onclick = () => openMarket(MARKET_RATE + ((G.wk && G.wk.rateBonus) || 0), 'Marketplace', true));
    q('[data-tavern]', b => b.onclick = openTavern);
    q('[data-xhero]', b => b.onclick = () => {
      const hs = heroesAt(t.x, t.y), a = hs[0], c2 = hs[1];
      openExchange('🤝 Exchange troops', 'Heroes in the town can share their armies.', a.army, a.name, c2.army, c2.name, () => openTown(t));
    });
  }

  // ---------- forts & garrisons ----------
  function openFort(f, h) {
    const hs = heroesAt(f.x, f.y), hero = hs.includes(h) ? h : hs[0];
    const note = `+${FORT_INCOME} 🪙/day · zone mine income · +${MILITIA} militia/week · the garrison fights enemy heroes inside the walls with +3 Defense`;
    const fl = f.fort || 0, ml = f.minel || 0, fc = fl < FORT_MAX_FORT ? FORT_WALL_COST[fl + 1] : null, mc = ml < FORT_MAX_MINE ? FORT_MINE_COST[ml + 1] : null;
    const extra = {
      html: `<div class="trow" style="grid-template-columns:30px 1fr auto"><div class="ic">🧱</div><div><b>${FORT_LEVELS[fl].n}</b> <span class="small">walls ×${FORT_LEVELS[fl].hp}</span></div><div class="acts">${fc ? `<button data-fw="1">⬆ ${fmtCost(fc)}</button>` : '<span class="small">MAX</span>'}</div></div>
        <div class="trow" style="grid-template-columns:30px 1fr auto"><div class="ic">💣</div><div><b>${MINE_LEVELS[ml].n}</b> <span class="small">${MINE_LEVELS[ml].stock} hidden mines</span></div><div class="acts">${mc ? `<button data-fm="1">Build ${fmtCost(mc)}</button>` : '<span class="small">MAX</span>'}</div></div>`,
      bind: () => {
        $('mbox').querySelectorAll('[data-fw]').forEach(b => b.onclick = () => { if (!canAfford(G.res, fc)) return toast('Not enough resources.'); pay(G.res, fc); f.fort = fl + 1; sfx('build'); renderAll(); openFort(f, hero || h); });
        $('mbox').querySelectorAll('[data-fm]').forEach(b => b.onclick = () => { if (!canAfford(G.res, mc)) return toast('Not enough resources.'); pay(G.res, mc); f.minel = ml + 1; sfx('build'); renderAll(); openFort(f, hero || h); });
      } };
    if (!hero) {
      $('mbox').innerHTML = `<h2>🏯 ${f.name}</h2><div class="small">${note}</div>${extra.html}<p>Garrison: ${armyList(f.garrison, false) || 'empty'}</p><p class="small">Visit the fort with a hero to transfer troops.</p><div class="mb"><button class="primary" id="fClose">Close</button></div>`;
      $('fClose').onclick = () => $('modal').classList.add('hide'); extra.bind(); $('modal').classList.remove('hide'); return;
    }
    openExchange(`🏯 ${f.name}`, note, f.garrison, 'Garrison', hero.army, hero.name, undefined, extra);
  }
  // siege parameters for a structure: wall strength (fortifications) and mines (minefield); dside = who defends (1 = the opposing side of the player)
  const siegeOf = (o, dside) => ({ dside, fort: (o && o.fort) || 0, minel: (o && o.minel) || 0, mines: o && o.minel ? MINE_LEVELS[o.minel].stock : 0 });
  // a rival hero attacks a player-owned fort or town: the garrison defends in a real siege battle, an empty one falls at once
  async function defendStructure(o, ah) {
    const gar = o.garrison;
    if (!gar.some(Boolean)) { await aiCapture(o, ah); return false; }
    centerOn(o.x, o.y); toast(`${ah.name} assaults ${o.name}!`);
    const res = await Battle.run({ hero: { att: 0, def: 3, sp: 0, mana: 0, spells: [], perks: {}, name: 'Garrison', icon: '🛡️' }, army: gar, enemy: ah.army.map(a => a && ({ ...a })),
      eStats: { att: ah.att, def: ah.def }, eHero: ah, title: `Defending ${o.name}`, siege: siegeOf(o, 0), canRetreat: false });
    res.survivors.forEach((n, i) => { if (gar[i]) { if (n > 0) gar[i].n = n; else gar[i] = null; } });
    if (res.win) { removeAiHero(ah); toast(`${o.name} held! ${ah.name} is slain.`); return true; }
    shrinkArmy(ah.army, 0.5);
    await aiCapture(o, ah);
    return false;
  }
  async function aiCapture(o, ah) {
    const ai = aiById(ah.ai), wasMine = o.owner === 0;
    if (o.t === 'town') takeTown(o, ai.id);
    else { o.owner = ai.id; o.garrison = [{ t: factionTiers(ai.fac)[0], n: 10 }, null, null, null, null, null, null]; }
    reindex(G); renderAll();
    if (wasMine) {
      centerOn(o.x, o.y);
      await showModal(`<h2>${o.t === 'town' ? '🏰' : '🏯'} ${o.name} has fallen!</h2><p>${ai.name} ${FACTIONS[ai.fac].icon} now holds it. Retake it by defeating its garrison.${myTowns().length ? '' : ' <b>You own no towns — retake one within 7 days or the realm is lost!</b>'}</p>`);
    }
  }
  const shrinkArmy = (arr, frac) => { for (let i = 0; i < arr.length; i++) { const s = arr[i]; if (!s) continue; s.n = Math.floor(s.n * (1 - frac)); if (s.n <= 0) arr[i] = null; } };

  // ---------- rival AI players ----------
  const armyPower = (arr) => arr.reduce((s, a) => s + (a ? C[a.t].v * a.n : 0), 0);
  const goldEq = (c) => Object.keys(c).reduce((s, k) => s + c[k] * RES_VALUE[k], 0);
  // fast auto-resolve for fights the player is not part of; mutates both armies, returns true if the attacker wins
  function quickBattle(att, def, defBonus = 1) {
    const A = armyPower(att) * (0.85 + Math.random() * 0.3), D = armyPower(def) * defBonus * (0.85 + Math.random() * 0.3);
    if (A > D) { shrinkArmy(att, Math.min(0.95, Math.pow(D / A, 1.3))); shrinkArmy(def, 1); return true; }
    shrinkArmy(att, 1); shrinkArmy(def, Math.min(0.95, Math.pow(A / D, 1.3))); return false;
  }
  function spawnAiHero(ai, t) {
    if (!t) return null;
    const names = FACTIONS[ai.fac].heroes, pick = names[ai.heroes.length % names.length], D = DIFFICULTY[G.diff || 'normal'];
    const h = makeHero(HEROES[pick[0]], t.x, t.y);
    h.ai = ai.id; if (ai.heroes.some(x => x.name === h.name)) h.name += ' II';
    const ti = factionTiers(ai.fac), m = D.ehMul * (ai.heroes.length ? 0.6 : 1);
    h.army = [{ t: ti[0], n: Math.max(2, Math.round(14 * m)) }, { t: ti[1], n: Math.max(1, Math.round(7 * m)) }, { t: ti[2], n: Math.max(1, Math.round(4 * m)) }, null, null, null, null];
    const bonus = Math.max(0, Math.floor((D.ehMul - 0.7) * 3)); h.att += bonus; h.def += bonus;
    h.move = Math.round(D.ehMove * sizeMv());
    ai.heroes.push(h); return h;
  }
  function aiIncome(ai) {
    let g = 0;
    for (const o of G.objs) {
      if (o.owner !== ai.id) continue;
      if (o.t === 'town') g += 500 + (o.b && o.b.hall ? HALL_LEVELS[o.b.hall].inc : 0);
      else if (o.t === 'fort') g += FORT_INCOME;
      else if (o.t === 'mine' && zoneOwner(G, G.zone[o.y][o.x]) === ai.id) g += MINE_YIELD[o.kind] * RES_VALUE[o.kind];
    }
    return Math.round(g * DF().aiInc);
  }
  function aiBuild(ai, t) {
    const hall = t.b.hall, afford = (c) => goldEq(c) <= ai.gold * 0.7;
    if (hall < 5 && afford(HALL_LEVELS[hall + 1].cost) && (hall < 2 || G.day > 10 * hall)) { ai.gold -= goldEq(HALL_LEVELS[hall + 1].cost); t.b.hall++; return true; }
    for (let tier = 1; tier <= 7; tier++) if (!t.b[tier] && hall >= TIER_HALL[tier] && afford(DWELL_COST[tier])) { ai.gold -= goldEq(DWELL_COST[tier]); t.b[tier] = 1; t.avail[tier] = GROWTH[tier - 1]; return true; }
    for (let tier = 1; tier <= 7; tier++) {
      const lv = t.up[tier];
      if (t.b[tier] && lv < MAX_LV && hall >= UP_HALL[lv + 1] && afford(upgradeCost(tier, lv + 1))) { ai.gold -= goldEq(upgradeCost(tier, lv + 1)); t.up[tier]++; return true; }
    }
    const fl = t.fort || 0, ml = t.minel || 0;
    if (fl < 3 && G.day > 10 * (fl + 1) && afford(FORT_LEVELS[fl + 1].cost)) { ai.gold -= goldEq(FORT_LEVELS[fl + 1].cost); t.fort = fl + 1; return true; }
    if (ml < 3 && fl >= 1 && G.day > 14 * (ml + 1) && afford(MINE_LEVELS[ml + 1].cost)) { ai.gold -= goldEq(MINE_LEVELS[ml + 1].cost); t.minel = ml + 1; return true; }
    return false;
  }
  function aiRecruit(ai, t) {
    const hero = ai.heroes.find(h => h.x === t.x && h.y === t.y), army = hero ? hero.army : t.garrison;
    for (let tier = 7; tier >= 1; tier--) {
      if (!t.b[tier]) continue;
      const type = tierType(t, tier), price = goldEq(C[type].cost);
      const n = Math.min(t.avail[tier] || 0, Math.floor(ai.gold * 0.5 / price));
      if (n > 0 && addToArmy({ army }, type, n)) { ai.gold -= n * price; t.avail[tier] -= n; }
    }
  }
  function aiEconomy(ai) {
    ai.gold += aiIncome(ai);
    const towns = G.objs.filter(o => o.t === 'town' && o.owner === ai.id);
    if (!towns.length) return;
    if (ai.spawnWait > 0) ai.spawnWait--;
    // a rival without any hero hires one first (cheaply), before spending on buildings and troops
    if (!ai.heroes.length && ai.spawnWait <= 0 && ai.gold >= HIRE_COST * 0.5) { ai.gold -= HIRE_COST * 0.5; spawnAiHero(ai, towns[0]); }
    for (const t of towns) { let k = 0; while (k < 2 && aiBuild(ai, t)) k++; aiRecruit(ai, t); }
    const maxH = Math.min(4, 1 + Math.ceil(towns.length / 2) + (G.day > 25 ? 1 : 0));
    if (ai.heroes.length && ai.heroes.length < maxH && ai.spawnWait <= 0 && ai.gold >= HIRE_COST * 1.2) {
      ai.gold -= HIRE_COST; const t = towns[0]; spawnAiHero(ai, t); aiRecruit(ai, t);
    }
  }
  function aiTargets(ai, h, power) {
    const R = 22 * sizeMv(), list = [];
    for (const o of G.objs) {
      if (o.owner === ai.id) continue;
      const d = dist(o, h); if (d > R) continue;
      let sc = 0;
      switch (o.t) {
        case 'monster': { const gp = armyPower(o.guard); if (power >= gp * 1.25) sc = (gp * 0.3 + 200) / (d + 6); break; }
        case 'pile': sc = 350 / (d + 4); break;
        case 'chest': sc = 500 / (d + 4); break;
        case 'mine': { const gp = armyPower(o.guard || []); if (power >= gp * 1.2) sc = 900 / (d + 6); break; }
        case 'fort': { const dp = o.owner ? armyPower(o.garrison) : armyPower(o.guard); if (power >= dp * 1.3 + 1) sc = 1600 / (d + 8); break; }
        case 'town': { const dp = o.owner ? armyPower(o.garrison) : armyPower(o.guard || []); if (power >= dp * 1.4 + 1) sc = 4000 / (d + 10); break; }
      }
      if (sc > 0) list.push({ x: o.x, y: o.y, score: sc });
    }
    for (const ph of G.heroes) { const d = dist(ph, h); if (d > R) continue; if (power >= armyPower(ph.army) * 1.25) list.push({ x: ph.x, y: ph.y, score: 2400 / (d + 6) }); }
    return list.sort((a, b) => b.score - a.score);
  }
  function aiKill(ai, h) { ai.heroes = ai.heroes.filter(x => x !== h); ai.spawnWait = 3; }
  async function aiHeroTurn(ai, h) {
    const D = DF();
    h.move = Math.round(D.ehMove * sizeMv());
    const towns = G.objs.filter(o => o.t === 'town' && o.owner === ai.id);
    const here = towns.find(t => t.x === h.x && t.y === h.y);
    if (here) { here.garrison.forEach((s, i) => { if (s && addToArmy(h, s.t, s.n)) here.garrison[i] = null; }); mergeArmy(h); }
    if (G.day < D.ehDay + (ai.id - 1) * 2) return;
    const power = armyPower(h.army), nearest = () => towns.slice().sort((a, b) => dist(a, h) - dist(b, h))[0];
    if (power < 1200 && towns.length) { if (!here) await aiWalk(ai, h, nearest()); return; }
    for (const tg of aiTargets(ai, h, power).slice(0, 5)) { if (await aiWalk(ai, h, tg)) return; }
    if (towns.length && !here) await aiWalk(ai, h, nearest());
  }
  // walk toward a target tile; returns false if there is no path
  async function aiWalk(ai, h, tg) {
    const path = findPath(G, h.x, h.y, tg.x, tg.y, false, false);
    if (!path || !path.length) return false;
    for (let i = 0; i < path.length; i++) {
      const s = path[i];
      if (s.cost > h.move) return true;
      h.move -= s.cost; h.x = s.x; h.y = s.y;
      const ph = heroesAt(s.x, s.y);
      if (ph.length) {
        const d = ph.reduce((a, b) => armyCount(a) >= armyCount(b) ? a : b);
        centerOn(s.x, s.y); renderAll(); toast(`${h.name} of the ${FACTIONS[ai.fac].name} attacks ${d.name}!`); await sleep(350);
        await fightAiHero(d, h, false);
        if (!ai.heroes.includes(h)) return true;
        const so = objAt(G, h.x, h.y);
        if (so && so.owner === 0 && (so.t === 'fort' || so.t === 'town')) await defendStructure(so, h);
        return true;
      }
      const other = G.ais.flatMap(a => a.heroes).find(x => x !== h && x.x === s.x && x.y === s.y);
      if (other) { if (quickBattle(h.army, other.army, 1)) aiKill(aiById(other.ai), other); else { aiKill(ai, h); return true; } }
      const o = objAt(G, s.x, s.y);
      if (o && await aiInteract(ai, h, o, i === path.length - 1)) return true;
    }
    return true;
  }
  // returns true when the interaction ends the hero's day
  async function aiInteract(ai, h, o, last) {
    if (o.t === 'pile') { ai.gold += o.kind === 'gold' ? o.amt : o.amt * RES_VALUE[o.kind]; G.objs.splice(G.objs.indexOf(o), 1); reindex(G); return false; }
    if (o.t === 'chest') { ai.gold += o.gold; G.objs.splice(G.objs.indexOf(o), 1); reindex(G); return false; }
    if (!last || o.owner === ai.id) return false;
    const win = (def, bonus = 1) => { const d = def.map(a => a && ({ ...a })); return quickBattle(h.army, d, bonus); };
    const lose = () => { aiKill(ai, h); return true; };
    switch (o.t) {
      case 'monster': if (!win(o.guard)) return lose(); G.objs.splice(G.objs.indexOf(o), 1); reindex(G); return true;
      case 'art': if (o.guard && o.guard.length && !win(o.guard)) return lose(); h[ARTIFACTS[o.art].stat] += ARTIFACTS[o.art].v; G.objs.splice(G.objs.indexOf(o), 1); reindex(G); return true;
      case 'mine': if (o.guard && o.guard.length && !win(o.guard)) return lose(); o.guard = []; o.owner = ai.id; return true;
      case 'fort': case 'town': {
        if (o.owner === 0) { await defendStructure(o, h); return true; }
        const defenders = o.owner ? o.garrison : o.guard;
        if (defenders && defenders.some(Boolean) && !win(defenders, 1.3)) return lose();
        if (o.t === 'town') takeTown(o, ai.id); else { o.owner = ai.id; o.guard = []; o.garrison = [{ t: factionTiers(ai.fac)[0], n: 8 }, null, null, null, null, null, null]; }
        reindex(G); return true;
      }
    }
    return false;
  }
  async function aiPhase() {
    for (const ai of G.ais) {
      if (!ai.alive) continue;
      aiEconomy(ai);
      for (const h of [...ai.heroes]) {
        if (!ai.heroes.includes(h)) continue;
        await aiHeroTurn(ai, h);
        if (G.over) return;
      }
    }
    checkVictory();
  }

  function computeGain() {
    const gain = Object.fromEntries(RES.map(k => [k, 0]));
    for (const t of myTowns()) if (t.b.hall) gain.gold += HALL_LEVELS[t.b.hall].inc;
    for (const h of G.heroes) gain.gold += 300 * perk(h, 'estates');
    for (const o of G.objs) {
      if (o.t === 'mine' && o.owner === 0 && zoneOwner(G, G.zone[o.y][o.x]) === 0) gain[o.kind] += MINE_YIELD[o.kind] * ((G.wk && G.wk.mineMul) || 1);
      if (o.t === 'fort' && o.owner === 0) gain.gold += FORT_INCOME;
    }
    RES.forEach(k => { gain[k] = Math.round(gain[k] * DF().income); });
    return gain;
  }

  // ---------- events ----------
  function rollWeekEvent() {
    const t = town() || G.objs.find(o => o.t === 'town');
    const builtTiers = [1, 2, 3, 4, 5, 6, 7].filter(k => t.b[k]);
    const list = [
      () => {
        const tier = builtTiers[Math.floor(Math.random() * builtTiers.length)], c = C[tierType(t, tier)];
        return { icon: c.i, title: `Week of the ${c.n}`, text: `Recruitment is booming: ${c.n} dwellings produce double this week.`, apply() { t.avail[tier] = (t.avail[tier] || 0) + GROWTH[tier - 1]; renderAll(); } };
      },
      () => ({ icon: '☠️', title: 'Week of the Plague', text: 'Disease sweeps the land: all available recruits are halved.', apply() { for (const tw of G.objs) if (tw.t === 'town') for (const k in tw.avail) tw.avail[k] = Math.floor(tw.avail[k] / 2); } }),
      () => { G.wk.mineMul = 2; return { icon: '⛏️', title: 'Bountiful Harvest', text: 'Your mines yield double this week.', apply() {} }; },
      () => { G.wk.rateBonus = 0.15; return { icon: '🐪', title: 'Merchant Caravans', text: 'Trade flourishes: the marketplace and wandering merchants give 15% better rates this week.', apply() {} }; },
      () => ({ icon: '🏋️', title: 'Heroic Training', text: 'Veterans drill your heroes: each gains 150 XP per level.', async apply() { for (const h of G.heroes) await gainXp(h, 150 * h.lvl); renderAll(); } }),
      () => ({ icon: '🐺', title: 'Hungry Beasts', text: 'Wild monsters multiply: all neutral stacks grow by 20%.', apply() { for (const o of G.objs) if (o.t === 'monster') o.guard.forEach(g => { g.n = Math.ceil(g.n * 1.2); }); } }),
      () => ({ icon: '🦠', title: 'Plague on the Rivals', text: 'Sickness strikes your foes: every rival hero loses a quarter of their troops.', apply() { for (const ah of allAiHeroes()) shrinkArmy(ah.army, 0.25); } }),
    ];
    return list[Math.floor(Math.random() * list.length)]();
  }
  function rollDayEvent() {
    const hs = G.heroes, rh = () => hs[Math.floor(Math.random() * hs.length)];
    const list = [
      () => { const g = 500 + 250 * Math.floor(Math.random() * 6); G.res.gold += g; return ['💰', 'Buried Treasure', `Farmers dig up an old chest: +${g} 🪙.`]; },
      () => { const k = RES[1 + Math.floor(Math.random() * (RES.length - 1))], n = k === 'wood' || k === 'ore' ? 6 : 3; G.res[k] += n; return ['🎁', 'A Generous Gift', `A grateful traveler gives you ${n} ${RES_ICON[k]} ${k}.`]; },
      () => { const g = Math.floor(G.res.gold * (0.05 + Math.random() * 0.05)); G.res.gold -= g; return ['🗡️', 'Bandit Raid', `Bandits plunder your caravans: -${g} 🪙.`]; },
      () => { const h = rh(), ty = CASTLE_TIERS[0], n = 5 + Math.floor(Math.random() * 8); const ok = addToArmy(h, ty, n); return ['🛡️', 'Wandering Mercenaries', ok ? `${n} ${C[ty].n}s volunteer to serve ${h.name}.` : `Mercenaries offer their swords, but ${h.name} has no free slot.`]; },
      () => { hs.forEach(h => { h.mana = maxMana(h); }); return ['🔷', 'Mana Spring', "A surge of magic restores every hero's mana."]; },
      () => { hs.forEach(h => { h.move = Math.floor(h.move * 0.7); }); return ['⛈️', 'Storm', 'Heavy storms slow your heroes: -30% movement today.']; },
      () => { const ah = allAiHeroes().sort((a, b) => dist(a, G.hero) - dist(b, G.hero))[0]; return ['📜', 'Rumors', ah ? `Scouts report ${ah.name} of the ${FACTIONS[aiById(ah.ai).fac].name} ${dist(ah, G.hero)} tiles from ${G.hero.name}.` : 'Scouts see no rival army on the roads.']; },
      () => { const h = rh(); h.kn++; return ['📖', 'Visiting Scholar', `A wandering scholar tutors ${h.name}: +1 Knowledge.`]; },
      () => { const h = rh(), a = h.army.find(Boolean); if (!a || a.n < 8) return ['🍀', 'Quiet Day', 'Nothing of note happens.']; const lost = Math.max(1, Math.floor(a.n * 0.06)); a.n -= lost; return ['🤒', 'Camp Fever', `Sickness spreads in ${h.name}'s camp: ${lost} ${C[a.t].n}s fall ill and leave.`]; },
    ];
    return list[Math.floor(Math.random() * list.length)]();
  }

  async function endTurn() {
    if (!G || busy || G.over) return;
    busy = true; G.path = null; selSlot = -1;
    await aiPhase();
    if (G.over) { busy = false; return; }
    G.day++;
    const newWeek = (G.day - 1) % 7 === 0;
    let wev = null;
    if (newWeek) { G.wk = {}; wev = rollWeekEvent(); }
    for (const h of G.heroes) { h.move = maxMove(h); h.mana = Math.min(maxMana(h), h.mana + 4); if (heroAtTown(h)) h.mana = maxMana(h); }
    const gain = computeGain();
    RES.forEach(k => { G.res[k] += gain[k]; });
    const parts = RES.filter(k => gain[k]).map(k => `+${gain[k]}${RES_ICON[k]}`);
    if ((G.day - 1) % 7 === 0) {
      for (const tw of G.objs) if (tw.t === 'town') for (let i = 1; i <= 7; i++) if (tw.b[i]) tw.avail[i] = (tw.avail[i] || 0) + GROWTH[i - 1];
      for (const o of G.objs) if (o.t === 'fort' && o.owner === 0) {
        const mil = CASTLE_TIERS[0];
        const s = o.garrison.find(a => a && a.t === mil);
        if (s) s.n += MILITIA; else { const i = o.garrison.findIndex(a => !a); if (i >= 0) o.garrison[i] = { t: mil, n: MILITIA }; }
      }
      rollTavern();
      toast('A new week begins — dwellings replenish, forts raise militia, new heroes arrive at the tavern!');
    }
    if (!myTowns().length) {
      G.noTown++;
      if (G.noTown >= 7) { busy = false; await endGame(false, 'You held no town for a whole week — the realm is lost.'); return; }
      toast(`⚠ You own no towns! ${7 - G.noTown} days left to retake one.`);
    }
    if (checkVictory()) { busy = false; return; }
    banner(newWeek ? `Week ${Math.floor((G.day - 1) % 28 / 7) + 1} begins` : `Day ${(G.day - 1) % 7 + 1}`, parts.join(' '));
    sfx('day');
    renderAll();
    if (wev) {
      await showModal(`<h2>${wev.icon} ${wev.title}</h2><p class="small">A new week begins!</p><p>${wev.text}</p>`);
      await wev.apply();
    } else if (G.day >= 2 && Math.random() < 0.4) {
      const ev = rollDayEvent();
      await showModal(`<h2>${ev[0]} ${ev[1]}</h2><p>${ev[2]}</p>`);
    }
    busy = false; centerOn(G.hero.x, G.hero.y); renderAll();
    try { localStorage.setItem(SAVE, saveJSON()); } catch (e) { /* ignore */ }
  }
  async function endGame(win, why) {
    G.over = true; sfx(win ? 'win' : 'lose');
    try { localStorage.removeItem(SAVE); } catch (e) { /* ignore */ }
    await showModal(win ? `<h2>🏆 Victory!</h2><p>Every rival has lost its towns: you rule the realm on day ${G.day} (${DF().name}). Well fought!</p>` : `<h2>💀 Defeat</h2><p>${why || 'Your hero has fallen.'}</p>`, ['Main menu']);
    $('title').classList.remove('hide'); refreshTitle();
  }

  // ---------- title / selection / help ----------
  const HELP = `<h2>How to Play</h2><p><b>Goal:</b> eliminate every rival by capturing all of their towns. Rival AI players build, recruit, hire several heroes and expand across the map — and they will attack your forts and towns. If you hold no town for 7 days you lose.</p>
    <p><b>Towns:</b> capture neutral and rival towns for more castles (each keeps its own faction, creatures and buildings). Use the tabs in the town screen to switch towns, and station a garrison so a town defends itself when no hero is inside.</p>
    <p><b>Map:</b> click a tile to preview the path (green = reachable today, red = next turn), click again to walk. Click another hero to select it (Tab cycles). Monsters facing an army ${FLEE_RATIO}× stronger offer to flee; with the Charisma perk they can join you instead. Walk onto resources to grab them; mines give daily income; monsters, mines and artifacts are guarded. Merchants ⛺ sell missing resources.<br>
    Keys: arrows/WASD scroll · +/- zoom · H center hero · Space go · E end turn · T town · Tab next hero. Drag the map to pan, mouse wheel / pinch to zoom.<br>
    <b>On a phone:</b> drag to pan, pinch to zoom, tap a tile to preview the path and tap it again to go; in battle, tap a hex twice to confirm. Use the bottom bar for End Turn, Town and heroes.</p>
    <p><b>Sea:</b> build a Shipyard in town, then boats at the port by the bay. Walk a hero onto a boat to sail; collect floating treasures, salvage shipwrecks, fight sea monsters, and disembark on any shore tile. Pick the map type, size and seed when starting a game.</p>
    <p><b>Events:</b> every new week brings a weekly event (double growth for a creature, plague, bountiful harvest, merchant caravans, heroic training...) and most days a random event may strike — treasure, bandits, mercenaries, storms, rumors.</p>
    <p><b>Territory:</b> the map is split into zones, each ruled by a fort. Capture a fort to own the zone: +${FORT_INCOME} gold/day, your mines there pay, +${MILITIA} militia/week. <b>Station troops in forts</b> — the enemy hero raids undefended forts.</p>
    <p><b>Town:</b> Town Hall levels 1-5 raise income and unlock dwellings (tiers 3-7) and creature upgrades (up to 5 levels). Mage Guild teaches spells, the Marketplace trades resources, the Tavern hires up to ${MAX_HEROES} heroes.</p>
    <p><b>Defenses:</b> build Fortifications (Citadel → Castle → Fortress) to strengthen walls, gate and arrow towers, and a Minefield for hidden mines in front of the walls — mines hurt and halt attackers. When you defend, you can also lay mines yourself (💣 button, key M); even without a minefield you get ${EMERGENCY_MINES}. Forts can be fortified too.</p>
    <p><b>Battle:</b> click a green hex to move, click an enemy to attack (archers shoot, flyers ignore obstacles). Your hero stands beside the field: cast one spell per round and make one Hero Strike per round. Castle assaults are <b>sieges</b>: break the gate or walls (your catapult helps), beware arrow towers and the moat; flyers can cross the walls. Level-ups let you pick one of two perks.</p>`;
  function refreshTitle() { $('tCont').disabled = !localStorage.getItem(SAVE); }
  function showDifficultySelect() {
    const cards = Object.entries(DIFFICULTY).map(([k, d]) => `<div class="card" data-d="${k}"><div class="big">${d.icon}</div><b>${d.name}</b><div class="small">${d.desc}</div>
      <div class="small">Start: ${RES_ICON.gold}${d.gold} · guards ×${d.neutral} · income ×${d.income}<br>Rivals march from day ${d.ehDay} · armies ×${d.ehMul} · rival income ×${d.aiInc}</div></div>`).join('');
    $('mbox').innerHTML = `<h2>Choose difficulty</h2><div class="grid two">${cards}</div><div class="mb"><button id="sBack">Back</button></div>`;
    $('sBack').onclick = () => $('modal').classList.add('hide');
    $('mbox').querySelectorAll('.card').forEach(c => c.onclick = () => showMapSelect(c.dataset.d));
    $('modal').classList.remove('hide');
  }
  function showMapSelect(diff, st = { preset: 'plains', size: 'medium', seed: '' }) {
    const cards = Object.entries(MAPS).map(([k, m]) => `<div class="card${st.preset === k ? ' on' : ''}" data-m="${k}"><div class="big">${m.icon}</div><b>${m.name}</b><div class="small">${m.desc}</div></div>`).join('');
    const sizes = Object.entries(SIZES).map(([k, s]) => `<button class="${st.size === k ? 'primary' : ''}" data-s="${k}">${s.name} (${s.w}×${s.h})</button>`).join(' ');
    $('mbox').innerHTML = `<h2>Choose your map <span class="small">${DIFFICULTY[diff].icon} ${DIFFICULTY[diff].name}</span></h2><div class="grid two">${cards}</div>
      <p>Size: ${sizes}</p>
      <p>Rivals: ${[0, 1, 2, 3, 4].map(n => `<button class="${(st.ais || 0) === n ? 'primary' : ''}" data-a="${n}">${n ? n : 'Auto'}</button>`).join(' ')} <span class="small">AI players that expand and fight you.</span></p><p>Seed: <input id="mSeed" placeholder="empty = random map" value="${st.seed}" style="width:230px;background:#120d08;color:#f1e6c4;border:1px solid #6b4f24;padding:4px"> <span class="small">Share a seed to replay the same map.</span></p>
      <div class="mb"><button id="sBack">Back</button><button class="primary" id="sNext">Next: castle</button></div>`;
    const keep = () => { st.seed = $('mSeed').value; };
    $('mbox').querySelectorAll('[data-m]').forEach(c => c.onclick = () => { keep(); st.preset = c.dataset.m; showMapSelect(diff, st); });
    $('mbox').querySelectorAll('[data-s]').forEach(b => b.onclick = () => { keep(); st.size = b.dataset.s; showMapSelect(diff, st); });
    $('mbox').querySelectorAll('[data-a]').forEach(b => b.onclick = () => { keep(); st.ais = +b.dataset.a; showMapSelect(diff, st); });
    $('sBack').onclick = showDifficultySelect;
    $('sNext').onclick = () => { keep(); showFactionSelect(diff, { ...st }); };
    $('modal').classList.remove('hide');
  }
  function showFactionSelect(diff = 'normal', map = {}) {
    const cards = Object.entries(FACTIONS).map(([k, f]) => `<div class="card" data-f="${k}"><div class="big">${f.icon}</div><b>${f.name}</b><div class="small">${f.blurb}</div>
      <div class="crow">${factionTiers(k).map(id => `<span title="${C[id].n} → ${C[lineType(id, 2)].n}">${C[id].i}</span>`).join('')}</div></div>`).join('');
    $('mbox').innerHTML = `<h2>Choose your castle <span class="small">${DIFFICULTY[diff].icon} ${DIFFICULTY[diff].name}</span></h2><div class="grid">${cards}</div><div class="mb"><button id="sBack">Back</button></div>`;
    $('sBack').onclick = () => showMapSelect(diff, map.preset ? map : undefined);
    $('mbox').querySelectorAll('.card').forEach(c => c.onclick = () => showHeroSelect(c.dataset.f, diff, map));
    $('modal').classList.remove('hide');
  }
  function showHeroSelect(f, diff = 'normal', map = {}) {
    const ti = factionTiers(f);
    const cards = FACTIONS[f].heroes.map(([n]) => { const d = HEROES[n];
      return `<div class="card" data-hid="${n}"><div class="big">${d.i}</div><b>${d.name}</b><div class="small">${d.cls}</div>
        <div class="small">⚔️${d.att} 🛡${d.def} ✨${d.sp} 📚${d.kn}</div><div class="small">Spells: ${[...START_SPELLS, ...d.spells].map(k => SPELLS[k].i).join(' ')}</div>
        <div class="small">Army: ${ti.slice(0, 3).map(id => C[id].i).join(' ')}</div></div>`; }).join('');
    $('mbox').innerHTML = `<h2>${FACTIONS[f].icon} ${FACTIONS[f].name} — choose your hero</h2><div class="grid two">${cards}</div>
      <div class="small">Your rival will command a different castle. Fight them across zones, forts and sieges.</div><div class="mb"><button id="sBack">Back</button></div>`;
    $('sBack').onclick = () => showFactionSelect(diff, map);
    $('mbox').querySelectorAll('.card').forEach(c => c.onclick = () => { $('modal').classList.add('hide'); $('title').classList.add('hide'); newGame(f, c.dataset.hid, diff, map); });
  }
  $('tNew').onclick = showDifficultySelect;
  $('tCont').onclick = () => { if (load()) $('title').classList.add('hide'); };
  $('tHelp').onclick = () => showModal(HELP);
  $('bHelp').onclick = () => showModal(HELP);
  $('bSave').onclick = () => G && !busy && save();
  $('bEnd').onclick = endTurn;
  $('bTown').onclick = () => G && !busy && openTown();
  function fitZoom() { if (!G) return; setZoom(Math.min(cmap.width / (G.W * TS), cmap.height / (G.H * TS)), 0, 0); clampCam(); }
  $('mEnd').onclick = endTurn;
  $('mTown').onclick = () => G && !busy && openTown();
  $('mHero').onclick = () => { if (G && !busy) { setActive((G.sel + 1) % G.heroes.length); G.path = null; centerOn(G.hero.x, G.hero.y); renderAll(); toast(`${G.hero.name} selected`); } };
  $('mMenu').onclick = async () => {
    if (!G || busy) return;
    const i = await showModal('<h2>Menu</h2><p class="small">Drag to pan, pinch to zoom, tap a tile to preview the path and tap it again to go.</p>', ['Close', '💾 Save game', Sfx.on ? '🔇 Sound off' : '🔊 Sound on', '🗺 Zoom to fit', '❓ Help']);
    if (i === 1) save(); else if (i === 2) { Sfx.toggle(); $('bSnd').textContent = Sfx.on ? '🔊' : '🔇'; } else if (i === 3) fitZoom(); else if (i === 4) showModal(HELP);
  };

  refreshTitle();
  requestAnimationFrame(loop);
  window.__G = () => G;
  window.__dbg = { centerOn, interact, renderAll, newGame, fight, gainXp, openTown, view: () => ({ Z, VW, VH, cam: { ...cam } }) };
})();
