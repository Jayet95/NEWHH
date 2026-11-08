'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise(r => setTimeout(r, ms / Settings.animSpeed));
  const TS = 32, FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
  const HR = TS / Math.sqrt(3), RH = HR * 1.5, HH = HR * 2;
  const hcx = (x, y) => (x + 0.5 + (y & 1) * 0.5) * TS, hcy = (y) => y * RH + HR;
  const COARSE = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  let VW = 960, VH = 640, Z = (COARSE || window.innerWidth < 700) ? 1.5 : window.innerWidth > 1100 ? 1.3 : 1;
  const SAVE = 'h3js_save_v7';
  const MOVE_PER_DAY = 1700;
  const FLEE_RATIO = 3;
  const cmap = $('map'), cx = cmap.getContext('2d'), mini = $('mini'), mx = mini.getContext('2d');
  let G = null, cam = { x: 0, y: 0 }, hover = null, busy = false, selSlot = -1, terrain = null;

  // ---------- helpers ----------
  window.toast = (t) => {
    const d = document.createElement('div'); d.innerHTML = t; $('toast').appendChild(d);
    setTimeout(() => d.remove(), 2800);
  };
  window.showModal = (html, buttons = ['OK']) => new Promise(res => {
    $('mbox').innerHTML = html + '<div class="mb"></div>';
    buttons.forEach((b, i) => {
      const el = document.createElement('button'); el.innerHTML = b; if (i === 0) el.className = 'primary';
      el.onclick = () => { $('modal').classList.add('hide'); res(i); };
      $('mbox').lastChild.appendChild(el);
    });
    $('modal').classList.remove('hide');
  });
  // artifact bonuses: equipped items plus completed sets (cached per hero; h.av bumps when equipment changes)
  const BONUS_KEYS = ['att', 'def', 'sp', 'kn', 'morale', 'luck', 'move', 'mana'];
  function artBonus(h) {
    if (h._ab && h._abv === (h.av || 0)) return h._ab;
    const b = { att: 0, def: 0, sp: 0, kn: 0, morale: 0, luck: 0, move: 0, mana: 0, sk: {} }, ids = [];
    for (const s of SLOT_ORDER) if (h.arts && h.arts[s]) ids.push(h.arts[s]);
    for (const id of ids) {
      const a = ART[id];
      BONUS_KEYS.forEach(k => { b[k] += a[k] || 0; });
      if (a.sk) for (const k in a.sk) b.sk[k] = (b.sk[k] || 0) + a.sk[k];
    }
    for (const sid in ART_SETS) { const set = ART_SETS[sid]; if (set.parts.every(p => ids.includes(p))) BONUS_KEYS.forEach(k => { b[k] += set[k] || 0; }); }
    h._ab = b; h._abv = h.av || 0; return b;
  }
  const rawPerk = (h, id) => (h.perks && h.perks[id]) || 0;
  const perk = (h, id) => Math.min(MAX_PERK, rawPerk(h, id) + ((h.arts && artBonus(h).sk[id]) || 0));
  const eff = (h, k) => h[k] + (h.arts ? artBonus(h)[k] : 0);
  const perksOf = (h) => Object.fromEntries(Object.keys(PERKS).map(k => [k, perk(h, k)]));
  const artStats = (a) => ['att', 'def', 'sp', 'kn', 'morale', 'luck'].filter(k => a[k]).map(k => `${a[k] > 0 ? '+' : ''}${a[k]} ${{ att: 'Attack', def: 'Defense', sp: 'Spell Power', kn: 'Knowledge', morale: 'Morale', luck: 'Luck' }[k]}`)
    .concat(a.move ? [`+${a.move}% movement`] : [], a.mana ? [`+${a.mana} mana`] : [], a.sk ? Object.keys(a.sk).map(k => `+${a.sk[k]} ${PERKS[k].n}`) : []).join(', ');
  const myTowns = () => G.objs.filter(o => o.t === 'town' && o.owner === 0);
  const town = () => myTowns()[0] || null;
  const townAt = (x, y) => { const o = objAt(G, x, y); return o && o.t === 'town' && o.owner === 0 ? o : null; };
  const nearestTown = (x, y) => myTowns().sort((a, b) => Math.max(Math.abs(a.x - x), Math.abs(a.y - y)) - Math.max(Math.abs(b.x - x), Math.abs(b.y - y)))[0] || null;
  const tiersOf = (t) => factionTiers(t.fac || G.faction);
  const aiById = (id) => G.ais.find(a => a.id === id);
  const gst = (k, n) => { if (!G) return; (G.st = G.st || {})[k] = (G.st[k] || 0) + n; };
  const note = (t, x, y) => { (G.report = G.report || []).push({ t, x, y }); };
  const allAiHeroes = () => G.ais.flatMap(a => a.heroes);
  const aiHeroAt = (x, y) => allAiHeroes().find(h => h.x === x && h.y === y);
  const AICOL = ['#e03a3a', '#e0a030', '#a050e0', '#30b0a0'];
  const PALETTE = [['Blue', '#3a8aff'], ['Red', '#e03a3a'], ['Green', '#46b84a'], ['Orange', '#ff9a2a'], ['Purple', '#b06af0'], ['Teal', '#2ec8c0'], ['Pink', '#ff78b8'], ['Tan', '#d8b878']];
  const ownCol = (o) => (o === null || o === undefined) ? '#999' : (G && G.col && G.col[o]) || (o === 0 ? '#3a8aff' : AICOL[(o - 1) % 4]);
  // teams: you are team 1; allies share it, an "enemy bloc" is team 2, other rivals fight alone
  const teamOf = (o) => o === 0 ? 1 : ((G.ais.find(a => a.id === o) || {}).team || (10 + o));
  const isAlly = (a, b) => a !== null && a !== undefined && b !== null && b !== undefined && a !== b && teamOf(a) === teamOf(b);
  const allyOfPlayer = (o) => o !== null && o !== undefined && o !== 0 && teamOf(o) === 1;
  const ownFill = (o, a) => { const c = ownCol(o); return `rgba(${parseInt(c.slice(1, 3), 16)},${parseInt(c.slice(3, 5), 16)},${parseInt(c.slice(5, 7), 16)},${a})`; };
  const armyCount = (h) => h.army.reduce((s, a) => s + (a ? a.n : 0), 0);
  const maxMana = (h) => eff(h, 'kn') * 10 + 15 * perk(h, 'wisdom') + (h.arts ? artBonus(h).mana : 0);
  const heroMorale = (h) => {
    const facs = new Set(h.army.filter(Boolean).map(a => C[a.t].fac).filter(Boolean));
    return Math.max(-3, Math.min(3, perk(h, 'leadership') - Math.max(0, facs.size - 1) + (h.arts ? artBonus(h).morale : 0) + (h.buff ? h.buff.morale : 0)));
  };
  const heroLuck = (h) => Math.max(-3, Math.min(3, perk(h, 'fortune') + (h.arts ? artBonus(h).luck : 0) + (h.buff ? h.buff.luck : 0)));
  const capsOf = (h) => ({ forest: perk(h, 'forester'), mount: perk(h, 'mountaineer'), water: perk(h, 'waterwalk'), nav: perk(h, 'navigation') });
  const sgn = (n) => (n > 0 ? '+' : '') + n;
  const sizeMv = () => (G && SIZES[G.size] && SIZES[G.size].mv) || 1;
  const maxMove = (h) => Math.round(MOVE_PER_DAY * sizeMv() * (1 + 0.1 * perk(h, 'logistics') + (h.arts ? artBonus(h).move : 0) / 100));
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
    return { id: def.id, pid: def.id, name: def.name, cls: def.cls, icon: def.i, x, y, att: def.att, def: def.def, sp: def.sp, kn: def.kn,
      lvl: 1, xp: 0, mana: def.kn * 10, move: MOVE_PER_DAY, army: emptyArmy(), perks: Object.fromEntries([...(START_SKILLS[def.cls] || []), ...(def.sk ? [def.sk] : [])].map(k => [k, 1])), arts: {}, pack: [], av: 0 };
  }
  // ---------- artifacts & equipment ----------
  function slotFor(h, a) { return a.slot === 'ring' ? (!h.arts.ring1 ? 'ring1' : !h.arts.ring2 ? 'ring2' : null) : (!h.arts[a.slot] ? a.slot : null); }
  // equips into a free slot, otherwise the backpack; returns 'equipped' | 'pack' | 'full'
  function giveArt(h, id) {
    const r = giveArt0(h, id);
    if (r !== 'full' && !h.ai) Ach.event('art', { equipped: Object.values(h.arts).filter(Boolean).length });
    return r;
  }
  function giveArt0(h, id) {
    const a = ART[id], slot = slotFor(h, a);
    if (slot) { h.arts[slot] = id; h.av++; return 'equipped'; }
    if (h.pack.length < MAX_PACK) { h.pack.push(id); return 'pack'; }
    return 'full';
  }
  function equipFromPack(h, idx) {
    const id = h.pack[idx], a = ART[id]; let slot = slotFor(h, a) || (a.slot === 'ring' ? 'ring1' : a.slot);
    const old = h.arts[slot]; h.arts[slot] = id; h.pack.splice(idx, 1); if (old) h.pack.push(old); h.av++;
  }
  function unequip(h, slot) { if (h.pack.length >= MAX_PACK) return toast('Backpack is full.'); h.pack.push(h.arts[slot]); h.arts[slot] = null; h.av++; }
  function openEquip(h) {
    const b = artBonus(h), others = heroesAt(h.x, h.y).filter(x => x !== h);
    const slots = SLOT_ORDER.map(s => { const id = h.arts[s], a = id && ART[id];
      return `<div class="trow" style="grid-template-columns:96px 1fr auto"><div class="small">${SLOT_NAMES[s]}</div>
        <div>${a ? `${a.i} <b>${a.n}</b><br><span class="small">${artStats(a)}</span>` : '<span class="small">— empty —</span>'}</div>
        <div class="acts">${a ? `<button data-un="${s}">Unequip</button>` : ''}</div></div>`; }).join('');
    const pack = h.pack.map((id, i) => { const a = ART[id];
      return `<div class="trow" style="grid-template-columns:30px 1fr auto"><div class="ic">${a.i}</div><div><b>${a.n}</b> <span class="small">${SLOT_NAMES[a.slot === 'ring' ? 'ring1' : a.slot]}</span><br><span class="small">${artStats(a)}</span></div>
        <div class="acts"><button data-eq="${i}">Equip</button>${others.map(o => `<button data-give="${i}:${G.heroes.indexOf(o)}" title="Give to ${o.name}">→ ${o.icon}</button>`).join('')}</div></div>`; }).join('');
    const sets = Object.entries(ART_SETS).map(([sid, st]) => { const have = st.parts.filter(p => Object.values(h.arts).includes(p)).length;
      return `<div class="small">${st.n}: ${have}/${st.parts.length} ${have === st.parts.length ? '✅ active' : '· ' + st.parts.map(p => ART[p].n).join(', ')}</div>`; }).join('');
    $('mbox').innerHTML = `<h2>🎒 ${h.name} — Equipment</h2>
      <div class="small">Bonus from artifacts: ${['att', 'def', 'sp', 'kn', 'morale', 'luck'].filter(k => b[k]).map(k => `${b[k] > 0 ? '+' : ''}${b[k]} ${k}`).join(', ') || 'none'}${b.move ? `, +${b.move}% move` : ''}${b.mana ? `, +${b.mana} mana` : ''}</div>
      ${slots}<h4>Backpack (${h.pack.length}/${MAX_PACK})</h4>${pack || '<div class="small">Empty.</div>'}<h4>Sets</h4>${sets}
      <div class="mb"><button class="primary" id="eClose">Close</button></div>`;
    $('eClose').onclick = () => { $('modal').classList.add('hide'); renderAll(); };
    $('mbox').querySelectorAll('[data-un]').forEach(x => x.onclick = () => { unequip(h, x.dataset.un); renderAll(); openEquip(h); });
    $('mbox').querySelectorAll('[data-eq]').forEach(x => x.onclick = () => { equipFromPack(h, +x.dataset.eq); sfx('build'); renderAll(); openEquip(h); });
    $('mbox').querySelectorAll('[data-give]').forEach(x => x.onclick = () => { const [i, hi] = x.dataset.give.split(':').map(Number), t = G.heroes[hi]; if (t.pack.length >= MAX_PACK) return toast(`${t.name}'s backpack is full.`); t.pack.push(h.pack.splice(i, 1)[0]); openEquip(h); });
    $('modal').classList.remove('hide');
  }
  function learn(spells) { for (const k of spells) if (!G.spells.includes(k)) G.spells.push(k); }
  function rollTavern() {
    const pool = Object.values(HEROES).filter(d => !G.heroes.some(h => h.id === d.id));
    G.tavern = shuffle(pool).slice(0, 3).map(d => d.id);
  }

  // ---------- new game / save ----------
  const DF = () => DIFFICULTY[(G && G.diff) || 'normal'];
  // interface mood follows the player's castle: bright for the human realms, black and ember for the demonic ones
  const THEME = { castle: 'light', rampart: 'light', tower: 'light', conflux: 'light', inferno: 'dark', necropolis: 'dark', dungeon: 'dark' };
  function applyTheme(f) { const b = document.body.classList; b.remove('th-light', 'th-dark'); if (THEME[f]) b.add('th-' + THEME[f]); }
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
    const m = genMap(seed, aiFacs, diff, { preset, size, biome: map.biome });
    setFaction(faction); applyTheme(faction);
    G = { seed, preset, size, W: m.W, H: m.H, scn: map.scn ? { id: map.scn.id, name: map.scn.name, goal: map.scn.goal } : null, tiles: m.tiles, biome: m.biome, zone: m.zone, objs: m.objs, dock: m.dock, boats: [], nextBoat: 1, day: 1, over: false, path: null, faction, diff,
      res: { gold: D.gold, wood: r(20), ore: r(20), mercury: r(5), sulfur: r(5), crystal: r(5), gems: r(5) }, spells: [...START_SPELLS],
      wk: {}, heroes: [], sel: 0, hero: null, tavern: [], noTown: 0,
      col: (() => { const pc = Math.max(0, Math.min(7, map.color || 0)), free = PALETTE.map((p, i) => i).filter(i => i !== pc); return [PALETTE[pc][1], ...aiFacs.map((f, i) => PALETTE[free[i % free.length]][1])]; })(),
      ais: aiFacs.map((f, i) => ({ id: i + 1, fac: f, name: FACTIONS[f].name, gold: Math.round(3000 * D.aiInc), heroes: [], alive: true, spawnWait: 0, team: ({ ally: 1, bloc: 2 }[(map.teams || [])[i]] || 3 + i) })) };
    if (G.ais.every(a => a.team === 1)) G.ais[0].team = 3;
    for (const o of G.objs) if (o.t === 'town') {
      if (o.owner === 0) { o.fac = faction; o.name = FACTIONS[faction].town; initTown(o, 0); }
      else initTown(o, o.owner ? 1 : 0);
    }
    for (const ai of G.ais) spawnAiHero(ai, G.objs.find(o => o.t === 'town' && o.owner === ai.id));
    const def = HEROES[heroId], h = makeHero(def, m.P.x, m.P.y), ti = factionTiers(faction);
    h.army = [{ t: ti[0], n: 20 }, { t: ti[1], n: 10 }, { t: ti[2], n: 5 }, null, null, null, null];
    h.move = maxMove(h);
    G.heroes.push(h); setActive(0); learn(def.spells); rollTavern();
    if (map.scn && map.scn.bonus) for (const k in map.scn.bonus) G.res[k] = (G.res[k] || 0) + map.scn.bonus[k];
    G.fog = map.fog !== false; initFog();
    reindex(G); buildTerrain(); sizeMini(); centerOn(h.x, h.y); renderAll(); recentreSoon();
    toast(`${MAPS[preset].name} (${SIZES[size].name}, seed ${seed}) · ${D.name}: defeat ${nAI > 1 ? 'all ' + nAI + ' rivals by capturing their towns' : 'the rival by capturing their towns'}. Good luck, ${h.name}!`);
  }
  const saveJSON = () => JSON.stringify(G, (k, v) => (k === 'omap' || k === 'hero' || k[0] === '_') ? undefined : v);
  const metaNow = () => ({ day: G.day, hero: G.hero.name, fac: G.faction, size: G.size, diff: G.diff, towns: G.objs.filter(o => o.t === 'town' && o.owner === 0).length, t: Date.now() });
  function saveTo(key) { try { localStorage.setItem(key, saveJSON()); localStorage.setItem(key + '_meta', JSON.stringify(metaNow())); return true; } catch (e) { return false; } }
  function save() { toast(saveTo(SAVE) ? 'Game saved.' : 'Save failed.'); }
  function autosave() { if (saveTo(SAVE)) { const el = $('autosave'); el.classList.remove('hide'); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; setTimeout(() => el.classList.add('hide'), 1800); } }
  function load(key = SAVE) {
    try {
      const s = localStorage.getItem(key); if (!s) return false;
      G = JSON.parse(s); if (!G.zone || !G.heroes || !G.ais) return false;
      G.tavern = (G.tavern || []).filter(id => HEROES[id]);
      G.path = null; G.boats = G.boats || []; setFaction(G.faction); applyTheme(G.faction); setActive(Math.min(G.sel, G.heroes.length - 1));
      initFog(); reindex(G); buildTerrain(); sizeMini(); centerOn(G.hero.x, G.hero.y); renderAll(); recentreSoon(); return true;
    } catch (e) { return false; }
  }

  // ---------- terrain rendering ----------
  function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function buildTerrain() {
    terrain = document.createElement('canvas'); terrain.width = Math.ceil((G.W + 0.5) * TS); terrain.height = Math.ceil(G.H * RH + HR * 0.5);
    const c = terrain.getContext('2d');
    for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) Art.tile(c, G.tiles[y][x], x, y, G);
    for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) Art.tileOverlay(c, G.tiles[y][x], x, y, G);
  }
  // ---------- fog of war ----------
  let vis = null, fogDirty = true, miniFog = null;
  const fogOn = () => G.fog !== false;
  const isExpl = (x, y) => !fogOn() || G.expl[y * G.W + x] === 1;
  const isVis = (x, y) => !fogOn() || vis[y * G.W + x] === 1;
  function initFog() { const n = G.W * G.H; if (!G.expl) G.expl = new Array(n).fill(0); vis = new Uint8Array(n); fogDirty = true; }
  function markView(x, y, r, seeNow = true) {
    const r2 = r * r + r, ry = Math.ceil(r / 0.866);
    for (let dy = -ry; dy <= ry; dy++) {
      const yy = y + dy; if (yy < 0 || yy >= G.H) continue;
      for (let dx = -r - 1; dx <= r + 1; dx++) {
        const ox = dx + ((yy & 1) - (y & 1)) * 0.5, oy = dy * 0.866;
        if (ox * ox + oy * oy > r2) continue;
        const xx = x + dx; if (xx < 0 || xx >= G.W) continue;
        const i = yy * G.W + xx;
        if (seeNow) vis[i] = 1;
        if (G.expl[i] === 0) { G.expl[i] = 1; fogDirty = true; }
      }
    }
  }
  function recomputeVision() {
    if (!fogOn() || !vis) return;
    vis.fill(0);
    for (const h of G.heroes) markView(h.x, h.y, 6 + perk(h, 'scouting'));
    for (const o of G.objs) if (o.owner === 0 || allyOfPlayer(o.owner)) markView(o.x, o.y, o.t === 'town' ? 9 : o.t === 'fort' ? 6 : 4);
    for (const a of G.ais) if (allyOfPlayer(a.id)) for (const ah of a.heroes) markView(ah.x, ah.y, 6);
    for (const b of G.boats) markView(b.x, b.y, 3);
  }
  let MK = 6, miniTerr = null, miniCache = null, miniSig = '';
  let MV = 5;
  const mxp = (x, y, k) => (x + 0.5 * (y & 1)) * k;
  function sizeMini() {
    MK = Math.max(4, Math.floor(480 / (G.W + 0.5))); MV = MK * 0.866; mini.width = Math.ceil((G.W + 0.5) * MK); mini.height = Math.ceil(G.H * MV + MV * 0.4); miniSig = '';
    miniTerr = document.createElement('canvas'); miniTerr.width = mini.width; miniTerr.height = mini.height;
    const t = miniTerr.getContext('2d');
    const BIO = [null, { 0: '#d8b865', 1: '#a8863c', 2: '#8a7a55', 4: '#c9a964', 5: '#e0c577' }, { 0: '#dfe9f2', 1: '#9fb4c6', 2: '#b9c6d4', 4: '#c8d4e0', 5: '#cfdbe6' }, { 0: '#5f6b3a', 1: '#3f4a26', 2: '#4a4a42', 4: '#7a7448', 5: '#6e7242' }, { 0: '#4a4a50', 1: '#34343a', 2: '#242428', 4: '#5c4a44', 5: '#55504c' }];
    for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) {
      const tt = G.tiles[y][x], bm = G.biome && G.biome[y] ? G.biome[y][x] : 0; let col = (bm && BIO[bm][tt]) || MC[tt];
      t.fillStyle = col; t.fillRect(mxp(x, y, MK), y * MV, MK + 0.7, MV + 0.7);
      const j = ((x * 73 + y * 151) % 7) - 3; if (j) { t.fillStyle = j > 0 ? `rgba(255,255,255,${j * 0.018})` : `rgba(0,0,0,${-j * 0.03})`; t.fillRect(mxp(x, y, MK), y * MV, MK + 0.7, MV + 0.7); }
    }
    miniCache = document.createElement('canvas'); miniCache.width = mini.width; miniCache.height = mini.height;
    miniFog = document.createElement('canvas'); miniFog.width = mini.width; miniFog.height = mini.height; fogDirty = true;
  }
  function clampCam() {
    const WW = (G.W + 0.5) * TS, WH = G.H * RH + HR * 0.5;
    // a little overscroll past the map edge so a hero standing in a corner can still be centred
    const mx = VW * 0.45, my = VH * 0.45;
    cam.x = WW <= VW ? -(VW - WW) / 2 : Math.max(-mx, Math.min(WW - VW + mx, cam.x));
    cam.y = WH <= VH ? -(VH - WH) / 2 : Math.max(-my, Math.min(WH - VH + my, cam.y));
  }
  // the page layout settles a moment after a game starts (title/dialogs close), so centre on the hero again once it has
  const recentreSoon = () => { const g = G; [60, 250].forEach(ms => setTimeout(() => { if (G === g && G && G.hero && !G.path) { centerOn(G.hero.x, G.hero.y); renderAll(); } }, ms)); };
  function centerOn(x, y) { resizeMap(); cam.x = hcx(x, Math.floor(y)) - VW / 2; cam.y = hcy(y) - VH / 2; clampCam(); }
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

  // ---------- threat tags: how dangerous is a guard compared with the selected hero's army ----------
  const THREAT = [[3, 'Trivial', '#6fd36f'], [1.6, 'Easy', '#a6e05a'], [0.9, 'Even', '#ffd24a'], [0.45, 'Hard', '#ff9a2a'], [0, 'Deadly', '#e0443a']];
  function threatOfDef(def) {
    if (!G || !G.hero) return null;
    const theirs = armyValue(def || []); if (!theirs) return null;
    const ratio = armyValue(G.hero.army) / theirs, t = THREAT.find(x => ratio >= x[0]) || THREAT[4];
    const loss = ratio >= 1 ? 0.45 / Math.pow(ratio, 1.3) : Math.min(1, 0.45 + (1 - ratio) * 0.8);
    return { ratio, label: t[1], col: t[2], loss: Math.max(0.02, Math.min(1, loss)) };
  }
  function defenderOf(o) {
    if (!o) return null;
    if (o.t === 'town' || o.t === 'fort') { if (o.owner === 0 || allyOfPlayer(o.owner)) return null; return o.owner === null ? (o.guard || []) : (o.garrison || []); }
    if (o.owner === 0 || allyOfPlayer(o.owner)) return null;
    return o.guard && o.guard.length ? o.guard : null;
  }
  function threatAt(x, y) {
    if (!isExpl(x, y)) return null;
    const ah = isVis(x, y) ? aiHeroAt(x, y) : null; if (ah) return allyOfPlayer(ah.ai) ? null : threatOfDef(ah.army);
    const o = objAt(G, x, y); if (!o || (o.t === 'monster' && !isVis(x, y))) return null;
    return threatOfDef(defenderOf(o));
  }
  const threatLine = (x, y) => { const t = threatAt(x, y); return t ? `<br>⚔ <b style="color:${t.col}">${t.label}</b> <span class="small">— your army is ${t.ratio >= 10 ? '10+' : t.ratio.toFixed(1)}× ${t.ratio >= 1 ? 'stronger' : 'as strong'}; expect to lose ≈${Math.round(t.loss * 100)}% of it</span>` : ''; };
  // waving flag in the owner's colour (allies get a white fringe)
  function drawFlag(px, py, col, rel, sc = 1) {
    const pal = PALETTE.find(q => q[1] === col), fim = pal ? Assets.get('flags/' + pal[0].toLowerCase()) : null;
    if (fim) { const fh = 26 * sc, fw = fim.width * fh / fim.height; cx.drawImage(fim, px - fw * 0.22, py + 7 * sc - fh, fw, fh); return; }
    const t = performance.now() / 260, w = Math.sin(t + px * 0.07) * 1.6 * sc;
    cx.save(); cx.translate(px, py); cx.scale(sc, sc);
    cx.strokeStyle = '#2b2218'; cx.lineWidth = 1.7; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(0, 6); cx.lineTo(0, -13); cx.stroke();
    cx.beginPath(); cx.moveTo(0.5, -13); cx.quadraticCurveTo(6, -14 + w, 12, -10.5 + w); cx.quadraticCurveTo(7, -8.5 - w * 0.5, 12, -5.5 + w * 0.6); cx.lineTo(0.5, -5); cx.closePath();
    cx.fillStyle = col; cx.fill(); cx.lineWidth = 1.1; cx.strokeStyle = rel === 'ally' ? '#fff' : '#140a04'; cx.stroke();
    cx.restore();
  }
  // banner carried by a hero: a pole held at the side rising above the head, the flag flying from its top
  function drawBanner(px, py, col, rel) {
    cx.strokeStyle = '#2b2218'; cx.lineWidth = 2; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(px + 12, py + 10); cx.lineTo(px + 12, py - 30); cx.stroke();
    drawFlag(px + 12, py - 14, col, rel, 1);
  }
  const dirOf = (ax, ay, bx, by) => { const dx = hcx(bx, by) - hcx(ax, ay), dy = hcy(by) - hcy(ay); return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : (dy > 0 ? 'south' : 'north'); };
  // mounted hero sprite from the art pack (4 directions, loaded on first use); returns false when there is none
  function drawMounted(h, px, py, ring, col, rel) {
    const dirs = ['north', 'east', 'south', 'west'];
    if (!h._nd) { h._nd = 1; Assets.need(dirs.map(d => 'mounted/' + h.pid + '_' + d)); }
    const im = Assets.get('mounted/' + h.pid + '_' + (h.dir || 'south')); if (!im) return false;
    const k = Math.min(46 / im.height, 50 / im.width), w = im.width * k, hh = im.height * k;
    cx.beginPath(); cx.ellipse(px, py + 14, 14, 5.5, 0, 0, 7); cx.fillStyle = 'rgba(0,0,0,.35)'; cx.fill(); cx.lineWidth = ring ? 3 : 2; cx.strokeStyle = ring ? '#ffd24a' : col; cx.stroke();
    cx.drawImage(im, px - w / 2, py + 15 - hh, w, hh); drawBanner(px, py, col, rel); return true;
  }
  const relOf = (o) => o === 0 ? 'me' : o === null || o === undefined ? 'none' : allyOfPlayer(o) ? 'ally' : 'enemy';
  function objIcon(o) {
    switch (o.t) {
      case 'town': return '🏰';
      case 'fort': return '🏯';
      case 'merchant': return '⛺';
      case 'wreck': return '🚢';
      case 'lair': return '🐲';
      case 'spring': return '⛲';
      case 'dwelling': return C[dwId(o)].i;
      case 'resobj': return { windmill: '🌬️', waterwheel: '🎡', garden: '🌻' }[o.kind];
      case 'stone': return '📚';
      case 'shrine': return '⛩️';
      case 'tower': return '🔭';
      case 'bank': return { crypt: '⚰️', utopia: '🐲', stockpile: '🏚️' }[o.kind];
      case 'mono': return '🌌';
      case 'seer': return '🧙';
      case 'mine': return MINE_ICON[o.kind];
      case 'pile': return RES_ICON[o.kind];
      case 'chest': return '🧰';
      case 'art': return ART[o.art].i;
      case 'monster': return C[o.guard[0].t].i;
    }
  }
  const monNeed = new Set(), fpFar = {};
  function draw() {
    if (!G) return;
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.fillStyle = '#000'; cx.fillRect(0, 0, cmap.width, cmap.height); cx.setTransform(Z, 0, 0, Z, 0, 0);
    cx.imageSmoothingEnabled = Z < 1.4;
    cx.drawImage(terrain, cam.x, cam.y, VW, VH, 0, 0, VW, VH);
    const x0 = Math.floor(cam.x / TS) - 1, y0 = Math.floor(cam.y / RH) - 1, vx = Math.ceil(VW / TS) + 3, vy = Math.ceil(VH / RH) + 3;
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.lineWidth = 2; cx.strokeStyle = 'rgba(255,255,255,.45)';
    const zo = {}; for (const o of G.objs) if (o.t === 'fort' || o.t === 'town') zo[o.zone] = o.owner;
    for (let y = Math.max(0, y0); y < Math.min(G.H, y0 + vy); y++) for (let x = Math.max(0, x0); x < Math.min(G.W, x0 + vx); x++) {
      const z = G.zone[y][x], ow = zo[z], px = hcx(x, y) - cam.x, py = hcy(y) - cam.y;
      if (ow !== null && ow !== undefined && G.tiles[y][x] !== T.WATER) { Art.hexPath(cx, px, py, HR + 0.5); cx.fillStyle = ownFill(ow, 0.2); cx.fill(); }
      const hn = hexNb(x, y);
      for (let e = 0; e < 3; e++) { const nx = hn[e][0], ny = hn[e][1]; if (nx >= 0 && ny >= 0 && nx < G.W && ny < G.H && G.zone[ny][nx] !== z) { const p1 = Art.hexPt(px, py, HR, e), p2 = Art.hexPt(px, py, HR, e + 1); cx.beginPath(); cx.moveTo(p1[0], p1[1]); cx.lineTo(p2[0], p2[1]); cx.stroke(); } }
    }
    if (G.path) {
      let left = G.hero.move;
      // pirate-map trail: a dotted route (cream while the hero can still reach it today, red beyond) ending in a big red X
      let prev = { x: G.hero.x, y: G.hero.y };
      cx.lineCap = 'round';
      const fp0 = Assets.get('markers/footprints');
      // footprints are coloured by the day the hero gets there: gold = today, blue = day 2, red = day 3 or later
      const tintFp = (col) => { if (!fpFar[col]) { const c = document.createElement('canvas'); c.width = fp0.width; c.height = fp0.height; const x = c.getContext('2d'); x.drawImage(fp0, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); fpFar[col] = c; } return fpFar[col]; };
      let cum = 0; const mm = Math.max(1, maxMove(G.hero));
      G.path.forEach((s) => {
        left -= s.cost; const ok = left >= 0; cum += s.cost; const dayN = cum <= G.hero.move ? 1 : 1 + Math.ceil((cum - G.hero.move) / mm); const fp = !fp0 || dayN === 1 ? fp0 : tintFp(dayN === 2 ? 'rgba(60,150,255,.8)' : 'rgba(235,45,35,.8)');
        const ax = hcx(prev.x, prev.y) - cam.x, ay = hcy(prev.y) - cam.y, bx = hcx(s.x, s.y) - cam.x, by = hcy(s.y) - cam.y;
        if (fp) { const ang = Math.atan2(by - ay, bx - ax), fw = 21, fh = fp.height * fw / fp.width; cx.save(); cx.translate(bx, by); cx.rotate(ang + Math.PI / 2); cx.globalAlpha = 1; cx.shadowColor = 'rgba(0,0,0,.9)'; cx.shadowBlur = 5; cx.drawImage(fp, -fw / 2, -fh / 2, fw, fh); cx.shadowBlur = 0; cx.shadowColor = 'transparent'; cx.drawImage(fp, -fw / 2, -fh / 2, fw, fh); cx.restore(); prev = s; return; }
        cx.setLineDash([0.1, 7]);
        cx.beginPath(); cx.moveTo(ax, ay); cx.lineTo(bx, by);
        cx.lineWidth = 6.5; cx.strokeStyle = 'rgba(25,12,0,.8)'; cx.stroke();
        cx.lineWidth = 3.6; cx.strokeStyle = ok ? '#fff2c4' : '#ff8a70'; cx.stroke();
        cx.setLineDash([]); prev = s;
      });
      { const e = G.path[G.path.length - 1], ex = hcx(e.x, e.y) - cam.x, ey = hcy(e.y) - cam.y, r = 9;
        const eo = objAt(G, e.x, e.y), ahh = aiHeroAt(e.x, e.y), hostile = (ahh && !allyOfPlayer(ahh.ai)) || (eo && eo.owner !== 0 && !allyOfPlayer(eo.owner) && (eo.t === 'monster' || defenderOf(eo))), boat = G.boats.some(b => b.x === e.x && b.y === e.y);
        const mk = hostile ? Assets.get('markers/attack') : boat ? Assets.get('markers/anchor') : null;
        if (mk) { const mw = 30, mh = mk.height * mw / mk.width; cx.drawImage(mk, ex - mw / 2, ey - mh / 2, mw, mh); }
        else for (const [w, col] of [[8.5, 'rgba(25,12,0,.9)'], [5, '#e0281c']]) { cx.lineWidth = w; cx.strokeStyle = col; cx.beginPath(); cx.moveTo(ex - r, ey - r); cx.lineTo(ex + r, ey + r); cx.moveTo(ex + r, ey - r); cx.lineTo(ex - r, ey + r); cx.stroke(); }
        const hg = Assets.get('markers/hourglass'); if (hg && G.path.reduce((q, p) => q + p.cost, 0) > G.hero.move) { const hw = 16, hh = hg.height * hw / hg.width; cx.drawImage(hg, ex + 12, ey - 24, hw, hh); } }
      const total = G.path.reduce((s, p) => s + p.cost, 0), days = total <= G.hero.move ? 0 : Math.ceil((total - G.hero.move) / maxMove(G.hero));
      const end = G.path[G.path.length - 1], lx = hcx(end.x, end.y) - cam.x, ly = hcy(end.y) - cam.y - 22, txt = days ? `${days + 1} days — click to go` : '✓ today — click to go';
      cx.font = 'bold 11px sans-serif'; const tw = cx.measureText(txt).width + 12;
      cx.fillStyle = days ? 'rgba(120,30,20,.9)' : 'rgba(20,80,30,.9)'; cx.fillRect(lx - tw / 2, ly - 9, tw, 18);
      cx.fillStyle = '#fff'; cx.fillText(txt, lx, ly);
    }
    for (const o of G.objs) {
      if (o.x < x0 - 1 || o.x > x0 + vx || o.y < y0 - 1 || o.y > y0 + vy) continue;
      if (fogOn()) { const fi = o.y * G.W + o.x; if (!G.expl[fi] || (o.t === 'monster' && !vis[fi])) continue; }
      const px = hcx(o.x, o.y) - cam.x, py = hcy(o.y) - cam.y;
      if (o.t === 'monster') {
        cx.beginPath(); cx.arc(px, py, 15, 0, 7);
        cx.fillStyle = o.t === 'monster' ? 'rgba(90,10,10,.65)' : 'rgba(0,0,0,.45)'; cx.fill();
      }
      if (o.t === 'monster') {
        const mt = o.guard[0].t, mb = mt.replace(/_\d$/, ''), mu = /_\d$/.test(mt) ? '_up' : '', ms = 'poses/left/idle/' + mb + mu;
        const pimg = typeof Assets !== 'undefined' ? Assets.get(ms, 'poses/left/idle/' + mb) : null;
        if (pimg) { const k = Math.min(50 / pimg.height, 44 / pimg.width), w = pimg.width * k, h = pimg.height * k; cx.drawImage(pimg, px - w / 2, py + 14 - h, w, h); }
        else {
          cx.drawImage(Art.portraitCanvas(mt), px - 15, py - 15, 30, 30);
          if (typeof Assets !== 'undefined' && Assets.has(ms) && !monNeed.has(ms)) { monNeed.add(ms); Assets.need([ms, 'poses/left/idle/' + mb]).then(() => draw()); }
        }
      }
      const spr = o.t === 'monster' ? null : Art.obj(o, o.fac);
      if (spr) { const sz = o.t === 'town' ? 50 : o.t === 'fort' || o.t === 'lair' ? 46 : o.t === 'dwelling' ? 44 : o.t === 'pile' ? 30 : 38; cx.drawImage(spr, px - sz / 2, py - sz / 2 - (o.t === 'town' ? 5 : 2), sz, sz); }
      else if (o.t !== 'monster') { cx.font = `26px ${FONT}`; cx.fillStyle = '#fff'; cx.fillText(objIcon(o), px, py + 1); }
      if (o.t === 'fort') {
        drawFlag(px + 13, py - 8, ownCol(o.owner), relOf(o.owner), 1.1);
        const gn = o.garrison.reduce((s, a) => s + (a ? a.n : 0), 0);
        if (o.owner === 0 && gn) { cx.font = 'bold 11px sans-serif'; cx.fillStyle = '#000b'; cx.fillRect(px - 14, py + 10, 28, 13); cx.fillStyle = '#fff'; cx.fillText(gn, px, py + 17); }
      }
      if (o.t === 'mine' || o.t === 'dwelling' || o.t === 'lair') drawFlag(px + 11, py - 4, ownCol(o.owner), relOf(o.owner), 0.85);
      if (o.t === 'town') drawFlag(px + 15, py - 10, ownCol(o.owner), relOf(o.owner), 1.25);
      { const df = defenderOf(o); if (df && (o.t !== 'monster' || vis[o.y * G.W + o.x] || !fogOn())) { const th = threatOfDef(df); if (th) { const bx = px - 14, by = py + 12; cx.beginPath(); cx.arc(bx, by, 5.5, 0, 7); cx.fillStyle = th.col; cx.fill(); cx.lineWidth = 1.6; cx.strokeStyle = '#140a04'; cx.stroke(); if (th.label === 'Deadly') { cx.strokeStyle = '#fff'; cx.lineWidth = 1.4; cx.beginPath(); cx.moveTo(bx - 2.4, by - 2.4); cx.lineTo(bx + 2.4, by + 2.4); cx.moveTo(bx + 2.4, by - 2.4); cx.lineTo(bx - 2.4, by + 2.4); cx.stroke(); } } } }
      if (o.t === 'town' || o.t === 'fort') {
        cx.font = 'bold 11px sans-serif'; cx.lineWidth = 3; cx.strokeStyle = '#000'; cx.fillStyle = o.owner === 0 ? '#bcd8ff' : allyOfPlayer(o.owner) ? '#c8f0c8' : o.owner ? '#ffb3a8' : '#f3e7bd';
        cx.strokeText(o.name, px, py - 27); cx.fillText(o.name, px, py - 27);
      }
    }
    for (const b of G.boats) {
      const px = hcx(b.x, b.y) - cam.x, py = hcy(b.y) - cam.y;
      cx.drawImage(Art.boat(), px - 20, py - 22, 40, 40);
    }
    for (const ai of G.ais) for (const eh of ai.heroes) {
      if (!isVis(eh.x, eh.y)) continue;
      const px = hcx(eh.x, eh.y) - cam.x, py = hcy(eh.y) - cam.y;
      if (drawMounted(eh, px, py, false, ownCol(ai.id), relOf(ai.id))) continue;
      cx.beginPath(); cx.arc(px, py, 15, 0, 7); cx.fillStyle = ownCol(ai.id); cx.fill(); cx.strokeStyle = '#000'; cx.lineWidth = 2; cx.stroke();
      cx.drawImage(Art.heroCanvas(eh.icon, ownCol(ai.id), 72, eh.pid), px - 13, py - 13, 26, 26); drawBanner(px, py, ownCol(ai.id), relOf(ai.id));
    }
    G.heroes.forEach((h, i) => {
      const px = hcx(h.x, h.y) - cam.x + (G.heroes.filter((o, j) => j < i && o.x === h.x && o.y === h.y).length * 6), py = hcy(h.y) - cam.y;
      const rr = h.boat != null ? 11 : 15;
      if (h.boat == null && drawMounted(h, px, py, h === G.hero, ownCol(0), 'me')) return;
      cx.beginPath(); cx.arc(px, py - (h.boat != null ? 6 : 0), rr, 0, 7); cx.fillStyle = '#2a5fb0'; cx.fill();
      cx.strokeStyle = h === G.hero ? '#ffd24a' : '#fff'; cx.lineWidth = h === G.hero ? 3 : 1.5; cx.stroke();
      { const hs = h.boat != null ? 18 : 26; cx.drawImage(Art.heroCanvas(h.icon, ownCol(0), 72, h.pid), px - hs / 2, py - (h.boat != null ? 6 : 0) - hs / 2, hs, hs); drawBanner(px, py - (h.boat != null ? 6 : 0), ownCol(0), 'me'); }
    });
    if (fogOn()) {
      for (let y = Math.max(0, y0); y < Math.min(G.H, y0 + vy); y++) for (let x = Math.max(0, x0); x < Math.min(G.W, x0 + vx); x++) {
        const fi = y * G.W + x;
        if (!G.expl[fi]) { Art.hexPath(cx, hcx(x, y) - cam.x, hcy(y) - cam.y, HR + 0.8); cx.fillStyle = '#05030a'; cx.fill(); }
        else if (!vis[fi]) { Art.hexPath(cx, hcx(x, y) - cam.x, hcy(y) - cam.y, HR + 0.8); cx.fillStyle = 'rgba(5,3,10,.5)'; cx.fill(); }
      }
    }
    if (hover) { Art.hexPath(cx, hcx(hover.x, hover.y) - cam.x, hcy(hover.y) - cam.y, HR - 1); cx.strokeStyle = 'rgba(255,255,255,.85)'; cx.lineWidth = 2; cx.stroke(); }
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
        if (ow !== null && ow !== undefined) { c.fillStyle = ownFill(ow, 0.4); c.fillRect(mxp(x, y, k), y * MV, k + 0.7, MV + 0.7); }
      }
    }
    mx.drawImage(miniCache, 0, 0);
    if (fogOn()) {
      if (fogDirty) {
        const c = miniFog.getContext('2d'); c.clearRect(0, 0, miniFog.width, miniFog.height); c.fillStyle = '#000';
        for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) if (!G.expl[y * G.W + x]) c.fillRect(mxp(x, y, k), y * MV, k + 0.7, MV + 0.7);
        fogDirty = false;
      }
      mx.drawImage(miniFog, 0, 0);
    }
    const s = k / 4, T0 = performance.now(), px = (o) => mxp(o.x, o.y, k) + k / 2, py = (o) => o.y * MV + MV / 2;
    const dot = (x, y, rad, fill, line) => { mx.beginPath(); mx.arc(x, y, rad, 0, 7); mx.fillStyle = fill; mx.fill(); mx.lineWidth = Math.max(1, s * 0.9); mx.strokeStyle = line; mx.stroke(); };
    for (const o of G.objs) {
      if (fogOn() && (!isExpl(o.x, o.y) || (o.t === 'monster' && !isVis(o.x, o.y)))) continue;
      if (o.t === 'town') { dot(px(o), py(o), 3.3 * s, ownCol(o.owner), '#120a04'); mx.fillStyle = '#fff'; mx.fillRect(px(o) - 1 * s, py(o) - 1.2 * s, 2 * s, 2 * s); }
      else if (o.t === 'fort') dot(px(o), py(o), 2.3 * s, ownCol(o.owner), '#120a04');
      else if (o.t === 'monster') dot(px(o), py(o), 1.1 * s, '#c33', 'rgba(0,0,0,.6)');
      else { mx.fillStyle = o.t === 'lair' ? '#ff6a00' : o.t === 'mine' ? (o.owner !== null ? ownCol(o.owner) : '#f4f0e0') : o.t === 'merchant' ? '#fa0' : '#ffe86a'; const w = (o.t === 'mine' ? 1.9 : 1.3) * s; mx.fillRect(px(o) - w / 2, py(o) - w / 2, w, w); mx.strokeStyle = 'rgba(0,0,0,.55)'; mx.lineWidth = 1; mx.strokeRect(px(o) - w / 2, py(o) - w / 2, w, w); }
    }
    for (const b of G.boats) dot(px(b), py(b), 1.5 * s, '#8df', '#05213a');
    for (const ai of G.ais) for (const eh of ai.heroes) { if (!isVis(eh.x, eh.y)) continue; const x = px(eh), y = py(eh), q = 2.6 * s; mx.beginPath(); mx.moveTo(x, y - q); mx.lineTo(x + q, y); mx.lineTo(x, y + q); mx.lineTo(x - q, y); mx.closePath(); mx.fillStyle = ownCol(ai.id); mx.fill(); mx.lineWidth = Math.max(1, s); mx.strokeStyle = '#000'; mx.stroke(); }
    for (const h of G.heroes) { const x = px(h), y = py(h), pu = 0.5 + 0.5 * Math.sin(T0 / 380); mx.beginPath(); mx.arc(x, y, (3.6 + pu * 2.2) * s, 0, 7); mx.strokeStyle = `rgba(255,215,90,${0.85 - pu * 0.5})`; mx.lineWidth = Math.max(1.4, s * 1.1); mx.stroke(); dot(x, y, 2.4 * s, '#fff', '#a37a1c'); }
    // viewport: dim everything outside it, frame it in gold
    { const vx = cam.x / TS * k, vy = cam.y / RH * MV, vw = VW / TS * k, vh = VH / RH * MV;
      mx.save(); mx.beginPath(); mx.rect(0, 0, mini.width, mini.height); mx.rect(vx, vy, vw, vh); mx.fillStyle = 'rgba(0,0,0,.34)'; mx.fill('evenodd'); mx.restore();
      mx.lineWidth = Math.max(3, s * 2.2); mx.strokeStyle = 'rgba(0,0,0,.75)'; mx.strokeRect(vx, vy, vw, vh); mx.lineWidth = Math.max(1.5, s * 1.1); mx.strokeStyle = '#ffd766'; mx.strokeRect(vx, vy, vw, vh); }
    { let seen = 0; for (let i = 0; i < G.expl.length; i++) if (G.expl[i]) seen++; const pct = fogOn() ? Math.round(seen / G.expl.length * 100) + '% explored' : ''; if (pct) { mx.font = 'bold ' + Math.round(6 * s + 2) + 'px Georgia, serif'; mx.textBaseline = 'bottom'; mx.lineWidth = 3; mx.strokeStyle = 'rgba(0,0,0,.85)'; mx.strokeText(pct, 6, mini.height - 4); mx.fillStyle = '#f3e7c6'; mx.fillText(pct, 6, mini.height - 4); } }
  }
  function loop() {
    if (G && !document.body.classList.contains('inbattle')) {
      if (cmap.clientWidth && (cmap.clientWidth !== cmap.width || cmap.clientHeight !== cmap.height)) resizeMap();
      draw();
    }
    requestAnimationFrame(loop);
  }

  // ---------- UI panels ----------
  function syncMres() { $('mres').style.display = (G && $('title').classList.contains('hide') && !$('modal').classList.contains('hide')) ? '' : 'none'; }
  new MutationObserver(() => { if (G) renderResOnly(); syncMres(); }).observe($('modal'), { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(syncMres).observe($('title'), { attributes: true, attributeFilter: ['class'] });
  function renderResOnly() { $('mres').innerHTML = $('res').innerHTML; }
  function renderAll() {
    if (!G) return;
    recomputeVision();
    const gn = computeGain();
    const resHtml = RES.map(k => `<span class="chip" title="${k[0].toUpperCase() + k.slice(1)}: ${G.res[k]}${gn[k] ? ` (+${gn[k]}/day)` : ''}">${RES_ICON[k]} <b>${fmtN(G.res[k])}</b>${gn[k] ? `<small class="inc">+${fmtN(gn[k])}</small>` : ''}</span>`).join('');
    $('res').innerHTML = resHtml; $('mres').innerHTML = resHtml; syncMres();
    $('income').innerHTML = `📈 ${RES.filter(k => gn[k]).map(k => `+${fmtN(gn[k])}${RES_ICON[k]}`).join(' ') || 'no income'}<small>/day</small>`;
    const d = G.day - 1;
    { const gt = goalText(), mo = Math.floor(d / 28) + 1, wk = Math.floor(d % 28 / 7) + 1, dw = d % 7 + 1;
      $('date').innerHTML = `<span class="dtMain"><small>Month ${mo} · Week ${wk}</small><b>Day ${dw}</b></span><span class="dtTurn" title="Turns played">Turn<br><b>${G.day}</b></span><span class="dtDiff">${DF().icon} ${DF().name}</span>${gt ? `<span class="dtGoal" title="Scenario objective">🎯 ${gt}</span>` : ''}`; }
    const h = G.hero;
    const ab = artBonus(h), plus = (v) => v ? ` <span class="bonus">(${v > 0 ? '+' : ''}${v})</span>` : '';
    const perkTxt = Object.keys(PERKS).filter(k => perk(h, k) > 0).map(k => `<span title="${PERKS[k].d}">${PERKS[k].i}${PERKS[k].n} ${RANK_NAMES[perk(h, k)]}${ab.sk[k] ? '*' : ''}</span>`).join(' · ');
    $('hero').innerHTML = `<div class="hlist">${G.heroes.map((x, i) => `<button class="hbtn${x === h ? ' on' : ''}" data-h="${i}" title="${x.name} (${x.cls})">${Art.heroPic(x.icon, ownCol(0), 34, x.pid)}</button>`).join('')}</div>
      <h3>${Art.heroPic(h.icon, ownCol(0), 34, h.pid)} ${h.name} <span class="small">${h.cls} — Level ${h.lvl}</span></h3>
      <div class="stats"><span>⚔️ Attack ${h.att}${plus(ab.att)}</span><span>🛡 Defense ${h.def}${plus(ab.def)}</span><span>✨ Spell Pow ${h.sp}${plus(ab.sp)}</span><span>📚 Knowledge ${h.kn}${plus(ab.kn)}</span></div>
      <div class="small" title="Morale: each point = 4% chance of an extra turn (negative: of skipping a turn). Mixing creatures from different castles lowers it; undead and golems are immune. Luck: each point = 4% chance of double damage.">😀 Morale ${sgn(heroMorale(h))} · 🍀 Luck ${sgn(heroLuck(h))}</div>
      <div class="small">Movement ${h.move}/${maxMove(h)}</div><div class="bar mv"><i style="width:${Math.min(100, h.move / maxMove(h) * 100)}%"></i></div>
      ${h.boat != null ? '<div class="small">⛵ Sailing — walk onto a shore tile to disembark</div>' : ''}
      <div class="small">Mana ${h.mana}/${maxMana(h)}</div><div class="bar mn"><i style="width:${Math.min(100, h.mana / maxMana(h) * 100)}%"></i></div>
      <div class="small">XP ${h.xp}/${need(h.lvl)}</div><div class="bar xp"><i style="width:${Math.min(100, h.xp / need(h.lvl) * 100)}%"></i></div>
      ${perkTxt ? `<div class="small">${perkTxt}</div>` : ''}
      <div class="small" title="${G.spells.map(k => SPELLS[k].n).join(', ')}">Spells: ${G.spells.map(k => SPELLS[k].i).join(' ')}</div>
      <button id="bEquip" class="small-btn" title="Equip artifacts">🎒 Equipment (${Object.values(h.arts).filter(Boolean).length} worn, ${h.pack.length} in pack)</button>
      <button id="bPortal" class="small-btn" title="Teleport to your castle">🌀 Town Portal (${PORTAL_COST} mana)</button>
      <div class="row2"><button id="bNext" class="small-btn" title="Select the next hero (Tab)">⏭ Next hero</button><button id="bSleep" class="small-btn" title="A sleeping hero is skipped by the end-turn reminder">${h.sleep ? '⏰ Wake' : '💤 Sleep'}</button></div>`;
    $('hero').querySelectorAll('[data-h]').forEach(b => b.onclick = () => { if (busy) return; setActive(+b.dataset.h); G.path = null; centerOn(G.hero.x, G.hero.y); renderAll(); });
    $('bPortal').onclick = townPortal;
    $('bNext').onclick = nextHero;
    $('bSleep').onclick = () => { h.sleep = !h.sleep; toast(h.sleep ? `${h.name} is resting — no more reminders.` : `${h.name} is awake.`); renderAll(); };
    $('bEquip').onclick = () => { if (!busy) openEquip(G.hero); };
    const zs = G.objs.filter(o => o.t === 'fort' || o.t === 'town').sort((a, b) => a.zone - b.zone);
    const mineIncome = G.objs.filter(o => o.t === 'mine' && o.owner === 0 && zoneOwner(G, G.zone[o.y][o.x]) === 0).length;
    const mine = zs.filter(z => z.owner === 0), rest = zs.length - mine.length;
    $('terr').innerHTML = `<h3>🗺 Territory — ${mine.length}/${zs.length} zones</h3>` +
      mine.map(z => { const gn = z.garrison ? z.garrison.reduce((s, a) => s + (a ? a.n : 0), 0) : 0;
        return `<div class="zrow"><span class="zdot" style="background:${ownCol(0)};color:${ownCol(0)}"></span>${z.t === 'town' ? '🏰' : '🏯'} ${z.name} <span class="small">garrison ${gn}</span></div>`; }).join('') +
      `<div class="small">Paying mines: ${mineIncome} · other zones: ${rest}</div>` +
      G.ais.map(ai => { const tw = G.objs.filter(o => o.t === 'town' && o.owner === ai.id).length, fr = G.objs.filter(o => o.t === 'fort' && o.owner === ai.id).length;
        return `<div class="zrow" title="Rival: ${FACTIONS[ai.fac].name}"><span class="zdot" style="background:${ownCol(ai.id)};color:${ownCol(ai.id)}"></span>${allyOfPlayer(ai.id) ? '🤝 ' : ''}${FACTIONS[ai.fac].icon} ${ai.alive ? `${tw} towns, ${fr} forts, ${ai.heroes.length} heroes` : '<s>eliminated</s>'}</div>`; }).join('');
    const el = $('army'); el.innerHTML = '';
    h.army.forEach((a, i) => {
      const b = document.createElement('button');
      b.className = 'slot' + (a ? '' : ' empty') + (i === selSlot ? ' sel' : '');
      if (a) { const c = C[a.t]; b.innerHTML = `${Art.pic(a.t, 44)}<small>${a.n}${c.lv > 1 ? ' ' + '★'.repeat(c.lv - 1) : ''}</small>`; b.title = `${c.n} — ${Art.rarity(a.t).n}\nAtt ${c.a} Def ${c.d} Dmg ${c.lo}-${c.hi} HP ${c.hp} Spd ${c.s}${c.shoot ? '\nArcher' : ''}${c.fly ? '\nFlying' : ''}`; }
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
  function nextHero() {
    const n = G.heroes.length; if (n < 2) return toast('You have only one hero.');
    for (let k = 1; k <= n; k++) { const i = (G.sel + k) % n; if (!G.heroes[i].sleep || k === n) { setActive(i); G.path = null; centerOn(G.hero.x, G.hero.y); renderAll(); return; } }
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
    const qx = px - TS / 2, qy = py - HR, q = (Math.sqrt(3) / 3 * qx - qy / 3) / HR, rr = (2 / 3 * qy) / HR;
    let rx = Math.round(q), rz = Math.round(rr), ry = Math.round(-q - rr);
    const ddx = Math.abs(rx - q), ddz = Math.abs(rz - rr), ddy = Math.abs(ry + q + rr);
    if (ddx > ddz && ddx > ddy) rx = -ry - rz; else if (ddy > ddz) ry = -rx - rz; else rz = -rx - ry;
    const x = rx + ((rz - (rz & 1)) >> 1), y = rz;
    return x >= 0 && y >= 0 && x < G.W && y < G.H ? { x, y } : null;
  }
  function armyList(arr, vague) { return arr.filter(Boolean).map(a => vague ? `${groupLabel(a.n)} ${C[a.t].n}s` : `${a.n} ${C[a.t].n}`).join(', '); }
  function describe(x, y) {
    if (!isExpl(x, y)) return 'Unexplored territory';
    const seen = isVis(x, y);
    const ah = seen ? aiHeroAt(x, y) : null; if (ah) return `<b>${ah.name}</b> (${allyOfPlayer(ah.ai) ? 'allied' : 'rival'} ${FACTIONS[aiById(ah.ai).fac].name} hero, L${ah.lvl})<br>${armyList(ah.army, true)}`;
    const hs = heroesAt(x, y); if (hs.length) return hs.map(h => `<b>${h.name}</b> (${h.cls} L${h.lvl})${h.boat != null ? ' ⛵ sailing' : ''}`).join('<br>');
    if (G.boats.some(b => b.x === x && b.y === y)) return '<b>⛵ Your boat</b><br>Walk onto it from the shore to set sail.';
    let o = objAt(G, x, y);
    if (o && o.t === 'monster' && !seen) o = null;
    if (!o) { const tt = G.tiles[y][x], bm = G.biome && G.biome[y] ? G.biome[y][x] : 0, base = ['Grass', 'Forest (needs Forester)', 'Mountains (needs Mountaineer)', 'Water (needs a boat or Water Walk)', 'Road (half the movement cost)', 'Sand (slow)'][tt]; return bm && tt !== T.ROAD && tt !== T.WATER ? `${BIOME_NAME[bm]} — ${base.replace(/ (.*)/, '')} (slower: ×${BIOME_COST[bm]} movement)` : base; }
    const g = o.guard && o.guard.length ? `<br>Guarded by: ${armyList(o.guard, true)}` : '';
    switch (o.t) {
      case 'town': {
        const fn = FACTIONS[o.fac || G.faction].name, gn = (o.garrison || []).reduce((s, a) => s + (a ? a.n : 0), 0);
        return o.owner === 0 ? `<b>${o.name}</b> — your ${fn} town (garrison ${gn})`
          : allyOfPlayer(o.owner) ? `<b>${o.name}</b> — allied ${fn} town (it will never attack you)`
          : o.owner ? `<b>${o.name}</b> — rival ${fn} town${gn ? ' — garrison: ' + armyList(o.garrison, true) : ''}<br>Assaulting it is a siege battle.`
            : `<b>${o.name}</b> — neutral ${fn} town${g}<br>Capture it for a new castle (siege battle).`;
      }
      case 'merchant': return '<b>Wandering Merchant</b><br>Buy missing resources';
      case 'lair': return `<b>🐲 Dragon Lair</b>${o.owner === 0 ? ' — yours<br>' + LAIR.map(id => `${C[id].n}: ${o.avail[id] || 0}`).join(' · ') : '<br>Home of the Faerie, Rust, Crystal and Azure dragons — sold in no castle.<br>Defeat the horde to claim it.'}${g}`;
      case 'dwelling': { const c = C[dwId(o)]; return `<b>${c.i} ${c.n} dwelling</b> (${dwFac(o)}) — ${o.owner === 0 ? `yours, ${o.avail} available` : o.guard && o.guard.length ? 'unclaimed — fight the guards first' : 'unguarded — walk in to claim it'}${g}`; }
      case 'resobj': return `<b>${{ windmill: 'Windmill', waterwheel: 'Water Wheel', garden: 'Mystical Garden' }[o.kind]}</b><br>Yields resources once per week.`;
      case 'stone': return '<b>Learning Stone</b><br>Grants experience once per hero.';
      case 'shrine': return `<b>Shrine of ${SPELLS[o.spell].n}</b><br>Teaches a spell once per hero.`;
      case 'tower': return '<b>Observation Tower</b><br>Reveals a large area.';
      case 'bank': return `<b>${{ crypt: 'Crypt', utopia: 'Wyrm Hoard', stockpile: 'Rockhurler Stockpile' }[o.kind]}</b><br>Guarded treasure: ${armyList(o.guard, true)}`;
      case 'mono': return '<b>Monolith</b><br>Teleports to its twin.';
      case 'seer': return `<b>Seer's Hut</b><br>Wants ${o.amt} ${o.need} for an artifact.`;
      case 'spring': return `<b>${SPRING[o.kind].n}</b><br>${SPRING[o.kind].d}<br><span class="small">Once per week per hero.</span>`;
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
      case 'art': return `<b>${ART[o.art].n}</b> <span class="small">(${SLOT_NAMES[ART[o.art].slot === 'ring' ? 'ring1' : ART[o.art].slot]}, tier ${ART[o.art].tier})</span><br>${artStats(ART[o.art])}${ART[o.art].set ? '<br>Part of ' + ART_SETS[ART[o.art].set].n : ''}${g}`;
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
      const ah = isVis(hover.x, hover.y) ? aiHeroAt(hover.x, hover.y) : null, mine = heroesAt(hover.x, hover.y).length > 0;
      const hostile = (ah && !allyOfPlayer(ah.ai)) || (o && isExpl(hover.x, hover.y) && ((o.t === 'monster' && isVis(hover.x, hover.y)) || (o.guard && o.guard.some(Boolean) && o.owner !== 0 && !allyOfPlayer(o.owner)) || ((o.t === 'town' || o.t === 'fort') && o.owner !== 0 && !allyOfPlayer(o.owner))));
      const sailing = G.hero.boat != null || (tt === T.WATER && !blocked);
      cmap.style.cursor = !isExpl(hover.x, hover.y) ? Art.cursor('pointer') : mine ? Art.cursor('pointer') : hostile ? Art.cursor('sword') : blocked ? Art.cursor('no') : sailing ? Art.cursor('boat') : Art.cursor('horse');
    }
    const tip = $('tip');
    if (hover) {
      tip.innerHTML = describe(hover.x, hover.y) + threatLine(hover.x, hover.y);
      const r = $('stage').getBoundingClientRect();
      tip.classList.remove('hide');
      // keep the tooltip fully inside the visible part of the map: flip to the other side of the cursor near the right / bottom edges
      const visW = Math.min(r.width, window.innerWidth - r.left), visH = Math.min(r.height, window.innerHeight - r.top);
      const tw = tip.offsetWidth, th = tip.offsetHeight, cxp = ev.clientX - r.left, cyp = ev.clientY - r.top;
      let x = cxp + 14, y = cyp + 14;
      if (x + tw > visW - 4) x = cxp - tw - 14;
      if (y + th > visH - 4) y = cyp - th - 14;
      tip.style.left = Math.max(4, Math.min(x, visW - tw - 4)) + 'px'; tip.style.top = Math.max(4, Math.min(y, visH - th - 4)) + 'px';
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
  { let md = false;
    const jump = (ev) => { if (!G) return; const r = mini.getBoundingClientRect(), py = (ev.clientY - r.top) / r.height * mini.height / MV, px = (ev.clientX - r.left) / r.width * mini.width / MK - 0.5 * (Math.floor(py) & 1); centerOn(Math.max(0, Math.min(G.W - 1, px)), Math.max(0, Math.min(G.H - 1, py))); };
    mini.addEventListener('pointerdown', (ev) => { md = true; try { mini.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ } jump(ev); });
    mini.addEventListener('pointermove', (ev) => { if (md) jump(ev); });
    const up = () => { if (md) { md = false; if (!$('modal').classList.contains('hide') && !document.body.classList.contains('inbattle')) $('modal').classList.add('hide'); } };
    mini.addEventListener('pointerup', up); mini.addEventListener('pointercancel', () => { md = false; }); }
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
    else if (k === 'escape') openMenu();
    else if (k === 'k') openKingdom();
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
        if (bt) { h.boat = bt.id; Ach.event('sail'); toast(`${h.name} sets sail!`); }
      }
      h.dir = dirOf(h.x, h.y, s.x, s.y); h.x = s.x; h.y = s.y; (G.flags = G.flags || {}).moved = true; centerOn(h.x, h.y); renderAll(); sfx('step');
      await sleep(70);
      const last = i === path.length - 1, o = objAt(G, s.x, s.y);
      const eh = aiHeroAt(s.x, s.y);
      if (eh && allyOfPlayer(eh.ai)) { openExchange(`🤝 ${eh.name}`, `Allied hero of the ${FACTIONS[aiById(eh.ai).fac].name} realm — swap troops freely.`, h.army, h.name, eh.army, eh.name, null); break; }
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
    else { G.res.gold += o.gold; Ach.event('chest'); toast(`The chest holds ${o.gold} 🪙 gold!`); }
    G.objs.splice(G.objs.indexOf(o), 1); reindex(G);
  }
  // ---------- adventure objects: dwellings, resource sites, stones, shrines, towers, banks, monoliths, seers ----------
  const weekNow = () => Math.floor((G.day - 1) / 7);
  const dwId = (o) => o.cid || factionTiers(o.fac)[o.tier - 1];
  const dwGrowth = (o) => o.cid ? NEUTRAL_DW[o.cid] : GROWTH[o.tier - 1];
  const dwFac = (o) => o.fac ? FACTIONS[o.fac].name : 'Neutral';
  async function visitDwelling(o, h) {
    if (o.owner !== 0) {
      if (o.guard && o.guard.length && !(await fight(h, o.guard, { att: 0, def: 0 }, 'Dwelling guardians'))) return;
      o.owner = 0; o.guard = []; sfx('build'); toast(`You now own the ${C[dwId(o)].n} dwelling!`); renderAll();
    }
    openDwelling(o, h);
  }
  function openDwelling(o, h) {
    const id = dwId(o), c = C[id];
    $('mbox').innerHTML = `<h2>${c.i} ${c.n} dwelling</h2><div class="small">${dwFac(o)} · produces +${dwGrowth(o)} per week while you hold it. Recruits join ${h.name}.</div>
      <div class="trow"><div class="ic">${Art.pic(id, 38)}</div><div><b>${c.n}</b> <span class="small">Att ${c.a} Def ${c.d} Dmg ${c.lo}-${c.hi} HP ${c.hp} Spd ${c.s}</span><br><span class="small">Available: <b>${o.avail}</b> · ${fmtCost(c.cost)} each</span></div>
        <div class="acts"><input type="number" id="dwN" min="1" max="${o.avail}" value="${o.avail}"><button id="dwBuy">Recruit</button></div></div>
      <div class="mb"><button class="primary" id="dwClose">Close</button></div>`;
    $('dwClose').onclick = () => { $('modal').classList.add('hide'); renderAll(); };
    $('dwBuy').onclick = () => {
      let n = Math.min(parseInt($('dwN').value) || 0, o.avail);
      while (n > 0 && !canAfford(G.res, Object.fromEntries(Object.entries(c.cost).map(([k, v]) => [k, v * n])))) n--;
      if (n <= 0) return toast('Cannot recruit (resources or availability).');
      if (!addToArmy(h, id, n)) return toast('No free army slot.');
      pay(G.res, c.cost, n); o.avail -= n; toast(`Recruited ${n} ${c.n}${n > 1 ? 's' : ''}.`); sfx('build'); renderAll(); openDwelling(o, h);
    };
    $('modal').classList.remove('hide');
  }
  // Dragon Lair: beat the horde first (anyone must), then buy every kind of dragon each week
  async function visitLair(o, h) {
    if (o.owner !== 0) {
      if (o.guard && o.guard.length && !(await fight(h, o.guard, { att: 0, def: 0 }, 'Dragon Lair guardians'))) return;
      o.owner = 0; o.guard = []; Ach.event('lair'); sfx('build'); toast('The Dragon Lair is yours — dragons gather here every week!'); renderAll();
    }
    openLair(o, h);
  }
  function openLair(o, h) {
    const need = (c, n) => Object.fromEntries(Object.entries(c.cost).map(([k, v]) => [k, v * n]));
    const rows = LAIR.map(id => { const c = C[id], av = o.avail[id] || 0;
      return `<div class="trow"><div class="ic">${Art.pic(id, 40)}</div><div><b>${c.n}</b> <span class="small">${Art.rarity(id).n} · Att ${c.a} Def ${c.d} Dmg ${c.lo}-${c.hi} HP ${c.hp} Spd ${c.s} · Flying${c.ab.includes('breath') ? ' · Breath' : ''} · +${LAIR_GROWTH[id]}/week</span><br><span class="small">Available: <b>${av}</b> · ${fmtCost(c.cost)} each</span></div>
        <div class="acts"><input type="number" min="1" max="${av}" value="${av}" data-ln="${id}"><button data-lb="${id}"${av ? '' : ' disabled'}>Recruit</button></div></div>`; }).join('');
    $('mbox').innerHTML = `<h2>🐲 Dragon Lair</h2><div class="small">These dragons cannot be recruited in any castle. While you hold the lair, new dragons arrive every week — buy them here and they join ${h.name}.</div>${rows}
      <div class="mb"><button id="lrAll">Buy all I can afford</button><button class="primary" id="lrClose">Close</button></div>`;
    const buy = (id, want) => { const c = C[id]; let n = Math.min(want, o.avail[id] || 0); while (n > 0 && !canAfford(G.res, need(c, n))) n--; if (n <= 0) return 0; if (!addToArmy(h, id, n)) return -1; pay(G.res, c.cost, n); o.avail[id] -= n; Ach.event('lairBuy', { n, id }); return n; };
    $('lrClose').onclick = () => { $('modal').classList.add('hide'); renderAll(); };
    $('mbox').querySelectorAll('[data-lb]').forEach(b => b.onclick = () => {
      const id = b.dataset.lb, r = buy(id, parseInt($('mbox').querySelector('[data-ln="' + id + '"]').value) || 0);
      if (r === -1) return toast('No free army slot.'); if (r === 0) return toast('Cannot recruit (resources or availability).');
      toast('Recruited ' + r + ' ' + C[id].n + (r > 1 ? 's' : '') + '.'); sfx('build'); renderAll(); openLair(o, h);
    });
    $('lrAll').onclick = () => { let got = []; for (const id of [...LAIR].reverse()) { const r = buy(id, o.avail[id] || 0); if (r > 0) got.push(r + ' ' + C[id].n); } if (!got.length) return toast('Nothing affordable (or no free army slot).'); toast('Recruited ' + got.join(', ') + '.'); sfx('build'); renderAll(); openLair(o, h); };
    $('modal').classList.remove('hide');
  }
  function visitResObj(o, h) {
    const NAMES = { windmill: '🌬️ Windmill', waterwheel: '🎡 Water Wheel', garden: '🌻 Mystical Garden' };
    if (o.week === weekNow()) return showModal(`<h2>${NAMES[o.kind]}</h2><p>Nothing more to collect until next week.</p>`);
    o.week = weekNow(); let txt;
    if (o.kind === 'waterwheel') { G.res.gold += 1000; txt = `+1000 ${RES_ICON.gold}`; }
    else if (o.kind === 'garden') { if (Math.random() < 0.5) { G.res.gems += 5; txt = `+5 ${RES_ICON.gems}`; } else { G.res.gold += 500; txt = `+500 ${RES_ICON.gold}`; } }
    else { const k = ['wood', 'ore', 'mercury', 'sulfur', 'crystal', 'gems'][Math.floor(Math.random() * 6)], n = 2 + Math.floor(Math.random() * 4); G.res[k] += n; txt = `+${n} ${RES_ICON[k]} ${k}`; }
    sfx('coin'); renderAll();
    return showModal(`<h2>${NAMES[o.kind]}</h2><p>${h.name} collects this week's yield: <b>${txt}</b>. Visit again next week!</p>`);
  }
  async function visitStone(o, h) {
    if (o.used[h.id]) return showModal(`<h2>📚 Learning Stone</h2><p>${h.name} has already studied here.</p>`);
    o.used[h.id] = true; const xp = 400 + 150 * h.lvl;
    await showModal(`<h2>📚 Learning Stone</h2><p>${h.name} studies the ancient runes and gains <b>${xp}</b> experience.</p>`);
    await gainXp(h, Math.round(xp / (1 + 0.1 * perk(h, 'learning')))); renderAll();
  }
  function visitShrine(o, h) {
    const sp = SPELLS[o.spell];
    if (o.used[h.id]) return showModal(`<h2>⛩️ Shrine of ${sp.n}</h2><p>${h.name} has already prayed here.</p>`);
    if (G.spells.includes(o.spell)) return showModal(`<h2>⛩️ Shrine of ${sp.n}</h2><p>Your spellbook already holds ${sp.i} ${sp.n}.</p>`);
    if (sp.cost > maxMana(h)) return showModal(`<h2>⛩️ Shrine of ${sp.n}</h2><p>The spell is too complex for ${h.name} (needs ${sp.cost} maximum mana).</p>`);
    o.used[h.id] = true; learn([o.spell]); sfx('level'); renderAll();
    return showModal(`<h2>⛩️ Shrine of ${sp.n}</h2><p>${h.name} learns <b>${sp.i} ${sp.n}</b>: ${sp.desc}.</p>`);
  }
  function visitTower(o, h) {
    if (o.used) return showModal('<h2>🔭 Observation Tower</h2><p>The surroundings are already mapped.</p>');
    o.used = true; markView(o.x, o.y, 16, false); renderAll();
    return showModal('<h2>🔭 Observation Tower</h2><p>From the top you survey the land: a large area of the map is revealed.</p>');
  }
  async function visitBank(o, h) {
    const NAMES = { crypt: '⚰️ Crypt', utopia: '🐲 Wyrm Hoard', stockpile: '🏚️ Rockhurler Stockpile' };
    if (!(await fight(h, o.guard, { att: 0, def: 0 }, NAMES[o.kind].slice(3)))) return;
    let txt = `${RES_ICON.gold}${o.gold}`; G.res.gold += o.gold;
    if (o.kind === 'stockpile') { for (const k of ['wood', 'ore', 'mercury', 'sulfur', 'crystal', 'gems']) G.res[k] += 4; txt += ' and 4 of every other resource'; }
    let extra = '';
    if (o.art) { const a = ART[o.art], got = giveArt(h, o.art); extra = `<p>${a.i} <b>${a.n}</b> (${artStats(a)}) — ${got === 'equipped' ? 'equipped' : got === 'pack' ? 'in the backpack' : 'left behind, backpack full'}.</p>`; }
    G.objs.splice(G.objs.indexOf(o), 1); reindex(G); sfx('coin'); renderAll();
    return showModal(`<h2>${NAMES[o.kind]} plundered</h2><p>${h.name} claims <b>${txt}</b>.</p>${extra}`);
  }
  function visitMono(o, h) {
    const other = G.objs.find(x => x.t === 'mono' && x.id === o.id && x !== o);
    if (!other) return toast('The monolith is silent.');
    h.x = other.x; h.y = other.y; h.boat = null; G.path = null; h.move = Math.max(0, h.move - 100); sfx('level'); centerOn(h.x, h.y); renderAll();
    return toast(`${h.name} steps through the monolith and emerges far away!`);
  }
  async function visitSeer(o, h) {
    const a = ART[o.art], have = G.res[o.need] >= o.amt;
    const i = await showModal(`<h2>🏚️ Seer's Hut</h2><p>"Bring me <b>${o.amt} ${RES_ICON[o.need]} ${o.need}</b> and I will give you ${a.i} <b>${a.n}</b> (${artStats(a)})."</p><p class="small">You have ${G.res[o.need]}.</p>`, have ? ['Accept the deal', 'Not now'] : ['Not now']);
    if (!have || i !== 0) return;
    const got = giveArt(h, o.art); if (got === 'full') return toast('Your backpack is full.');
    G.res[o.need] -= o.amt; G.objs.splice(G.objs.indexOf(o), 1); reindex(G); sfx('build'); renderAll();
    toast(`${a.n} acquired!`);
  }
  const SPRING = {
    mana: { n: '⛲ Magic Spring', d: 'Restores all mana and adds 50% more.' },
    oasis: { n: '🌴 Oasis', d: '+800 movement now and +1 Morale in the next battle.' },
    fortune: { n: '🍀 Fountain of Fortune', d: '+1 Luck in the next battle (+2 for a hero with Fortune).' },
  };
  function drinkSpring(o, h) {
    const week = Math.floor((G.day - 1) / 7);
    if (o.used[h.id] === week) return showModal(`<h2>${SPRING[o.kind].n}</h2><p>${h.name} has already drunk here this week.</p>`);
    o.used[h.id] = week; h.buff = h.buff || { morale: 0, luck: 0 };
    if (o.kind === 'mana') h.mana = Math.round(maxMana(h) * 1.5);
    else if (o.kind === 'oasis') { h.move += 800; h.buff.morale = 1; }
    else h.buff.luck = 1 + (perk(h, 'fortune') ? 1 : 0);
    sfx('level'); renderAll();
    return showModal(`<h2>${SPRING[o.kind].n}</h2><p>${h.name} refreshes at the water. ${SPRING[o.kind].d}</p>`);
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
    if (o.owner !== null && o.owner !== undefined && o.owner !== 0 && allyOfPlayer(o.owner)) return toast(`${o.name || 'This place'} belongs to your ally — you are welcome to pass, but it is not yours to take.`);
    if (o.t === 'wreck') {
      if (o.guard && o.guard.length) { if (!(await fight(h, o.guard, { att: 0, def: 0 }, 'Shipwreck guardians'))) return; o.guard = []; }
      const n = 3 + Math.floor(Math.random() * 4);
      G.res.gold += o.gold; G.res[o.res] += n; G.objs.splice(G.objs.indexOf(o), 1); reindex(G); renderAll();
      return showModal(`<h2>🚢 Shipwreck salvaged</h2><p>${h.name}'s crew recovers ${RES_ICON.gold}${o.gold} and ${RES_ICON[o.res]}${n} from the wreck.</p>`);
    }
    if (o.t === 'spring') return drinkSpring(o, h);
    if (o.t === 'dwelling') return visitDwelling(o, h);
    if (o.t === 'lair') return visitLair(o, h);
    if (o.t === 'resobj') return visitResObj(o, h);
    if (o.t === 'stone') return visitStone(o, h);
    if (o.t === 'shrine') return visitShrine(o, h);
    if (o.t === 'tower') return visitTower(o, h);
    if (o.t === 'bank') return visitBank(o, h);
    if (o.t === 'mono') return visitMono(o, h);
    if (o.t === 'seer') return visitSeer(o, h);
    if (o.t === 'merchant') return openMarket(MERCHANT_RATE + ((G.wk && G.wk.rateBonus) || 0), 'Wandering Merchant', false);
    if (o.t === 'town') {
      if (o.owner === 0) { for (const x of heroesAt(o.x, o.y)) x.mana = maxMana(x); return openTown(o); }
      return conquerTown(h, o, eh);
    }
    if (o.t === 'fort') {
      if (o.owner === 0) return openFort(o, h);
      const army = defendersOf(o, eh);
      if (army.length && !(await fight(h, army, { att: eh ? eff(eh, 'att') : o.owner ? 4 : 0, def: eh ? eff(eh, 'def') : o.owner ? 4 : 0 }, `Siege of ${o.name}`, siegeOf(o, 1), eh))) { if (eh) shrinkArmy(eh.army, 0.5); return; }
      if (eh) removeAiHero(eh);
      o.owner = 0; o.guard = []; o.garrison = emptyArmy();
      renderAll();
      await showModal(`<h2>🏯 ${o.name} captured!</h2><p>The zone is yours: +${FORT_INCOME} 🪙/day, mine income in the zone, and +${MILITIA} militia per week. Station troops here to defend it from the enemy hero.</p>`);
      return openFort(o, h);
    }
    if (o.t === 'mine') {
      if (o.owner === 0) return toast('This mine is already yours.');
      if (o.guard && o.guard.length) { if (!(await fight(h, o.guard, { att: 0, def: 0 }, 'Mine guardians'))) return; o.guard = []; }
      o.owner = 0; Ach.event('mine', { count: G.objs.filter(x => x.t === 'mine' && x.owner === 0).length }); return toast(`You now own the ${o.kind} mine!`);
    }
    if (o.t === 'art') {
      if (o.guard && o.guard.length) { if (!(await fight(h, o.guard, { att: 0, def: 0 }, 'Artifact guardians'))) return; o.guard = []; }
      const a = ART[o.art], got = giveArt(h, o.art);
      if (got === 'full') return toast('Your backpack is full — drop something first.');
      G.objs.splice(G.objs.indexOf(o), 1); reindex(G); renderAll();
      return showModal(`<h2>${a.i} ${a.n}</h2><p>${h.name} found a tier ${a.tier} artifact: <b>${artStats(a)}</b>.${a.set ? ' Part of the <b>' + ART_SETS[a.set].n + '</b> set.' : ''}</p><p class="small">${got === 'equipped' ? 'It was equipped automatically.' : 'Placed in the backpack (the slot is taken).'}</p>`);
    }
    if (o.t === 'monster') {
      const ratio = armyValue(h.army) / Math.max(1, armyValue(o.guard)), cr = perk(h, 'charisma');
      const canFlee = ratio >= FLEE_RATIO, canJoin = cr > 0 && ratio >= FLEE_RATIO - 0.5 * cr - 0.5;
      if (canFlee || canJoin) {
        const opts = ['⚔ Fight'], acts = ['fight'];
        if (canJoin) { opts.push('🤝 Recruit them'); acts.push('join'); }
        if (canFlee) { opts.push('🕊 Let them go'); acts.push('go'); }
        const tribute = Math.max(50, Math.round(armyValue(o.guard) * 0.08 / 10) * 10);
        if (canFlee) { opts.push(`💰 Demand ${tribute} gold`); acts.push('tribute'); }
        const names = armyList(o.guard, true);
        const pct = Math.round((0.5 + 0.25 * (cr - 1)) * 100);
        const i = await showModal(`<h2>😨 They tremble before you</h2><p>${names} cower before ${h.name}'s army (${ratio.toFixed(1)}× stronger).</p>
          <p class="small">${canJoin ? `Your Charisma lets ${pct}% of them join your army.` : 'You may spare them — no fight, no experience.'}${cr ? '' : ' (The Charisma perk would let them join you.)'}</p>`, opts);
        const act = acts[i];
        if (act === 'go') { Ach.event('spare'); G.objs.splice(G.objs.indexOf(o), 1); reindex(G); return toast('The monsters scatter and flee.'); }
        if (act === 'tribute') { Ach.event('tribute'); G.res.gold += tribute; G.objs.splice(G.objs.indexOf(o), 1); reindex(G); sfx('coin'); renderAll(); return toast(`The monsters hand over ${tribute} gold and scatter.`); }
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
    const cmd = hero ? { name: hero.name, icon: hero.icon, pid: hero.pid, real: hero, att: eff(hero, 'att'), def: eff(hero, 'def') } : { name: 'Garrison commander', icon: '🏰', att: 4, def: 4 };
    if (defenders.length && !(await fight(h, defenders, { att: cmd.att, def: cmd.def }, `Siege of ${o.name}`, siegeOf(o, 1), cmd))) { if (!fightCancelled && hero) shrinkArmy(hero.army, 0.5); return; }
    if (hero) removeAiHero(hero);
    takeTown(o, 0);
    await showModal(`<h2>🏰 ${o.name} captured!</h2><p>A new ${FACTIONS[o.fac].name} town joins your realm. Recruit its creatures, build up its Town Hall, and garrison it against the rivals.</p>`);
    if (!checkVictory()) openTown(o);
  }
  function takeTown(o, newOwner) {
    o.owner = newOwner; o.guard = []; o.garrison = emptyArmy(); o.avail = {};
    for (let i = 1; i <= 7; i++) if (o.b[i]) o.avail[i] = GROWTH[i - 1];
    if (newOwner === 0) { G.noTown = 0; Ach.event('town', { count: G.objs.filter(x => x.t === 'town' && x.owner === 0).length }); }
    reindex(G); renderAll();
  }
  // victory: every rival has lost all of its towns
  function checkVictory() {
    for (const ai of G.ais) if (ai.alive && !G.objs.some(o => o.t === 'town' && o.owner === ai.id)) { ai.alive = false; ai.heroes = []; Ach.event('elim'); toast(`${FACTIONS[ai.fac].name} rival is eliminated!`); note(`💥 The ${FACTIONS[ai.fac].name} rival is eliminated!`); }
    if (!G.over && G.ais.every(a => !a.alive || allyOfPlayer(a.id))) { endGame(true); return true; }
    return false;
  }
  // ---------- spoils: gold and resources dropped by defeated armies, and the artifacts a defeated hero was carrying ----------
  const RES_DROP = ['wood', 'ore', 'mercury', 'sulfur', 'crystal', 'gems'];
  function collectSpoils(h, guard, foeHero, withLoot = true) {
    const sp = { gold: 0, res: {}, arts: [], lost: [] };
    if (withLoot) {
      const val = guard.filter(Boolean).reduce((s, a) => s + (C[a.t].v || 0) * a.n, 0);
      sp.gold = Math.round(val * (0.1 + Math.random() * 0.15) * (foeHero ? 0.8 : 1) / 10) * 10;
      if (Math.random() < (foeHero ? 0.5 : 0.35)) { const k = RES_DROP[Math.floor(Math.random() * RES_DROP.length)]; sp.res[k] = Math.max(1, Math.min(14, Math.round(2 + val / 1500 * (1 + Math.random())))); }
    }
    if (foeHero) {
      const items = [...Object.values(foeHero.arts || {}).filter(Boolean), ...(foeHero.pack || [])];
      foeHero.arts = {}; foeHero.pack = []; foeHero.av = (foeHero.av || 0) + 1;
      for (const id of items) (giveArt(h, id) === 'full' ? sp.lost : sp.arts).push(id);
    }
    if (sp.gold) G.res.gold += sp.gold;
    for (const k in sp.res) G.res[k] += sp.res[k];
    return (sp.gold || sp.arts.length || sp.lost.length || Object.keys(sp.res).length) ? sp : null;
  }
  async function spoilsModal(sp, who) {
    const lines = [];
    if (sp.gold) lines.push(`${RES_ICON.gold} <b>${sp.gold}</b> gold`);
    for (const k in sp.res) lines.push(`${RES_ICON[k]} <b>${sp.res[k]}</b> ${k}`);
    for (const id of sp.arts) lines.push(`${ART[id].i} <b>${ART[id].n}</b> <span class="small">(${artStats(ART[id])})</span>`);
    for (const id of sp.lost) lines.push(`<span class="small">${ART[id].i} ${ART[id].n} — backpack full, left behind</span>`);
    sfx('coin'); if (typeof Celebrate !== 'undefined') Celebrate.loot();
    await showModal(`<h2>💰 Spoils of war</h2><p>${who} searches the battlefield and claims:</p><div style="line-height:1.8">${lines.join('<br>')}</div>${sp.arts.length ? '<p class="small">Captured artifacts were added to the hero (equipped if a slot was free, otherwise in the backpack).</p>' : ''}`, ['Collect']);
  }
  // ground type under the fighting hero, used to pick the battle backdrop
  const battleTerrainAt = (x, y, boat) => { if (boat) return 'water'; const t = G.tiles && G.tiles[y] && G.tiles[y][x]; if (t === T.WATER) return 'water'; const b = G.biome && G.biome[y] && G.biome[y][x]; return ['grass', 'desert', 'snow', 'swamp', 'lava'][b || 0] === 'grass' && t === T.SAND ? 'desert' : ['grass', 'desert', 'snow', 'swamp', 'lava'][b || 0]; };
  const battleTerrain = (h) => battleTerrainAt(h.x, h.y, h.boat != null);
  let fightFromAi = false, fightCancelled = false;
  async function fight(h, guard, eStats, title, siege, eHero) {
    fightCancelled = false;
    if (!armyCount(h)) { toast(`${h.name} has no army! Recruit in town first.`); return false; }
    if (!fightFromAi && Settings.confirmDanger && h === G.hero) {
      const th = threatOfDef(guard);
      if (th && th.ratio < 0.45) {
        const i = await showModal(`<h2>⚠ This looks deadly</h2><p><b>${armyList(guard.filter(Boolean), true)}</b> are far stronger than your army (<b>${th.ratio.toFixed(2)}×</b>). You would most likely lose everything.</p><p class="small">Recruit more troops, level up, or find a weaker target first.</p>`, ['↩ Not now', '⚔ Attack anyway']);
        if (i !== 1) { fightCancelled = true; return false; }
      }
    }
    const before0 = armyCount(h), th0 = threatOfDef(guard), slain0 = guard.filter(Boolean).reduce((p, a) => p + a.n, 0);
    const res = await Battle.run({ hero: { att: eff(h, 'att'), def: eff(h, 'def'), sp: eff(h, 'sp'), mana: h.mana, spells: G.spells, perks: perksOf(h), name: h.name, icon: h.icon, pid: h.pid, morale: heroMorale(h), luck: heroLuck(h) },
      army: h.army, enemy: guard.filter(Boolean).map(a => ({ ...a })), eStats, eHero, title, siege, terrain: battleTerrain(h), canRetreat: true });
    h.mana = res.mana; h.buff = null;
    if (res.win) {
      res.survivors.forEach((n, i) => { if (h.army[i]) { if (n > 0) h.army[i].n = n; else h.army[i] = null; } });
      if (!h.ai) { gst('slain', slain0); gst('battles', 1); }
      if (!h.ai) Ach.event('fightWon', { slain: slain0, ratio: th0 ? th0.ratio : undefined, lossPct: before0 ? (before0 - armyCount(h)) / before0 : 0, hero: !!(eHero && (eHero.real || eHero.arts)) });
      const nec = perk(h, 'necromancy');
      if (nec && res.xp > 0) {
        const raised = Math.floor(res.xp * 0.1 * nec / 6);
        if (raised > 0 && addToArmy(h, 'necropolis1', raised)) toast(`💀 ${h.name} raises ${raised} bonewalkers from the fallen (Necromancy ${RANK_NAMES[nec]}).`);
      }
      await gainXp(h, res.xp);
      const foe = eHero && (eHero.real || (eHero.arts || eHero.pack ? eHero : null));
      if (!siege || foe) { const sp = collectSpoils(h, guard, foe, !siege || !!foe); if (sp) { renderAll(); await spoilsModal(sp, h.name); } }
    } else {
      const tw = nearestTown(h.x, h.y), foe = armyList(guard.filter(Boolean), true);
      retreat(h); renderAll();
      await showModal(res.fled
        ? `<h2>🏳️ Retreat</h2><p><b>${h.name}</b> ordered a retreat from <b>${title || 'the battle'}</b> and the scattered army is gone.</p><p>${tw ? h.name + ' rides back to <b>' + tw.name + '</b> alone.' : 'There is no town to return to!'}</p><p class="small">Enemy: ${foe}. Recruit fresh troops, gather artifacts and spells, and come back stronger — hovering a monster tells you how big its stack is.</p>`
        : `<h2>💀 Defeat!</h2><p><b>${h.name}</b>'s army was wiped out in <b>${title || 'battle'}</b>.</p><p>${tw ? 'The hero limps back to <b>' + tw.name + '</b> with no troops.' : 'There is no town to return to!'}</p><p class="small">Enemy: ${foe}. Their numbers are unchanged — recruit more units, level up your hero, or use mines, walls and spells next time.</p>`, ['Continue']);
    }
    renderAll();
    return res.win;
  }
  // two skills are offered (weighted by hero class); a hero knows at most MAX_SKILLS different skills
  function skillChoices(h) {
    const known = Object.keys(h.perks).filter(k => rawPerk(h, k) > 0).length;
    const pool = Object.keys(PERKS).filter(k => rawPerk(h, k) < MAX_PERK && perk(h, k) < MAX_PERK && (!PERKS[k].minLvl || h.lvl >= PERKS[k].minLvl) && (known < MAX_SKILLS || rawPerk(h, k) > 0));
    const out = [];
    while (out.length < 2 && pool.length) {
      const tot = pool.reduce((s, k) => s + skillWeight(h.cls, k), 0); let r = Math.random() * tot, idx = 0;
      for (let i = 0; i < pool.length; i++) { r -= skillWeight(h.cls, pool[i]); if (r <= 0) { idx = i; break; } }
      out.push(pool.splice(idx, 1)[0]);
    }
    return out;
  }
  async function gainXp(h, xp) {
    h.xp += Math.round(xp * (1 + 0.1 * perk(h, 'learning')));
    while (h.xp >= need(h.lvl)) {
      h.xp -= need(h.lvl); h.lvl++; sfx('level'); if (!h.ai) Ach.event('level', { lvl: h.lvl });
      const r = Math.random(), st = r < .3 ? 'att' : r < .6 ? 'def' : r < .8 ? 'sp' : 'kn';
      h[st]++;
      const statName = { att: 'Attack', def: 'Defense', sp: 'Spell Power', kn: 'Knowledge' }[st];
      const opts = skillChoices(h);
      const head = `<h2>⭐ ${h.name} reaches level ${h.lvl}!</h2><p>+1 ${statName}</p>`;
      if (!opts.length) { await showModal(head); continue; }
      const rankOf = (k) => rawPerk(h, k) + 1;
      const i = await showModal(`${head}<p>Choose a skill (${Object.keys(h.perks).filter(k => rawPerk(h, k) > 0).length}/${MAX_SKILLS} known):</p><div class="small">${opts.map(k => `${PERKS[k].i} <b>${PERKS[k].n}</b> → ${RANK_NAMES[rankOf(k)]} — ${PERKS[k].d}`).join('<br>')}</div>`, opts.map(k => `${PERKS[k].i} ${PERKS[k].n} (${RANK_NAMES[rankOf(k)]})`));
      h.perks[opts[i]] = rankOf(opts[i]);
    }
  }
  // a player hero fights a rival hero (open field, or a siege when the rival attacks a town/fort the hero stands in)
  // before two heroes fight: a hopelessly outmatched rival offers gold to be let go (and withdraws to its nearest castle),
  // and when YOU are hopelessly outmatched you may pay the aggressor to leave you be (your army withdraws to your nearest castle)
  async function negotiate(h, e) {
    const ai = aiById(e.ai); if (!ai) return false;
    const pv = armyValue(h.army), ev = armyValue(e.army); if (!pv || !ev) return false;
    const ratio = Math.max(pv / ev, ev / pv);
    const homes = G.objs.filter(o => o.t === 'town' && o.owner === ai.id).sort((a, b) => hexDist(a, e) - hexDist(b, e)), home = homes[0], mine = nearestTown(h.x, h.y);
    if (pv >= ev * 2.5 && home && ai.gold >= 150) {
      const gold = Math.min(Math.round((ev * 0.2 + 300) / 10) * 10, Math.floor(ai.gold));
      const i = await showModal(`<h2>🏳️ ${e.name} offers to surrender</h2><p>The ${FACTIONS[ai.fac].name} hero cannot stand against ${h.name}'s army (<b>${ratio.toFixed(1)}×</b> stronger) and offers <b>${RES_ICON.gold}${gold}</b> to be let go. If you agree, ${e.name} and the army withdraw to <b>${home.name}</b>.</p><p class="small">Fighting on gives experience, the hero's artifacts and the spoils of war — but costs you troops.</p>`, ['⚔ Fight on', `💰 Accept ${gold} gold`]);
      if (i !== 1) return false;
      Ach.event('tribute'); ai.gold -= gold; G.res.gold += gold; e.x = home.x; e.y = home.y; e.move = 0; sfx('coin'); if (typeof Celebrate !== 'undefined') Celebrate.loot(); renderAll();
      toast(`${e.name} pays ${gold} gold and withdraws to ${home.name}.`); return true;
    }
    if (ev >= pv * 2.5 && mine && !heroAtTown(h)) {
      const price = Math.round(Math.min(ev * 0.1 + 200, Math.max(300, G.res.gold * 0.5)) / 10) * 10;
      if (G.res.gold < price) { toast(`You are outmatched (${ratio.toFixed(1)}×) — a ransom of ${price} gold would buy your retreat, but you cannot afford it.`); return false; }
      const i = await showModal(`<h2>😰 Outmatched by ${e.name}</h2><p>The ${FACTIONS[ai.fac].name} army is <b>${ratio.toFixed(1)}×</b> stronger than yours. You may offer <b>${RES_ICON.gold}${price}</b> to be let alone: ${h.name} and the army then retreat to <b>${mine.name}</b> unharmed.</p><p class="small">Refusing means a battle you are very likely to lose.</p>`, ['💰 Pay ' + price + ' gold', '⚔ Fight anyway']);
      if (i !== 0) return false;
      Ach.event('ransom'); G.res.gold -= price; ai.gold += price; h.x = mine.x; h.y = mine.y; h.boat = null; h.move = 0; G.path = null; if (h === G.hero) centerOn(h.x, h.y); renderAll();
      toast(`${h.name} pays ${price} gold and retreats to ${mine.name}.`); return true;
    }
    return false;
  }
  async function fightAiHero(h, e, playerAttacks) {
    const atTown = heroAtTown(h), fo = objAt(G, h.x, h.y), atFort = fo && fo.t === 'fort' && fo.owner === 0;
    if (!armyCount(h)) { retreat(h); return false; }
    const siege = !playerAttacks && (atTown || atFort) ? siegeOf(townAt(h.x, h.y) || fo, 0) : null;
    if (!siege && await negotiate(h, e)) return false;
    fightFromAi = !playerAttacks;
    let win; try { win = await fight(h, e.army, { att: eff(e, 'att'), def: eff(e, 'def') }, `${e.name}'s army`, siege, e); } finally { fightFromAi = false; }
    if (fightCancelled) return false;
    if (win) { removeAiHero(e); toast(`${e.name} is defeated!`); return true; }
    shrinkArmy(e.army, 0.5);
    return false;
  }
  function removeAiHero(e) { const ai = aiById(e.ai); if (ai) { ai.heroes = ai.heroes.filter(x => x !== e); ai.spawnWait = 3; } }

  // ---------- generic army exchange ----------
  function openExchange(title, note, A, nameA, B, nameB, back, extra) {
    let sel = null, amt = 0;
    const arr = (r) => r === 'a' ? A : B;
    const render = () => {
      const row = (a, rk) => a.map((s, i) => `<button class="slot${s ? '' : ' empty'}${sel && sel.r === rk && sel.i === i ? ' sel' : ''}" data-r="${rk}" data-i="${i}">${s ? `${Art.pic(s.t, 40)}<small>${s.n}</small>` : ''}</button>`).join('');
      $('mbox').innerHTML = `<h2>${title}</h2><div class="small">${note}</div>${extra ? extra.html : ''}
        <h4>${nameA}</h4><div class="armyrow">${row(A, 'a')}</div><h4>${nameB}</h4><div class="armyrow">${row(B, 'b')}</div>
        ${sel ? (() => { const st = arr(sel.r)[sel.i]; return `<div class="small" style="margin-top:6px">Selected: <b>${C[st.t].n}</b> (${st.n}). Move <input type="number" id="xAmt" min="1" max="${st.n}" value="${Math.min(amt || st.n, st.n)}" style="width:72px"> <button id="xOne">1</button> <button id="xHalf">½</button> <button id="xAll">All</button> — then click an empty slot (or the same creature) to split, or any slot to swap/merge all.</div>`; })() : '<div class="small">Click a stack, choose how many to move, then click a slot: move / split / merge / swap.</div>'}
        <div class="mb"><button class="primary" id="xClose">${back ? 'Back' : 'Close'}</button></div>`;
      $('xClose').onclick = () => { if (back) back(); else { $('modal').classList.add('hide'); renderAll(); } };
      if (extra) extra.bind();
      if (sel && $('xAmt')) {
        const inp = $('xAmt'), mx = arr(sel.r)[sel.i].n, setA = (v) => { amt = Math.max(1, Math.min(mx, v)); inp.value = amt; };
        inp.oninput = () => { amt = Math.max(1, Math.min(mx, parseInt(inp.value) || 1)); };
        $('xOne').onclick = () => setA(1); $('xHalf').onclick = () => setA(Math.max(1, Math.floor(mx / 2))); $('xAll').onclick = () => setA(mx);
      }
      $('mbox').querySelectorAll('.slot').forEach(b => b.onclick = () => {
        if (dragged) return;
        const r = b.dataset.r, i = +b.dataset.i;
        if (!sel) { if (arr(r)[i]) { sel = { r, i }; amt = arr(r)[i].n; } }
        else {
          if (!(sel.r === r && sel.i === i)) {
            const X = arr(sel.r), Y = arr(r), src = X[sel.i], n = Math.max(1, Math.min(src.n, amt || src.n));
            if (n < src.n) {
              if (!Y[i]) { Y[i] = { t: src.t, n }; src.n -= n; }
              else if (Y[i].t === src.t) { Y[i].n += n; src.n -= n; }
              else toast('To split a stack, pick an empty slot or a stack of the same creature.');
            }
            else if (src && Y[i] && src.t === Y[i].t) { Y[i].n += src.n; X[sel.i] = null; }
            else { const tmp = X[sel.i]; X[sel.i] = Y[i]; Y[i] = tmp; }
          }
          sel = null;
        }
        render();
      });
      // drag & drop (finger or mouse): pick a stack up and drop it on any slot — empty = move, same creature = merge, other = swap
      let drag = null, ghost = null;
      $('mbox').ondragstart = (e) => e.preventDefault();
      const slotAt = (x, y) => { const el = document.elementFromPoint(x, y), s = el && el.closest ? el.closest('.slot') : null; return s && s.dataset.r ? s : null; };
      const clearDrop = () => $('mbox').querySelectorAll('.slot.drop').forEach(e => e.classList.remove('drop'));
      $('mbox').querySelectorAll('.slot').forEach(b => {
        b.onpointerdown = (e) => {
          const r = b.dataset.r, i = +b.dataset.i; if (!arr(r)[i]) return;
          drag = { r, i, x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
          try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        };
        b.onpointermove = (e) => {
          if (!drag || drag.id !== e.pointerId) return;
          if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 9) {
            drag.moved = true; ghost = document.createElement('div'); ghost.className = 'dragghost'; ghost.innerHTML = b.innerHTML; document.body.appendChild(ghost); b.classList.add('lifted');
          }
          if (drag.moved) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; clearDrop(); const t = slotAt(e.clientX, e.clientY); if (t) t.classList.add('drop'); }
        };
        const finish = (e, cancel) => {
          if (!drag || drag.id !== e.pointerId) return;
          const d = drag; drag = null; if (ghost) { ghost.remove(); ghost = null; } clearDrop(); b.classList.remove('lifted');
          if (!d.moved) return;
          dragged = true; setTimeout(() => { dragged = false; }, 60);
          const t = cancel ? null : slotAt(e.clientX, e.clientY); if (!t) return;
          const tr = t.dataset.r, ti = +t.dataset.i; if (tr === d.r && ti === d.i) return;
          const X = arr(d.r), Y = arr(tr), src = X[d.i]; if (!src) return;
          const n = sel && sel.r === d.r && sel.i === d.i ? Math.max(1, Math.min(src.n, amt || src.n)) : src.n;
          if (n < src.n) {
            if (!Y[ti]) { Y[ti] = { t: src.t, n }; src.n -= n; }
            else if (Y[ti].t === src.t) { Y[ti].n += n; src.n -= n; }
            else { toast('To split a stack, drop it on an empty slot or the same creature.'); return; }
          } else if (Y[ti] && Y[ti].t === src.t) { Y[ti].n += src.n; X[d.i] = null; }
          else { const tmp = X[d.i]; X[d.i] = Y[ti]; Y[ti] = tmp; }
          sel = null; sfx('click'); render();
        };
        b.onpointerup = (e) => finish(e, false); b.onpointercancel = (e) => finish(e, true);
      });
    };
    let dragged = false;
    render(); $('modal').classList.remove('hide');
  }

  // ---------- town ----------
  let townAnim = null, townLoop = false;
  const LV_COL = ['#7a6a50', '#8c7a58', '#9e8a60', '#b49c62', '#d4b252'];
  const SLOTS = 11;
  const TIER_HALL = [null, 0, 0, 1, 2, 3, 4, 5];
  const UP_HALL = { 2: 1, 3: 2, 4: 3, 5: 4 };
  let curTown = null, townTab = 'war';
  const defaultTown = () => townAt(G.hero.x, G.hero.y) || nearestTown(G.hero.x, G.hero.y);
  const tierType = (t, tier) => lineType(tiersOf(t)[tier - 1], (t.up && t.up[tier]) || 1);
  const starStr = (lv, max = MAX_LV) => '★'.repeat(lv) + '☆'.repeat(max - lv);
  function startTownAnim(kind, slot) { townAnim = { kind, slot, t0: performance.now() }; sfx(kind === 'upgrade' ? 'level' : 'build'); }
  function slotInfo(t, i) {
    if (i < 7) return { built: !!t.b[i + 1], lv: t.up[i + 1] || 1, max: MAX_LV, icon: C[tierType(t, i + 1)].i, id: tierType(t, i + 1) };
    if (i === 7) return { built: t.b.hall > 0, lv: t.b.hall, max: 5, icon: '🏛️', id: 'hall' };
    if (i === 8) return { built: t.b.guild > 0, lv: t.b.guild, max: 3, icon: '🔮' };
    if (i === 9) return { built: !!t.b.market, lv: t.b.market ? 1 : 0, max: 1, icon: '⚖️' };
    return { built: !!t.b.ship, lv: t.b.ship ? 1 : 0, max: 1, icon: '⚓' };
  }
  function drawTown() {
    const cv = $('tcv');
    if (!cv || $('modal').classList.contains('hide')) { townLoop = false; return; }
    const t = curTown; if (!t) return;
    const now = performance.now();
    if (townAnim && now - townAnim.t0 > 1600) townAnim = null;
    TownArt.scene(cv.getContext('2d'), t, now, townAnim, slotInfo, cv.width, cv.height);
    requestAnimationFrame(drawTown);
  }

  function openMarket(rate, title, back) {
    const st = openMarket.st || (openMarket.st = { get: 'wood', give: 'gold', qty: 1 });
    const opts = (sel) => RES.map(k => `<option value="${k}"${k === sel ? ' selected' : ''}>${Art.RES_EMOJI[k]} ${k}</option>`).join('');
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

  // ---------- outposts: every creature building you hold can be recruited from inside any of your towns ----------
  function outpostHtml(t) {
    const outs = G.objs.filter(o => (o.t === 'dwelling' || o.t === 'lair') && o.owner === 0);
    if (!outs.length) return '';
    let h = '<h4>🏕 Outposts — creatures from the buildings you hold</h4><div class="small">Dwellings and the Dragon Lair you have conquered deliver their weekly recruits to every castle: buy them here, no travelling needed.</div>';
    for (const o of outs) {
      const oi = G.objs.indexOf(o), ids = o.t === 'lair' ? LAIR : [dwId(o)];
      for (const id of ids) {
        const c = C[id], av = o.t === 'lair' ? (o.avail[id] || 0) : o.avail, gr = o.t === 'lair' ? LAIR_GROWTH[id] : dwGrowth(o);
        h += `<div class="trow"><div class="ic">${Art.pic(id, 38)}</div><div><b>${c.n}</b> <span class="small">${Art.rarity(id).n} · ${o.t === 'lair' ? 'Dragon Lair' : dwFac(o) + ' dwelling'} · +${gr}/week</span><br><span class="small">Available: <b>${av}</b> · ${fmtCost(c.cost)} each</span></div>
          <div class="acts"><input type="number" min="1" max="${av}" value="${av}"><button data-outbuy="${oi}:${id}"${av ? '' : ' disabled'}>Recruit</button></div></div>`;
      }
    }
    return h;
  }
  // ---------- caravans: move troops between your castles; the trip takes days depending on the distance ----------
  const caravanDays = (a, b) => Math.max(1, Math.ceil(hexDist(a, b) / 10));
  function caravanHtml(t, mt) {
    const cars = (G.caravans || []).filter(c => (c.fx === t.x && c.fy === t.y) || (c.tx === t.x && c.ty === t.y));
    if (mt.length < 2 && !cars.length) return '';
    const line = (c) => { const from = townAt(c.fx, c.fy), to = townAt(c.tx, c.ty); return `<div class="small">🚚 ${armyList(c.army, false)} — ${from ? from.name : 'a lost castle'} → ${to ? to.name : 'a lost castle'} · arrives in <b>${c.eta}</b> day${c.eta === 1 ? '' : 's'}</div>`; };
    return `<div class="trow"><div class="ic">🚚</div><div><b>Reinforcements</b><br><span class="small">Send troops from this castle's garrison to another of your castles. They travel for a few days depending on the distance.</span>${cars.map(line).join('')}</div>
      <div class="acts">${mt.length > 1 ? '<button data-caravan="1">Send troops…</button>' : ''}</div></div>`;
  }
  function openCaravan(t) {
    const others = myTowns().filter(x => x !== t);
    if (!others.length) return toast('You need a second castle.');
    const stacks = t.garrison.map((a, i) => a ? { a, i } : null).filter(Boolean);
    $('mbox').innerHTML = `<h2>🚚 Send troops from ${t.name}</h2><div class="small">Only the castle garrison can be sent (move units from a hero into the garrison first). The caravan cannot be stopped once it leaves.</div>
      <h4>Destination</h4><select id="cvDest">${others.map((x, i) => `<option value="${i}">${x.name} — ${caravanDays(t, x)} day${caravanDays(t, x) === 1 ? '' : 's'}</option>`).join('')}</select>
      <h4>Troops</h4>${stacks.length ? stacks.map(({ a, i }) => `<div class="trow"><div class="ic">${Art.pic(a.t, 38)}</div><div><b>${C[a.t].n}</b> <span class="small">in garrison: ${a.n}</span></div><div class="acts"><input type="number" min="0" max="${a.n}" value="${a.n}" data-cv="${i}"></div></div>`).join('') : '<p class="small">The garrison is empty.</p>'}
      <div class="mb"><button id="cvBack">Back</button><button class="primary" id="cvGo"${stacks.length ? '' : ' disabled'}>Send caravan</button></div>`;
    $('modal').classList.remove('hide');
    $('cvBack').onclick = () => openTown(t);
    $('cvGo').onclick = () => {
      const dest = others[+$('cvDest').value], army = [];
      $('mbox').querySelectorAll('[data-cv]').forEach(inp => { const i = +inp.dataset.cv, g = t.garrison[i], n = Math.min(g ? g.n : 0, Math.max(0, parseInt(inp.value) || 0)); if (n > 0) { army.push({ t: g.t, n }); g.n -= n; if (g.n <= 0) t.garrison[i] = null; } });
      if (!army.length) return toast('Choose some troops to send.');
      const days = caravanDays(t, dest); (G.caravans = G.caravans || []).push({ fx: t.x, fy: t.y, tx: dest.x, ty: dest.y, army, eta: days });
      Ach.event('caravan'); sfx('click'); toast(`Caravan sets out for ${dest.name}: ${days} day${days === 1 ? '' : 's'}.`); renderAll(); openTown(t);
    };
  }
  function moveCaravans() {
    if (!G.caravans || !G.caravans.length) return;
    for (const c of G.caravans.slice()) {
      if (--c.eta > 0) continue;
      G.caravans.splice(G.caravans.indexOf(c), 1);
      const dest = townAt(c.tx, c.ty);
      if (!dest) { toast('🚚 A reinforcement caravan arrived at a castle you no longer hold — the troops scatter.'); continue; }
      let lost = 0; for (const a of c.army) if (!addToArmy({ army: dest.garrison }, a.t, a.n)) lost += a.n;
      note(`🚚 Reinforcements reached ${dest.name}`, dest.x, dest.y);
      toast(`🚚 Reinforcements reached ${dest.name}: ${armyList(c.army, false)}${lost ? ' (garrison full — ' + lost + ' turned away)' : ''}.`);
    }
  }
  function openTavern() {
    const premium = G.tavern.length === 0;
    const ids = premium ? shuffle(Object.keys(HEROES).filter(id => !G.heroes.some(h => h.id === id))).slice(0, 8) : G.tavern, price = premium ? HIRE_COST * 2 : HIRE_COST;
    const cards = ids.map(id => { const d = HEROES[id];
      return `<div class="trow" style="grid-template-columns:42px 1fr auto"><div class="ic">${Art.heroPic(d.i, ownCol(0), 36, d.id)}</div>
        <div><b>${d.name}</b> <span class="small">${d.cls} (${FACTIONS[d.fac].name})${d.sk ? ' · ' + PERKS[d.sk].i + ' ' + PERKS[d.sk].n : ''}</span><br><span class="small">⚔️${d.att} 🛡${d.def} ✨${d.sp} 📚${d.kn}${d.spells.length ? ' · knows ' + d.spells.map(k => SPELLS[k].n).join(', ') : ''}</span></div>
        <div class="acts"><button data-hire="${id}">Hire ${RES_ICON.gold}${price}</button></div></div>`; }).join('');
    $('mbox').innerHTML = `<h2>🍺 Tavern</h2><p class="small">Heroes: ${G.heroes.length}/${MAX_HEROES}. New heroes arrive at the castle without an army — recruit troops and use the exchange to equip them. Heroes level up independently. The tavern offers new heroes every week.</p>${premium ? `<p>No heroes are waiting at the tavern right now — mercenary captains from across the realm will serve for <b>double</b> the price (${RES_ICON.gold}${price}).</p>` : ''}${cards}
      <div class="mb"><button class="primary" id="hBack">Back to town</button></div>`;
    $('hBack').onclick = () => openTown(curTown);
    $('mbox').querySelectorAll('[data-hire]').forEach(b => b.onclick = () => {
      if (G.heroes.length >= MAX_HEROES) return toast(`You can command at most ${MAX_HEROES} heroes.`);
      if (G.res.gold < price) return toast('Not enough gold.');
      const d = HEROES[b.dataset.hire], t = curTown;
      G.res.gold -= price; G.heroes.push(makeHero(d, t.x, t.y)); learn(d.spells); setActive(G.heroes.length - 1);
      G.tavern = G.tavern.filter(x => x !== d.id); Ach.event('hire', { count: G.heroes.length }); toast(`${d.name} joins your cause!`); renderAll(); openTavern();
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
    curTown = t; (G.flags = G.flags || {}).town = true; Assets.need(['ui/town_' + t.fac]);
    const th = townHero(t), here = !!th, mt = myTowns(), coastal = !!G.dock && t === mt[0];
    const tabs = mt.length > 1 ? `<div class="hlist">${mt.map((x, i) => `<button class="hbtn${x === t ? ' on' : ''}" data-tab="${i}" title="${x.name}">${FACTIONS[x.fac].icon}</button>`).join('')}</div>` : '';
    let html = `${tabs}<h2>🏰 ${t.name} <span class="small">${FACTIONS[t.fac].name} · ${t.b.hall ? HALL_LEVELS[t.b.hall].n : 'Settlement'}</span></h2><span class="townwide"></span><canvas id="tcv" width="1040" height="290" style="width:100%;height:auto;aspect-ratio:1040/290;border-radius:8px;border:2px solid #8c6a33;display:block"></canvas>
      <div class="small">${here ? `${th.name} is in town — recruits join the hero's army.` : 'No hero in this town — recruits join the town garrison (a hero can pick them up later).'} Higher Town Hall levels unlock new dwellings and creature upgrades.</div>`;
    let war = '';
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
      war += `<div class="trow big${!built && locked ? ' lockedrow' : ''}"><div class="ic">${Art.pic(lineType(id, lv), 68)}</div>
        <div><b>${c.n}</b> <span class="stars">${built ? starStr(lv) : ''}</span> <span class="small">Att ${c.a} Def ${c.d} Dmg ${c.lo}-${c.hi} HP ${c.hp} Spd ${c.s}${c.shoot ? ' · Archer' : ''}${c.fly ? ' · Flying' : ''}</span><br>
        <span class="small">${built ? `Available: <b>${av}</b> · ${fmtCost(c.cost)} each · +${c.gr}/week` : locked ? `🔒 Requires ${HALL_LEVELS[needHall].n} (Town Hall level ${needHall})` : `Dwelling not built — ${fmtCost(DWELL_COST[tier])}`}</span></div>
        <div class="acts">${built
          ? `<input type="number" min="1" max="${av}" value="${av}" id="n${tier}"><button data-buy="${tier}">Recruit</button>
             ${upC ? (upLocked ? `<span class="lockpill" title="Requires Town Hall level ${UP_HALL[nextLv]}">Lv${nextLv} · Hall ${UP_HALL[nextLv]}</span>` : `<button data-up="${tier}" title="${Art.fmtCostTxt(upC)}">⬆ Lv${nextLv} ${fmtCost(upC)}</button>`) : '<span class="small">MAX</span>'}
             ${upArmy ? `<button data-uparmy="${tier}">🪖 Upgrade ${upArmy.count} troops ${RES_ICON.gold}${upArmy.cost}</button>` : ''}`
          : (locked ? `<span class="lockpill">🔒 Hall ${needHall}</span>` : `<button data-build="${tier}">Build</button>`)}</div></div>`;
    });
    const hl = t.b.hall, hNext = hl < 5 ? HALL_LEVELS[hl + 1] : null;
    const gl = t.b.guild, gNext = gl < 3 ? GUILD_COST[gl + 1] : null;
    const bld = `<div class="trow"><div class="ic">${TownArt.pic('hall', Math.max(1, hl), t.fac, 42)}</div><div><b>${hl ? HALL_LEVELS[hl].n : 'Town Hall'}</b> <span class="stars">${starStr(hl, 5)}</span><br>
        <span class="small">${hl ? `+${HALL_LEVELS[hl].inc} 🪙/day.` : 'No income yet.'}${hNext ? ` Next: ${hNext.n} (+${hNext.inc} 🪙/day) — unlocks ${hl + 1 >= 1 && TIER_HALL.indexOf(hl + 1) > 0 ? 'tier ' + TIER_HALL.indexOf(hl + 1) + ' dwelling' : ''}${UP_HALL[hl + 2] ? ' and Lv' + (hl + 2) + ' upgrades' : ''}.` : ''}</span></div>
        <div class="acts">${hNext ? `<button data-hall="1" title="${Art.fmtCostTxt(hNext.cost)}">${hl ? 'Upgrade' : 'Build'} ${fmtCost(hNext.cost)}</button>` : '<span class="small">MAX</span>'}</div></div>
      <div class="trow"><div class="ic">${TownArt.pic('guild', Math.max(1, gl), t.fac, 42)}</div><div><b>Mage Guild</b> <span class="stars">${starStr(gl, 3)}</span><br>
        <span class="small">Spellbook: ${G.spells.map(k => SPELLS[k].i + ' ' + SPELLS[k].n).join(', ')}${gl < 3 ? `<br>Next level teaches: ${GUILD_SPELLS[gl + 1].map(k => SPELLS[k].i + ' ' + SPELLS[k].n).join(', ')}` : ''}</span></div>
        <div class="acts">${gNext ? `<button data-guild="1" title="${Art.fmtCostTxt(gNext)}">${gl ? 'Upgrade' : 'Build'} ${fmtCost(gNext)}</button>` : '<span class="small">MAX</span>'}</div></div>
      <div class="trow"><div class="ic">${TownArt.pic('market', 1, t.fac, 42)}</div><div><b>Marketplace</b><br><span class="small">${t.b.market ? `Buy missing resources at ${Math.round(MARKET_RATE * 100)}% rate.` : `Trade resources — ${fmtCost(MARKET_COST)}`}</span></div>
        <div class="acts">${t.b.market ? '<button data-trade="1">Trade</button>' : '<button data-build="market">Build</button>'}</div></div>
      <div class="trow"><div class="ic">${TownArt.pic('ship', 1, t.fac, 42)}</div><div><b>Shipyard</b><br><span class="small">${t.b.ship ? `Boats ${G.boats.length}/${MAX_BOATS}. A new boat appears at the port by the bay (${fmtCost(BOAT_COST)} each). Walk a hero onto a boat to sail; collect treasures at sea.` : coastal ? `Build boats to sail the sea and collect its treasures — ${fmtCost(SHIPYARD_COST)}` : 'There is no coast near this town.'}</span></div>
        <div class="acts">${!coastal ? '' : t.b.ship ? `<button data-boat="1" ${G.boats.length >= MAX_BOATS ? 'disabled' : ''}>⛵ Build boat</button>` : '<button data-build="ship">Build</button>'}</div></div>
      <div class="trow"><div class="ic">${TownArt.pic('fort', t.fort || 0, t.fac, 42)}</div><div><b>${FORT_LEVELS[t.fort || 0].n}</b> <span class="stars">${starStr(t.fort || 0, 3)}</span><br>
        <span class="small">Walls, gate and arrow towers are ×${FORT_LEVELS[t.fort || 0].hp} as strong in a siege${(t.fort || 0) < 3 ? ` — next: ${FORT_LEVELS[(t.fort || 0) + 1].n} (×${FORT_LEVELS[(t.fort || 0) + 1].hp} walls, ×${FORT_LEVELS[(t.fort || 0) + 1].tower} tower fire)` : ''}.</span></div>
        <div class="acts">${(t.fort || 0) < 3 ? `<button data-fortify="1" title="${Art.fmtCostTxt(FORT_LEVELS[(t.fort || 0) + 1].cost)}">⬆ ${fmtCost(FORT_LEVELS[(t.fort || 0) + 1].cost)}</button>` : '<span class="small">MAX</span>'}</div></div>
      <div class="trow"><div class="ic">${TownArt.pic('mines', t.minel || 0, t.fac, 42)}</div><div><b>${MINE_LEVELS[t.minel || 0].n}</b> <span class="stars">${starStr(t.minel || 0, 3)}</span><br>
        <span class="small">Hidden mines (${MINE_LEVELS[t.minel || 0].stock}) in front of the walls hurt and halt attackers. A defending hero can lay ${EMERGENCY_MINES} extra mines even without a minefield${(t.minel || 0) < 3 ? ` — next: ${MINE_LEVELS[(t.minel || 0) + 1].n} (${MINE_LEVELS[(t.minel || 0) + 1].stock} mines)` : ''}.</span></div>
        <div class="acts">${(t.minel || 0) < 3 ? `<button data-minefield="1" title="${Art.fmtCostTxt(MINE_LEVELS[(t.minel || 0) + 1].cost)}">⬆ ${fmtCost(MINE_LEVELS[(t.minel || 0) + 1].cost)}</button>` : '<span class="small">MAX</span>'}</div></div>
      <div class="trow"><div class="ic">${TownArt.pic('tavern', 1, t.fac, 42)}</div><div><b>Tavern</b><br><span class="small">Heroes ${G.heroes.length}/${MAX_HEROES}. Hire more heroes and exchange troops between heroes in town.</span></div>
        <div class="acts"><button data-tavern="1">Hire heroes</button>${heroesAt(t.x, t.y).length > 1 ? '<button data-xhero="1">Exchange troops</button>' : ''}</div></div>
      `;
    const garrRow = `      <div class="trow"><div class="ic">${TownArt.pic('garrison', 1, t.fac, 42)}</div><div><b>Garrison</b><br><span class="small">${armyList(t.garrison, false) || 'No troops stationed.'} The garrison defends the town when no hero is inside${here ? '' : ' (bring a hero to move troops)'}.</span></div>
        <div class="acts"><button data-garr="1">Manage garrison</button></div></div>
`;
    const tabBar = `<div class="ttabs"><button class="ttab${townTab === 'war' ? ' on' : ''}" data-ttab="war">⚔️ Warriors</button><button class="ttab${townTab === 'bld' ? ' on' : ''}" data-ttab="bld">🏗️ Buildings</button></div>`;
    html += tabBar + (townTab === 'war' ? war + garrRow + outpostHtml(t) + caravanHtml(t, mt) : garrRow + bld) + `<div class="small" style="margin-top:8px">${RES.map(k => RES_ICON[k] + ' ' + G.res[k]).join('  ')}</div>
      <div class="mb"><button class="primary" id="tClose">Leave town</button></div>`;
    $('mbox').innerHTML = html; $('modal').classList.remove('hide');
    if (!townLoop) { townLoop = true; requestAnimationFrame(drawTown); }
    $('tClose').onclick = () => { $('modal').classList.add('hide'); renderAll(); };
    const again = () => { openTown(t); renderAll(); };
    const q = (sel, fn) => $('mbox').querySelectorAll(sel).forEach(fn);
    q('[data-tab]', b => b.onclick = () => openTown(mt[+b.dataset.tab]));
    q('[data-ttab]', b => b.onclick = () => { townTab = b.dataset.ttab; openTown(t); });
    q('[data-outbuy]', b => b.onclick = () => {
      const [oi, id] = b.dataset.outbuy.split(':'), o = G.objs[+oi], c = C[id];
      if (!o || o.owner !== 0) return toast('You no longer hold that building.');
      const stock = o.t === 'lair' ? (o.avail[id] || 0) : o.avail;
      let n = Math.min(parseInt(b.parentElement.querySelector('input').value) || 0, stock);
      while (n > 0 && !canAfford(G.res, Object.fromEntries(Object.entries(c.cost).map(([k, v]) => [k, v * n])))) n--;
      if (n <= 0) return toast('Cannot recruit (resources or availability).');
      if (!addToArmy(th || { army: t.garrison }, id, n)) return toast('No free army slot.');
      pay(G.res, c.cost, n); if (o.t === 'lair') { o.avail[id] -= n; Ach.event('lairBuy', { n, id }); } else o.avail -= n;
      toast(`Recruited ${n} ${c.n}${n > 1 ? 's' : ''} from your outpost.`); sfx('build'); again();
    });
    q('[data-caravan]', b => b.onclick = () => openCaravan(t));
    q('[data-fortify]', b => b.onclick = () => {
      const nx = FORT_LEVELS[(t.fort || 0) + 1]; if (!canAfford(G.res, nx.cost)) return toast('Not enough resources.');
      pay(G.res, nx.cost); t.fort = (t.fort || 0) + 1; Ach.event('fort', { lv: t.fort }); sfx('build'); toast(`${nx.n} built — the walls are stronger.`); again();
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
      pay(G.res, nx.cost); t.b.hall++; Ach.event('hall', { lv: t.b.hall });
      toast(`${nx.n} built! Income +${nx.inc}/day. New buildings unlocked.`); startTownAnim('upgrade', 7); again();
    });
    q('[data-guild]', b => b.onclick = () => {
      const cost = GUILD_COST[t.b.guild + 1];
      if (!canAfford(G.res, cost)) return toast('Not enough resources.');
      pay(G.res, cost); t.b.guild++; Ach.event('guild', { lv: t.b.guild });
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
      let n = Math.min(parseInt($('n' + tier).value) || 0, t.avail[tier] || 0);
      while (n > 0 && !canAfford(G.res, Object.fromEntries(Object.entries(c.cost).map(([k, v]) => [k, v * n])))) n--;
      if (n <= 0) return toast('Cannot recruit (resources or availability).');
      if (!addToArmy(th || { army: t.garrison }, type, n)) return toast(here ? 'No free army slot.' : 'The garrison is full.');
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
      html: `<div class="trow" style="grid-template-columns:30px 1fr auto"><div class="ic">${TownArt.pic('fort', fl, G.faction, 42)}</div><div><b>${FORT_LEVELS[fl].n}</b> <span class="small">walls ×${FORT_LEVELS[fl].hp}</span></div><div class="acts">${fc ? `<button data-fw="1">⬆ ${fmtCost(fc)}</button>` : '<span class="small">MAX</span>'}</div></div>
        <div class="trow" style="grid-template-columns:30px 1fr auto"><div class="ic">${TownArt.pic('mines', ml, G.faction, 42)}</div><div><b>${MINE_LEVELS[ml].n}</b> <span class="small">${MINE_LEVELS[ml].stock} hidden mines</span></div><div class="acts">${mc ? `<button data-fm="1">Build ${fmtCost(mc)}</button>` : '<span class="small">MAX</span>'}</div></div>`,
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
      eStats: { att: eff(ah, 'att'), def: eff(ah, 'def') }, eHero: ah, title: `Defending ${o.name}`, siege: siegeOf(o, 0), terrain: battleTerrainAt(o.x, o.y, false), canRetreat: false });
    res.survivors.forEach((n, i) => { if (gar[i]) { if (n > 0) gar[i].n = n; else gar[i] = null; } });
    if (res.win) {
      removeAiHero(ah); toast(`${o.name} held! ${ah.name} is slain.`); note(`🛡 ${o.name} held against ${ah.name}`, o.x, o.y);
      const sp = collectSpoils(G.hero, ah.army, ah, true); if (sp) { renderAll(); await spoilsModal(sp, 'Your garrison'); }
      return true;
    }
    shrinkArmy(ah.army, 0.5);
    await aiCapture(o, ah);
    return false;
  }
  async function aiCapture(o, ah) {
    const ai = aiById(ah.ai), wasMine = o.owner === 0;
    note(`💀 ${o.name} fell to ${ai.name}`, o.x, o.y);
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
    // a held Dragon Lair: buy the strongest dragons the treasury allows and send them to the home castle
    for (const lr of G.objs) if (lr.t === 'lair' && lr.owner === ai.id) {
      const t = towns[0], hero = ai.heroes.find(h => h.x === t.x && h.y === t.y), army = hero ? hero.army : t.garrison;
      for (const id of [...LAIR].reverse()) { const price = goldEq(C[id].cost), n = Math.min(lr.avail[id] || 0, Math.floor(ai.gold * 0.6 / price)); if (n > 0 && addToArmy({ army }, id, n)) { ai.gold -= n * price; lr.avail[id] -= n; } }
    }
    const maxH = Math.min(4, 1 + Math.ceil(towns.length / 2) + (G.day > 25 ? 1 : 0));
    if (ai.heroes.length && ai.heroes.length < maxH && ai.spawnWait <= 0 && ai.gold >= HIRE_COST * 1.2) {
      ai.gold -= HIRE_COST; const t = towns[0]; spawnAiHero(ai, t); aiRecruit(ai, t);
    }
  }
  const defPower = (o) => (o.owner !== null ? armyPower(o.garrison) : armyPower(o.guard || [])) + heroesAt(o.x, o.y).reduce((s, hh) => s + armyPower(hh.army), 0);
  function aiTargets(ai, h, power) {
    const R = 22 * sizeMv(), list = [];
    for (const o of G.objs) {
      if (o.owner === ai.id || isAlly(ai.id, o.owner)) continue;
      const d = dist(o, h); if (d > R) continue;
      let sc = 0;
      switch (o.t) {
        case 'monster': { const gp = armyPower(o.guard); if (power >= gp * 1.25) sc = (gp * 0.3 + 200) / (d + 6); break; }
        case 'pile': sc = 350 / (d + 4); break;
        case 'chest': sc = 500 / (d + 4); break;
        case 'mine': { const gp = armyPower(o.guard || []); if (power >= gp * 1.2) sc = 900 / (d + 6); break; }
        case 'lair': { const gp = armyPower(o.guard || []); if (power >= gp * 1.25 + 1) sc = 3000 / (d + 8); break; }
        case 'fort': { const dp = defPower(o); if (power >= dp * 1.3 + 1) sc = 1600 / (d + 8); break; }
        case 'town': { const dp = defPower(o); if (power >= dp * 1.4 + 1) sc = 4000 / (d + 10); break; }
      }
      if (sc > 0) list.push({ x: o.x, y: o.y, score: sc });
    }
    if (!isAlly(ai.id, 0)) for (const ph of G.heroes) { const d = dist(ph, h); if (d > R) continue; if (power >= armyPower(ph.army) * 1.25) list.push({ x: ph.x, y: ph.y, score: 2400 / (d + 6) }); }
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
      h.move -= s.cost; h.dir = dirOf(h.x, h.y, s.x, s.y); h.x = s.x; h.y = s.y;
      const ph = isAlly(ai.id, 0) ? [] : heroesAt(s.x, s.y);
      if (ph.length) {
        const d = ph.reduce((a, b) => armyCount(a) >= armyCount(b) ? a : b);
        centerOn(s.x, s.y); renderAll(); toast(`${h.name} of the ${FACTIONS[ai.fac].name} attacks ${d.name}!`); note(`⚔ ${h.name} of the ${FACTIONS[ai.fac].name} attacked ${d.name}`, s.x, s.y); await sleep(350);
        await fightAiHero(d, h, false);
        if (!ai.heroes.includes(h)) return true;
        const so = objAt(G, h.x, h.y);
        if (so && so.owner === 0 && (so.t === 'fort' || so.t === 'town')) await defendStructure(so, h);
        return true;
      }
      const other = G.ais.flatMap(a => a.heroes).find(x => x !== h && x.x === s.x && x.y === s.y && !isAlly(ai.id, x.ai));
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
    if (!last || o.owner === ai.id || isAlly(ai.id, o.owner)) return false;
    const win = (def, bonus = 1) => { const d = def.map(a => a && ({ ...a })); return quickBattle(h.army, d, bonus); };
    const lose = () => { aiKill(ai, h); return true; };
    switch (o.t) {
      case 'monster': if (!win(o.guard)) return lose(); G.objs.splice(G.objs.indexOf(o), 1); reindex(G); return true;
      case 'art': if (o.guard && o.guard.length && !win(o.guard)) return lose(); giveArt(h, o.art); G.objs.splice(G.objs.indexOf(o), 1); reindex(G); return true;
      case 'mine': if (o.guard && o.guard.length && !win(o.guard)) return lose(); { const was = o.owner === 0; o.guard = []; o.owner = ai.id; note(`⛏ ${ai.name} took ${was ? 'YOUR ' : 'a '}${o.kind} mine`, o.x, o.y); } return true;
      case 'lair': if (o.guard && o.guard.length && !win(o.guard)) return lose(); o.guard = []; o.owner = ai.id; toast(`The ${FACTIONS[ai.fac].name} rivals seize the Dragon Lair!`); note(`🐲 ${ai.name} seized the Dragon Lair`, o.x, o.y); return true;
      case 'fort': case 'town': {
        if (o.owner === 0) { await defendStructure(o, h); return true; }
        const defenders = o.owner ? o.garrison : o.guard;
        if (defenders && defenders.some(Boolean) && !win(defenders, 1.3)) return lose();
        if (o.t === 'town') takeTown(o, ai.id); else { o.owner = ai.id; o.guard = []; o.garrison = [{ t: factionTiers(ai.fac)[0], n: 8 }, null, null, null, null, null, null]; }
        note(`🏰 ${ai.name} captured ${o.name}`, o.x, o.y);
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
      () => { const o = G.objs[Math.floor(Math.random() * G.objs.length)]; markView(o.x, o.y, 10, false); renderAll(); return ['🗺️', 'Scouts Return', 'Your scouts bring back maps of a distant region: part of the unexplored land is revealed.']; },
      () => { const h = rh(); h.kn++; return ['📖', 'Visiting Scholar', `A wandering scholar tutors ${h.name}: +1 Knowledge.`]; },
      () => { const h = rh(), a = h.army.find(Boolean); if (!a || a.n < 8) return ['🍀', 'Quiet Day', 'Nothing of note happens.']; const lost = Math.max(1, Math.floor(a.n * 0.06)); a.n -= lost; return ['🤒', 'Camp Fever', `Sickness spreads in ${h.name}'s camp: ${lost} ${C[a.t].n}s fall ill and leave.`]; },
    ];
    return list[Math.floor(Math.random() * list.length)]();
  }

  function turnIssues() {
    const out = [];
    for (const h of G.heroes) if (!h.sleep && armyCount(h) && h.move >= 0.5 * maxMove(h) && !(heroAtTown(h) && G.heroes.length === 1 && G.day > 3 && false)) out.push(`🏇 <b>${h.name}</b> has not moved much (${Math.round(100 * h.move / maxMove(h))}% movement left) — or press 💤 Sleep to stop this reminder.`);
    for (const t of myTowns()) {
      const waiting = [];
      tiersOf(t).forEach((id, i) => { const tier = i + 1, c = C[tierType(t, tier)], av = t.avail[tier] || 0; if (t.b[tier] && av > 0 && canAfford(G.res, c.cost)) waiting.push(`${av} ${c.n}`); });
      if (waiting.length) out.push(`🏰 <b>${t.name}</b> has recruits waiting: ${waiting.slice(0, 3).join(', ')}${waiting.length > 3 ? '…' : ''}`);
      if (!t.b.hall && canAfford(G.res, HALL_LEVELS[1].cost)) out.push(`🏛 You can afford a Village Hall in <b>${t.name}</b> (+${HALL_LEVELS[1].inc} gold per day).`);
    }
    return out.slice(0, 5);
  }
  // scenario objectives
  const ownedTowns = () => G.objs.filter(x => x.t === 'town' && x.owner === 0).length;
  function goalText() {
    const g = G && G.scn && G.scn.goal; if (!g) return '';
    const left = g.days ? ` · day ${Math.min(G.day, g.days)}/${g.days}` : '';
    return g.type === 'gold' ? `${G.res.gold.toLocaleString()} / ${g.n.toLocaleString()} gold${left}` : g.type === 'towns' ? `${ownedTowns()}/${g.n} towns${left}` : g.type === 'survive' ? `survive to day ${g.days} (day ${G.day})` : 'defeat every rival' + (g.days ? left : '');
  }
  async function goalCheck() {
    const g = G && G.scn && G.scn.goal; if (!g || G.over) return false;
    if (g.type === 'gold' && G.res.gold >= g.n) { busy = false; await endGame(true); return true; }
    if (g.type === 'towns' && ownedTowns() >= g.n) { busy = false; await endGame(true); return true; }
    if (g.type === 'survive' && G.day > g.days) { busy = false; await endGame(true); return true; }
    if ((g.type === 'gold' || g.type === 'towns' || (g.type === 'conquer' && g.days)) && G.day > g.days) { busy = false; await endGame(false, `The scenario "${G.scn.name}" ran out of time: ${goalText().replace(/ · day.*/, '')}.`); return true; }
    return false;
  }
  async function endTurn() {
    if (!G || busy || G.over) return;
    if (Settings.confirmEnd) {
      const issues = turnIssues();
      if (issues.length) {
        const i = await showModal(`<h2>⏭ End the turn?</h2><p class="small">Before you go:</p><ul style="margin:6px 0 6px 18px;line-height:1.6">${issues.map(x => '<li>' + x + '</li>').join('')}</ul>`, ['⏭ End turn anyway', '↩ Keep playing']);
        if (i !== 0) return;
      }
    }
    return doEndTurn();
  }
  async function turnReport() {
    if (!G.report || !G.report.length) return;
    const list = G.report.slice(); G.lastReport = list; G.report = [];
    await new Promise((res) => {
      modalOpen(`<h2>📜 While you were away</h2><div class="small">Tap an entry to look at the place.</div>${list.slice(0, 9).map((r, i) => `<div class="trow rep" data-rp="${i}" style="grid-template-columns:1fr auto"><div>${r.t}</div><div class="small">${r.x !== undefined ? '📍' : ''}</div></div>`).join('')}${list.length > 9 ? `<div class="small">…and ${list.length - 9} more.</div>` : ''}<div class="mb"><button class="primary" id="rpOk">Continue</button></div>`);
      $('rpOk').onclick = () => { $('modal').classList.add('hide'); res(); };
      $('mbox').querySelectorAll('[data-rp]').forEach(r => r.onclick = () => { const e = list[+r.dataset.rp]; if (e.x !== undefined) { centerOn(e.x, e.y); } $('modal').classList.add('hide'); res(); });
    });
  }
  function openReport() {
    const list = G.lastReport || [];
    modalOpen(`<h2>📜 Last turn report</h2>${list.length ? list.map((r, i) => `<div class="trow rep" data-rp="${i}" style="grid-template-columns:1fr auto"><div>${r.t}</div><div class="small">${r.x !== undefined ? '📍' : ''}</div></div>`).join('') : '<p class="small">Nothing happened that you needed to know about.</p>'}<div class="mb"><button class="primary" id="rpOk">Back</button></div>`);
    $('rpOk').onclick = openMenu;
    $('mbox').querySelectorAll('[data-rp]').forEach(r => r.onclick = () => { const e = list[+r.dataset.rp]; if (e.x !== undefined) centerOn(e.x, e.y); closeModal(); });
  }
  async function doEndTurn() {
    if (!G || busy || G.over) return;
    busy = true; G.path = null; selSlot = -1;
    G.report = [];
    document.body.classList.add('aiturn', 'night');   // the rivals move at night
    const nt0 = Date.now();
    try { await aiPhase(); await new Promise(r => setTimeout(r, Math.max(0, 1700 - (Date.now() - nt0)))); } finally { document.body.classList.remove('aiturn', 'night'); }
    if (G.over) { busy = false; return; }
    G.day++;
    await turnReport();
    const newWeek = (G.day - 1) % 7 === 0;
    let wev = null;
    if (newWeek) { G.wk = {}; wev = rollWeekEvent(); }
    for (const h of G.heroes) { h.move = maxMove(h); h.mana = Math.min(maxMana(h), h.mana + 4 + 2 * perk(h, 'mysticism')); if (heroAtTown(h)) h.mana = maxMana(h); }
    const gain = computeGain();
    RES.forEach(k => { G.res[k] += gain[k]; });
    if (await goalCheck()) return;
    gst('gold', gain.gold || 0);
    Ach.event('day', { day: G.day, gold: gain.gold || 0, towns: myTowns().length, mines: G.objs.filter(x => x.t === 'mine' && x.owner === 0).length, azure: G.heroes.some(x => x.army.some(a => a && a.t === 'azured')) });
    moveCaravans();
    const parts = RES.filter(k => gain[k]).map(k => `+${gain[k]}${RES_ICON[k]}`);
    if ((G.day - 1) % 7 === 0) {
      for (const tw of G.objs) if (tw.t === 'town') for (let i = 1; i <= 7; i++) if (tw.b[i]) tw.avail[i] = (tw.avail[i] || 0) + GROWTH[i - 1];
      for (const dw of G.objs) if (dw.t === 'dwelling' && dw.owner === 0) dw.avail += dwGrowth(dw);
      for (const lr of G.objs) if (lr.t === 'lair' && lr.owner !== null && lr.owner !== undefined) for (const id of LAIR) lr.avail[id] = (lr.avail[id] || 0) + LAIR_GROWTH[id];
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
    autosave();
  }
  async function endGame(win, why) {
    G.over = true; if (win) Ach.event('win', { diff: G.diff, size: G.size, day: G.day }); sfx(win ? 'fanfare' : 'lose'); if (win && typeof Celebrate !== 'undefined') Celebrate.game();
    try { localStorage.removeItem(SAVE); } catch (e) { /* ignore */ }
    if (win) { await victoryScreen(); $('title').classList.remove('hide'); refreshTitle(); return; }
    await showModal(win ? `<h2>🏆 Victory!</h2><p>Every rival has lost its towns: you rule the realm on day ${G.day} (${DF().name}). Well fought!</p>` : `<h2>💀 Defeat</h2><p>${why || 'Your hero has fallen.'}</p>`, ['Main menu']);
    $('title').classList.remove('hide'); refreshTitle();
  }

  // ---------- title / selection / help ----------
  const HELP = `<h2>How to Play</h2><p><b>Goal:</b> eliminate every rival by capturing all of their towns. Rival AI players build, recruit, hire several heroes and expand across the map — and they will attack your forts and towns. If you hold no town for 7 days you lose.</p>
    <p><b>Towns:</b> capture neutral and rival towns for more castles (each keeps its own faction, creatures and buildings). Use the tabs in the town screen to switch towns, and station a garrison so a town defends itself when no hero is inside.</p>
    <p><b>Map:</b> click a tile to preview the path (green = reachable today, red = next turn), click again to walk. Click another hero to select it (Tab cycles). Monsters facing an army ${FLEE_RATIO}× stronger offer to flee (or pay tribute); with the Charisma perk they can join you instead. A rival hero who is hopelessly outmatched may offer gold to be let go, and if you are the outmatched one you can pay a ransom to retreat to your nearest castle with your army intact. Walk onto resources to grab them; mines give daily income; monsters, mines and artifacts are guarded. Merchants ⛺ sell missing resources.<br>
    Keys: arrows/WASD scroll · +/- zoom · H center hero · Space go · E end turn · T town · Tab next hero. Drag the map to pan, mouse wheel / pinch to zoom.<br>
    <b>On a phone:</b> drag to pan, pinch to zoom, tap a tile to preview the path and tap it again to go; in battle, tap a hex twice to confirm. Use the bottom bar for End Turn, Town and heroes.</p>
    <p><b>Sea:</b> build a Shipyard in town, then boats at the port by the bay. Walk a hero onto a boat to sail; collect floating treasures, salvage shipwrecks, fight sea monsters, and disembark on any shore tile. Pick the map type, size and seed when starting a game.</p>
    <p><b>Events:</b> every new week brings a weekly event (double growth for a creature, plague, bountiful harvest, merchant caravans, heroic training...) and most days a random event may strike — treasure, bandits, mercenaries, storms, rumors.</p>
    <p><b>Territory:</b> the map is split into zones, each ruled by a fort. Capture a fort to own the zone: +${FORT_INCOME} gold/day, your mines there pay, +${MILITIA} militia/week. <b>Station troops in forts</b> — the enemy hero raids undefended forts.</p>
    <p><b>Town:</b> Town Hall levels 1-5 raise income and unlock dwellings (tiers 3-7) and creature upgrades (up to 5 levels). Mage Guild teaches spells, the Marketplace trades resources, the Tavern hires up to ${MAX_HEROES} heroes.</p>
    <p><b>Fog of war:</b> unexplored land is black; explored land you no longer see is dimmed and hides monsters and rival heroes. Heroes see 6 tiles (+1 per Scouting rank), towns 9, forts 6. Observation towers and scouts reveal large areas. <b>Adventure sites:</b> dwellings (capture, then recruit weekly), windmills / water wheels / gardens (weekly resources), learning stones (experience), shrines (spells), creature banks (guarded treasure), monoliths (teleport pairs), seers (trade resources for an artifact) and springs (mana, movement or luck).</p>
    <p><b>Defenses:</b> build Fortifications (Citadel → Castle → Fortress) to strengthen walls, gate and arrow towers, and a Minefield for hidden mines in front of the walls — mines hurt and halt attackers. When you defend, you can also lay mines yourself (💣 button, key M); even without a minefield you get ${EMERGENCY_MINES}. Forts can be fortified too.</p>
    <p><b>Spells:</b> 18 spells in four schools — 🌬️ Air, ⛰️ Earth, 🔥 Fire, 💧 Water. Each school is a skill (Basic → Expert) that makes its spells stronger; at <b>Expert</b> buffs and debuffs become mass spells and areas grow. A spell of level L needs Wisdom rank L-2 (levels 1-2 are free). The Mage Guild teaches higher-level spells; shrines teach one each. You cast one spell per round.</p>
    <p><b>Skills &amp; artifacts:</b> each hero starts with two skills and, at every level-up, picks one of two offered skills (Basic → Advanced → Expert; up to ${MAX_SKILLS} skills; the offers favour the hero's class). Artifacts are equipment: they have slots (head, neck, armor, weapon, shield, feet, cape, two rings), tiers, special effects (movement, mana, morale, luck, extra skill ranks such as Water Walk) and <b>sets</b> that give bonuses when completed. Use 🎒 Equipment on the hero panel; heroes standing together can hand artifacts to each other.</p>
    <p><b>Battle:</b> click a green hex to move, click an enemy to attack (archers shoot — +25% at close range, weaker the farther the target, and <b>half damage beyond 10 hexes: the broken arrow 💔</b>; flyers ignore obstacles). Your hero stands beside the field: cast one spell per round and make one Hero Strike per round. Castle assaults are <b>sieges</b>: break the gate or walls (your catapult helps), beware arrow towers and the moat; flyers can cross the walls. Level-ups let you pick one of two perks.</p>`;
  function refreshTitle() { $('tCont').disabled = !localStorage.getItem(SAVE); $('tLoad').disabled = !['h3js_save_v7', 'h3js_slot_1', 'h3js_slot_2', 'h3js_slot_3'].some(k => localStorage.getItem(k)); }
  function showDifficultySelect() {
    const cards = Object.entries(DIFFICULTY).map(([k, d]) => `<div class="card" data-d="${k}"><div class="big">${d.icon}</div><b>${d.name}</b><div class="small">${d.desc}</div>
      <div class="small">Start: ${RES_ICON.gold}${d.gold} · guards ×${d.neutral} · income ×${d.income}<br>Rivals march from day ${d.ehDay} · armies ×${d.ehMul} · rival income ×${d.aiInc}</div></div>`).join('');
    $('mbox').innerHTML = `<h2>Choose difficulty</h2><div class="grid two">${cards}</div><div class="mb"><button id="sBack">Back</button></div>`;
    $('sBack').onclick = () => $('modal').classList.add('hide');
    $('mbox').querySelectorAll('.card').forEach(c => c.onclick = () => showMapSelect(c.dataset.d));
    $('modal').classList.remove('hide');
  }
  function showMapSelect(diff, st = { preset: 'plains', size: 'medium', seed: '' }) {
    const cards = Object.entries(MAPS).map(([k, m]) => `<div class="card${st.preset === k ? ' on' : ''}" data-m="${k}"><img class="mprev" src="${mapPreview(k)}" alt="" draggable="false"><b>${m.name}</b><div class="small">${m.desc}</div></div>`).join('');
    const sizes = Object.entries(SIZES).map(([k, s]) => `<button class="${st.size === k ? 'primary' : ''}" data-s="${k}">${s.name} (${s.w}×${s.h})</button>`).join(' ');
    $('mbox').innerHTML = `<div class="setup"><h2>Choose your map <span class="small">${DIFFICULTY[diff].icon} ${DIFFICULTY[diff].name}</span></h2><div class="grid two">${cards}</div>
      <p>Size: ${sizes}</p>
      <p>Fog of war: ${[[true, 'On'], [false, 'Off']].map(([v, n]) => `<button class="${(st.fog !== false) === v ? 'primary' : ''}" data-fog="${v}">${n}</button>`).join(' ')} <span class="small">Unexplored land is hidden; scouts, towers and your heroes reveal it.</span></p>
      <p>Rivals: ${[0, 1, 2, 3, 4].map(n => `<button class="${(st.ais || 0) === n ? 'primary' : ''}" data-a="${n}">${n ? n : 'Auto'}</button>`).join(' ')} <span class="small">AI players that expand and fight you.</span></p><p>Seed: <input id="mSeed" placeholder="empty = random map" value="${st.seed}" style="width:230px;background:#120d08;color:#f1e6c4;border:1px solid #6b4f24;padding:4px"> <span class="small">Share a seed to replay the same map.</span></p>
      <h4>Colours &amp; teams</h4><p>Your flag: ${PALETTE.map((p, i) => `<button class="swatch flagbtn${(st.color || 0) === i ? ' on' : ''}" data-col="${i}" title="${p[0]}">${flagImg(i, 40)}</button>`).join('')}</p>
      <div class="small">Allies never attack you, share vision and let you swap troops; an enemy bloc fights together. You win when every enemy realm is gone.</div>
      ${(() => { const n = st.ais || ({ small: 1, medium: 1, large: 2, huge: 3, giant: 4 }[st.size] || 1), free = PALETTE.map((p, i) => i).filter(i => i !== (st.color || 0)); st.teams = st.teams || []; return Array.from({ length: n }, (_, i) => `<div class="setrow"><div>${flagImg(free[i % free.length], 30)} <b>Rival ${i + 1}</b></div><div class="seg">${[['enemy', '⚔ Enemy'], ['ally', '🤝 Ally'], ['bloc', '⚔⚔ Bloc']].map(([v, l]) => `<button data-tm="${i}:${v}" class="${(st.teams[i] || 'enemy') === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>`).join(''); })()}
      <div class="mb"><button id="sBack">Back</button><button class="primary" id="sNext">Next: castle</button></div></div>`;
    const keep = () => { st.seed = $('mSeed').value; };
    $('mbox').querySelectorAll('[data-col]').forEach(b => b.onclick = () => { keep(); st.color = +b.dataset.col; showMapSelect(diff, st); });
    $('mbox').querySelectorAll('[data-tm]').forEach(b => b.onclick = () => { keep(); const [i, v] = b.dataset.tm.split(':'); (st.teams = st.teams || [])[+i] = v; showMapSelect(diff, st); });
    $('mbox').querySelectorAll('[data-m]').forEach(c => c.onclick = () => { keep(); st.preset = c.dataset.m; showMapSelect(diff, st); });
    $('mbox').querySelectorAll('[data-s]').forEach(b => b.onclick = () => { keep(); st.size = b.dataset.s; showMapSelect(diff, st); });
    $('mbox').querySelectorAll('[data-fog]').forEach(b => b.onclick = () => { keep(); st.fog = b.dataset.fog === 'true'; showMapSelect(diff, st); });
    $('mbox').querySelectorAll('[data-a]').forEach(b => b.onclick = () => { keep(); st.ais = +b.dataset.a; showMapSelect(diff, st); });
    $('sBack').onclick = showDifficultySelect;
    $('sNext').onclick = () => { keep(); showFactionSelect(diff, { ...st }); };
    $('modal').classList.remove('hide');
    Assets.need(['terrain/grass', 'terrain/water']).then(() => { if (!prevCache[Object.keys(MAPS)[0]] || !prevCache[Object.keys(MAPS)[0]].full) { const d = $('mbox').querySelectorAll('.mprev'); Object.keys(MAPS).forEach((k, i) => { delete prevCache[k]; if (d[i]) d[i].src = mapPreview(k); }); } });
  }
  // ---------- setup screens (wide layout): painted map previews, castle pictures with banners, hero chooser with detail panel ----------
  const FLAGS = ['blue', 'red', 'green', 'orange', 'purple', 'teal', 'pink', 'tan'];
  const flagImg = (i, px = 36) => { const u = Assets.url('flags/' + FLAGS[i]); return u ? `<img class="flagimg" src="${u}" alt="" draggable="false" style="height:${px}px">` : `<span class="zdot" style="background:${PALETTE[i][1]};width:${px * 0.5}px;height:${px * 0.5}px"></span>`; };
  const prevCache = {};
  function mapPreview(kind0, biome) {
    const kind = kind0, ck = kind0 + (biome || '');
    if (prevCache[ck] && prevCache[ck].full) return prevCache[ck].url;
    const W = 300, H = 150, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const T = (n) => Assets.get('terrain/' + n), full = !!(T('grass') && T('water'));
    const fill = (img, col) => { g.fillStyle = img ? g.createPattern(img, 'repeat') : col; g.fillRect(0, 0, W, H); };
    const blob = (img, col, cx, cy, rx, ry, rot = 0) => { g.save(); g.beginPath(); g.ellipse(cx, cy, rx, ry, rot, 0, 7); g.clip(); g.fillStyle = img ? g.createPattern(img, 'repeat') : col; g.fillRect(0, 0, W, H); g.restore(); g.beginPath(); g.ellipse(cx, cy, rx, ry, rot, 0, 7); g.lineWidth = 3; g.strokeStyle = 'rgba(235,225,190,.55)'; g.stroke(); };
    const stamp = (name, x, y, h) => { const im = Assets.get(name); if (im) { const w = im.width * h / im.height; g.drawImage(im, x - w / 2, y - h, w, h); } };
    let seed = kind.length * 7 + 3; const R = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const trees = (n, x0, y0, x1, y1) => { for (let i = 0; i < n; i++) stamp('terrain/forest_overlay', x0 + R() * (x1 - x0), y0 + R() * (y1 - y0), 26 + R() * 8); };
    const mounts = (n, x0, y0, x1, y1) => { const a = []; for (let i = 0; i < n; i++) a.push([x0 + R() * (x1 - x0), y0 + R() * (y1 - y0)]); a.sort((p, q) => p[1] - q[1]).forEach(([x, y]) => stamp('terrain/mountain_overlay', x, y, 38 + R() * 12)); };
    if (kind === 'isles') {
      fill(T('water'), '#2f6fb0');
      blob(T('grass'), '#5b8a3a', 80, 90, 62, 36, -0.2); blob(T('grass'), '#5b8a3a', 215, 55, 52, 30, 0.3); blob(T('sand'), '#d8c07a', 235, 118, 34, 18); blob(T('grass'), '#5b8a3a', 150, 128, 28, 14);
      trees(5, 45, 70, 110, 100); trees(4, 190, 40, 245, 70); stamp('objects/town_castle', 82, 92, 40); stamp('objects/boat', 150, 40, 26); stamp('objects/chest', 235, 118, 20);
    } else if (kind === 'highland') {
      fill(T('grass'), '#5b8a3a'); mounts(8, 15, 40, 285, 75); trees(14, 15, 70, 285, 140); blob(T('water'), '#2f6fb0', 255, 125, 55, 24); stamp('objects/town_castle', 60, 128, 40); stamp('objects/mine_ore', 175, 120, 26);
    } else if (kind === 'steppe') {
      fill(T('grass'), '#6f9a3a'); blob(T('sand'), '#d8c07a', 210, 100, 56, 22, 0.2); trees(4, 20, 30, 140, 70); stamp('objects/town_castle', 70, 118, 40); stamp('objects/dwelling_stronghold1', 190, 70, 30); stamp('objects/mine_gold', 250, 40, 24);
      for (let i = 0; i < 4; i++) stamp('poses/left/idle/orc', 30 + R() * 250, 70 + R() * 70, 30);
    } else {
      fill(T('grass'), '#5b8a3a'); blob(T('water'), '#2f6fb0', 40, 130, 90, 36, -0.2); blob(T('sand'), '#d8c07a', 150, 135, 40, 12); mounts(4, 170, 30, 285, 60); trees(9, 100, 45, 270, 115); stamp('objects/town_castle', 95, 118, 40); stamp('objects/mine_wood', 205, 90, 24); stamp('objects/chest', 255, 120, 20);
    }
    const sh = g.createLinearGradient(0, H * 0.55, 0, H); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.45)'); g.fillStyle = sh; g.fillRect(0, 0, W, H);
    const tint = { desert: '224,160,64', snow: '225,236,255', swamp: '70,90,40', lava: '200,70,20' }[biome]; if (tint) { g.fillStyle = `rgba(${tint},.34)`; g.fillRect(0, 0, W, H); }
    const url = c.toDataURL('image/jpeg', 0.82); prevCache[ck] = { url, full }; return url;
  }
  const facBanner = (k) => { const h = Art.facHue(k); return h === null ? '#6b4f24' : `hsl(${h},48%,30%)`; };
  const goalLine = (g) => g.type === 'gold' ? `Hold <b>${g.n.toLocaleString()}</b> gold before day ${g.days}` : g.type === 'towns' ? `Own <b>${g.n}</b> towns before day ${g.days}` : g.type === 'survive' ? `Hold a town until <b>day ${g.days}</b>` : 'Defeat every rival realm';
  function showScenarios(pick) {
    const cur = SCENARIOS.find(s => s.id === pick) || SCENARIOS[0];
    const tiles = SCENARIOS.map(s => `<div class="card scn${s === cur ? ' on' : ''}" data-sc="${s.id}"><img class="mprev" src="${mapPreview(s.map.preset, s.map.biome)}" alt="" draggable="false"><b>${s.icon} ${s.name}</b><div class="small">${DIFFICULTY[s.diff].icon} ${DIFFICULTY[s.diff].name} · ${SIZES[s.map.size].name} · ${s.map.ais} rival${s.map.ais > 1 ? 's' : ''}</div></div>`).join('');
    const tm = (cur.map.teams || []).filter(Boolean), ally = tm.filter(t => t === 'ally').length, bloc = tm.filter(t => t === 'bloc').length;
    const panel = `<div class="hspan scnpan"><img class="mprev" src="${mapPreview(cur.map.preset, cur.map.biome)}" alt="" draggable="false"><h3>${cur.icon} ${cur.name}</h3><div class="hscls">${DIFFICULTY[cur.diff].icon} ${DIFFICULTY[cur.diff].name}</div><p class="scnb">${cur.blurb}</p>
      <h4>Objective</h4><div class="scngoal">🎯 ${goalLine(cur.goal)}</div>
      <h4>Setup</h4><div class="hsspells"><span>${MAPS[cur.map.preset].name}</span><span>${SIZES[cur.map.size].name} ${SIZES[cur.map.size].w}×${SIZES[cur.map.size].h}</span><span>${cur.map.ais} rival${cur.map.ais > 1 ? 's' : ''}</span>${ally ? '<span>🤝 ally</span>' : ''}${bloc ? '<span>⚔⚔ allied rivals</span>' : ''}<span>Fog ${cur.map.fog === false ? 'off' : 'on'}</span>${cur.map.biome && cur.map.biome !== 'mixed' && cur.map.biome !== 'none' ? `<span>${cur.map.biome} lands</span>` : ''}${cur.bonus ? `<span>+${cur.bonus.gold} gold</span>` : ''}</div>
      <button class="primary hsgo" id="scGo">Choose your castle →</button></div>`;
    $('mbox').innerHTML = `<div class="setup"><h2>Scenarios <span class="small">ready-made maps with an objective</span></h2><div class="hsbody"><div class="grid scngrid">${tiles}</div>${panel}</div><div class="mb"><button id="sBack">Back</button></div></div>`;
    $('sBack').onclick = () => $('modal').classList.add('hide');
    $('mbox').querySelectorAll('[data-sc]').forEach(c => { c.onclick = () => showScenarios(c.dataset.sc); c.ondblclick = () => go(); });
    const go = () => showFactionSelect(cur.diff, { ...cur.map, color: 0, scn: cur });
    $('scGo').onclick = go; $('modal').classList.remove('hide');
  }
  function showFactionSelect(diff = 'normal', map = {}) {
    const need = Object.keys(FACTIONS).map(k => 'ui/town_' + k);
    const draw = () => {
      const cards = Object.entries(FACTIONS).map(([k, f]) => `<div class="card fac" data-f="${k}" style="--ban:${facBanner(k)}"><div class="facpic">${Assets.url('ui/town_' + k) ? `<img src="${Assets.url('ui/town_' + k)}" alt="" draggable="false">` : `<span class="facicon">${f.icon}</span>`}<div class="ribbon">${f.icon} ${f.name}</div></div>
        <div class="small blurb">${f.blurb}</div>
        <div class="crow">${factionTiers(k).map(id => `<span title="${C[id].n} → ${C[lineType(id, 2)].n}">${Art.pic(id, 44)}</span>`).join('')}</div></div>`).join('');
      $('mbox').innerHTML = `<div class="setup"><span data-bg="castle_select"></span><h2>Choose your castle <span class="small">${DIFFICULTY[diff].icon} ${DIFFICULTY[diff].name}</span></h2><div class="grid facgrid">${cards}</div><div class="mb"><button id="sBack">Back</button></div></div>`;
      $('sBack').onclick = () => map.scn ? showScenarios(map.scn.id) : showMapSelect(diff, map.preset ? map : undefined);
      $('mbox').querySelectorAll('.card').forEach(c => c.onclick = () => showHeroSelect(c.dataset.f, diff, map));
    };
    draw(); $('modal').classList.remove('hide');
    Assets.need(need).then(() => { if ($('mbox').querySelector('.facgrid')) draw(); });
  }
  function showHeroSelect(f, diff = 'normal', map = {}, pick) {
    const ti = factionTiers(f), list = FACTIONS[f].heroes.map(([n]) => Object.assign({ key: n }, HEROES[n])); pick = pick || list[0].key;
    const cur = list.find(d => d.key === pick) || list[0];
    const tiles = list.map(d => `<button class="htile${d === cur ? ' on' : ''}" data-hid="${d.key}">${Art.heroPic(d.i, ownCol(0), 84, d.id)}<span>${d.name}</span><small>${d.cls}</small></button>`).join('');
    const army = [[ti[0], 20], [ti[1], 10], [ti[2], 5]];
    const panel = `<div class="hspan"><div class="hsbig">${Art.heroPic(cur.i, ownCol(0), 150, cur.id)}</div><h3>${cur.name}</h3><div class="hscls">${cur.cls}${cur.sk ? ` · ${PERKS[cur.sk].i} ${PERKS[cur.sk].n}` : ''}</div>
      <div class="hsstats"><div><b>${cur.att}</b><span>Attack</span></div><div><b>${cur.def}</b><span>Defence</span></div><div><b>${cur.sp}</b><span>Spell power</span></div><div><b>${cur.kn}</b><span>Knowledge</span></div></div>
      <h4>Spells</h4><div class="hsspells">${[...START_SPELLS, ...cur.spells].map(k => `<span>${SPELLS[k].i} ${SPELLS[k].n}</span>`).join('')}</div>
      <h4>Starting army</h4><div class="hsarmy">${army.map(([id, n]) => `<div>${Art.pic(id, 60)}<small>${n} ${C[id].n}</small></div>`).join('')}</div>
      <button class="primary hsgo" id="hsGo">Play as ${cur.name}</button></div>`;
    $('mbox').innerHTML = `<div class="setup"><span data-bg="hero_select"></span><h2>${FACTIONS[f].icon} ${FACTIONS[f].name} — choose your hero</h2><div class="hsbody"><div class="hsgrid">${tiles}</div>${panel}</div>
      <div class="small">Your rival will command a different castle. Fight them across zones, forts and sieges.</div><div class="mb"><button id="sBack">Back</button></div></div>`;
    $('sBack').onclick = () => showFactionSelect(diff, map);
    const go = (id) => { $('modal').classList.add('hide'); $('title').classList.add('hide'); newGame(f, id, diff, map); };
    $('mbox').querySelectorAll('.htile').forEach(b => { b.onclick = () => showHeroSelect(f, diff, map, b.dataset.hid); b.ondblclick = () => go(b.dataset.hid); });
    $('hsGo').onclick = () => go(cur.key);
  }
  $('tNew').onclick = showDifficultySelect;
  $('tScn').onclick = () => showScenarios();
  $('tCont').onclick = () => { if (load()) $('title').classList.add('hide'); };
  $('tLoad').onclick = () => openSlots();
  $('tSet').onclick = () => openSettings();
  $('tAch').onclick = () => openAchievements();
  $('tBoard').onclick = () => openLeaderboard();
  $('tHelp').onclick = () => openHelp();
  async function exitToMenu() {
    if (!G || busy) return;
    const i = await showModal('<h2>Return to the main menu?</h2><p class="small">The game also autosaves at the start of every day.</p>', ['💾 Save & exit', 'Exit without saving', 'Cancel']);
    if (i === 2) return;
    if (i === 0) save();
    $('title').classList.remove('hide'); refreshTitle();
  }
  $('bMenu').onclick = () => openMenu();
  $('bKd').onclick = () => G && openKingdom();
  $('bSet').onclick = () => openSettings();
  $('bHelp').onclick = () => openHelp();
  $('bSave').onclick = () => G && !busy && openSlots();
  $('bEnd').onclick = endTurn;
  $('bTown').onclick = () => G && !busy && openTown();
  function fitZoom() { if (!G) return; setZoom(Math.min(cmap.width / ((G.W + 0.5) * TS), cmap.height / (G.H * RH + HR * 0.5)), 0, 0); clampCam(); }
  $('mEnd').onclick = endTurn;
  $('mTown').onclick = () => G && !busy && openTown();
  // phone action bar: the side panels open as sheets (the real elements are moved into the dialog and back, so they stay live)
  let sheetBack = null;
  const sheetOpen = (title, els) => {
    if (!G || busy) return;
    if (sheetBack) sheetBack();
    $('mbox').innerHTML = `<h2>${title}</h2><div id="sheetBody"></div><div class="mb"><button class="primary" id="shClose">Close</button></div>`;
    els.forEach(e => $('sheetBody').appendChild(e));
    sheetBack = () => { sheetBack = null; els.forEach(e => $('side').appendChild(e)); };
    $('modal').classList.remove('hide'); $('shClose').onclick = () => $('modal').classList.add('hide');
  };
  new MutationObserver(() => { if (sheetBack && !$('sheetBody')) sheetBack(); }).observe($('mbox'), { childList: true });
  new MutationObserver(() => { if (sheetBack && $('modal').classList.contains('hide')) sheetBack(); }).observe($('modal'), { attributes: true, attributeFilter: ['class'] });
  $('mHero').onclick = () => sheetOpen('🏇 Hero', [$('hero')]);
  $('mArmy').onclick = () => G && sheetOpen(`⚔️ ${G.hero.name} — Army`, [$('army')]);
  $('mGear').onclick = () => G && !busy && openEquip(G.hero);
  $('mLand').onclick = () => sheetOpen('🗺️ Territory', [$('mini'), $('terr')]);
  $('mMenu').onclick = () => openMenu();

  // custom art from art/ finished loading: rebuild every cached picture, set the title artwork
  document.addEventListener('assets-ready', () => {
    try { Art.reload(); TownArt.reload(); Icons.reload(); } catch (e) { /* ignore */ }
    document.body.classList.toggle('skin', Assets.has('ui/btn_normal') && Assets.has('ui/frame_scroll'));
    const bg = Assets.get('ui/title'); if (bg) $('title').style.background = `url(${bg.src}) center / cover no-repeat`;
    const logo = Assets.get('ui/logo'); if (logo) { const h1 = document.querySelector('#title h1'); if (h1) h1.innerHTML = `<img src="${logo.src}" alt="Day &amp; Night" style="max-width:100%;max-height:150px">`; }
    if (G) { buildTerrain(); renderAll(); }
  });
  document.addEventListener('assets-progress', (e) => { const d = e.detail, el = $('loadmsg'); if (el) el.textContent = d.done >= d.total ? '' : 'Loading art… ' + Math.round(100 * d.done / d.total) + '%'; });
  // some screens carry a data-bg marker: the picture behind the dialog comes from art/ui/<name>
  new MutationObserver(() => { const mk = $('mbox').querySelector('[data-bg]'), u = mk && Assets.url('ui/' + mk.dataset.bg); $('mbox').style.backgroundImage = u ? 'linear-gradient(rgba(14,9,4,.72), rgba(14,9,4,.86)), url(' + u + ')' : ''; $('mbox').style.backgroundSize = 'cover'; $('mbox').style.backgroundPosition = 'center'; }).observe($('mbox'), { childList: true });
  // ==== UI SCREENS ====
  const modalOpen = (html) => { $('mbox').innerHTML = html; $('modal').classList.remove('hide'); };
  const closeModal = () => { $('modal').classList.add('hide'); renderAll(); };
  const when = (t) => { const d = new Date(t), p = (n) => String(n).padStart(2, '0'); return `${d.getDate()}/${d.getMonth() + 1} ${p(d.getHours())}:${p(d.getMinutes())}`; };

  function openMenu() {
    if (!G) return;
    modalOpen(`<h2>☰ Menu</h2><div class="menugrid">
      <button data-mn="save">💾 Save / Load</button><button data-mn="set">⚙ Settings</button>
      <button data-mn="kd">📋 Kingdom</button><button data-mn="ach">🏆 Achievements</button>
      <button data-mn="lb">📊 Leaderboard</button><button data-mn="hint">💡 Hints on/off</button>
      <button data-mn="rep">📜 Turn report</button><button data-mn="help">📖 Help & glossary</button>
      <button data-mn="snd">${Sfx.on ? '🔇 Sound off' : '🔊 Sound on'}</button><button data-mn="fit">🗺 Zoom to fit</button>
      <button data-mn="exit">🚪 Main menu</button></div><div class="mb"><button class="primary" id="mnClose">Resume</button></div>`);
    $('mnClose').onclick = closeModal;
    $('mbox').querySelectorAll('[data-mn]').forEach(b => b.onclick = () => {
      const k = b.dataset.mn;
      if (k === 'save') openSlots(); else if (k === 'set') openSettings(); else if (k === 'kd') openKingdom(); else if (k === 'ach') openAchievements(); else if (k === 'lb') openLeaderboard(); else if (k === 'hint') { Settings.set('hints', !Settings.hints); if (Settings.hints) Settings.resetHints(); toast(Settings.hints ? 'Hints on.' : 'Hints off.'); }
      else if (k === 'rep') openReport(); else if (k === 'help') openHelp();
      else if (k === 'snd') { Sfx.toggle(); $('bSnd').textContent = Sfx.on ? '🔊' : '🔇'; openMenu(); }
      else if (k === 'fit') { closeModal(); fitZoom(); } else if (k === 'exit') { $('modal').classList.add('hide'); exitToMenu(); }
    });
  }

  // ---- first-game hints ----
  const HINTS = [
    ['path', () => !G.flags || !G.flags.moved, '👆 <b>Move your hero:</b> tap a tile to preview the route (dotted trail, red ✖ = destination), then tap it again to walk there.'],
    ['tags', () => G.flags && G.flags.moved, '🟢🔴 <b>Coloured dots</b> beside monsters and guarded places show how dangerous they are for your army — from Trivial (green) to Deadly (red). Tap or hover anything for details.'],
    ['town', () => G.day <= 3 && G.flags && G.flags.moved && !G.flags.town, '🏰 <b>Open your Town</b> (🏰 button) and recruit troops — a bigger army makes every fight safer. Heroes can also take units from the garrison.'],
    ['hall', () => myTowns().some(t => !t.b.hall) && G.res.gold >= HALL_LEVELS[1].cost && G.day > 1, '🏛 <b>Build a Town Hall</b> (Buildings tab): it pays gold every day and unlocks stronger creatures and upgrades.'],
    ['mines', () => G.day >= 3, '⛏ <b>Mines</b> give daily income only while you also hold the <i>zone</i> they lie in — capture the zone\'s town or fort. 📋 Kingdom → Details shows what pays and what does not.'],
    ['hero2', () => G.heroes.length === 1 && G.res.gold >= HIRE_COST && G.day > 2, '🍺 <b>Hire a second hero</b> in the Tavern (Town → Buildings) to explore and fight on two fronts.'],
    ['save', () => G.day >= 4, '💾 The game <b>autosaves every day</b>. Use ☰ Menu → Save / Load for extra slots, and ⚙ Settings for animation speed and more.'],
    ['expand', () => myTowns().length >= 2, '🚚 With several castles you can <b>send troops</b> between them (Town → Warriors → Send troops) — they arrive after a few days.'],
  ];
  let hintShown = false, hintTimer = null;
  function checkHints() {
    if (hintShown || !Settings.hints || !G || G.over || busy || document.body.classList.contains('inbattle') || !$('modal').classList.contains('hide') || !$('title').classList.contains('hide')) return;
    const hint = HINTS.find(([id, cond]) => !Settings.hintsSeen[id] && (() => { try { return cond(); } catch (e) { return false; } })());
    if (!hint) return;
    hintShown = true; $('hintTxt').innerHTML = hint[2]; $('hint').classList.remove('hide');
    const done = (off) => { clearTimeout(hintTimer); Settings.seen(hint[0]); if (off) Settings.set('hints', false); $('hint').classList.add('hide'); hintShown = false; };
    $('hintOk').onclick = () => done(false); $('hintOff').onclick = () => done(true);
    hintTimer = setTimeout(() => done(false), 14000);
  }
  setInterval(checkHints, 2500);

  // ---- glossary + help ----
  const GLOSSARY = [
    ['Morale', 'Each point gives your creatures a 4% chance of an extra turn (negative: a 4% chance to lose one). Mixing creatures of different castles lowers it; undead and golems are immune.'],
    ['Luck', 'Each point gives a 4% chance of double damage (bad luck: half).'],
    ['Retaliation', 'A creature that is attacked in melee hits back once per round, unless the attacker has "no retaliation" or the defender already retaliated.'],
    ['Zones', 'The map is divided into zones, each ruled from a town or fort. Mines pay you only while you hold their zone.'],
    ['Threat tags', 'The coloured dot next to a guard compares its strength with your selected hero\'s army: Trivial, Easy, Even, Hard, Deadly. It is an estimate, not a promise.'],
    ['Outposts', 'Dwellings and the Dragon Lair you have conquered deliver their weekly recruits to every castle — buy them in the Warriors tab.'],
    ['Dragon Lair', 'Guarded by a dragon horde. Conquer it to buy the Glimmerdrake, Corrosion, Prism and Sapphire Wyrms, found in no castle.'],
    ['Caravans', 'Troops sent from one castle garrison to another travel for several days, depending on distance.'],
    ['Rarity colours', 'The frame of a creature portrait shows its rarity: Common (bronze), Uncommon (green), Rare (blue), Epic (purple), Legendary (gold), Mythic (red), Ancient (silver), Divine (prismatic). Stars show the upgrade level.'],
    ['Surrender & ransom', 'A hopelessly outmatched rival hero may offer gold to be let go. If you are the outmatched one, you can pay a ransom and retreat to your nearest castle with your army intact.'],
    ['Siege', 'Attacking a town or fort means storming walls, a gate, a moat and arrow towers; Fortifications make them stronger and minefields hurt attackers.'],
    ['Spell schools', 'Air, Earth, Fire and Water skills raise the rank of their spells. Wisdom unlocks higher-level spells; Sorcery and Mysticism help spell power and mana.'],
    ['Charisma', 'Weak monsters can join you instead of fighting when your army is much stronger.'],
    ['Broken arrow', 'Archers shoot best point-blank; beyond 10 hexes their damage is halved.'],
  ];
  function openHelp(g) {
    modalOpen(HELP.replace('</p>\n', '</p>\n') + `<div class="mb"><button id="hlGl">📖 Glossary</button><button class="primary" id="hlOk">Close</button></div>`);
    $('hlOk').onclick = () => { if (G && $('title').classList.contains('hide')) openMenu(); else $('modal').classList.add('hide'); };
    $('hlGl').onclick = () => {
      modalOpen(`<h2>📖 Glossary</h2>${GLOSSARY.map(([t, d]) => `<details><summary><b>${t}</b></summary><p class="small" style="margin:4px 0 8px">${d}</p></details>`).join('')}<div class="mb"><button class="primary" id="glBack">Back</button></div>`);
      $('glBack').onclick = () => openHelp();
    };
  }

  // ---- score + leaderboard ----
  function scoreParts() {
    const towns = myTowns().length, lv = G.heroes.reduce((p, x) => p + x.lvl, 0), st = G.st || {};
    const parts = [['Towns held', towns * 500], ['Hero levels', lv * 150], ['Creatures slain', (st.slain || 0) * 3], ['Battles won', (st.battles || 0) * 40], ['Gold earned', Math.round((st.gold || 0) * 0.1)], ['Speed bonus (win before day 90)', Math.max(0, 90 - G.day) * 100], ['Victory', 3000]];
    const mult = ({ easy: 0.6, normal: 1, hard: 1.5, expert: 2.2 }[G.diff] || 1) * ({ small: 0.7, medium: 1, large: 1.3, huge: 1.6, giant: 2 }[G.size] || 1) * (1 + 0.25 * (Math.max(1, G.ais.filter(a => !allyOfPlayer(a.id)).length) - 1));
    return { parts, mult, score: Math.min(1400000, Math.round(parts.reduce((p, x) => p + x[1], 0) * mult)) };
  }
  async function victoryScreen() {
    const sc = scoreParts();
    await new Promise((res) => {
      modalOpen(`<h2>🏆 Victory!</h2><p>Every rival has lost its towns: you rule the realm on day ${G.day} (${DF().name}).</p><h4>Score</h4>${sc.parts.map(([l, v]) => `<div class="trow" style="grid-template-columns:1fr auto"><div>${l}</div><div>+${fmtN(v)}</div></div>`).join('')}
        <div class="trow" style="grid-template-columns:1fr auto"><div>Difficulty × map size × rivals</div><div>×${sc.mult.toFixed(2)}</div></div>
        <div class="trow" style="grid-template-columns:1fr auto"><div><b>Final score</b></div><div><b style="color:var(--gold);font-size:22px">${fmtN(sc.score)}</b></div></div>
        <div class="setrow"><div><b>Your name</b><div class="small">Shown on the leaderboard</div></div><input id="lbName" maxlength="16" value="${Board.name.replace(/"/g, '')}" placeholder="Commander" style="width:170px"></div>
        <div class="mb"><button id="lbSkip">Skip</button><button class="primary" id="lbSend">Submit score</button></div>`);
      $('lbSkip').onclick = () => { $('modal').classList.add('hide'); res(); };
      $('lbSend').onclick = async () => {
        const name = ($('lbName').value || '').trim() || 'Commander'; Board.name = name; $('lbSend').disabled = true; $('lbSend').textContent = 'Sending…';
        const r = await Board.submit({ name, score: sc.score, diff: G.diff, size: G.size, day: G.day, fac: G.faction, hero: G.hero.name });
        toast(r.ok ? 'Score submitted to the global board!' : 'Saved on this device (the global board is unavailable).');
        openLeaderboard(r.ok ? 'global' : 'local', { diff: G.diff, size: G.size }); res();
      };
    });
  }
  let lbTab = 'global', lbF = {};
  async function openLeaderboard(tab, f) {
    if (tab) lbTab = tab; if (f) lbF = f;
    const seg = (key, opts) => '<div class="seg">' + opts.map(([v, l]) => `<button data-lf="${key}:${v}" class="${(lbF[key] || '') === v ? 'on' : ''}">${l}</button>`).join('') + '</div>';
    modalOpen(`<h2>📊 Leaderboard</h2><div class="seg" style="margin-bottom:8px"><button data-lt="global" class="${lbTab === 'global' ? 'on' : ''}">🌍 Global</button><button data-lt="local" class="${lbTab === 'local' ? 'on' : ''}">📱 This device</button></div>
      <div class="small">Difficulty</div>${seg('diff', [['', 'All'], ['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard'], ['expert', 'Expert']])}
      <div class="small" style="margin-top:6px">Map size</div>${seg('size', [['', 'All'], ['small', 'S'], ['medium', 'M'], ['large', 'L'], ['huge', 'XL'], ['giant', 'XXL']])}
      <div id="lbList" style="margin-top:10px"><div class="small">Loading…</div></div><div class="mb"><button class="primary" id="lbBack">Close</button></div>`);
    $('lbBack').onclick = () => { if (G && $('title').classList.contains('hide')) openMenu(); else $('modal').classList.add('hide'); };
    $('mbox').querySelectorAll('[data-lt]').forEach(b => b.onclick = () => openLeaderboard(b.dataset.lt));
    $('mbox').querySelectorAll('[data-lf]').forEach(b => b.onclick = () => { const [k, v] = b.dataset.lf.split(':'); lbF = Object.assign({}, lbF, { [k]: v }); openLeaderboard(); });
    let list, note = '';
    if (lbTab === 'global') {
      const r = await Board.global(lbF);
      if (r.ok) list = r.list; else { list = Board.local(lbF); note = r.status === 503 ? 'The online leaderboard is not set up on this server yet — showing the scores on this device.' : 'Could not reach the online leaderboard — showing the scores on this device.'; }
    } else list = Board.local(lbF);
    if (!$('lbList')) return;
    const me = Board.name.toLowerCase();
    $('lbList').innerHTML = (note ? `<div class="small" style="color:#ffb3a8;margin-bottom:6px">${note}</div>` : '') + (list.length ? list.slice(0, 50).map((e, i) => `<div class="lbrow${me && String(e.n).toLowerCase() === me ? ' me' : ''}"><div class="lbrank r${i < 3 ? i + 1 : 0}">${i + 1}</div><div><b>${String(e.n).replace(/[<>&]/g, '')}</b><div class="small">${(DIFFICULTY[e.d] || { name: e.d }).name} · ${(SIZES[e.z] || { name: e.z }).name} · day ${e.y} · ${FACTIONS[e.f] ? FACTIONS[e.f].name : ''}${e.h ? ' · ' + String(e.h).replace(/[<>&]/g, '') : ''}</div></div><div class="lbscore">${fmtN(e.s)}</div></div>`).join('') : '<div class="small">No scores yet — win a game to enter the board!</div>');
  }

  // ---- achievements screen ----
  function openAchievements() {
    const defs = Ach.DEFS, got = defs.filter(d => Ach.unlocked[d.id]).length, cats = [...new Set(defs.map(d => d.cat))];
    const card = (d) => { const on = !!Ach.unlocked[d.id], cur = Ach.progress(d);
      return `<div class="achrow${on ? ' on' : ''}">${on ? Icons.glyphHtml(d.g, d.hue, 42) : Icons.lockedHtml(42)}<div><b>${d.name}</b><div class="small">${d.desc}</div>${on ? `<div class="small" style="color:var(--good)">Unlocked ${when(Ach.unlocked[d.id])}</div>` : `<div class="bar"><i style="width:${Math.round(100 * cur / d.target)}%;background:#d6a43a"></i></div><div class="small">${fmtN(cur)} / ${fmtN(d.target)}</div>`}</div></div>`; };
    modalOpen(`<h2>🏆 Achievements <span class="small">${got}/${defs.length}</span></h2><div class="bar"><i style="width:${Math.round(100 * got / defs.length)}%;background:#6fd36f"></i></div>${cats.map(c => `<h4>${c}</h4><div class="achgrid">${defs.filter(d => d.cat === c).map(card).join('')}</div>`).join('')}<div class="mb"><button class="primary" id="acBack">Close</button></div>`);
    $('acBack').onclick = () => { if (G && $('title').classList.contains('hide')) openMenu(); else $('modal').classList.add('hide'); };
  }

  // ---- income breakdown ----
  const cap = (k) => k[0].toUpperCase() + k.slice(1);
  function openIncome(back) {
    const mm = (G.wk && G.wk.mineMul) || 1, mul = DF().income, lines = [];
    for (const t of myTowns()) if (t.b.hall) lines.push({ l: `🏛 ${t.name} — ${HALL_LEVELS[t.b.hall].n}`, r: { gold: HALL_LEVELS[t.b.hall].inc } });
    for (const h of G.heroes) if (perk(h, 'estates')) lines.push({ l: `🏠 ${h.name} — Estates`, r: { gold: 300 * perk(h, 'estates') } });
    for (const o of G.objs) {
      if (o.t === 'mine' && o.owner === 0) { const ok = zoneOwner(G, G.zone[o.y][o.x]) === 0; lines.push({ l: `⛏ ${cap(o.kind)} mine`, r: ok ? { [o.kind]: MINE_YIELD[o.kind] * mm } : {}, warn: ok ? '' : 'pays nothing — you do not hold its zone (capture the fort or town of that zone)', x: o.x, y: o.y }); }
      if (o.t === 'fort' && o.owner === 0) lines.push({ l: `🏯 ${o.name}`, r: { gold: FORT_INCOME } });
    }
    const gain = computeGain(), fmt = (r) => Object.keys(r).filter(k => r[k]).map(k => `+${Math.round(r[k] * mul)}${RES_ICON[k]}`).join(' ') || '—';
    modalOpen(`<h2>📈 Daily income</h2><div class="small">Difficulty multiplier ×${mul}${mm > 1 ? ' · Bountiful Harvest ×' + mm : ''}</div>${lines.length ? lines.map(x => `<div class="trow" style="grid-template-columns:1fr auto"><div>${x.l}${x.warn ? `<div class="small" style="color:#ffb3a8">⚠ ${x.warn}</div>` : ''}</div><div>${fmt(x.r)}</div></div>`).join('') : '<p class="small">No income yet — build a Town Hall and capture mines.</p>'}
      <div class="trow" style="grid-template-columns:1fr auto"><div><b>Total per day</b></div><div><b>${RES.filter(k => gain[k]).map(k => `+${gain[k]}${RES_ICON[k]}`).join(' ') || '—'}</b></div></div><div class="mb"><button class="primary" id="inOk">${back ? 'Back' : 'Close'}</button></div>`);
    $('inOk').onclick = () => back ? back() : closeModal();
  }
  $('income').onclick = () => G && openIncome(); $('res').onclick = () => G && openIncome();

  // ---- Kingdom overview: every town, hero and holding at a glance ----
  function openKingdom() {
    if (!G) return;
    const gain = computeGain(), towns = myTowns(), locBtn = (x, y) => `<button data-loc="${x}:${y}" title="Show on the map">📍</button>`;
    const power = G.heroes.reduce((p, h) => p + armyValue(h.army), 0) + towns.reduce((p, t) => p + armyValue(t.garrison), 0);
    const tRows = towns.map(t => { const rec = Object.entries(t.avail || {}).filter(([k]) => t.b[k]).reduce((p, [, v]) => p + v, 0), gar = t.garrison.reduce((p, a) => p + (a ? a.n : 0), 0);
      return `<div class="trow" style="grid-template-columns:42px 1fr auto"><div class="ic">${TownArt.pic('hall', Math.max(1, t.b.hall), t.fac, 38)}</div><div><b>${t.name}</b> <span class="small">${FACTIONS[t.fac].name} · ${t.b.hall ? HALL_LEVELS[t.b.hall].n : 'Settlement'} · ${FORT_LEVELS[t.fort || 0].n}</span><br><span class="small">Garrison ${gar} · recruits waiting ${rec}</span></div><div class="acts"><button data-kt="${towns.indexOf(t)}">Open</button>${locBtn(t.x, t.y)}</div></div>`; }).join('');
    const hRows = G.heroes.map((h, i) => `<div class="trow" style="grid-template-columns:42px 1fr auto"><div class="ic">${Art.heroPic(h.icon, ownCol(0), 38, h.pid)}</div><div><b>${h.name}</b> <span class="small">${h.cls} L${h.lvl}${h.sleep ? ' · 💤' : ''}</span><br><span class="small">${armyList(h.army, false) || 'no army'} · move ${Math.round(100 * h.move / maxMove(h))}%</span></div><div class="acts"><button data-kh="${i}">Select</button>${locBtn(h.x, h.y)}</div></div>`).join('');
    const holds = G.objs.filter(o => o.owner === 0 && (o.t === 'mine' || o.t === 'fort' || o.t === 'dwelling' || o.t === 'lair')).map(o => {
      const nm = o.t === 'mine' ? `⛏ ${cap(o.kind)} mine${zoneOwner(G, G.zone[o.y][o.x]) === 0 ? '' : ' ⚠ not paying'}` : o.t === 'fort' ? `🏯 ${o.name}` : o.t === 'lair' ? '🐲 Dragon Lair' : `🛖 ${C[dwId(o)].n} dwelling (${o.avail})`;
      return `<div class="trow" style="grid-template-columns:1fr auto"><div>${nm}</div><div class="acts">${locBtn(o.x, o.y)}</div></div>`; }).join('');
    const cars = (G.caravans || []).map(c => `<div class="small">🚚 ${armyList(c.army, false)} → ${(townAt(c.tx, c.ty) || { name: '?' }).name} in ${c.eta} day${c.eta === 1 ? '' : 's'}</div>`).join('');
    modalOpen(`<h2>📋 Kingdom</h2><div class="small">Day ${G.day} · ${towns.length} town${towns.length === 1 ? '' : 's'} · ${G.heroes.length} hero${G.heroes.length === 1 ? '' : 'es'} · army strength ${fmtN(Math.round(power))}</div>
      <div class="trow" style="grid-template-columns:1fr auto"><div>📈 <b>Income per day</b> ${RES.filter(k => gain[k]).map(k => `+${fmtN(gain[k])}${RES_ICON[k]}`).join(' ') || '—'}</div><div class="acts"><button id="kdInc">Details</button></div></div>
      <h4>Towns</h4>${tRows || '<div class="small">none</div>'}<h4>Heroes</h4>${hRows}<h4>Realms</h4>${G.ais.map(ai => `<div class="trow" style="grid-template-columns:1fr auto"><div><span class="zdot" style="background:${ownCol(ai.id)};color:${ownCol(ai.id)}"></span><b>${FACTIONS[ai.fac].name}</b> ${allyOfPlayer(ai.id) ? '🤝 ally' : teamOf(ai.id) === 2 ? '⚔⚔ enemy bloc' : '⚔ enemy'}</div><div class="small">${ai.alive ? G.objs.filter(o => o.t === 'town' && o.owner === ai.id).length + ' towns' : 'eliminated'}</div></div>`).join('')}<h4>Holdings</h4>${holds || '<div class="small">No mines, forts or dwellings yet.</div>'}${cars ? '<h4>On the road</h4>' + cars : ''}
      <div class="mb"><button class="primary" id="kdOk">Close</button></div>`);
    $('kdOk').onclick = closeModal; $('kdInc').onclick = () => openIncome(openKingdom);
    $('mbox').querySelectorAll('[data-loc]').forEach(b => b.onclick = () => { const [x, y] = b.dataset.loc.split(':').map(Number); closeModal(); centerOn(x, y); });
    $('mbox').querySelectorAll('[data-kt]').forEach(b => b.onclick = () => openTown(towns[+b.dataset.kt]));
    $('mbox').querySelectorAll('[data-kh]').forEach(b => b.onclick = () => { setActive(+b.dataset.kh); G.path = null; closeModal(); centerOn(G.hero.x, G.hero.y); });
  }

  // ---- settings ----
  function openSettings() {
    const S = Settings, seg = (key, opts) => '<div class="seg">' + opts.map(([v, l]) => `<button data-sg="${key}:${v}" class="${String(S[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('') + '</div>';
    const row = (label, ctl, note) => `<div class="setrow"><div><b>${label}</b>${note ? `<div class="small">${note}</div>` : ''}</div>${ctl}</div>`;
    modalOpen(`<h2>⚙ Settings</h2>${row('Animation speed', seg('animSpeed', [[1, '1×'], [1.5, '1.5×'], [2, '2×'], [3, '3×']]), 'Battles and walking')}
      ${row('Sound effects', `<input type="range" min="0" max="100" value="${Math.round(S.sfxVol * 100)}" data-rg="sfxVol">`)}
      ${row('Music', `<input type="range" min="0" max="100" value="${Math.round(S.musicVol * 100)}" data-rg="musicVol">`)}
      ${row('Interface size', seg('uiScale', [[1, 'Normal'], [1.15, 'Large'], [1.3, 'Huge']]))}
      ${row('Left-handed layout', seg('leftHand', [[false, 'Off'], [true, 'On']]), 'Mirrors the phone buttons')}
      ${row('Vibration', seg('haptics', [[true, 'On'], [false, 'Off']]), 'Phones only')}
      ${row('Warn before deadly fights', seg('confirmDanger', [[true, 'On'], [false, 'Off']]), 'Asks before attacking something far stronger than you')}
      ${row('Confirm before ending a turn', seg('confirmEnd', [[true, 'On'], [false, 'Off']]), 'Warns about idle heroes and unspent recruits')}
      ${row('Hints', seg('hints', [[true, 'On'], [false, 'Off']]), '<a href="#" id="stReset">Show all hints again</a>')}
      <div class="mb"><button class="primary" id="stClose">Done</button></div>`);
    $('stClose').onclick = () => { if (G && $('title').classList.contains('hide')) openMenu(); else $('modal').classList.add('hide'); };
    $('mbox').querySelectorAll('[data-sg]').forEach(b => b.onclick = () => { const [k, v] = b.dataset.sg.split(':'); S.set(k, v === 'true' ? true : v === 'false' ? false : parseFloat(v)); sfx('click'); openSettings(); });
    $('mbox').querySelectorAll('[data-rg]').forEach(r => r.oninput = () => { S.set(r.dataset.rg, r.value / 100); if (r.dataset.rg === 'sfxVol') sfx('click'); });
    $('stReset').onclick = (e) => { e.preventDefault(); S.resetHints(); toast('Hints will appear again.'); };
  }

  // ---- save / load slots ----
  function openSlots() {
    const inGame = !!G && $('title').classList.contains('hide');
    const keys = [[SAVE, 'Autosave'], ['h3js_slot_1', 'Slot 1'], ['h3js_slot_2', 'Slot 2'], ['h3js_slot_3', 'Slot 3']];
    const rows = keys.map(([k, label]) => {
      let m = null; try { m = JSON.parse(localStorage.getItem(k + '_meta') || 'null'); } catch (e) { /* ignore */ }
      const has = !!localStorage.getItem(k), info = has ? (m ? `Day ${m.day} · ${m.hero} (${FACTIONS[m.fac] ? FACTIONS[m.fac].name : m.fac}) · ${m.towns} town${m.towns === 1 ? '' : 's'} · ${when(m.t)}` : 'Saved game') : '<span class="small">empty</span>';
      return `<div class="trow" style="grid-template-columns:70px 1fr auto"><div><b>${label}</b></div><div class="small">${info}</div><div class="acts">${inGame && k !== SAVE ? `<button data-sv="${k}">Save</button>` : ''}${has ? `<button data-ld="${k}">Load</button>` : ''}${has && k !== SAVE ? `<button data-dl="${k}" title="Delete">🗑</button>` : ''}</div></div>`; }).join('');
    modalOpen(`<h2>💾 Save / Load</h2><div class="small">The game autosaves at the start of every day.</div>${rows}<div class="mb"><button class="primary" id="slClose">${inGame ? 'Back' : 'Close'}</button></div>`);
    $('slClose').onclick = () => { if (inGame) openMenu(); else $('modal').classList.add('hide'); };
    $('mbox').querySelectorAll('[data-sv]').forEach(b => b.onclick = () => { toast(saveTo(b.dataset.sv) ? 'Saved.' : 'Save failed.'); openSlots(); });
    $('mbox').querySelectorAll('[data-dl]').forEach(b => b.onclick = () => { localStorage.removeItem(b.dataset.dl); localStorage.removeItem(b.dataset.dl + '_meta'); openSlots(); });
    $('mbox').querySelectorAll('[data-ld]').forEach(b => b.onclick = () => { if (load(b.dataset.ld)) { $('modal').classList.add('hide'); $('title').classList.add('hide'); toast('Game loaded.'); } else toast('Could not load that save.'); });
  }

  // Android (Capacitor) hardware back button: close the open dialog, else ask to leave the game, else exit the app
  const CapApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (CapApp && CapApp.addListener) CapApp.addListener('backButton', () => {
    if (!$('modal').classList.contains('hide')) { const b = [...$('mbox').querySelectorAll('button')].find(x => /^(close|cancel|back|leave|ok|not now|leave town)/i.test(x.textContent.replace(/^[^A-Za-z]+/, '').trim())); if (b) b.click(); else $('modal').classList.add('hide'); return; }
    if (document.body.classList.contains('inbattle')) return;
    if (!$('title').classList.contains('hide')) return CapApp.exitApp();
    if (G) openMenu();
  });

  // menu music while the title screen is up
  const syncMood = () => { if (document.body.classList.contains('inbattle')) return; Sfx.mood($('title').classList.contains('hide') ? 'map' : 'menu'); };
  new MutationObserver(syncMood).observe($('title'), { attributes: true, attributeFilter: ['class'] });
  syncMood();

  refreshTitle();
  requestAnimationFrame(loop);
  window.__G = () => G;
  window.__dbg = { negotiate, fightAiHero, centerOn, interact, renderAll, newGame, fight, gainXp, openTown, view: () => ({ Z, VW, VH, cam: { ...cam } }) };
})();
