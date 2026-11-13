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
  let G = null, cam = { x: 0, y: 0 }, hover = null, busy = false, selSlot = -1, terrain = null, tsc = 1;
  const DPR = () => Math.min(2, window.devicePixelRatio || 1);
  const RM = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

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
  // war and peace: with diplomacy on, rivals are at peace until somebody declares war (G.rel); without it everyone not allied is an enemy
  const relKey = (a, b) => (a < b ? a + '_' + b : b + '_' + a);
  const atWar = (a, b) => { if (a === null || a === undefined || b === null || b === undefined) return true; if (a === b || isAlly(a, b)) return false; if (!G.dip) return true; const r = (G.rel || {})[relKey(a, b)]; return !!r && r.s === 'war'; };
  const peaceWithPlayer = (o) => o === 0 || (o !== null && o !== undefined && !atWar(0, o));
  const ownFill = (o, a) => { const c = ownCol(o); return `rgba(${parseInt(c.slice(1, 3), 16)},${parseInt(c.slice(3, 5), 16)},${parseInt(c.slice(5, 7), 16)},${a})`; };
  const armyCount = (h) => h.army.reduce((s, a) => s + (a ? a.n : 0), 0);
  const maxMana = (h) => eff(h, 'kn') * 10 + 15 * perk(h, 'wisdom') + (h.arts ? artBonus(h).mana : 0);
  const heroMorale = (h) => {
    const facs = new Set(h.army.filter(Boolean).map(a => C[a.t].fac).filter(Boolean));
    return Math.max(-3, Math.min(3, perk(h, 'leadership') - Math.max(0, facs.size - 1) + (h.arts ? artBonus(h).morale : 0) + (h.buff ? h.buff.morale : 0)));
  };
  const heroLuck = (h) => Math.max(-3, Math.min(3, perk(h, 'fortune') + (h.arts ? artBonus(h).luck : 0) + (h.buff ? h.buff.luck : 0)));
  const capsOf = (h) => ({ forest: perk(h, 'forester'), mount: perk(h, 'mountaineer'), water: perk(h, 'waterwalk'), nav: perk(h, 'navigation'), block: borderBlock(0, h.x, h.y) });
  const sgn = (n) => (n > 0 ? '+' : '') + n;
  const sizeMv = () => (G && SIZES[G.size] && SIZES[G.size].mv) || 1;
  const maxMove = (h) => Math.round(MOVE_PER_DAY * sizeMv() * (1 + 0.1 * perk(h, 'logistics') + (h.arts ? artBonus(h).move : 0) / 100));
  const need = (l) => 150 * l * l;
  const heroesAt = (x, y) => G.heroes.filter(h => h.x === x && h.y === y);
  const heroAtTown = (h) => !!townAt(h.x, h.y);
  const dist = (a, b) => { let dx = Math.abs(a.x - b.x); if (WRAP_W && dx > WRAP_W / 2) dx = WRAP_W - dx; return Math.max(dx, Math.abs(a.y - b.y)); };
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
  // full screen (web): the map and battles get the whole display; hidden where the browser has no Fullscreen API (e.g. iPhone) or the app is installed
  const fsEl = document.documentElement, fsOn = () => document.fullscreenElement || document.webkitFullscreenElement;
  function toggleFs() { try { if (fsOn()) (document.exitFullscreen || document.webkitExitFullscreen).call(document); else (fsEl.requestFullscreen || fsEl.webkitRequestFullscreen).call(fsEl); } catch (e) { /* ignore */ } }
  if (!(fsEl.requestFullscreen || fsEl.webkitRequestFullscreen) || window.Capacitor || matchMedia('(display-mode: standalone)').matches) $('bFs').style.display = 'none';
  $('bFs').onclick = toggleFs;
  // phones: the first tap on the game hides the address bar (full screen), once per visit; the full screen button leaves it again
  if (matchMedia('(pointer: coarse)').matches && (fsEl.requestFullscreen || fsEl.webkitRequestFullscreen) && !window.Capacitor && !matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches) {
    const auto = () => { document.removeEventListener('pointerup', auto, true); try { if (!fsOn()) { const r = (fsEl.requestFullscreen || fsEl.webkitRequestFullscreen).call(fsEl, { navigationUI: 'hide' }); if (r && r.catch) r.catch(() => {}); } } catch (e) { /* ignore */ } };
    document.addEventListener('pointerup', auto, true);
  }
  const fsSync = () => { $('bFs').textContent = fsOn() ? '🗗' : '⛶'; $('bFs').title = fsOn() ? 'Exit full screen (F)' : 'Full screen (F)'; };
  document.addEventListener('fullscreenchange', fsSync); document.addEventListener('webkitfullscreenchange', fsSync);
  document.addEventListener('keydown', (e) => { if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName || '')) toggleFs(); });
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
  // every hero starts with a different band: 3 stacks from tiers 1-4 chosen by the hero (might heroes lean on the front line,
  // magic heroes on shooters and flyers), all worth about the same as the old 20/10/5 start
  function startArmy(def, fac, mul = 1) {
    const ti = factionTiers(fac), hs = (s) => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); }, r = hs(def.id + def.name);
    const V0 = (20 * C[ti[0]].v + 10 * C[ti[1]].v + 5 * C[ti[2]].v) * mul, arch = CLASS_ARCH[def.cls] || 'might';
    const PERM = []; for (const p of [1, 2, 3, 4]) for (const q of [1, 2, 3, 4]) for (const s of [1, 2, 3, 4]) if (p !== q && q !== s && p !== s) PERM.push([p, q, s]);
    const need = arch === 'magic' ? 2 : arch === 'ranger' ? 3 : 1, SETS = PERM.filter(s => s.includes(need));
    const set = SETS[r % SETS.length].slice(); if (arch === 'magic' && r % 5 === 0) set[2] = 5;
    const SH = [[0.42, 0.33, 0.25], [0.42, 0.25, 0.33], [0.33, 0.42, 0.25], [0.25, 0.42, 0.33], [0.33, 0.25, 0.42], [0.25, 0.33, 0.42]], shares = SH[(r >> 5) % 6];
    const army = set.map((t, i) => ({ t: ti[t - 1], n: Math.max(1, Math.round(V0 * shares[i] / C[ti[t - 1]].v)) }));
    while (army.length < 7) army.push(null);
    return army;
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
  function openEquip(h, sel) {
    const b = artBonus(h), others = heroesAt(h.x, h.y).filter(x => x !== h);
    const TIERC = ['#8a8a8a', '#8a8a8a', '#5fbf5f', '#4a90e0', '#b060e8', '#f0a030'];
    const tile = (kind, k, a, label, glyph = '') => `<button class="eqt${a ? ' full' : ''}${sel && sel.kind === kind && sel.k === k ? ' on' : ''}" data-${kind === 'slot' ? 'sl' : 'pk'}="${k}" style="--tc:${a ? TIERC[Math.min(5, a.tier || 1)] : 'transparent'}" title="${a ? a.n : label}"><span class="eqi">${a ? a.i : `<span class="ghost">${glyph}</span>`}</span><small>${a ? '' : label}</small></button>`;
    const slotLabel = (s) => SLOT_NAMES[s].replace(/^\S+\s/, ''), slotGlyph = (s) => { const id = GI.idOf(SLOT_NAMES[s].split(' ')[0]); return id ? GI.html(id) : ''; };
    const slotTile = (s) => { const id = h.arts[s], a = id && ART[id]; return `<div class="eqs" style="grid-area:${s}">${tile('slot', s, a, slotLabel(s), slotGlyph(s))}</div>`; };
    const doll = `<div class="doll"><div class="eqhero" style="grid-area:hero">${Art.heroPic(h.icon, ownCol(0), 92, h.pid)}<b>${h.name}</b><small>Level ${h.lvl}</small></div>${SLOT_ORDER.map(slotTile).join('')}</div>`;
    const pack = h.pack.map((id, i) => tile('pack', i, ART[id], '')).join('') + Array.from({ length: Math.max(0, MAX_PACK - h.pack.length) }, () => '<span class="eqt empty"></span>').join('');
    let info = '<div class="eqinfo muted">Tap an item to see what it does.</div>';
    if (sel) {
      const id = sel.kind === 'slot' ? h.arts[sel.k] : h.pack[sel.k], a = id && ART[id];
      if (a) info = `<div class="eqinfo"><div class="eqbig" style="--tc:${TIERC[Math.min(5, a.tier || 1)]}">${a.i}</div><div class="eqtxt"><b>${a.n}</b><span class="small">${SLOT_NAMES[a.slot === 'ring' ? 'ring1' : a.slot].replace(/^\S+\s/, '')} · tier ${a.tier || 1}</span><span>${artStats(a)}</span></div>
        <div class="acts">${sel.kind === 'slot' ? `<button data-un="${sel.k}">Take off</button>` : `<button class="primary" data-eq="${sel.k}">Equip</button>${others.map(o => `<button data-give="${sel.k}:${G.heroes.indexOf(o)}">Give to ${o.name}</button>`).join('')}`}</div></div>`;
    }
    const bonus = ['att', 'def', 'sp', 'kn', 'morale', 'luck'].filter(k => b[k]).map(k => `<span class="eqb">${b[k] > 0 ? '+' : ''}${b[k]} ${{ att: 'Attack', def: 'Defense', sp: 'Spell', kn: 'Knowledge', morale: 'Morale', luck: 'Luck' }[k]}</span>`).join('') + (b.move ? `<span class="eqb">+${b.move}% move</span>` : '') + (b.mana ? `<span class="eqb">+${b.mana} mana</span>` : '');
    const sets = Object.entries(ART_SETS).map(([sid, st]) => { const have = st.parts.filter(p => Object.values(h.arts).includes(p)).length;
      return `<div class="eqset${have === st.parts.length ? ' on' : ''}"><b>${st.n}</b> <span>${have}/${st.parts.length}</span> <small>${have === st.parts.length ? '✔ active' : st.parts.map(p => ART[p].n).join(' · ')}</small></div>`; }).join('');
    $('mbox').innerHTML = `<h2>🎒 Equipment</h2><div class="eqbon">${bonus || '<span class="small">No bonus from artifacts yet</span>'}</div>
      ${doll}${info}<h4>Backpack (${h.pack.length}/${MAX_PACK})</h4><div class="eqpack">${pack}</div><h4>Sets</h4><div class="eqsets">${sets}</div>
      <div class="mb"><button class="primary" id="eClose">Close</button></div>`;
    $('eClose').onclick = () => { $('modal').classList.add('hide'); renderAll(); };
    $('mbox').querySelectorAll('[data-sl]').forEach(x => x.onclick = () => openEquip(h, { kind: 'slot', k: x.dataset.sl }));
    $('mbox').querySelectorAll('[data-pk]').forEach(x => x.onclick = () => openEquip(h, { kind: 'pack', k: +x.dataset.pk }));
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
  function applyTheme(f) { const b = document.body; [...b.classList].filter(c => c.indexOf('th-') === 0).forEach(c => b.classList.remove(c)); if (f) b.classList.add('th-' + f); if (typeof Sfx !== 'undefined' && Sfx.setFaction) Sfx.setFaction(f || null); }
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
    const nAI = Math.max(1, Math.min(4, map.ais || { small: 1, medium: 2, large: 3, huge: 4, giant: 4 }[size] || 1));
    const aiFacs = shuffle(Object.keys(FACTIONS).filter(f => f !== faction)).slice(0, nAI);
    const wrap = map.wrap === true, m = genMap(seed, aiFacs, diff, { preset, size, biome: map.biome, wrap });
    setFaction(faction); applyTheme(faction);
    G = { seed, preset, size, W: m.W, H: m.H, scn: map.scn ? { id: map.scn.id, name: map.scn.name, goal: map.scn.goal } : null, tiles: m.tiles, biome: m.biome, river: m.river, zone: m.zone, objs: m.objs, dock: m.dock, boats: [], nextBoat: 1, day: 1, over: false, path: null, faction, diff,
      res: { gold: D.gold, wood: r(20), ore: r(20), mercury: r(5), sulfur: r(5), crystal: r(5), gems: r(5) }, spells: [...START_SPELLS],
      wk: {}, heroes: [], sel: 0, hero: null, tavern: [], noTown: 0,
      col: (() => { const pc = Math.max(0, Math.min(7, map.color || 0)), free = PALETTE.map((p, i) => i).filter(i => i !== pc); return [PALETTE[pc][1], ...aiFacs.map((f, i) => PALETTE[free[i % free.length]][1])]; })(),
      ais: aiFacs.map((f, i) => ({ id: i + 1, fac: f, name: FACTIONS[f].name, gold: Math.round(3000 * D.aiInc), heroes: [], alive: true, spawnWait: 0, pers: persPick(), team: ({ ally: 1, bloc: 2 }[(map.teams || [])[i]] || 3 + i) })) };
    if (G.ais.every(a => a.team === 1)) G.ais[0].team = 3;
    G.wrap = wrap; WRAP_W = wrap ? G.W : 0;
    G.dip = !map.scn && map.dip !== false; G.rel = {};   // diplomacy: everyone at peace until war is declared (scenarios keep the old rules)
    for (const o of G.objs) if (o.t === 'town') {
      if (o.owner === 0) { o.fac = faction; o.name = FACTIONS[faction].town; initTown(o, 0); }
      else initTown(o, o.owner ? 1 : 0);
    }
    for (const ai of G.ais) spawnAiHero(ai, G.objs.find(o => o.t === 'town' && o.owner === ai.id));
    const def = HEROES[heroId], h = makeHero(def, m.P.x, m.P.y), ti = factionTiers(faction);
    h.army = startArmy(def, faction);
    h.move = maxMove(h);
    G.heroes.push(h); setActive(0); learn(def.spells); rollTavern();
    if (map.scn && map.scn.bonus) for (const k in map.scn.bonus) G.res[k] = (G.res[k] || 0) + map.scn.bonus[k];
    G.fog = map.fog !== false; initFog();
    reindex(G); buildTerrain(); sizeMini(); centerOn(h.x, h.y); renderAll(); recentreSoon(); needHeroArt();
    toast(`${MAPS[preset].name} (${SIZES[size].name}, seed ${seed}) · ${D.name}: defeat ${nAI > 1 ? 'all ' + nAI + ' rivals by capturing their towns' : 'the rival by capturing their towns'}. Good luck, ${h.name}!`);
  }
  const saveJSON = () => JSON.stringify(G, (k, v) => (k === 'omap' || k === 'hero' || k[0] === '_') ? undefined : v);
  const metaNow = () => ({ day: G.day, hero: G.hero.name, fac: G.faction, size: G.size, diff: G.diff, towns: G.objs.filter(o => o.t === 'town' && o.owner === 0).length, t: Date.now() });
  function saveTo(key) { try { localStorage.setItem(key, saveJSON()); localStorage.setItem(key + '_meta', JSON.stringify(metaNow())); return true; } catch (e) { return false; } }
  function save() { toast(saveTo(SAVE) ? 'Game saved.' : 'Save failed.'); }
  function autosave() { if (saveTo(SAVE)) { const el = $('autosave'); el.classList.remove('hide'); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; setTimeout(() => el.classList.add('hide'), 1800); } }
  // hero busts stream in after the loader: fetch the ones a game in progress shows (its heroes, the tavern's)
  function needHeroArt() {
    try { const ids = [...(G.heroes || []).map(h => h.pid), ...(G.tavern || [])].filter(Boolean).map(p => 'heroes/' + p).filter(s => Assets.has(s) && !Assets.get(s)); if (ids.length) Assets.need(ids).then(() => renderAll()); } catch (e) { /* ignore */ }
  }
  function load(key = SAVE) {
    try {
      const s = localStorage.getItem(key); if (!s) return false;
      G = JSON.parse(s); if (!G.zone || !G.heroes || !G.ais) return false;
      WRAP_W = G.wrap ? G.W : 0;
      G.tavern = (G.tavern || []).filter(id => HEROES[id]);
      G.path = null; G.boats = G.boats || []; setFaction(G.faction); applyTheme(G.faction); setActive(Math.min(G.sel, G.heroes.length - 1));
      initFog(); reindex(G); buildTerrain(); sizeMini(); centerOn(G.hero.x, G.hero.y); renderAll(); recentreSoon(); needHeroArt(); return true;
    } catch (e) { return false; }
  }

  // ---------- terrain rendering ----------
  function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function buildTerrain() {
    // painted at up to 2x on sharp screens (as large as memory allows) so the ground stays crisp
    const w1 = Math.ceil((G.W + 0.5) * TS), h1 = Math.ceil(G.H * RH + HR * 0.5);
    tsc = Math.max(1, Math.min(DPR() > 1 ? 2 : 1, Math.sqrt(16e6 / (w1 * h1))));
    terrain = document.createElement('canvas'); terrain.width = Math.ceil(w1 * tsc); terrain.height = Math.ceil(h1 * tsc);
    const c = terrain.getContext('2d'); c.scale(tsc, tsc);
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
        let xx = x + dx; if (WRAP_W) xx = wrapX(xx); else if (xx < 0 || xx >= G.W) continue;
        const i = yy * G.W + xx;
        if (seeNow) vis[i] = 1;
        if (G.expl[i] === 0) { G.expl[i] = 1; fogDirty = true; }
      }
    }
  }
  // with fog of war a realm is unknown until you see one of its heroes or lands: only then can you trade or declare war
  function meetRealms() {
    if (!G.dip) return; G.met = G.met || {};
    for (const a of G.ais) {
      if (G.met[a.id] || !a.alive) continue;
      // contact is mutual: you see them, or they see you (their heroes see 6 tiles, towns 9, forts 6)
      const seesMe = () => { const mine = [...G.heroes, ...G.objs.filter(o => o.owner === 0)]; return a.heroes.some(h => mine.some(m => hexDist(h, m) <= 6)) || G.objs.some(o => o.owner === a.id && mine.some(m => hexDist(o, m) <= (o.t === 'town' ? 9 : o.t === 'fort' ? 6 : 4))); };
      // a border counts too: if any tile of their land is in view (or a tile of yours is in theirs), you have met
      const TGm = terrGrid(), seeBorder = () => { if (!vis) return false; for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) if (TGm[y * G.W + x] === a.id + 1 && isVis(x, y)) return true; return false; };
      if (!fogOn() || seeBorder() || (vis && (G.objs.some(o => o.owner === a.id && isVis(o.x, o.y)) || a.heroes.some(h => isVis(h.x, h.y)))) || seesMe()) { G.met[a.id] = true; if (fogOn()) toast(`🕊 You have met the ${FACTIONS[a.fac].name} realm — diplomacy with them is open.`); }
    }
  }
  function recomputeVision() {
    if (!fogOn() || !vis) { meetRealms(); return; }
    vis.fill(0);
    for (const h of G.heroes) markView(h.x, h.y, 6 + perk(h, 'scouting'));
    for (const o of G.objs) if (o.owner === 0 || sharesVision(o.owner)) markView(o.x, o.y, o.t === 'town' ? 9 : o.t === 'fort' ? 6 : 4);
    for (const a of G.ais) if (sharesVision(a.id)) for (const ah of a.heroes) markView(ah.x, ah.y, 6);
    for (const b of G.boats) markView(b.x, b.y, 3);
    meetRealms();
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
    if (WRAP_W) { const P = WRAP_W * TS; cam.x = ((cam.x % P) + P) % P; }   // the globe: sideways the view just goes round
    else cam.x = WW <= VW ? -(VW - WW) / 2 : Math.max(-mx, Math.min(WW - VW + mx, cam.x));
    cam.y = WH <= VH ? -(VH - WH) / 2 : Math.max(-my, Math.min(WH - VH + my, cam.y));
  }
  // the page layout settles a moment after a game starts (title/dialogs close), so centre on the hero again once it has
  const recentreSoon = () => { const g = G; [60, 250].forEach(ms => setTimeout(() => { if (G === g && G && G.hero && !G.path) { centerOn(G.hero.x, G.hero.y); renderAll(); } }, ms)); };
  function centerOn(x, y) { resizeMap(); cam.x = hcx(x, Math.floor(y)) - VW / 2; cam.y = hcy(y) - VH / 2; clampCam(); }
  function resizeMap() {
    const w = cmap.clientWidth, h = cmap.clientHeight; if (w < 50 || h < 50) return;
    const dw = Math.round(w * DPR()), dh = Math.round(h * DPR());
    if (cmap.width === dw && cmap.height === dh && VW === w / Z) return;
    const mx0 = cam.x + VW / 2, my0 = cam.y + VH / 2;
    cmap.width = dw; cmap.height = dh; VW = w / Z; VH = h / Z;
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
    if (o.t === 'town' || o.t === 'fort') { if (peaceWithPlayer(o.owner)) return null; return o.owner === null ? (o.guard || []) : (o.garrison || []); }
    if (peaceWithPlayer(o.owner)) return null;
    return o.guard && o.guard.length ? o.guard : null;
  }
  function threatAt(x, y) {
    if (!isExpl(x, y)) return null;
    const ah = isVis(x, y) ? aiHeroAt(x, y) : null; if (ah) return peaceWithPlayer(ah.ai) ? null : threatOfDef(ah.army);
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
    // a little walking bob while the hero moves, a slow breath when standing, and dust kicked up on each new tile
    const nw = performance.now(); if (h._lx !== h.x || h._ly !== h.y) { if (h._lx !== undefined) { h._mvT = nw; if (!RM()) for (let i = 0; i < 3; i++) dust.push({ x: px + cam.x - 4 + i * 4, y: py + cam.y + 13, vx: (i - 1) * 0.8, t0: nw }); } h._lx = h.x; h._ly = h.y; }
    const bob = RM() ? 0 : nw - (h._mvT || 0) < 300 ? -Math.abs(Math.sin(nw / 75)) * 2.6 : Math.sin(nw / 650 + h.x * 3) * 0.7;
    cx.drawImage(im, px - w / 2, py + 15 - hh + bob, w, hh); drawBanner(px, py + bob, col, rel); return true;
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
      case 'prison': return '⛓️';
      case 'obelisk': return o.seen ? '🔹' : '🔺';
      case 'questgate': return '🛡️';
      case 'keytent': return '⛺';
      case 'gate': return '🚪';
      case 'mine': return MINE_ICON[o.kind];
      case 'pile': return RES_ICON[o.kind];
      case 'chest': return '🧰';
      case 'art': return ART[o.art].i;
      case 'monster': return C[o.guard[0].t].i;
    }
  }
  // ---------- map polish: water glints, ambient particles, dust, soft fog, time of day ----------
  const dust = [];
  function drawWaterGlints(x0, y0, vx, vy, now) {
    const t = now / 1000; cx.save(); cx.lineCap = 'round'; cx.lineWidth = 1.2;
    for (let y = Math.max(0, y0); y < Math.min(G.H, y0 + vy); y++) for (let x = Math.max(0, x0); x < Math.min(G.W, x0 + vx); x++) {
      if (G.tiles[y][x] !== T.WATER) continue; if (fogOn() && !G.expl[y * G.W + x]) continue;
      const h = hash(x, y), a = 0.5 + 0.5 * Math.sin(t * 1.3 + h * 40); if (a < 0.6) continue;
      const px = hcx(x, y) - cam.x + (h - 0.5) * 14, py = hcy(y) - cam.y + (hash(y, x) - 0.5) * 12, w = 5 + h * 6;
      cx.strokeStyle = 'rgba(235,248,255,' + ((a - 0.6) * 1.1).toFixed(2) + ')'; cx.beginPath(); cx.moveTo(px - w / 2, py); cx.quadraticCurveTo(px, py - 1.6, px + w / 2, py); cx.stroke();
    }
    cx.restore();
  }
  // drifting specks that fit the land under the camera: pollen, sand, snow, fireflies, embers
  function drawAmbient(now) {
    const mx0 = Math.max(0, Math.min(G.W - 1, Math.floor((cam.x + VW / 2) / TS))), my0 = Math.max(0, Math.min(G.H - 1, Math.floor((cam.y + VH / 2) / RH)));
    const bm = G.biome && G.biome[my0] ? G.biome[my0][mx0] || 0 : 0, t = now / 1000, n = Math.min(70, Math.round(VW * VH / 9000));
    cx.save();
    for (let i = 0; i < n; i++) {
      const s = hash(i, 91), s2 = hash(91, i), sp = 0.4 + s2;
      let vxs = 6, vys = -2, r = 0.9 + s * 0.9, col = '255,245,205', al = 0.34;
      if (bm === 1) { vxs = 38 + 30 * s; vys = 3; r = 0.8; col = '236,206,140'; al = 0.3; }
      else if (bm === 2) { vxs = 6 * Math.sin(t * 0.6 + i); vys = 22 + 16 * s; r = 1.1 + s * 1.2; col = '255,255,255'; al = 0.7; }
      else if (bm === 3) { vxs = 5; vys = -3; r = 1.2 + s; col = '190,255,120'; al = 0.25 + 0.55 * Math.max(0, Math.sin(t * 1.7 * sp + i * 3)); }
      else if (bm === 4) { vxs = 4 * Math.sin(t + i); vys = -18 - 14 * s; r = 0.9 + s * 1.1; col = '255,140,50'; al = 0.6; }
      const x = (((s * VW + t * vxs * sp - cam.x * 0.25) % VW) + VW) % VW, y = (((s2 * VH + t * vys * sp - cam.y * 0.25) % VH) + VH) % VH;
      cx.fillStyle = 'rgba(' + col + ',' + al.toFixed(2) + ')';
      if (bm === 1) cx.fillRect(x, y, 7, 1); else { cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill(); }
      if (bm === 3 && al > 0.5) { cx.fillStyle = 'rgba(190,255,120,.12)'; cx.beginPath(); cx.arc(x, y, r * 4, 0, 7); cx.fill(); }
    }
    cx.restore();
  }
  function drawDust(now) {
    for (let i = dust.length - 1; i >= 0; i--) {
      const d = dust[i], k = (now - d.t0) / 520; if (k >= 1) { dust.splice(i, 1); continue; }
      cx.beginPath(); cx.arc(d.x - cam.x + d.vx * k * 10, d.y - cam.y - k * 7, 2 + k * 4.5, 0, 7); cx.fillStyle = 'rgba(190,170,130,' + (0.32 * (1 - k)).toFixed(2) + ')'; cx.fill();
    }
  }
  // fog painted small and stretched back up, so its edges are soft instead of hex-shaped
  let fogCv = null, fogCx = null;
  function drawFog(x0, y0, vx, vy) {
    const fs = 0.22, w = Math.max(8, Math.ceil(VW * fs)), h = Math.max(8, Math.ceil(VH * fs));
    if (!fogCv) { fogCv = document.createElement('canvas'); fogCx = fogCv.getContext('2d'); }
    if (fogCv.width !== w || fogCv.height !== h) { fogCv.width = w; fogCv.height = h; }
    const f = fogCx; f.setTransform(1, 0, 0, 1, 0, 0); f.clearRect(0, 0, w, h); f.setTransform(w / VW, 0, 0, h / VH, 0, 0);
    for (let y = Math.max(0, y0); y < Math.min(G.H, y0 + vy); y++) for (let x = Math.max(0, x0); x < Math.min(G.W, x0 + vx); x++) {
      const fi = y * G.W + x;
      if (!G.expl[fi]) { Art.hexPath(f, hcx(x, y) - cam.x, hcy(y) - cam.y, HR + 1.2); f.fillStyle = '#05030a'; f.fill(); }
      else if (!vis[fi]) { Art.hexPath(f, hcx(x, y) - cam.x, hcy(y) - cam.y, HR + 1.2); f.fillStyle = 'rgba(5,3,10,.5)'; f.fill(); }
    }
    const sm = cx.imageSmoothingEnabled; cx.imageSmoothingEnabled = true; cx.drawImage(fogCv, 0, 0, w, h, 0, 0, VW, VH); cx.imageSmoothingEnabled = sm;
  }
  // time of day follows the hero's movement left today: golden dawn with full movement, dusk and night as it runs out
  const TOD = [[0, [255, 232, 196]], [0.3, [255, 255, 255]], [0.62, [255, 222, 178]], [0.85, [255, 176, 136]], [1, [118, 134, 206]]];
  let todCur = 0, todG = null;
  function todColor(t) {
    for (let i = 1; i < TOD.length; i++) if (t <= TOD[i][0]) { const a = TOD[i - 1], b = TOD[i], k = (t - a[0]) / (b[0] - a[0]); return a[1].map((v, j) => Math.round(v + (b[1][j] - v) * k)); }
    return TOD[TOD.length - 1][1];
  }
  function drawTimeOfDay() {
    const hh = G.hero, target = hh ? 1 - Math.max(0, Math.min(1, hh.move / Math.max(1, maxMove(hh)))) : 0.3;
    if (todG !== G) { todG = G; todCur = target; } else todCur += (target - todCur) * 0.05;
    document.body.classList.toggle('night', todCur > 0.82);
    const c = todColor(todCur);
    cx.save(); cx.setTransform(1, 0, 0, 1, 0, 0);
    if (c[0] + c[1] + c[2] < 760) { cx.globalCompositeOperation = 'multiply'; cx.fillStyle = 'rgb(' + c.join(',') + ')'; cx.fillRect(0, 0, cmap.width, cmap.height); cx.globalCompositeOperation = 'source-over'; }
    const W = cmap.width, H = cmap.height, vg = cx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.hypot(W, H) * 0.62);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(8,4,0,.3)'); cx.fillStyle = vg; cx.fillRect(0, 0, W, H);
    cx.restore();
    if (todCur > 0.55) {   // warm lamplight around towns and forts as night falls
      const a = Math.min(0.55, (todCur - 0.55) * 1.3); cx.save(); cx.globalCompositeOperation = 'lighter';
      for (const o of G.objs) { if (o.t !== 'town' && o.t !== 'fort') continue; if (fogOn() && !G.expl[o.y * G.W + o.x]) continue; const px = hcx(o.x, o.y) - cam.x, py = hcy(o.y) - cam.y; if (px < -40 || py < -40 || px > VW + 40 || py > VH + 40) continue; const g =cx.createRadialGradient(px, py, 2, px, py, 34); g.addColorStop(0, 'rgba(255,190,90,' + a.toFixed(2) + ')'); g.addColorStop(1, 'rgba(255,150,50,0)'); cx.fillStyle = g; cx.fillRect(px - 34, py - 34, 68, 68); }
      cx.restore();
    }
  }
  // ---- how guards are presented on the map: a ground shadow with a soft threat-coloured glow instead of a flat red disc, and a heraldic shield badge ----
  const hexRgb = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const hexA = (h, a) => { const [r, g, b] = hexRgb(h); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; };
  const hexLight = (h, k) => { const [r, g, b] = hexRgb(h); return 'rgb(' + [r, g, b].map(v => Math.round(v + (255 - v) * k)).join(',') + ')'; };
  function drawMonsterBase(px, py, now, col, deadly) {
    const pulse = 0.5 + 0.5 * Math.sin(now / 560 + px * 0.05), a0 = (deadly ? 0.34 : 0.22) + 0.1 * pulse;
    cx.beginPath(); cx.ellipse(px, py + 13, 15, 5.4, 0, 0, 7); cx.fillStyle = 'rgba(0,0,0,.42)'; cx.fill();
    const g = cx.createRadialGradient(px, py + 12, 1, px, py + 12, 21); g.addColorStop(0, hexA(col, a0)); g.addColorStop(1, hexA(col, 0));
    cx.fillStyle = g; cx.beginPath(); cx.ellipse(px, py + 12, 21, 9, 0, 0, 7); cx.fill();
    cx.beginPath(); cx.ellipse(px, py + 12.5, 14.5, 5.2, 0, 0, 7); cx.strokeStyle = hexA(col, 0.5 + 0.2 * pulse); cx.lineWidth = 1.3; cx.stroke();
  }
  function drawThreatBadge(bx, by, th) {
    cx.save(); cx.translate(bx, by);
    cx.beginPath(); cx.moveTo(-6, -7); cx.lineTo(6, -7); cx.lineTo(6, 1); cx.quadraticCurveTo(6, 6, 0, 8.6); cx.quadraticCurveTo(-6, 6, -6, 1); cx.closePath();
    const g = cx.createLinearGradient(0, -7, 0, 9); g.addColorStop(0, hexLight(th.col, 0.45)); g.addColorStop(1, th.col);
    cx.shadowColor = 'rgba(0,0,0,.6)'; cx.shadowBlur = 3; cx.fillStyle = g; cx.fill(); cx.shadowBlur = 0;
    cx.lineWidth = 1.7; cx.strokeStyle = '#140a04'; cx.stroke(); cx.lineWidth = 0.8; cx.strokeStyle = 'rgba(255,226,150,.9)'; cx.stroke();
    cx.strokeStyle = 'rgba(255,255,255,.95)'; cx.fillStyle = 'rgba(255,255,255,.95)'; cx.lineWidth = 1.5; cx.lineCap = 'round';
    if (th.label === 'Deadly') { cx.beginPath(); cx.moveTo(-2.6, -2.6); cx.lineTo(2.6, 2.6); cx.moveTo(2.6, -2.6); cx.lineTo(-2.6, 2.6); cx.stroke(); }
    else if (th.label === 'Hard') { cx.beginPath(); cx.moveTo(-2.8, 0.6); cx.lineTo(0, -2.2); cx.lineTo(2.8, 0.6); cx.moveTo(-2.8, 3.6); cx.lineTo(0, 0.8); cx.lineTo(2.8, 3.6); cx.stroke(); }
    else { cx.beginPath(); cx.arc(0, 0.6, 1.7, 0, 7); cx.fill(); }
    cx.restore();
  }
  const badgeCache = {};
  function townBadge(o) {
    const key = 'ui/town_' + (o.fac || ''), img = typeof Assets !== 'undefined' ? Assets.get(key) : null; if (!img) return null;
    const col = ownCol(o.owner), ck = key + col; if (badgeCache[ck]) return badgeCache[ck];
    const S = 120, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
    g.save(); g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 7, 0, 7); g.clip();
    const side = Math.min(img.width, img.height) * 0.78, sx = img.width * 0.5 - side / 2, sy = img.height * 0.5 - side * 0.62;   // centre on the castle
    g.drawImage(img, Math.max(0, sx), Math.max(0, sy), side, side, 0, 0, S, S); g.restore();
    g.lineWidth = 7; g.strokeStyle = col; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 7, 0, 7); g.stroke();
    g.lineWidth = 2.5; g.strokeStyle = '#e6bf55'; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2.5, 0, 7); g.stroke();
    g.strokeStyle = '#120a04'; g.lineWidth = 1.5; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 11, 0, 7); g.stroke();
    return (badgeCache[ck] = c);
  }
  const monNeed = new Set(), fpFar = {};
  let reachKey = '', reachSet = new Map();
  function draw() {
    if (!G) return;
    const ds = cmap.width / (VW * Z), now = performance.now();
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.fillStyle = '#000'; cx.fillRect(0, 0, cmap.width, cmap.height); cx.setTransform(Z * ds, 0, 0, Z * ds, 0, 0);
    // the globe: when the view crosses the left/right seam the world is drawn a second time, shifted by one world width
    const camX = cam.x, P = WRAP_W ? WRAP_W * TS : 0;
    for (let s = 0; ; s++) { cam.x = camX - s * P; drawWorld(ds, now); if (!P || camX + VW <= (s + 1) * P) break; }
    cam.x = camX;
    drawTimeOfDay();
    drawMini();
  }
  function drawWorld(ds, now) {
    cx.imageSmoothingEnabled = Z * ds / tsc < 1.4; cx.imageSmoothingQuality = 'high';
    cx.drawImage(terrain, cam.x * tsc, cam.y * tsc, VW * tsc, VH * tsc, 0, 0, VW, VH);
    const x0 = Math.floor(cam.x / TS) - 1, y0 = Math.floor(cam.y / RH) - 1, vx = Math.ceil(VW / TS) + 3, vy = Math.ceil(VH / RH) + 3;
    if (!RM()) drawWaterGlints(x0, y0, vx, vy, now);
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.lineWidth = 2; cx.strokeStyle = 'rgba(255,255,255,.45)';
    const TG = terrGrid();
    for (let y = Math.max(0, y0); y < Math.min(G.H, y0 + vy); y++) for (let x = Math.max(0, x0); x < Math.min(G.W, x0 + vx); x++) {
      const z = TG[y * G.W + x], px = hcx(x, y) - cam.x, py = hcy(y) - cam.y;
      if (z && G.tiles[y][x] !== T.WATER) { Art.hexPath(cx, px, py, HR + 0.5); cx.fillStyle = ownFill(z - 1, 0.3); cx.fill(); }
      if (z && G.tiles[y][x] !== T.WATER) {   // a bold coloured wall along every edge where one realm's land meets another's (or no one's)
        const hb = hexNb(x, y);
        for (let e = 0; e < 6; e++) {
          const nx = hb[e][0], ny = hb[e][1]; if (nx < 0 || ny < 0 || nx >= G.W || ny >= G.H || TG[ny * G.W + nx] === z || G.tiles[ny][nx] === T.WATER) continue;
          const a = Art.hexPt(px, py, HR * 0.9, e), b = Art.hexPt(px, py, HR * 0.9, (e + 1) % 6);
          cx.save(); cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(a[0], a[1]); cx.lineTo(b[0], b[1]);
          cx.strokeStyle = 'rgba(0,0,0,.6)'; cx.lineWidth = 6.5; cx.stroke(); cx.strokeStyle = ownCol(z - 1); cx.lineWidth = 3.4; cx.stroke(); cx.restore();
        }
      }
      const hn = hexNb(x, y);
      for (let e = 0; e < 3; e++) { const nx = hn[e][0], ny = hn[e][1]; if (nx >= 0 && ny >= 0 && nx < G.W && ny < G.H && TG[ny * G.W + nx] !== z) { const p1 = Art.hexPt(px, py, HR, e), p2 = Art.hexPt(px, py, HR, e + 1); cx.beginPath(); cx.moveTo(p1[0], p1[1]); cx.lineTo(p2[0], p2[1]); cx.stroke(); } }
    }
    // tiles the selected hero can still walk to today (soft gold glow with a thin edge)
    if (Settings.showReach && !busy && G.hero && G.hero.move > 0 && !G.over) {
      const hh = G.hero, rk = [hh.x, hh.y, hh.move, hh.boat != null ? 1 : 0, G.day, G.objs.length].join();
      if (reachKey !== rk) { reachKey = rk; reachSet = reachMap(G, hh.x, hh.y, hh.move, hh.boat != null, capsOf(hh)); }
      cx.save(); cx.lineWidth = 2;
      for (const [k] of reachSet) {
        const tx = k % G.W, ty = (k / G.W) | 0; if (tx < x0 - 1 || tx > x0 + vx || ty < y0 - 1 || ty > y0 + vy) continue;
        const px = hcx(tx, ty) - cam.x, py = hcy(ty) - cam.y;
        cx.beginPath(); for (let i = 0; i < 6; i++) { const p = Art.hexPt(px, py, HR - 2, i); i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1]); } cx.closePath();
        cx.fillStyle = 'rgba(255, 233, 150, .22)'; cx.fill(); cx.strokeStyle = 'rgba(255, 214, 90, .9)'; cx.stroke();
      }
      cx.restore();
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
      let uoff = 0, pux = hcx(prev.x, prev.y); const PP = WRAP_W ? WRAP_W * TS : 0;   // the route is drawn unwrapped, so a step over the seam stays one short segment
      G.path.forEach((s) => {
        left -= s.cost; const ok = left >= 0; cum += s.cost; const dayN = cum <= G.hero.move ? 1 : 1 + Math.ceil((cum - G.hero.move) / mm); const fp = !fp0 || dayN === 1 ? fp0 : tintFp(dayN === 2 ? 'rgba(60,150,255,.8)' : 'rgba(235,45,35,.8)');
        let ux = hcx(s.x, s.y) + uoff; if (PP) { while (ux - pux > PP / 2) { uoff -= PP; ux -= PP; } while (ux - pux < -PP / 2) { uoff += PP; ux += PP; } }
        const ax = pux - cam.x, ay = hcy(prev.y) - cam.y, bx = ux - cam.x, by = hcy(s.y) - cam.y; pux = ux;
        if (fp) { const ang = Math.atan2(by - ay, bx - ax), fw = 21, fh = fp.height * fw / fp.width; cx.save(); cx.translate(bx, by); cx.rotate(ang + Math.PI / 2); cx.globalAlpha = 1; cx.shadowColor = 'rgba(0,0,0,.9)'; cx.shadowBlur = 5; cx.drawImage(fp, -fw / 2, -fh / 2, fw, fh); cx.shadowBlur = 0; cx.shadowColor = 'transparent'; cx.drawImage(fp, -fw / 2, -fh / 2, fw, fh); cx.restore(); prev = s; return; }
        cx.setLineDash([0.1, 7]);
        cx.beginPath(); cx.moveTo(ax, ay); cx.lineTo(bx, by);
        cx.lineWidth = 6.5; cx.strokeStyle = 'rgba(25,12,0,.8)'; cx.stroke();
        cx.lineWidth = 3.6; cx.strokeStyle = ok ? '#fff2c4' : '#ff8a70'; cx.stroke();
        cx.setLineDash([]); prev = s;
      });
      { const e = G.path[G.path.length - 1], ex = pux - cam.x, ey = hcy(e.y) - cam.y, r = 9;
        const eo = objAt(G, e.x, e.y), ahh = aiHeroAt(e.x, e.y), hostile = (ahh && !peaceWithPlayer(ahh.ai)) || (eo && !peaceWithPlayer(eo.owner) && (eo.t === 'monster' || defenderOf(eo))), boat = G.boats.some(b => b.x === e.x && b.y === e.y);
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
    // back to front: an object further down the map is drawn after the one above it, so a tall creature never hides behind a neighbour's pickup
    for (const o of G.objs.filter(q => q.x >= x0 - 1 && q.x <= x0 + vx && q.y >= y0 - 1 && q.y <= y0 + vy).sort((p, q) => p.y - q.y || p.x - q.x)) {
      if (o.x < x0 - 1 || o.x > x0 + vx || o.y < y0 - 1 || o.y > y0 + vy) continue;
      if (fogOn()) { const fi = o.y * G.W + o.x; if (!G.expl[fi] || (o.t === 'monster' && !vis[fi])) continue; }
      const px = hcx(o.x, o.y) - cam.x, py = hcy(o.y) - cam.y;
      if (o.t === 'monster') { const th0 = threatOfDef(defenderOf(o)); drawMonsterBase(px, py, now, th0 ? th0.col : '#e0443a', !!th0 && th0.label === 'Deadly'); }
      if (o.t === 'monster') {
        const mt = o.guard[0].t, mb = mt.replace(/_\d$/, ''), mu = /_\d$/.test(mt) ? '_up' : '', ms = 'poses/left/idle/' + mb + mu;
        const pimg = typeof Assets !== 'undefined' ? Assets.get(ms, 'poses/left/idle/' + mb) : null;
        const ma = typeof Battle !== 'undefined' && Battle.mapIdle ? Battle.mapIdle(mt, now, o.x * 3 + o.y * 5, RM()) : null;     // the creature's own idle animation
        if (ma) { const k = Math.min(41 / ma.bh, 44 / ma.bw); cx.save(); cx.shadowColor = 'rgba(0,0,0,.6)'; cx.shadowBlur = 5; cx.shadowOffsetY = 2; cx.translate(px, py + 14); cx.scale(-1, 1); cx.drawImage(ma.img, -ma.cx * k, -ma.by * k, ma.img.width * k, ma.img.height * k); cx.restore(); }
        else if (pimg) { const k = Math.min(41 / pimg.height, 44 / pimg.width), w = pimg.width * k, h = pimg.height * k, bob = RM() ? 0 : Math.sin(now / 700 + o.x * 2.1 + o.y * 1.3) * 1.1; cx.save(); cx.shadowColor = 'rgba(0,0,0,.6)'; cx.shadowBlur = 5; cx.shadowOffsetY = 2; const br = RM() ? 0 : Math.sin(now / 520 + o.x * 1.7 + o.y * 2.3); cx.translate(px, py + 14); cx.rotate(br * 0.018); cx.scale(1 - br * 0.012, 1 + br * 0.03); cx.drawImage(pimg, -w / 2, -h, w, h); cx.restore(); }      // no animation frames yet: a slow breathing and sway keeps it alive
        else {
          cx.drawImage(Art.portraitCanvas(mt), px - 15, py - 15, 30, 30);
          if (typeof Assets !== 'undefined' && Assets.has(ms) && !monNeed.has(ms)) { monNeed.add(ms); Assets.need([ms, 'poses/left/idle/' + mb]).then(() => draw()); }
        }
      }
      const badge = o.t === 'town' ? townBadge(o) : null;
      if (badge) {   // a round picture of the town's own castle, ringed in its owner's colour
        cx.beginPath(); cx.ellipse(px, py + 17, 24, 7, 0, 0, 7); cx.fillStyle = 'rgba(0,0,0,.3)'; cx.fill();
        cx.drawImage(badge, px - 30, py - 33, 60, 60);
      }
      const spr = o.t === 'monster' || badge ? null : Art.obj(o, o.fac);
      if (spr) {
        const sz = o.t === 'town' ? 50 : o.t === 'fort' || o.t === 'lair' ? 46 : o.t === 'dwelling' ? 44 : o.t === 'pile' ? 30 : 38;
        cx.beginPath(); cx.ellipse(px, py + sz * 0.3, sz * 0.38, sz * 0.12, 0, 0, 7); cx.fillStyle = 'rgba(0,0,0,.26)'; cx.fill();   // soft ground shadow
        cx.drawImage(spr, px - sz / 2, py - sz / 2 - (o.t === 'town' ? 5 : 2), sz, sz);
      }
      else if (o.t !== 'monster') { if (typeof GI !== 'undefined') GI.text(cx, objIcon(o), px, py + 1, 28, { fill: '#fff' }); else { cx.font = `26px ${FONT}`; cx.fillStyle = '#fff'; cx.fillText(objIcon(o), px, py + 1); } }
      if (o.t === 'fort') {
        drawFlag(px + 13, py - 8, ownCol(o.owner), relOf(o.owner), 1.1);
        const gn = o.garrison.reduce((s, a) => s + (a ? a.n : 0), 0);
        if (o.owner === 0 && gn) { cx.font = 'bold 11px sans-serif'; cx.fillStyle = '#000b'; cx.fillRect(px - 14, py + 10, 28, 13); cx.fillStyle = '#fff'; cx.fillText(gn, px, py + 17); }
      }
      if (o.col && (o.t === 'keytent' || o.t === 'gate')) { cx.beginPath(); cx.arc(px + 13, py - 14, 6, 0, 7); cx.fillStyle = { red: '#e03a3a', blue: '#3a8aff', green: '#46b84a', gold: '#ffd24a' }[o.col] || '#fff'; cx.fill(); cx.lineWidth = 2; cx.strokeStyle = '#140a04'; cx.stroke(); }
      if (o.t === 'mine' || o.t === 'dwelling' || o.t === 'lair') drawFlag(px + 11, py - 4, ownCol(o.owner), relOf(o.owner), 0.85);
      if (o.t === 'town') drawFlag(px + 15, py - 10, ownCol(o.owner), relOf(o.owner), 1.25);
      { const df = defenderOf(o); if (df && (o.t !== 'monster' || vis[o.y * G.W + o.x] || !fogOn())) { const th = threatOfDef(df); if (th) drawThreatBadge(px - 15, py + 11, th); } }
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
    drawDust(now);
    if (!RM()) drawAmbient(now);
    if (fogOn()) drawFog(x0, y0, vx, vy);
    if (hover) { Art.hexPath(cx, hcx(hover.x, hover.y) - cam.x, hcy(hover.y) - cam.y, HR - 1); cx.strokeStyle = 'rgba(255,255,255,.85)'; cx.lineWidth = 2; cx.stroke(); }
  }
  const MC = { [T.GRASS]: '#4a7c3a', [T.FOREST]: '#2f5a2a', [T.MOUNT]: '#666', [T.WATER]: '#285c92', [T.ROAD]: '#a88a5a', [T.SAND]: '#c8b26c' };
  function drawMini() {
    const k = MK;
    const TG = terrGrid(), sig = terrSig + ':' + G.W;
    if (sig !== miniSig) {
      miniSig = sig;
      const c = miniCache.getContext('2d'); c.drawImage(miniTerr, 0, 0);
      for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) {
        const ow = TG[y * G.W + x] - 1;
        if (ow >= 0) {
          let edge = false; for (const [nx, ny] of hexNb(x, y)) if (nx >= 0 && ny >= 0 && nx < G.W && ny < G.H && TG[ny * G.W + nx] !== ow + 1 && G.tiles[ny][nx] !== T.WATER) { edge = true; break; }
          c.fillStyle = edge ? ownFill(ow, 0.95) : ownFill(ow, 0.4); c.fillRect(mxp(x, y, k), y * MV, k + 0.7, MV + 0.7); }
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
      if (cmap.clientWidth && (Math.round(cmap.clientWidth * DPR()) !== cmap.width || Math.round(cmap.clientHeight * DPR()) !== cmap.height)) resizeMap();
      draw();
    }
    requestAnimationFrame(loop);
  }

  // ---------- UI panels ----------
  function syncMres() { $('mres').style.display = (G && $('title').classList.contains('hide') && !$('modal').classList.contains('hide')) ? '' : 'none'; }
  new MutationObserver(() => { if (G) renderResOnly(); syncMres(); }).observe($('modal'), { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(syncMres).observe($('title'), { attributes: true, attributeFilter: ['class'] });
  function renderResOnly() { $('mres').innerHTML = $('res').innerHTML; }
  // quiet autosave a moment after anything changes (never during a battle or on the title screen), so a refresh loses almost nothing
  let qsT = 0;
  function quietSave() {
    clearTimeout(qsT);
    qsT = setTimeout(() => { if (G && !G.over && !busy && $('title').classList.contains('hide') && !document.body.classList.contains('inbattle') && !/[?&]demo/.test(location.search)) saveTo(SAVE); }, 1500);
  }
  function renderAll() {
    if (!G) return;
    quietSave();
    recomputeVision();
    const gn = computeGain();
    const resHtml = RES.map(k => `<span class="chip" title="${k[0].toUpperCase() + k.slice(1)}: ${G.res[k]}${gn[k] ? ` (+${gn[k]}/day)` : ''}">${RES_ICON[k]} <b>${fmtN(G.res[k])}</b>${gn[k] ? `<small class="inc">+${fmtN(gn[k])}</small>` : ''}</span>`).join('');
    $('res').innerHTML = resHtml; $('mres').innerHTML = resHtml; syncMres();
    renderQuick();
    $('income').innerHTML = `📈 ${RES.filter(k => gn[k]).map(k => `+${fmtN(gn[k])}${RES_ICON[k]}`).join(' ') || 'no income'}<small>/day</small>`;
    const d = G.day - 1;
    { const gt = goalText(), mo = Math.floor(d / 28) + 1, wk = Math.floor(d % 28 / 7) + 1, dw = d % 7 + 1;
      $('date').innerHTML = `<span class="dtMain"><small>Month ${mo} · Week ${wk}</small><b>Day ${dw}</b></span><span class="dtTurn" title="Turns played">Turn<br><b>${G.day}</b></span><span class="dtDiff">${DF().icon} ${DF().name}</span>${gt ? `<span class="dtGoal" title="Scenario objective">🎯 ${gt}</span>` : ''}`; }
    const h = G.hero;
    const ab = artBonus(h), plus = (v) => v ? ` <span class="bonus">(${v > 0 ? '+' : ''}${v})</span>` : '';
    const perkTxt = Object.keys(PERKS).filter(k => perk(h, k) > 0).map(k => `<span title="${PERKS[k].d}">${PERKS[k].i}${PERKS[k].n} ${RANK_NAMES[perk(h, k)]}${ab.sk[k] ? '*' : ''}</span>`).join(' · ');
    $('hero').innerHTML = `<div class="hlist${G.heroes.length > 1 ? '' : ' solo'}">${G.heroes.map((x, i) => `<button class="hbtn${x === h ? ' on' : ''}" data-h="${i}" title="${x.name} (${clsLabel(x.cls)})">${Art.heroPic(x.icon, ownCol(0), 34, x.pid)}</button>`).join('')}</div>
      <div class="hcard">
        <div class="hport">${Art.heroPic(h.icon, ownCol(0), 84, h.pid)}<span class="hlvl" title="Level ${h.lvl}">${h.lvl}</span></div>
        <div class="hhead"><b class="hname">${h.name}</b><span class="hcls">${clsLabel(h.cls)} · Level ${h.lvl}</span></div>
        <div class="hgrid">
          ${[['⚔️', h.att + plus(ab.att), '', 'ATK', 'Attack'], ['🛡', h.def + plus(ab.def), '', 'DEF', 'Defense'], ['✨', h.sp + plus(ab.sp), '', 'SP', 'Spell power'],
            ['📚', h.kn + plus(ab.kn), '', 'KN', 'Knowledge'], ['👢', h.move, '/' + maxMove(h), 'MOVE', `Movement left today: ${h.move} of ${maxMove(h)}`, Math.min(100, h.move / maxMove(h) * 100)],
            ['🔷', h.mana, '/' + maxMana(h), 'MANA', `Mana: ${h.mana} of ${maxMana(h)}`, Math.min(100, h.mana / maxMana(h) * 100)]]
            .map(([ic, v, sub, lab, tip, bar]) => `<div class="hst${bar !== undefined ? ' hasbar' : ''}" title="${tip}"><span class="hi">${ic}</span><b>${v}${sub ? `<em>${sub}</em>` : ''}</b>${bar !== undefined ? `<u style="--p:${bar}%"></u>` : ''}<small>${lab}</small></div>`).join('')}
        </div>
      </div>
      <div class="hbar xp" title="Experience: ${h.xp} of ${need(h.lvl)} to the next level"><i style="width:${Math.min(100, h.xp / need(h.lvl) * 100)}%"></i><span>XP ${h.xp}/${need(h.lvl)}</span></div>
      <div class="hmood small" title="Morale: each point = 4% chance of an extra turn (negative: of skipping a turn). Mixing creatures from different castles lowers it; undead and golems are immune. Luck: each point = 4% chance of double damage.">😀 Morale ${sgn(heroMorale(h))} · 🍀 Luck ${sgn(heroLuck(h))}</div>
      ${h.boat != null ? '<div class="small">⛵ Sailing — walk onto a shore tile to disembark</div>' : ''}
      ${perkTxt ? `<div class="small hperks">${perkTxt}</div>` : ''}
      <div class="small hspells" title="${G.spells.map(k => SPELLS[k].n).join(', ')}">Spells: ${G.spells.map(k => SPELLS[k].i).join(' ')}</div>
      <div class="hacts">
        <button id="bEquip" class="small-btn" title="Equip artifacts (${Object.values(h.arts).filter(Boolean).length} worn, ${h.pack.length} in pack)">🎒 Equipment <span class="bcnt">${Object.values(h.arts).filter(Boolean).length}/${h.pack.length}</span></button>
        <button id="bPortal" class="small-btn" title="Teleport to your castle (${PORTAL_COST} mana)">🌀 Portal <span class="bcnt">${PORTAL_COST}</span></button>
        <button id="bNext" class="small-btn" title="Select the next hero (Tab)">⏭ Next hero</button>
        <button id="bSleep" class="small-btn" title="A sleeping hero is skipped by the end-turn reminder">${h.sleep ? '⏰ Wake' : '💤 Sleep'}</button>
      </div>`;
    $('hero').querySelectorAll('[data-h]').forEach(b => b.onclick = () => { if (busy) return; setActive(+b.dataset.h); G.path = null; centerOn(G.hero.x, G.hero.y); renderAll(); });
    $('bPortal').onclick = townPortal;
    $('bNext').onclick = nextHero;
    $('bSleep').onclick = () => { h.sleep = !h.sleep; toast(h.sleep ? `${h.name} is resting — no more reminders.` : `${h.name} is awake.`); renderAll(); };
    $('bEquip').onclick = () => { if (!busy) openEquip(G.hero); };
    const zs = G.objs.filter(o => o.t === 'fort' || o.t === 'town').sort((a, b) => a.zone - b.zone);
    const mineIncome = G.objs.filter(o => o.t === 'mine' && o.owner === 0 && terrOwner(o.x, o.y) === 0).length;
    const mine = zs.filter(z => z.owner === 0), rest = zs.length - mine.length;
    { const tp = $('townsPanel'); if (tp) {
      const mt = myTowns(), cur = (typeof curTown !== 'undefined' && curTown) || null;
      tp.innerHTML = `<h3>🏰 Towns — ${mt.length}</h3>` + mt.map((t, i) => {
        const u = typeof Assets !== 'undefined' && Assets.has('ui/town_' + t.fac) ? Assets.src('ui/town_' + t.fac) : '', here = G.heroes.filter(hh => hh.x === t.x && hh.y === t.y).length;
        const gn = t.garrison ? t.garrison.reduce((s2, a2) => s2 + (a2 ? a2.n : 0), 0) : 0, built = [1, 2, 3, 4, 5, 6, 7].filter(k => t.b && t.b[k]).length;
        return `<button class="tcard" data-tc="${i}" title="Open ${t.name}">${u ? `<img src="${u}" alt="" draggable="false">` : ''}<span class="tcn">${t.name}</span><span class="tci">${FACTIONS[t.fac] ? FACTIONS[t.fac].icon : ''} ${here ? '🏇' + here + ' ' : ''}🛡${gn} · 🏗${built}/7</span></button>`;
      }).join('');
      tp.querySelectorAll('[data-tc]').forEach(b => b.onclick = () => { if (busy) return; const t = mt[+b.dataset.tc]; centerOn(t.x, t.y); openTown(t); });
    } }
    const TS = terrStats();
    $('terr').innerHTML = `<h3>🗺 Territory — ${mine.length}/${zs.length} zones · ${TS.count[0] || 0} tiles</h3>` +
      mine.map(z => { const gn = z.garrison ? z.garrison.reduce((s, a) => s + (a ? a.n : 0), 0) : 0;
        return `<div class="zrow"><span class="zdot" style="background:${ownCol(0)};color:${ownCol(0)}"></span>${z.t === 'town' ? '🏰' : '🏯'} ${z.name} <span class="small">garrison ${gn}</span></div>`; }).join('') +
      `<div class="small">Paying mines: ${mineIncome} · other zones: ${rest}</div>` +
      G.ais.map(ai => { const tw = G.objs.filter(o => o.t === 'town' && o.owner === ai.id).length, fr = G.objs.filter(o => o.t === 'fort' && o.owner === ai.id).length, ed = TS.edges[ai.id] || 0;
        const bs = ed ? (allyOfPlayer(ai.id) ? 'allied — open' : atWar(0, ai.id) ? 'at war — open to invasion' : pairOb(0, ai.id) ? 'open borders' : 'closed') : '';
        return `<div class="zrow" title="Rival: ${FACTIONS[ai.fac].name}"><span class="zdot" style="background:${ownCol(ai.id)};color:${ownCol(ai.id)}"></span>${allyOfPlayer(ai.id) ? '🤝 ' : G.dip ? (atWar(0, ai.id) ? '⚔ ' : '🕊 ') : ''}${FACTIONS[ai.fac].icon} ${ai.alive ? `${tw} towns, ${fr} forts, ${ai.heroes.length} heroes · ${TS.count[ai.id] || 0} tiles` : '<s>eliminated</s>'}${ai.alive && ed ? `<br><span class="small">🚧 border with you: ${ed} edges — ${bs}</span>` : ''}</div>`; }).join('');
    const el = $('army'); el.innerHTML = ''; el.title = 'Drag a stack onto another slot (or tap two slots) to move, merge or swap.';
    h.army.forEach((a, i) => {
      const b = document.createElement('button');
      b.className = 'slot' + (a ? '' : ' empty') + (i === selSlot ? ' sel' : '');
      if (a) { const c = C[a.t]; b.innerHTML = `${Art.pic(a.t, 44)}<small>${a.n}${c.lv > 1 ? ' ' + '★'.repeat(c.lv - 1) : ''}</small>`; b.title = `${c.n} — ${Art.rarity(a.t).n}\nAtt ${c.a} Def ${c.d} Dmg ${c.lo}-${c.hi} HP ${c.hp} Spd ${c.s}${c.shoot ? '\nArcher' : ''}${c.fly ? '\nFlying' : ''}`; }
      b.dataset.i = i; b.draggable = false;
      b.onclick = () => { if (armyDragged) return; slotClick(i); };
      armyDrag(b, i);
      el.appendChild(b);
    });
    // the army is a tidy 4x2 grid: the spare eighth cell holds a heraldic plate
    if (h.army.length % 4) { const dc = document.createElement('div'); dc.className = 'sdeco'; dc.setAttribute('aria-hidden', 'true'); el.appendChild(dc); }
    const sw = document.createElement('div'); sw.className = 'small'; sw.style.gridColumn = '1/-1'; sw.textContent = 'Drag a stack onto another slot — or tap two slots — to move, merge or swap.'; el.appendChild(sw);
    if (selSlot >= 0 && h.army[selSlot] && h.army[selSlot].n > 1 && h.army.some(x => !x)) { const a = h.army[selSlot], sp = document.createElement('button'); sp.style.gridColumn = '1/-1'; sp.className = 'splitb'; sp.textContent = `✂ Split ${Math.floor(a.n / 2)} into a new stack`; sp.onclick = () => { const e = h.army.findIndex(x => !x), k = Math.floor(a.n / 2); h.army[e] = { t: a.t, n: k }; a.n -= k; selSlot = -1; sfx('click'); renderAll(); }; el.appendChild(sp); }
    if (selSlot >= 0 && h.army[selSlot]) { const a = h.army[selSlot], db = document.createElement('button'); db.className = 'danger disb'; db.style.gridColumn = '1/-1'; db.textContent = `🗑 Disband ${a.n} ${C[a.t].n}`; db.onclick = () => disbandSlot(h.army, selSlot, a.n, db); el.appendChild(db); }
  }
  // drag a stack with finger or mouse onto another slot: empty = move, same creature = merge, other = swap
  let armyDragged = false;
  function armyDrag(b, i) {
    let d = null, ghost = null;
    const slotAt = (x, y) => { const el = document.elementFromPoint(x, y), s = el && el.closest ? el.closest('#army .slot') : null; return s && s.dataset.i !== undefined ? s : null; };
    const clear = () => document.querySelectorAll('#army .slot.drop').forEach(e => e.classList.remove('drop'));
    b.onpointerdown = (e) => { if (!G.hero.army[i]) return; d = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId }; try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } };
    b.onpointermove = (e) => {
      if (!d || d.id !== e.pointerId) return;
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 9) { d.moved = true; ghost = document.createElement('div'); ghost.className = 'dragghost'; ghost.innerHTML = b.innerHTML; document.body.appendChild(ghost); b.classList.add('lifted'); }
      if (d.moved) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; clear(); const t = slotAt(e.clientX, e.clientY); if (t) t.classList.add('drop'); }
    };
    const finish = (e, cancel) => {
      if (!d || d.id !== e.pointerId) return; const was = d; d = null; if (ghost) { ghost.remove(); ghost = null; } clear(); b.classList.remove('lifted');
      if (!was.moved) return;
      armyDragged = true; setTimeout(() => { armyDragged = false; }, 80);
      const t = cancel ? null : slotAt(e.clientX, e.clientY); if (!t) return; const j = +t.dataset.i; if (j === i) return;
      const a = G.hero.army, src = a[i]; if (!src) return;
      if (a[j] && a[j].t === src.t) { a[j].n += src.n; a[i] = null; } else { a[i] = a[j]; a[j] = src; }
      selSlot = -1; sfx('click'); renderAll();
    };
    b.onpointerup = (e) => finish(e, false); b.onpointercancel = (e) => finish(e, true);
  }
  // release creatures from the army for good (two clicks to confirm); a hero always keeps at least one creature
  function disbandSlot(arr, i, n, btn, after) {
    const s = arr[i]; if (!s) return;
    if (!btn.dataset.sure) { btn.dataset.sure = '1'; const old = btn.textContent; btn.textContent = '⚠ Click again to disband'; setTimeout(() => { if (btn.isConnected) { delete btn.dataset.sure; btn.textContent = old; } }, 3000); return; }
    n = Math.max(1, Math.min(s.n, n));
    const left = arr.reduce((t, x) => t + (x ? x.n : 0), 0) - n;
    if (arr === G.hero.army && left <= 0) { toast('A hero needs at least one creature.'); return; }
    s.n -= n; if (s.n <= 0) arr[i] = null;
    sfx('step'); toast(`${n} ${C[s.t].n} disbanded.`); selSlot = -1; if (after) after(); else renderAll();
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
  // click on a hero on the map: his full sheet (stats, troops, skills), with the equipment one button away
  async function openHeroInfo(h) {
    const ab = artBonus(h), plus = (v) => v ? ` <span class="bonus">(${v > 0 ? '+' : ''}${v})</span>` : '';
    const perkTxt = Object.keys(PERKS).filter(k => perk(h, k) > 0).map(k => `<span title="${PERKS[k].d}">${PERKS[k].i}${PERKS[k].n} ${RANK_NAMES[perk(h, k)]}</span>`).join(' · ') || 'No skills yet';
    const army = h.army.map((a, i) => a ? `<div class="chip" title="${C[a.t].n}">${C[a.t].i || ''} <b>${a.n}</b> ${C[a.t].n}</div>` : '').join('') || '<div class="small">No troops</div>';
    const i = await showModal(`<h2>${h.name}</h2><div class="small">${clsLabel(h.cls)} · Level ${h.lvl} · XP ${h.xp}/${need(h.lvl)}</div>
      <div style="display:flex;gap:12px;align-items:center;margin:8px 0">${Art.heroPic(h.icon, ownCol(0), 84, h.pid)}<div class="small" style="line-height:1.7">⚔️ Attack ${h.att}${plus(ab.att)} · 🛡 Defense ${h.def}${plus(ab.def)}<br>✨ Spell power ${h.sp}${plus(ab.sp)} · 📚 Knowledge ${h.kn}${plus(ab.kn)}<br>👢 Movement ${h.move}/${maxMove(h)} · 🔷 Mana ${h.mana}/${maxMana(h)}<br>😀 Morale ${sgn(heroMorale(h))} · 🍀 Luck ${sgn(heroLuck(h))}</div></div>
      <h4>Troops</h4><div style="display:flex;flex-wrap:wrap;gap:6px">${army}</div><h4>Skills</h4><div class="small">${perkTxt}</div>`, ['Close', '🎒 Equipment']);
    if (i === 1) openEquip(h);
  }
  // quick buttons on the map: your castles (with their picture) and your heroes (with their portrait). A click selects and centres; a second click on the
  // selected hero opens his sheet, and a castle opens its town screen
  const quickAsked = new Set(); let quickTi = null;
  function renderQuick() {
    const q = $('quick'); if (!q || !G) return;
    const towns = myTowns(), heroes = G.heroes;
    if (typeof Assets !== 'undefined') { const todo = towns.map(t => 'ui/town_' + t.fac).filter(k => !quickAsked.has(k)); if (todo.length) { todo.forEach(k => quickAsked.add(k)); Assets.need(todo).then(() => renderQuick()); } }
    // collapsed: only the town that matters (the one the selected hero stands in, else the first) and the selected hero; a toggle expands the full lists
    const open = !!Settings.mem('quickOpen'), extra = Math.max(0, towns.length - 1) + Math.max(0, heroes.length - 1), here = G.hero && towns.findIndex(t => t.x === G.hero.x && t.y === G.hero.y);
    const cur = quickTi != null && quickTi < towns.length ? quickTi : (here >= 0 ? here : 0), tShow = (i) => open || i === cur, hShow = (h) => open || h === G.hero;
    const tBtn = (t, i) => { const u = typeof Assets !== 'undefined' && Assets.has('ui/town_' + t.fac) ? Assets.src('ui/town_' + t.fac) : ''; return `<button class="qt" data-qt="${i}" title="${t.name} — open town">${u ? `<img src="${u}" alt="" draggable="false">` : `<span class="qic">${FACTIONS[t.fac].icon}</span>`}<em class="qname">${t.name}</em></button>`; };
    const xBtn = extra ? `<button class="qx" data-qx="1" title="${open ? 'Collapse' : 'Show all castles and heroes'}">${open ? '◂' : '▸'}${open ? '' : '<small>+' + extra + '</small>'}</button>` : '';
    const nav = (d) => (towns.length > 1 && !open ? `<button class="qa" data-qa="${d}" title="${d < 0 ? 'Previous' : 'Next'} town">${d < 0 ? '‹' : '›'}</button>` : '');
    q.innerHTML = '<div class="qrow">' + nav(-1) + towns.map((t, i) => tShow(i) ? tBtn(t, i) : '').join('') + nav(1) + xBtn + '</div><div class="qcol">'
      + heroes.map((h, i) => { if (!hShow(h)) return ''; const has = typeof Assets !== 'undefined' && h.pid && Assets.has('heroes/' + h.pid); return `<button class="qh${h === G.hero ? ' on' : ''}" data-qh="${i}" title="${h.name} (${clsLabel(h.cls)} L${h.lvl}) — ${h === G.hero ? 'open hero sheet' : 'select'}">${has ? `<img src="${Assets.src('heroes/' + h.pid)}" alt="" draggable="false">` : Art.heroPic(h.icon, ownCol(0), 44, h.pid)}</button>`; }).join('')
      + '</div>';
  }
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest && ev.target.closest('#quick button'); if (!b || !G || busy || G.over) return;
    if (b.dataset.qa) { const ts = myTowns(); if (ts.length > 1) { const here2 = G.hero ? ts.findIndex(t => t.x === G.hero.x && t.y === G.hero.y) : -1, at = quickTi != null && quickTi < ts.length ? quickTi : (here2 >= 0 ? here2 : 0); quickTi = (at + +b.dataset.qa + ts.length) % ts.length; renderQuick(); centerOn(ts[quickTi].x, ts[quickTi].y); } return; }
    if (b.dataset.qx) { Settings.mem('quickOpen', !Settings.mem('quickOpen')); renderQuick(); return; }
    if (b.dataset.qt !== undefined) { const t = myTowns()[+b.dataset.qt]; if (t) { centerOn(t.x, t.y); openTown(t); } return; }
    const i = +b.dataset.qh, h = G.heroes[i]; if (!h) return;
    if (h === G.hero) return $('mHero').click();   // on a phone the map hero opens the same Hero screen as the bottom button
    setActive(i); G.path = null; centerOn(h.x, h.y); renderAll();
  });
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
    const px = (ev.clientX - r.left) * (cmap.clientWidth / r.width) / Z + cam.x, py = (ev.clientY - r.top) * (cmap.clientHeight / r.height) / Z + cam.y;
    const qx = px - TS / 2, qy = py - HR, q = (Math.sqrt(3) / 3 * qx - qy / 3) / HR, rr = (2 / 3 * qy) / HR;
    let rx = Math.round(q), rz = Math.round(rr), ry = Math.round(-q - rr);
    const ddx = Math.abs(rx - q), ddz = Math.abs(rz - rr), ddy = Math.abs(ry + q + rr);
    if (ddx > ddz && ddx > ddy) rx = -ry - rz; else if (ddy > ddz) ry = -rx - rz; else rz = -rx - ry;
    const x = rx + ((rz - (rz & 1)) >> 1), y = rz;
    if (WRAP_W) return y >= 0 && y < G.H ? { x: wrapX(x), y } : null;
    return x >= 0 && y >= 0 && x < G.W && y < G.H ? { x, y } : null;
  }
  function armyList(arr, vague) { return arr.filter(Boolean).map(a => vague ? `${groupLabel(a.n)} ${C[a.t].n}s` : `${a.n} ${C[a.t].n}`).join(', '); }
  function describe(x, y) {
    if (!isExpl(x, y)) return 'Unexplored territory';
    const seen = isVis(x, y);
    const ah = seen ? aiHeroAt(x, y) : null; if (ah) return `<b>${ah.name}</b> (${relWord(ah.ai)} ${FACTIONS[aiById(ah.ai).fac].name} hero, L${ah.lvl})<br>${armyList(ah.army, true)}`;
    const hs = heroesAt(x, y); if (hs.length) return hs.map(h => `<b>${h.name}</b> (${clsLabel(h.cls)} L${h.lvl})${h.boat != null ? ' ⛵ sailing' : ''}<br>⚔ ${h.att} 🛡 ${h.def} ✨ ${h.sp} 📚 ${h.kn} · 👢 ${h.move}/${maxMove(h)} · 🔷 ${h.mana}/${maxMana(h)}<br>${h.army.filter(Boolean).map(x => `${x.n} ${C[x.t].n}`).join('<br>') || 'No troops'}`).join('<hr style="border:0;border-top:1px solid #6b4f18;margin:4px 0">');
    if (G.boats.some(b => b.x === x && b.y === y)) return '<b>⛵ Your boat</b><br>Walk onto it from the shore to set sail.';
    let o = objAt(G, x, y);
    if (o && o.t === 'monster' && !seen) o = null;
    if (!o) { const tt = G.tiles[y][x], bm = G.biome && G.biome[y] ? G.biome[y][x] : 0, cpt = G.hero ? capsOf(G.hero) : {}, base = ['Grass', cpt.forest ? 'Forest' : 'Forest (needs Woodcraft)', cpt.mount ? 'Mountains' : 'Mountains (needs Cragwalking)', lakeAt(G, x, y) ? 'Shallow lake (wade through)' : cpt.water ? 'Water' : 'Water (needs a boat or Wave Treading)', 'Road (half the movement cost)', 'Sand (slow)'][tt]; return bm && tt !== T.ROAD && tt !== T.WATER ? `${BIOME_NAME[bm]} — ${base.replace(/ (.*)/, '')} (slower: ×${BIOME_COST[bm]} movement)` : base; }
    const g = o.guard && o.guard.length ? `<br>Guarded by: ${armyList(o.guard, true)}` : '';
    switch (o.t) {
      case 'town': {
        const fn = FACTIONS[o.fac || G.faction].name, gn = (o.garrison || []).reduce((s, a) => s + (a ? a.n : 0), 0);
        return o.owner === 0 ? `<b>${o.name}</b> — your ${fn} town (garrison ${gn})`
          : allyOfPlayer(o.owner) ? `<b>${o.name}</b> — allied ${fn} town (it will never attack you)`
          : o.owner && !atWar(0, o.owner) ? `<b>${o.name}</b> — ${fn} town of a realm you are at peace with<br>Declare war to attack it.`
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
      case 'bank': return `<b>${{ crypt: 'Crypt', utopia: 'Dragon Hoard', stockpile: 'Giant Stockpile' }[o.kind]}</b><br>Guarded treasure: ${armyList(o.guard, true)}`;
      case 'mono': return '<b>Monolith</b><br>Teleports to its twin.';
      case 'prison': return `<b>⛓️ Prison</b><br>A captive hero (${HEROES[o.hero].name}) waits behind the jailors.`;
      case 'obelisk': return `<b>🔺 Obelisk</b><br>${o.seen ? 'Already visited.' : 'Visit every obelisk to unearth a relic.'} (${G.objs.filter(x => x.t === 'obelisk' && x.seen).length}/${G.objs.filter(x => x.t === 'obelisk').length})`;
      case 'questgate': return `<b>🛡️ Quest Guardian</b><br>Rewards a hero of level ${o.need} or higher.`;
      case 'keytent': return `<b>⛺ Key Master (${o.col})</b><br>Hands out the ${o.col} key.`;
      case 'gate': return `<b>🚪 Border Gate (${o.col})</b><br>${(G.keys || {})[o.col] ? 'You hold the key — open the vault.' : `Needs the ${o.col} key from a Key Master.`}`;
      case 'seer': return `<b>Seer's Hut</b><br>Wants ${o.amt} ${o.need} for an artifact.`;
      case 'spring': return `<b>${SPRING[o.kind].n}</b><br>${SPRING[o.kind].d}<br><span class="small">Once per week per hero.</span>`;
      case 'wreck': return `<b>Shipwreck</b><br>Salvage: ${RES_ICON.gold}${o.gold} + ${RES_ICON[o.res]}${g}`;
      case 'mine': {
        const supplied = o.owner === 0 && terrOwner(o.x, o.y) === 0;
        return `<b>${o.kind[0].toUpperCase() + o.kind.slice(1)} mine</b> (${o.owner === 0 ? 'yours' : o.owner ? 'held by a rival' : 'unclaimed'}) +${MINE_YIELD[o.kind]}/day` +
          (o.owner === 0 && !supplied ? '<br>⚠ Pays nothing: the land around it belongs to someone stronger' : o.owner !== 0 ? '<br>Take it and its land becomes yours — it pays once the border is yours' : '') + g;
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
      const blocked = (tt === T.FOREST && !cp.forest) || (tt === T.MOUNT && !cp.mount) || (tt === T.WATER && !cp.water && !lakeAt(G, hover.x, hover.y) && G.hero.boat == null && !G.boats.some(b => b.x === hover.x && b.y === hover.y));
      const ah = isVis(hover.x, hover.y) ? aiHeroAt(hover.x, hover.y) : null, mine = heroesAt(hover.x, hover.y).length > 0;
      const hostile = (ah && !peaceWithPlayer(ah.ai)) || (o && isExpl(hover.x, hover.y) && ((o.t === 'monster' && isVis(hover.x, hover.y)) || (o.guard && o.guard.some(Boolean) && !peaceWithPlayer(o.owner)) || ((o.t === 'town' || o.t === 'fort') && !peaceWithPlayer(o.owner))));
      const sailing = G.hero.boat != null || (tt === T.WATER && !blocked && !lakeAt(G, hover.x, hover.y));
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
  const ptrs = new Map(); let drag = null, pinch = null, suppress = false; let lp = 0;
  const pdist = () => { const a = [...ptrs.values()]; return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); };
  cmap.addEventListener('pointerdown', (e) => {
    if (!G) return;
    try { cmap.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.pointerType !== 'mouse') { clearTimeout(lp); const pe = { clientX: e.clientX, clientY: e.clientY }; lp = setTimeout(() => { if (drag && !drag.moved && ptrs.size === 1) { updateHover(pe); suppress = true; } }, 450); }      // long press = hover
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
      if (!drag.moved && Math.hypot(dx, dy) > 7) { drag.moved = true; clearTimeout(lp); $('tip').classList.add('hide'); }
      if (drag.moved) { cam.x = drag.cx - dx / Z; cam.y = drag.cy - dy / Z; clampCam(); suppress = true; }
    }
  });
  const endPtr = (e) => {
    clearTimeout(lp);
    ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
    if (ptrs.size === 0) { drag = null; setTimeout(() => { suppress = false; }, 0); }
    else if (ptrs.size === 1) { const p = [...ptrs.values()][0]; drag = { x: p.x, y: p.y, cx: cam.x, cy: cam.y, moved: true }; }
  };
  cmap.addEventListener('pointerup', endPtr); cmap.addEventListener('pointercancel', endPtr);
  cmap.addEventListener('wheel', (e) => {
    if (!G) return; e.preventDefault();
    const r = cmap.getBoundingClientRect(); setZoom(Z * (e.deltaY < 0 ? 1.12 : 1 / 1.12), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  const zoomMid = (f) => setZoom(Z * f, cmap.clientWidth / 2, cmap.clientHeight / 2);
  $('zIn').onclick = () => zoomMid(1.25); $('zOut').onclick = () => zoomMid(0.8);
  $('zHome').onclick = () => { if (G) centerOn(G.hero.x, G.hero.y); };
  window.addEventListener('resize', resizeMap); window.addEventListener('orientationchange', () => setTimeout(resizeMap, 200));
  cmap.addEventListener('click', (ev) => {
    if (suppress) return;
    if (!G || busy || G.over) return;
    let t = tileFromEvent(ev); if (!t) return;
    { const to = objAt(G, t.x, t.y); if (to && to.t === 'town' && (to.x !== t.x || to.y !== t.y)) t = { x: to.x, y: to.y }; }   // any of the town's four tiles leads to its gate
    const here = heroesAt(t.x, t.y);
    if (here.length) {
      if (!here.includes(G.hero)) { setActive(G.heroes.indexOf(here[0])); G.path = null; renderAll(); return; }
      const o = objAt(G, t.x, t.y);
      if (heroAtTown(G.hero)) openTown(townAt(G.hero.x, G.hero.y)); else if (o && o.t === 'fort' && o.owner === 0) openFort(o, G.hero); else openHeroInfo(G.hero);
      return;
    }
    const last = G.path && G.path[G.path.length - 1];
    if (last && last.x === t.x && last.y === t.y) return moveHero();
    const p = findPath(G, G.hero.x, G.hero.y, t.x, t.y, false, G.hero.boat != null, capsOf(G.hero));
    if (!p || !p.length) { G.path = null; const tl = terrOwner(t.x, t.y); if (tl !== null && borderBlock(0, G.hero.x, G.hero.y)(t.x, t.y)) return toast(`That land belongs to the ${FN(tl)} realm — their border is closed to you. Ask for open borders in Diplomacy (Menu), or declare war.`); return toast(G.hero.boat != null ? 'Cannot sail there — disembark on a shore tile.' : "Can't reach there. (Water needs a boat.)"); }
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
    try { await moveHero0(); }
    catch (e) { console.error('move failed', e); toast('Something went wrong on that step — the game carried on.'); try { $('modal').classList.add('hide'); } catch (e2) { /* ignore */ } }   // an error must never leave the game locked
    finally { busy = false; try { renderAll(); } catch (e) { /* ignore */ } }
  }
  async function moveHero0() {
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
      await sleep(Math.round(90 + s.cost * 0.6));      // a step takes longer on rough ground and the hero no longer races across the map
      const last = i === path.length - 1, o = objAt(G, s.x, s.y);
      const eh = aiHeroAt(s.x, s.y);
      if (eh && allyOfPlayer(eh.ai)) { openExchange(`🤝 ${eh.name}`, `Allied hero of the ${FACTIONS[aiById(eh.ai).fac].name} realm — swap troops freely.`, h.army, h.name, eh.army, eh.name, null); break; }
      if (eh && !atWar(0, eh.ai) && !last) continue;
      if (eh && !(await confirmWar(eh.ai))) break;
      if (eh) {
        if (o && (o.t === 'town' || o.t === 'fort') && o.owner === eh.ai) await interact(o, h, eh);
        else await fightAiHero(h, eh, true);
        break;
      }
      if (o && (o.t === 'pile' || o.t === 'chest')) { collect(o); continue; }
      if (o && last) { await interact(o, h); break; }
    }
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
    const NAMES = { crypt: '⚰️ Crypt', utopia: '🐲 Dragon Hoard', stockpile: '🏚️ Giant Stockpile' };
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
  // ---------- prisons, obelisks, quest guardians, key masters and border gates ----------
  async function visitPrison(o, h) {
    if (o.guard && o.guard.length) { if (!(await fight(h, o.guard, { att: 0, def: 0 }, 'Prison jailors'))) return; o.guard = []; }
    const d = HEROES[o.hero];
    if (G.heroes.length >= MAX_HEROES) return showModal(`<h2>⛓️ Prison</h2><p>${d.name} begs to join you, but you already lead ${MAX_HEROES} heroes. Come back when one of them has left.</p>`);
    if (G.heroes.some(x => x.id === d.id) || G.ais.some(a => a.heroes.some(x => x.pid === d.id))) { G.objs.splice(G.objs.indexOf(o), 1); reindex(G); renderAll(); return showModal('<h2>⛓️ Empty cell</h2><p>The captive was already freed by someone else.</p>'); }
    const nh = makeHero(d, o.x, o.y), ti = factionTiers(d.fac);
    nh.army = startArmy(d, d.fac, 0.35); nh.move = 0; learn(d.spells);
    G.heroes.push(nh); G.objs.splice(G.objs.indexOf(o), 1); reindex(G); sfx('fanfare'); renderAll();
    await showModal(`<h2>⛓️ Hero freed!</h2><p><b>${nh.name}</b> (${clsLabel(d.cls)}) thanks you and joins your cause with a small band of ${C[ti[0]].n}s.</p>`);
  }
  async function visitObelisk(o, h) {
    if (o.seen) return toast('You have already seen this obelisk.');
    o.seen = true; sfx('level');
    const all = G.objs.filter(x => x.t === 'obelisk'), got = all.filter(x => x.seen).length;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const X = o.x + dx, Y = o.y + dy; if (X >= 0 && Y >= 0 && X < G.W && Y < G.H && G.expl) G.expl[Y * G.W + X] = 1; }
    fogDirty = true; renderAll();
    if (got < all.length) return showModal(`<h2>🔺 Obelisk</h2><p>A piece of an old map is etched into the stone. (${got}/${all.length})</p>`);
    const rel = randomArt(Math.random, 5), a = ART[rel], gotIt = giveArt(h, rel);
    G.res.gold += 5000; renderAll();
    await showModal(`<h2>🔺 The map is whole!</h2><p>All ${all.length} obelisks are found. The map leads you to a buried relic: ${a.i} <b>${a.n}</b> (${artStats(a)}) and ${RES_ICON.gold}5000 gold.${gotIt === 'full' ? ' (Your backpack is full — the relic is lost.)' : ''}</p>`);
  }
  async function visitQuestGate(o, h) {
    const a = ART[o.art];
    if (h.lvl < o.need) return showModal(`<h2>🛡️ Quest Guardian</h2><p>"Only a hero of <b>level ${o.need}</b> may claim what I guard." ${h.name} is level ${h.lvl}.</p>`);
    const got = giveArt(h, o.art); G.res.gold += o.gold; G.objs.splice(G.objs.indexOf(o), 1); reindex(G); sfx('build'); renderAll();
    await showModal(`<h2>🛡️ Quest complete</h2><p>The guardian bows to ${h.name} and hands over ${RES_ICON.gold}${o.gold} gold and ${a.i} <b>${a.n}</b>.${got === 'full' ? ' (Your backpack is full — the artifact is lost.)' : ''}</p>`);
  }
  async function visitKeyTent(o, h) {
    G.keys = G.keys || {};
    if (G.keys[o.col]) return toast('You already hold the ' + o.col + ' key.');
    if (o.guard && o.guard.length) { if (!(await fight(h, o.guard, { att: 0, def: 0 }, 'Key Master guards'))) return; o.guard = []; }
    G.keys[o.col] = true; sfx('build'); renderAll();
    await showModal(`<h2>⛺ Key Master</h2><p>You receive the <b>${o.col} key</b>. Somewhere on the map a border gate of the same colour guards a vault.</p>`);
  }
  async function visitGate(o, h) {
    if (!(G.keys || {})[o.col]) return showModal(`<h2>🚪 Border Gate</h2><p>The gate is sealed. It needs the <b>${o.col} key</b> from a Key Master's tent.</p>`);
    const a = ART[o.art], got = giveArt(h, o.art), n = 6 + Math.floor(Math.random() * 6);
    G.res.gold += o.gold; G.res[o.res] += n; G.objs.splice(G.objs.indexOf(o), 1); reindex(G); sfx('build'); renderAll();
    await showModal(`<h2>🚪 Vault opened</h2><p>The ${o.col} key turns. Inside: ${RES_ICON.gold}${o.gold} gold, ${RES_ICON[o.res]}${n} ${o.res} and ${a.i} <b>${a.n}</b>.${got === 'full' ? ' (Backpack full — the artifact is lost.)' : ''}</p>`);
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
    fortune: { n: '🍀 Fountain of Fortune', d: '+1 Luck in the next battle (+2 for a hero with Providence).' },
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
    if (o.owner !== null && o.owner !== undefined && o.owner !== 0 && !atWar(0, o.owner) && !(await confirmWar(o.owner))) return;
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
    if (o.t === 'prison') return visitPrison(o, h);
    if (o.t === 'obelisk') return visitObelisk(o, h);
    if (o.t === 'questgate') return visitQuestGate(o, h);
    if (o.t === 'keytent') return visitKeyTent(o, h);
    if (o.t === 'gate') return visitGate(o, h);
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
          <p class="small">${canJoin ? `Your Silver Tongue lets ${pct}% of them join your army.` : 'You may spare them — no fight, no experience.'}${cr ? '' : ' (The Silver Tongue perk would let them join you.)'}</p>`, opts);
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
  const battleTerrainAt = (x, y, boat) => { if (boat) return 'water'; const t = G.tiles && G.tiles[y] && G.tiles[y][x]; if (t === T.WATER && !lakeAt(G, x, y)) return 'water'; const b = G.biome && G.biome[y] && G.biome[y][x]; return ['grass', 'desert', 'snow', 'swamp', 'lava'][b || 0] === 'grass' && t === T.SAND ? 'desert' : ['grass', 'desert', 'snow', 'swamp', 'lava'][b || 0]; };
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
    const res = await Battle.run({ hero: { att: eff(h, 'att'), def: eff(h, 'def'), sp: eff(h, 'sp'), mana: h.mana, spells: G.spells, perks: perksOf(h), name: h.name, icon: h.icon, pid: h.pid, mach: h.mach || {}, morale: heroMorale(h), luck: heroLuck(h) },
      army: h.army, enemy: guard.filter(Boolean).map(a => ({ ...a })), eStats, eHero, title, siege, terrain: battleTerrain(h), canRetreat: true });
    h.mana = res.mana; h.buff = null;
    if (res.win) {
      res.survivors.forEach((n, i) => { if (h.army[i]) { if (n > 0) h.army[i].n = n; else h.army[i] = null; } });
      if (!h.ai) { gst('slain', slain0); gst('battles', 1); }
      if (!h.ai) Ach.event('fightWon', { slain: slain0, ratio: th0 ? th0.ratio : undefined, lossPct: before0 ? (before0 - armyCount(h)) / before0 : 0, hero: !!(eHero && (eHero.real || eHero.arts)) });
      const nec = perk(h, 'necromancy');
      if (nec && res.xp > 0) {
        const raised = Math.floor(res.xp * 0.1 * nec / 6);
        if (raised > 0 && addToArmy(h, 'necropolis1', raised)) toast(`💀 ${h.name} raises ${raised} skeletons from the fallen (Grave Craft ${RANK_NAMES[nec]}).`);
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
        ${sel ? (() => { const st = arr(sel.r)[sel.i]; return `<div class="small" style="margin-top:6px">Selected: <b>${C[st.t].n}</b> (${st.n}). Move <input type="number" id="xAmt" min="1" max="${st.n}" value="${Math.min(amt || st.n, st.n)}" style="width:72px"> <button id="xOne">1</button> <button id="xHalf">½</button> <button id="xAll">All</button> — then click an empty slot (or the same creature) to split, or any slot to swap/merge all. <button class="danger" id="xDis">🗑 Disband</button></div>`; })() : '<div class="small">Click a stack, choose how many to move, then click a slot: move / split / merge / swap.</div>'}
        <div class="mb"><button class="primary" id="xClose">${back ? 'Back' : 'Close'}</button></div>`;
      $('xClose').onclick = () => { if (back) back(); else { $('modal').classList.add('hide'); renderAll(); } };
      if (extra) extra.bind();
      if (sel && $('xAmt')) {
        const inp = $('xAmt'), mx = arr(sel.r)[sel.i].n, setA = (v) => { amt = Math.max(1, Math.min(mx, v)); inp.value = amt; };
        inp.oninput = () => { amt = Math.max(1, Math.min(mx, parseInt(inp.value) || 1)); };
        $('xDis').onclick = () => { const st = arr(sel.r)[sel.i], btn = $('xDis'); if (!btn.dataset.sure) { btn.dataset.sure = '1'; btn.textContent = `⚠ Disband ${Math.min(amt || st.n, st.n)}?`; setTimeout(() => { if (btn.isConnected) { delete btn.dataset.sure; btn.textContent = '🗑 Disband'; } }, 3000); return; } const n = Math.max(1, Math.min(st.n, amt || st.n)); if (A.concat(B).reduce((t, x) => t + (x ? x.n : 0), 0) - n <= 0) return toast('Keep at least one creature.'); st.n -= n; if (st.n <= 0) arr(sel.r)[sel.i] = null; toast(`${n} ${C[st.t].n} disbanded.`); sel = null; render(); };
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
  let curTown = null, townTab = null, garSel = null, GAR = null;
  fetch('art/ui/garrison_sockets.json').then(r => (r.ok ? r.json() : null)).then(j => { GAR = j; }).catch(() => {});
  const townNeeded = new Set();
  const defaultTown = () => townAt(G.hero.x, G.hero.y) || nearestTown(G.hero.x, G.hero.y);
  const tierType = (t, tier) => lineType(tiersOf(t)[tier - 1], (t.up && t.up[tier]) || 1);
  const starStr = (lv, max = MAX_LV) => '★'.repeat(Math.max(0, Math.min(lv, max)));   // only the stars it has now, no empty ones
  function startTownAnim(kind, slot) { townAnim = { kind, slot, t0: performance.now() }; sfx(kind === 'upgrade' ? 'level' : 'build'); }
  // what each of the 16 plots in the castle picture shows: 0-6 the dwellings, 7-15 the town buildings
  const DWELL_NAMES = ['Guardhouse', 'Training Grounds', 'Barracks', 'War Hall', 'Citadel', 'Great Keep', 'Royal Lair'];   // what the creature buildings are called in the town picture
  function slotInfo(t, i) {
    if (i < 7) { const tier = i + 1, id = tierType(t, tier); return { built: !!t.b[tier], lv: t.up[tier] || 1, max: MAX_LV, id, name: DWELL_NAMES[tier - 1], tip: C[id].n + ' dwelling', av: t.avail[tier] || 0, locked: !t.b[tier] && t.b.hall < TIER_HALL[tier] }; }
    switch (i) {
      case 7: return { built: t.b.hall > 0, lv: t.b.hall, max: 5, name: t.b.hall ? HALL_LEVELS[t.b.hall].n : 'Town Hall' };
      case 8: return { built: t.b.guild > 0, lv: t.b.guild, max: 3, name: 'Arcane Lodge' };
      case 9: return { built: !!t.b.market, lv: t.b.market ? 1 : 0, max: 1, name: 'Merchant Row' };
      case 10: return { built: !!t.b.ship, lv: t.b.ship ? 1 : 0, max: 1, name: 'Shipyard', na: !(G.dock && t === myTowns()[0]) };
      case 11: return { built: true, lv: 1, max: 1, name: 'Tavern' };
      case 12: return { built: true, lv: 1, max: 1, name: 'Smithy' };
      case 13: return { built: true, lv: 1, max: 1, name: 'Garrison' };
      case 14: return { built: true, lv: t.fort || 0, max: 3, name: FORT_LEVELS[t.fort || 0].n };
      default: return { built: true, lv: t.minel || 0, max: 3, name: MINE_LEVELS[t.minel || 0].n };
    }
  }
  let townHover = -1;
  let townV = { x: 0, y: 0, k: 1, max: 0 }, townBgC = null, townPan = null;
  // the picture around the panorama: the same scene, heavily shrunk and darkened, stretched over the whole screen
  function townBackdrop(g, t, bw, bh) {
    const key = t.fac + '|' + bw + 'x' + bh;
    if (!townBgC || townBgC.key !== key) {
      const sm = document.createElement('canvas'); sm.width = 56; sm.height = Math.max(8, Math.round(56 * bh / bw)); const sg = sm.getContext('2d');
      sg.fillStyle = '#0b0805'; sg.fillRect(0, 0, sm.width, sm.height);
      const im = Assets.get('ui/town_scene_' + t.fac + '_s', 'ui/town_scene_' + t.fac, 'ui/town_' + t.fac);
      if (im) { const k = Math.max(sm.width / im.width, sm.height / im.height); sg.drawImage(im, (sm.width - im.width * k) / 2, (sm.height - im.height * k) / 2, im.width * k, im.height * k); }
      sg.fillStyle = 'rgba(0,0,0,.45)'; sg.fillRect(0, 0, sm.width, sm.height); townBgC = { key, c: sm };
    }
    g.imageSmoothingEnabled = true; g.drawImage(townBgC.c, 0, 0, bw, bh);
  }
  function drawTown() {
    const cv = $('tcv');
    if (!cv || $('modal').classList.contains('hide')) { townLoop = false; return; }
    const t = curTown; if (!t) return;
    const now = performance.now(), dpr = DPR(), box = $('mbox'), bw = box.clientWidth, bh = box.clientHeight; if (!bw || !bh) return requestAnimationFrame(drawTown);
    if (townAnim && now - townAnim.t0 > 3000) townAnim = null;
    if (cv.width !== Math.round(bw * dpr) || cv.height !== Math.round(bh * dpr)) { cv.width = Math.round(bw * dpr); cv.height = Math.round(bh * dpr); }
    const mres = $('mres'), topY = mres && mres.style.display !== 'none' ? Math.max(0, mres.getBoundingClientRect().bottom - box.getBoundingClientRect().top + 4) : 4;
    const gs = box.querySelector('.gstack'), bar = box.querySelector('.tbar'), tui = box.querySelector('.tui');
    const full = TownArt.fullScene(t, bw, bh);
    if (full) {   // the new full-screen painting: the canvas is the screen, the 16 plots come from the painting's own layout
      townV = { x: 0, y: 0, k: 1, max: 0 };
      if (tui) { tui.style.paddingTop = topY + 'px'; tui.style.setProperty('--ttopY', topY + 'px'); tui.style.setProperty('--tbarH', (bar ? bar.offsetHeight + 10 : 60) + 'px'); }
      const g0 = cv.getContext('2d'); g0.setTransform(dpr, 0, 0, dpr, 0, 0); g0.fillStyle = '#0b0805'; g0.fillRect(0, 0, bw, bh);
      TownArt.scene(g0, t, now, townAnim, slotInfo, bw, bh, townHover, full);
      requestAnimationFrame(drawTown); return;
    }

    const uiH = (gs ? gs.offsetHeight : 0) + (bar ? bar.offsetHeight : 0) + 14, kFit = Math.max(0.2, (bh - topY - uiH) / TH);
    // wide screens: the whole panorama fits; phones held upright: it fills the free height and slides sideways (drag)
    const pan = bw < 761 && kFit > bw / TW, k = pan ? Math.min(kFit, 1.5) : Math.min(bw / TW, kFit), maxPan = Math.max(0, TW * k - bw);
    if (townPan == null) townPan = maxPan / 2; townPan = Math.max(0, Math.min(maxPan, townPan));
    townV = { x: maxPan > 0 ? -townPan : (bw - TW * k) / 2, y: topY + (pan ? Math.max(0, (bh - topY - uiH - TH * k) / 2) : 0), k, max: maxPan };
    if (tui) { tui.style.paddingTop = topY + 'px'; tui.style.setProperty('--ttopY', topY + 'px'); tui.style.setProperty('--tbarH', (bar ? bar.offsetHeight + 10 : 60) + 'px'); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    townBackdrop(g, t, bw, bh);
    g.save(); g.translate(townV.x, townV.y); g.scale(k, k); g.beginPath(); g.rect(0, 0, TW, TH); g.clip();
    TownArt.scene(g, t, now, townAnim, slotInfo, TW, TH, townHover);
    g.restore();
    requestAnimationFrame(drawTown);
  }
  // long-press (or right-click) a dwelling in the town picture, or a creature card, to see that warrior big
  function showBigCreature(t, tier) {
    const id = tierType(t, tier), c = C[id], built = !!t.b[tier], lv = (t.up && t.up[tier]) || 1;
    document.querySelectorAll('.bigcr').forEach(e => e.remove());
    const ov = document.createElement('div'); ov.className = 'bigcr';
    ov.innerHTML = `<div class="bcbox"><div class="bcpic">${Art.pic(id, 360)}</div><h3>${c.n} <span class="stars">${built ? starStr(lv) : ''}</span></h3><div class="small">${Art.rarity(id).n}${built ? ` · ${t.avail[tier] || 0} ready to recruit` : ' · dwelling not built yet'}</div>
      <div class="wstats big"><span>Attack ${c.a}</span><span>Defence ${c.d}</span><span>HP ${c.hp}</span><span>Speed ${c.s}</span><span>Damage ${c.lo}-${c.hi}</span>${c.shoot ? '<span>Archer</span>' : ''}${c.fly ? '<span>Flying</span>' : ''}</div>
      <div class="small">Cost ${fmtCost(c.cost)} each</div><button class="primary">Close</button></div>`;
    ov.onclick = () => ov.remove(); document.body.appendChild(ov); sfx('click');
  }
  { let lp = null, fired = false;
    const mb = document.getElementById('mbox'), slotOf = (e) => {
      const t = curTown; if (!t || !$('tcv')) return -1;
      const card = e.target.closest && e.target.closest('.wcard[data-slot], .bcard[data-slot]'); if (card) return +card.dataset.slot;
      const cv = e.target.closest && e.target.closest('#tcv'); if (!cv) return -1;
      const r = cv.getBoundingClientRect(); return TownArt.slotAt((e.clientX - r.left - townV.x) / townV.k, (e.clientY - r.top - townV.y) / townV.k, TW, TH);
    };
    const fire = (e) => { const i = slotOf(e); if (i >= 0 && i < 7 && curTown) { fired = true; showBigCreature(curTown, i + 1); } };
    mb.addEventListener('pointerdown', (e) => { if (e.button) return; fired = false; clearTimeout(lp); const ev = { target: e.target, clientX: e.clientX, clientY: e.clientY }; lp = setTimeout(() => fire(ev), 450); }, true);
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => mb.addEventListener(n, () => clearTimeout(lp), true));
    mb.addEventListener('pointermove', (e) => { if (lp && (Math.abs(e.movementX) > 6 || Math.abs(e.movementY) > 6)) clearTimeout(lp); }, true);
    mb.addEventListener('click', (e) => { if (fired) { fired = false; e.stopPropagation(); e.preventDefault(); } }, true);   // the press that opened the card is not also a tap
    mb.addEventListener('contextmenu', (e) => { if (curTown && $('tcv') && slotOf(e) >= 0 && slotOf(e) < 7) { e.preventDefault(); fire(e); } });
  }
  const TW = 1040, TH = 470;   // the panorama is painted in these units and backed at screen density
  // clicking a plot in the picture opens the matching warriors / buildings card below and flashes it
  function townSlotClick(t, i) {
    townTab = (i < 7 && slotInfo(t, i).built) ? 'war' : 'bld';
    openTown(t);
    const el = $('mbox').querySelector('[data-slot="' + i + '"]');
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('slotflash'); setTimeout(() => el.classList.remove('slotflash'), 1600); }
  }

  function openMarket(rate, title, back) {
    const st = openMarket.st || (openMarket.st = { get: 'wood', give: 'gold', qty: 1 });
    const chips = (grp, sel) => `<div class="mkchips" data-grp="${grp}">${RES.map(k => `<button type="button" class="mkchip${k === sel ? ' on' : ''}" data-k="${k}" title="${k}">${RES_ICON[k]}<small>${G.res[k]}</small></button>`).join('')}</div>`;
    $('mbox').innerHTML = `<h2>⚖️ ${title}</h2>
      <p class="small">Rate: ${Math.round(rate * 100)}% of market value. Pay with any resource to buy the ones you are missing.</p>
      <div class="mklbl">You get</div>${chips('get', st.get)}
      <div class="mklbl">You pay with</div>${chips('give', st.give)}
      <div class="mklbl">Quantity</div><div class="mkqty"><button type="button" id="mQm">−</button><input type="number" id="mQty" min="1" inputmode="numeric" value="${st.qty}"><button type="button" id="mQp">+</button><button type="button" id="mQ10">+10</button><button type="button" id="mQmax">Max</button></div>
      <div id="mCost" class="mkcost"></div>
      <div class="mb"><button id="mBuy" class="primary">Trade</button><button id="mClose">${back ? 'Back to town' : 'Close'}</button></div>`;
    const cost = () => Math.ceil(st.qty * RES_VALUE[st.get] / (RES_VALUE[st.give] * rate));
    const maxQty = () => Math.max(1, Math.floor(G.res[st.give] * RES_VALUE[st.give] * rate / RES_VALUE[st.get]));
    const upd = () => {
      st.qty = Math.max(1, parseInt($('mQty').value) || 1);
      const same = st.get === st.give, c = cost();
      $('mCost').innerHTML = same ? 'Choose two different resources.' : `Cost: <b>${RES_ICON[st.give]} ${c}</b> for ${RES_ICON[st.get]} ${st.qty}` + (G.res[st.give] < c ? ' <span style="color:#f88">(not enough)</span>' : '');
      $('mBuy').disabled = same || G.res[st.give] < c;
    };
    $('mQty').oninput = upd; $('mQty').onchange = upd;
    const setQ = (v) => { $('mQty').value = Math.max(1, v); upd(); };
    $('mQm').onclick = () => setQ(st.qty - 1); $('mQp').onclick = () => setQ(st.qty + 1); $('mQ10').onclick = () => setQ(st.qty + 10); $('mQmax').onclick = () => setQ(maxQty());
    $('mbox').querySelectorAll('.mkchips').forEach(g => g.querySelectorAll('.mkchip').forEach(b => b.onclick = () => { st[g.dataset.grp] = b.dataset.k; g.querySelectorAll('.mkchip').forEach(x => x.classList.toggle('on', x === b)); upd(); }));
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
        <div><b>${d.name}</b> <span class="small">${clsLabel(d.cls)} (${FACTIONS[d.fac].name})${d.sk ? ' · ' + PERKS[d.sk].i + ' ' + PERKS[d.sk].n : ''}</span><br><span class="small">⚔️${d.att} 🛡${d.def} ✨${d.sp} 📚${d.kn}${d.spells.length ? ' · knows ' + d.spells.map(k => SPELLS[k].n).join(', ') : ''}</span></div>
        <div class="acts"><button data-hire="${id}">Hire ${RES_ICON.gold}${price}</button></div></div>`; }).join('');
    // your heroes and the warriors each one leads
    const mine = G.heroes.map(h => { const st = h.army.filter(Boolean), tw = G.objs.find(o => o.t === 'town' && o.owner === 0 && o.x === h.x && o.y === h.y);
      return `<div class="trow" style="grid-template-columns:42px 1fr"><div class="ic">${Art.heroPic(h.icon, ownCol(0), 36, h.pid)}</div><div><b>${h.name}</b> <span class="small">Lv ${h.lvl} ${clsLabel(h.cls)} · ${tw ? 'in ' + tw.name : `at ${h.x},${h.y}`} · power ${Math.round(armyPower(h.army))}</span><br>${st.length ? st.map(a => `<span class="tvarm" title="${C[a.t].n}">${Art.pic(a.t, 30)}<small>${a.n}</small></span>`).join('') : '<span class="small">No warriors</span>'}</div></div>`; }).join('');
    $('mbox').innerHTML = `<h2>🍺 Tavern</h2><h4>Your heroes</h4>${mine}<h4>Heroes for hire</h4><p class="small">Heroes: ${G.heroes.length}/${MAX_HEROES}. New heroes arrive at the castle without an army — recruit troops and use the exchange to equip them. Heroes level up independently. The tavern offers new heroes every week.</p>${premium ? `<p>No heroes are waiting at the tavern right now — mercenary captains from across the realm will serve for <b>double</b> the price (${RES_ICON.gold}${price}).</p>` : ''}${cards}
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
        const nx = wrapX(c.x + dx), ny = c.y + dy;
        if (nx < 0 || ny < 0 || nx >= G.W || ny >= G.H || seen.has(ny * G.W + nx) || G.tiles[ny][nx] !== T.WATER) continue;
        seen.add(ny * G.W + nx); q.push({ x: nx, y: ny });
      }
    }
    return null;
  }

  const MACHINES = [['ballista', 'Ballista', 2500], ['tent', 'First aid tent', 800], ['cart', 'Ammo cart', 1000]];
  // building rows become picture cards (big building art on top, name and action below)
  const cardify = (s) => s.split('class="trow big"').join('class="bcard"').split('<div class="ic">').join('<div class="bpic">').split('<div class="acts">').join('<div class="bacts">');
  function openTown(t) {
    t = t || (curTown && curTown.owner === 0 ? curTown : defaultTown());
    if (!t) return toast('You do not own a town.');
    curTown = t; (G.flags = G.flags || {}).town = true;
    { const need = ['ui/town_' + t.fac, 'ui/town_scene_' + t.fac, 'ui/town_scene_' + t.fac + '_s'].concat(['w', 'wl', 't', 'tl'].map(x => 'ui/town_' + x + '_' + t.fac), ['with', 'without'].map(x => 'ui/town_gar_' + t.fac + '_' + x), ['war', 'bld'].map(x => 'ui/town_btn_' + t.fac + '_' + x), Assets.list('buildings/'));
      Assets.need(need).then(() => { try { TownArt.reload(); } catch (e) { /* ignore */ } if (!townNeeded.has(t.fac)) { townNeeded.add(t.fac); if (curTown === t && !$('modal').classList.contains('hide') && $('mbox').querySelector('#tcv')) openTown(t); } }); } if (typeof Sfx !== 'undefined' && Sfx.ambience) Sfx.ambience(t.fac); // quiet per-castle ambience while the town screen is open
    const th = townHero(t), here = !!th, mt = myTowns(), coastal = !!G.dock && t === mt[0];
    const tabs = mt.length > 1 ? `<div class="hlist"><button class="hbtn tnav" data-tnav="-1" title="Previous town">‹</button>${mt.map((x, i) => `<button class="hbtn${x === t ? ' on' : ''}" data-tab="${i}" title="${x.name}">${FACTIONS[x.fac].icon}</button>`).join('')}<button class="hbtn tnav" data-tnav="1" title="Next town">›</button></div>` : '';
    const topHtml = `${tabs}<h2>🏰 ${t.name} <span class="small">${FACTIONS[t.fac].name} · ${t.b.hall ? HALL_LEVELS[t.b.hall].n : 'Settlement'}</span></h2>`;
    const cvHtml = `<canvas id="tcv" width="1040" height="470" style="width:100%;height:auto;aspect-ratio:1040/470;border-radius:8px;border:2px solid #8c6a33;display:block;touch-action:manipulation"></canvas>`;
    let war = '', dwc = '', wc = '';
    tiersOf(t).forEach((id, i) => {
      const tier = i + 1, lv = t.up[tier], c = C[lineType(id, lv)], built = t.b[tier], av = t.avail[tier] || 0;
      const needHall = TIER_HALL[tier], locked = t.b.hall < needHall;
      let mb = av; while (mb > 0 && !canAfford(G.res, Object.fromEntries(Object.entries(c.cost).map(([k, v]) => [k, v * mb])))) mb--;   // the most you can recruit now: stock and money
      const nextLv = lv + 1, upC = lv < MAX_LV ? upgradeCost(tier, nextLv) : null, upLocked = lv < MAX_LV && t.b.hall < UP_HALL[nextLv];
      let upArmy = null;
      if (built && here) {
        let cost = 0, count = 0;
        for (const s of th.army) if (s && C[s.t].line === id && C[s.t].lv < lv) { cost += (c.cost.gold - C[s.t].cost.gold) * s.n; count += s.n; }
        if (count) upArmy = { cost, count };
      }
      dwc += `<div class="bcard${built ? ' built' : ''}${!built && locked ? ' lockedrow' : ''}" data-slot="${i}"><div class="bpic">${TownArt.pic('dwell', lv, t.fac, 112, lineType(id, lv))}<span class="bcr">${Art.pic(lineType(id, lv), 34)}</span></div><div><b>${c.n} dwelling</b> <span class="stars">${built ? starStr(lv) : ''}</span><br><span class="small">${built ? `Recruits <b>${av}</b> now · +${c.gr}/week · ${fmtCost(c.cost)} each` : locked ? `Needs the ${HALL_LEVELS[needHall].n}` : `Not built yet — ${fmtCost(DWELL_COST[tier])}`}</span></div>
        <div class="bacts">${built ? (upC ? (upLocked ? `<span class="lockpill">Lv${nextLv} · Hall ${UP_HALL[nextLv]}</span>` : `<button data-up="${tier}" title="${Art.fmtCostTxt(upC)}">⬆ Lv${nextLv} ${fmtCost(upC)}</button>`) : '<span class="small">MAX</span>') : (locked ? `<span class="lockpill">🔒 Hall ${needHall}</span>` : `<button class="primary" data-build="${tier}">Build ${fmtCost(DWELL_COST[tier])}</button>`)}</div></div>`;
      wc += `<div class="bcard wcard${built ? ' built' : ''}${!built && locked ? ' lockedrow' : ''}" data-slot="${i}"><div class="bpic wpic">${Art.pic(lineType(id, lv), 256)}<span class="bcr">${TownArt.pic('dwell', lv, t.fac, 44, lineType(id, lv))}</span>${built ? `<span class="wav" title="Ready to recruit">${av}</span>` : ''}</div>
        <div><b>${c.n}</b> <span class="stars">${built ? starStr(lv) : ''}</span><div class="wstats"><span>⚔ ${c.a}</span><span>🛡 ${c.d}</span><span>HP ${c.hp}</span><span>👢 ${c.s}</span><span>${c.lo}-${c.hi} dmg</span>${c.shoot ? '<span>🏹 archer</span>' : ''}${c.fly ? '<span>flying</span>' : ''}</div>
        <span class="small">${built ? `${fmtCost(c.cost)} each · +${c.gr}/week` : locked ? `🔒 Needs the ${HALL_LEVELS[needHall].n}` : `Dwelling not built — ${fmtCost(DWELL_COST[tier])}`}</span></div>
        <div class="bacts">${built ? `<div class="qty"><button type="button" class="qb" data-qty="${tier}:-1" title="Fewer">−</button><input type="number" id="n${tier}" value="${mb}" data-max="${mb}" readonly inputmode="none" tabindex="-1"><button type="button" class="qb" data-qty="${tier}:1" title="More">+</button><button type="button" class="qb qmax" data-qty="${tier}:max" title="Buy as many as you can">Max</button></div><button class="primary" data-buy="${tier}">Recruit</button>${upC ? (upLocked ? `<span class="lockpill" title="Requires Town Hall level ${UP_HALL[nextLv]}">Lv${nextLv} · Hall ${UP_HALL[nextLv]}</span>` : `<button data-up="${tier}" title="${Art.fmtCostTxt(upC)}">⬆ Lv${nextLv} ${fmtCost(upC)}</button>`) : ''}${upArmy ? `<button data-uparmy="${tier}">🪖 Upgrade ${upArmy.count} troops ${RES_ICON.gold}${upArmy.cost}</button>` : ''}` : (locked ? `<span class="lockpill">🔒 Hall ${needHall}</span>` : `<button class="primary" data-build="${tier}">Build</button>`)}</div></div>`;
      war += `<div class="trow big${!built && locked ? ' lockedrow' : ''}"><div class="ic">${Art.pic(lineType(id, lv), 68)}</div>
        <div><b>${c.n}</b> <span class="stars">${built ? starStr(lv) : ''}</span> <span class="small">Att ${c.a} Def ${c.d} Dmg ${c.lo}-${c.hi} HP ${c.hp} Spd ${c.s}${c.shoot ? ' · Archer' : ''}${c.fly ? ' · Flying' : ''}</span><br>
        <span class="small">${built ? `Available: <b>${av}</b> · ${fmtCost(c.cost)} each · +${c.gr}/week` : locked ? `🔒 Requires ${HALL_LEVELS[needHall].n} (Town Hall level ${needHall})` : `Dwelling not built — ${fmtCost(DWELL_COST[tier])}`}</span></div>
        <div class="acts">${built
          ? `<div class="qty"><button type="button" class="qb" data-qty="${tier}:-1" title="Fewer">−</button><input type="number" id="n${tier}" value="${mb}" data-max="${mb}" readonly inputmode="none" tabindex="-1"><button type="button" class="qb" data-qty="${tier}:1" title="More">+</button><button type="button" class="qb qmax" data-qty="${tier}:max" title="Buy as many as you can">Max</button></div><button data-buy="${tier}">Recruit</button>
             ${upC ? (upLocked ? `<span class="lockpill" title="Requires Town Hall level ${UP_HALL[nextLv]}">Lv${nextLv} · Hall ${UP_HALL[nextLv]}</span>` : `<button data-up="${tier}" title="${Art.fmtCostTxt(upC)}">⬆ Lv${nextLv} ${fmtCost(upC)}</button>`) : '<span class="small">MAX</span>'}
             ${upArmy ? `<button data-uparmy="${tier}">🪖 Upgrade ${upArmy.count} troops ${RES_ICON.gold}${upArmy.cost}</button>` : ''}`
          : (locked ? `<span class="lockpill">🔒 Hall ${needHall}</span>` : `<button data-build="${tier}">Build</button>`)}</div></div>`;
    });
    const hl = t.b.hall, hNext = hl < 5 ? HALL_LEVELS[hl + 1] : null;
    const gl = t.b.guild, gNext = gl < 3 ? GUILD_COST[gl + 1] : null;
    const bld = `<div class="trow big" data-slot="7"><div class="ic">${TownArt.pic('hall', Math.max(1, hl), t.fac, 64)}</div><div><b>${hl ? HALL_LEVELS[hl].n : 'Town Hall'}</b> <span class="stars">${starStr(hl, 5)}</span><br>
        <span class="small">${hl ? `+${HALL_LEVELS[hl].inc} 🪙/day.` : 'No income yet.'}${hNext ? ` Next: ${hNext.n} (+${hNext.inc} 🪙/day) — unlocks ${hl + 1 >= 1 && TIER_HALL.indexOf(hl + 1) > 0 ? 'tier ' + TIER_HALL.indexOf(hl + 1) + ' dwelling' : ''}${UP_HALL[hl + 2] ? ' and Lv' + (hl + 2) + ' upgrades' : ''}.` : ''}</span></div>
        <div class="acts">${hNext ? `<button data-hall="1" title="${Art.fmtCostTxt(hNext.cost)}">${hl ? 'Upgrade' : 'Build'} ${fmtCost(hNext.cost)}</button>` : '<span class="small">MAX</span>'}</div></div>
      <div class="trow big" data-slot="8"><div class="ic">${TownArt.pic('guild', Math.max(1, gl), t.fac, 64)}</div><div><b>Arcane Lodge</b> <span class="stars">${starStr(gl, 3)}</span><br>
        <span class="small">Spellbook: ${G.spells.map(k => SPELLS[k].i + ' ' + SPELLS[k].n).join(', ')}${gl < 3 ? `<br>Next level teaches: ${GUILD_SPELLS[gl + 1].map(k => SPELLS[k].i + ' ' + SPELLS[k].n).join(', ')}` : ''}</span></div>
        <div class="acts">${gNext ? `<button data-guild="1" title="${Art.fmtCostTxt(gNext)}">${gl ? 'Upgrade' : 'Build'} ${fmtCost(gNext)}</button>` : '<span class="small">MAX</span>'}</div></div>
      <div class="trow big" data-slot="9"><div class="ic">${TownArt.pic('market', 1, t.fac, 64)}</div><div><b>Merchant Row</b><br><span class="small">${t.b.market ? `Buy missing resources at ${Math.round(MARKET_RATE * 100)}% rate.` : `Trade resources — ${fmtCost(MARKET_COST)}`}</span></div>
        <div class="acts">${t.b.market ? '<button data-trade="1">Trade</button>' : '<button data-build="market">Build</button>'}</div></div>
      <div class="trow big" data-slot="10"><div class="ic">${TownArt.pic('ship', 1, t.fac, 64)}</div><div><b>Shipyard</b><br><span class="small">${t.b.ship ? `Boats ${G.boats.length}/${MAX_BOATS}. A new boat appears at the port by the bay (${fmtCost(BOAT_COST)} each). Walk a hero onto a boat to sail; collect treasures at sea.` : coastal ? `Build boats to sail the sea and collect its treasures — ${fmtCost(SHIPYARD_COST)}` : 'There is no coast near this town.'}</span></div>
        <div class="acts">${!coastal ? '' : t.b.ship ? `<button data-boat="1" ${G.boats.length >= MAX_BOATS ? 'disabled' : ''}>⛵ Build boat</button>` : '<button data-build="ship">Build</button>'}</div></div>
      <div class="trow big" data-slot="14"><div class="ic">${TownArt.pic('fort', t.fort || 0, t.fac, 64)}</div><div><b>${FORT_LEVELS[t.fort || 0].n}</b> <span class="stars">${starStr(t.fort || 0, 3)}</span><br>
        <span class="small">Walls, gate and arrow towers are ×${FORT_LEVELS[t.fort || 0].hp} as strong in a siege${(t.fort || 0) < 3 ? ` — next: ${FORT_LEVELS[(t.fort || 0) + 1].n} (×${FORT_LEVELS[(t.fort || 0) + 1].hp} walls, ×${FORT_LEVELS[(t.fort || 0) + 1].tower} tower fire)` : ''}.</span></div>
        <div class="acts">${(t.fort || 0) < 3 ? `<button data-fortify="1" title="${Art.fmtCostTxt(FORT_LEVELS[(t.fort || 0) + 1].cost)}">⬆ ${fmtCost(FORT_LEVELS[(t.fort || 0) + 1].cost)}</button>` : '<span class="small">MAX</span>'}</div></div>
      <div class="trow big" data-slot="15"><div class="ic">${TownArt.pic('mines', t.minel || 0, t.fac, 64)}</div><div><b>${MINE_LEVELS[t.minel || 0].n}</b> <span class="stars">${starStr(t.minel || 0, 3)}</span><br>
        <span class="small">Hidden mines (${MINE_LEVELS[t.minel || 0].stock}) in front of the walls hurt and halt attackers. A defending hero can lay ${EMERGENCY_MINES} extra mines even without a minefield${(t.minel || 0) < 3 ? ` — next: ${MINE_LEVELS[(t.minel || 0) + 1].n} (${MINE_LEVELS[(t.minel || 0) + 1].stock} mines)` : ''}.</span></div>
        <div class="acts">${(t.minel || 0) < 3 ? `<button data-minefield="1" title="${Art.fmtCostTxt(MINE_LEVELS[(t.minel || 0) + 1].cost)}">⬆ ${fmtCost(MINE_LEVELS[(t.minel || 0) + 1].cost)}</button>` : '<span class="small">MAX</span>'}</div></div>
      <div class="trow big" data-slot="11"><div class="ic">${TownArt.pic('tavern', 1, t.fac, 64)}</div><div><b>Tavern</b><br><span class="small">Heroes ${G.heroes.length}/${MAX_HEROES}. Hire more heroes and exchange troops between heroes in town.</span></div>
        <div class="acts"><button data-tavern="1">Hire heroes</button>${heroesAt(t.x, t.y).length > 1 ? '<button data-xhero="1">Exchange troops</button>' : ''}</div></div>
      `;
    const smithy = `<div class="trow big" data-slot="12"><div class="ic">${TownArt.pic('smithy', 1, t.fac, 64)}</div><div><b>Smithy</b><br><span class="small">${here ? `War machines for ${th.name}: the <b>ballista</b> shoots every round, the <b>first aid tent</b> heals a stack every round and the <b>ammo cart</b> gives your archers 50% more arrows and refills one arrow a round.` : 'A hero must be in town to buy war machines.'}</span></div>
        <div class="acts">${here ? MACHINES.map(([k, nm, cost]) => (th.mach || {})[k] ? `<span class="small">✔ ${nm}</span>` : `<button data-mach="${k}" title="${nm}">${nm} ${RES_ICON.gold}${cost}</button>`).join('') : ''}</div></div>
      `;
    const garrRow = `      <div class="trow big" data-slot="13"><div class="ic">${TownArt.pic('garrison', 1, t.fac, 64)}</div><div><b>Garrison</b><br><span class="small">${armyList(t.garrison, false) || 'No troops stationed.'} The garrison defends the town when no hero is inside${here ? '' : ' (bring a hero to move troops)'}.</span></div>
        <div class="acts"><button data-garr="1">Manage garrison</button></div></div>
`;
    const tabBar = `<div class="ttabs"><button class="ttab${townTab !== 'bld' ? ' on' : ''}" data-ttab="war">⚔️ Warriors</button><button class="ttab${townTab === 'bld' ? ' on' : ''}" data-ttab="bld">🏗️ Buildings</button></div>`;
    // like the original: the town's garrison above the picture, the visiting hero's army below it; click a stack, then a slot, to move, merge or swap
    const garSlot = (a, rk, i) => `<button class="slot${a ? '' : ' empty'}${garSel && garSel.r === rk && garSel.i === i && garSel.t === t ? ' sel' : ''}" data-gr="${rk}" data-gi="${i}" title="${a ? C[a.t].n + ' — ' + a.n : 'Empty slot'}">${a ? `${Art.pic(a.t, 52)}<small>${a.n}</small>` : ''}</button>`;
    // the garrison and the hero's army use the painted panels (a socket for every stack); without the art they fall back to plain slot rows
    const gp = GAR && GAR[t.fac], gsrc = (k) => (Assets.has('ui/town_gar_' + t.fac + '_' + k) && Assets.src('ui/town_gar_' + t.fac + '_' + k)) || null;
    const gSel = (rk, i) => garSel && garSel.r === rk && garSel.i === i && garSel.t === t ? ' sel' : '';
    const garPanel = (kind, arr, rk, hero) => {
      const g = gp && gp[kind], src = g && gsrc(kind); if (!g || !src) return null;
      const pc = (b) => `left:${(b[0] * 100).toFixed(2)}%;top:${(b[1] * 100).toFixed(2)}%;width:${(b[2] * 100).toFixed(2)}%;height:${(b[3] * 100).toFixed(2)}%`;
      return `<div class="gpanel" style="aspect-ratio:${g.aspect};background-image:url(${src})">${g.slots.map((b, i) => { const a = arr[i]; return `<button class="slot gs${a ? '' : ' empty'}${gSel(rk, i)}" data-gr="${rk}" data-gi="${i}" style="${pc(b)}" title="${a ? C[a.t].n + ' — ' + a.n : 'Empty slot'}">${a ? `${Art.pic(a.t, 60)}<small>${a.n}</small>` : ''}</button>`; }).join('')}${kind === 'with' && g.hero && hero ? `<div class="gshero" style="${pc(g.hero)}">${Art.heroPic(hero.icon, ownCol(0), 64, hero.pid)}</div>` : ''}</div>`;
    };
    const gCol = !!Settings.mem('gcol');   // the troop panels can be folded away to see more of the town
    const gTop = `<button class="gcol" id="gColB" title="${gCol ? 'Show' : 'Hide'} the garrison and hero army">${gCol ? '▸ 🛡️ Garrison & army' : '▾ Hide troops'}</button>` + (gCol ? '' : `<div class="glabel">🛡️ ${t.name} garrison</div>` + (garPanel('without', t.garrison, 'g') || `<div class="armyrow garrow">${t.garrison.map((a, i) => garSlot(a, 'g', i)).join('')}</div>`));
    const gHero = gCol ? '' : th ? `<div class="glabel">⚔️ ${th.name} — hero army</div>` + (garPanel('with', th.army, 'h', th) || `<div class="armyrow garrow">${th.army.map((a, i) => garSlot(a, 'h', i)).join('')}</div>`) + `<div class="gacts"><button data-gmove="toHero">⬆ All to hero</button><button data-gmove="toGarr">⬇ To garrison</button><button data-garr="1">Split…</button></div>`
      : `<div class="small gnohero">No hero in this town — recruits join the garrison. Bring a hero to move troops.</div>`;
    const bsrc = (k) => (Assets.has('ui/town_btn_' + t.fac + '_' + k) && Assets.src('ui/town_btn_' + t.fac + '_' + k)) || null;
    const tabBtn = (k, label, ico) => { const u = bsrc(k === 'war' ? 'war' : 'bld'); return `<button class="ttab${townTab === k ? ' on' : ''}${u ? ' tbtn' : ''}" data-ttab="${k}" title="${label}">${u ? `<img src="${u}" alt="${label}" draggable="false">` : ico + ' ' + label}</button>`; };
    // the whole screen is the town picture (like the original); the troops, two buttons and a panel for Warriors / Buildings sit on top of it
    const panel = townTab ? `<div class="tpanel"><div class="tphead"><b>${townTab === 'bld' ? '🏗️ Buildings' : '⚔️ Warriors'}</b><span class="tpr">${townTab === 'bld' ? '' : '<button id="tBuyAll" class="tpall" title="Recruit as many of every creature as you can afford, strongest first">Recruit all</button>'}<button id="tpClose" class="tpx" title="Close">✕</button></span></div><div class="tpbody">${townTab !== 'bld' ? `<div class="bgrid wgrid">${wc}</div>` + outpostHtml(t) : `<h4>Creature dwellings</h4><div class="bgrid">${dwc}</div><h4>Town buildings</h4><div class="bgrid">${cardify(bld + smithy)}</div>` + caravanHtml(t, mt)}</div></div>` : '';
    const html = cvHtml + `<div class="tui">${mt.length > 1 ? `<button class="tarrow l" data-tnav="-1" title="Previous town: ${mt[(mt.indexOf(t) + mt.length - 1) % mt.length].name}">‹</button><button class="tarrow r" data-tnav="1" title="Next town: ${mt[(mt.indexOf(t) + 1) % mt.length].name}">›</button>` : ''}<div class="ttop">${topHtml}</div><div class="tfill"></div><div class="gstack">` + gTop + gHero + `</div><div class="tbar">${tabBtn('war', 'Warriors', '⚔️')}${tabBtn('bld', 'Buildings', '🏗️')}<button class="primary" id="tClose">Leave town</button></div>${panel}</div>`;
    $('mbox').innerHTML = html; $('mbox').classList.add('townfull'); $('modal').classList.remove('hide'); townHover = -1;
    { const cv = $('tcv'), at = (e) => { const r = cv.getBoundingClientRect(); return TownArt.slotAt((e.clientX - r.left - townV.x) / townV.k, (e.clientY - r.top - townV.y) / townV.k, TW, TH); };
      let pd = null;
      cv.onpointerdown = (e) => { pd = { x: e.clientX, pan: townPan, moved: false }; };
      cv.onpointermove = (e) => { if (pd && townV.max > 0) { const dx = e.clientX - pd.x; if (Math.abs(dx) > 6) pd.moved = true; if (pd.moved) townPan = Math.max(0, Math.min(townV.max, pd.pan - dx)); } townHover = pd && pd.moved ? -1 : at(e); cv.style.cursor = townHover >= 0 ? 'pointer' : (townV.max > 0 ? 'grab' : 'default'); };
      cv.onpointerup = () => { setTimeout(() => { pd = null; }, 0); };
      cv.onpointerleave = () => { townHover = -1; pd = null; };
      cv.onclick = (e) => { if (pd && pd.moved) return; const i = at(e); if (i >= 0) townSlotClick(t, i); }; }
    if (!townLoop) { townLoop = true; requestAnimationFrame(drawTown); }
    $('tClose').onclick = () => { townTab = null; townPan = null; $('modal').classList.add('hide'); renderAll(); };
    if ($('gColB')) $('gColB').onclick = () => { Settings.mem('gcol', Settings.mem('gcol') ? 0 : 1); openTown(t); };
    if ($('tpClose')) $('tpClose').onclick = () => { townTab = null; openTown(t); };
    const again = () => { openTown(t); renderAll(); };
    const q = (sel, fn) => $('mbox').querySelectorAll(sel).forEach(fn);
    q('[data-tab]', b => b.onclick = () => openTown(mt[+b.dataset.tab]));
    q('[data-tnav]', b => b.onclick = () => { const at = Math.max(0, mt.indexOf(t)); openTown(mt[(at + +b.dataset.tnav + mt.length) % mt.length]); });
    q('[data-ttab]', b => b.onclick = () => { townTab = townTab === b.dataset.ttab ? null : b.dataset.ttab; openTown(t); });
    q('[data-gr]', b => b.onclick = () => {
      const arrOf = (r) => r === 'g' ? t.garrison : th.army, r = b.dataset.gr, i = +b.dataset.gi;
      if (r === 'h' && !th) return;
      if (!garSel || garSel.t !== t) { if (arrOf(r)[i]) { garSel = { t, r, i }; sfx('click'); } return openTown(t); }
      if (!(garSel.r === r && garSel.i === i)) {
        const X = arrOf(garSel.r), Y = arrOf(r), src = X[garSel.i];
        if (!Y[i]) { Y[i] = src; X[garSel.i] = null; }
        else if (Y[i].t === src.t) { Y[i].n += src.n; X[garSel.i] = null; }
        else { X[garSel.i] = Y[i]; Y[i] = src; }
        sfx('click');
      }
      garSel = null; openTown(t); renderAll();
    });
    // drag a stack from one slot to another (garrison and hero army): an empty slot moves it, the same creature merges, another creature swaps; a click still works too
    q('.slot[data-gr]', b => b.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      const r0 = b.dataset.gr, i0 = +b.dataset.gi; if (r0 === 'h' && !th) return;
      const X = r0 === 'g' ? t.garrison : th.army; if (!X[i0]) return;
      let ghost = null, started = false, over = null; const x0 = ev.clientX, y0 = ev.clientY;
      const move = (e) => {
        if (!started && Math.hypot(e.clientX - x0, e.clientY - y0) > 8) { started = true; ghost = b.cloneNode(true); ghost.removeAttribute('style'); ghost.className = 'slot slot-ghost'; document.body.appendChild(ghost); b.classList.add('drag-src'); }
        if (!started) return;
        ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px';
        const el = document.elementFromPoint(e.clientX, e.clientY), tgt = el && el.closest ? el.closest('.slot[data-gr]') : null;
        if (over !== tgt) { if (over) over.classList.remove('drop'); over = tgt; if (over && over !== b) over.classList.add('drop'); }
        e.preventDefault();
      };
      const end = (e) => {
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end);
        if (!started) return;
        ghost.remove(); b.classList.remove('drag-src'); if (over) over.classList.remove('drop');
        const swallow = (c) => { c.stopPropagation(); c.preventDefault(); }; window.addEventListener('click', swallow, { capture: true, once: true }); setTimeout(() => window.removeEventListener('click', swallow, true), 80);
        if (e.type === 'pointercancel' || !over || over === b) return;
        const r = over.dataset.gr, i = +over.dataset.gi; if (r === 'h' && !th) return;
        const Y = r === 'g' ? t.garrison : th.army, src = X[i0];
        if (!Y[i]) { Y[i] = src; X[i0] = null; } else if (Y[i].t === src.t) { Y[i].n += src.n; X[i0] = null; } else { X[i0] = Y[i]; Y[i] = src; }
        sfx('click'); garSel = null; openTown(t); renderAll();
      };
      window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
    }));
    q('[data-gmove]', b => b.onclick = () => {
      if (!th) return;
      const from = b.dataset.gmove === 'toHero' ? t.garrison : th.army, to = b.dataset.gmove === 'toHero' ? th.army : t.garrison;
      const toGarr = from === th.army; let left = from.filter(Boolean).length;
      from.forEach((a, i) => { if (!a || (toGarr && left <= 1)) return; if (addToArmy({ army: to }, a.t, a.n)) { from[i] = null; left--; } });
      if (toGarr && left === 1) toast('The hero keeps one troop: a hero cannot march alone.');
      garSel = null; openTown(t); renderAll();
    });
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
      toast(`Arcane Lodge level ${t.b.guild}! Learned: ${learned.map(k => SPELLS[k].n).join(', ')}`);
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
    if ($('tBuyAll')) $('tBuyAll').onclick = () => {   // every built dwelling, strongest first: as many as the stock, the money and the free slots allow
      const got = []; let bought = 0, full = false;
      for (let tier = 7; tier >= 1; tier--) {
        if (!t.b[tier]) continue; const type = tierType(t, tier), c = C[type]; let n = t.avail[tier] || 0;
        while (n > 0 && !canAfford(G.res, Object.fromEntries(Object.entries(c.cost).map(([k, v]) => [k, v * n])))) n--;
        if (n <= 0) continue;
        if (!addToArmy(th || { army: t.garrison }, type, n)) { full = true; continue; }
        pay(G.res, c.cost, n); t.avail[tier] -= n; bought += n; got.push(n + ' ' + c.n);
      }
      if (!bought) return toast(full ? (here ? 'No free army slot.' : 'The garrison is full.') : 'Nothing to recruit (stock or resources).');
      sfx('click'); toast('Recruited ' + got.join(', ') + '.' + (full ? ' Some stacks did not fit.' : '')); again();
    };
    q('[data-qty]', b => b.onclick = () => {
      const [tr, op] = b.dataset.qty.split(':'), inp = $('n' + tr), mx = +inp.dataset.max || 0; let v = +inp.value || 0;
      v = op === 'max' ? mx : v + +op; inp.value = Math.max(mx ? 1 : 0, Math.min(mx, v)); sfx('click');
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
    q('[data-trade]', b => b.onclick = () => openMarket(MARKET_RATE + ((G.wk && G.wk.rateBonus) || 0), 'Merchant Row', true));
    q('[data-mach]', b => b.onclick = () => { const k = b.dataset.mach, mm = MACHINES.find(x => x[0] === k); if (!th || G.res.gold < mm[2]) return toast('Not enough gold.'); G.res.gold -= mm[2]; (th.mach = th.mach || {})[k] = 1; sfx('build'); toast(`${mm[1]} bought for ${th.name}.`); again(); });
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
    h.army = startArmy(HEROES[pick[0]], ai.fac, 0.7 * m);
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
      else if (o.t === 'mine' && terrOwner(o.x, o.y) === ai.id) g += MINE_YIELD[o.kind] * RES_VALUE[o.kind];
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
      if (o.owner === ai.id || !atWar(ai.id, o.owner)) continue;
      const d = dist(o, h); if (d > R) continue;
      let sc = 0;
      switch (o.t) {
        case 'monster': { const gp = armyPower(o.guard); if (power >= gp * 2.2) sc = (gp * 0.3 + 200) / (d + 6); break; }
        case 'pile': sc = 350 / (d + 4); break;
        case 'chest': sc = 500 / (d + 4); break;
        case 'mine': { const gp = armyPower(o.guard || []); if (power >= gp * 2) sc = 900 / (d + 6); break; }
        case 'lair': { const gp = armyPower(o.guard || []); if (power >= gp * 2.2 + 1) sc = 3000 / (d + 8); break; }
        case 'fort': { const dp = defPower(o); if (power >= dp * 2 + 1) sc = 1600 / (d + 8); break; }
        case 'town': { const dp = defPower(o); if (power >= dp * 2.2 + 1) sc = 4000 / (d + 10); break; }
      }
      if (sc > 0) list.push({ x: o.x, y: o.y, score: sc });
    }
    if (atWar(ai.id, 0)) for (const ph of G.heroes) { const d = dist(ph, h); if (d > R) continue; if (power >= armyPower(ph.army) * 1.25) list.push({ x: ph.x, y: ph.y, score: 2400 / (d + 6) }); }
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
    if (here) h.peak = power; else h.peak = Math.max(h.peak || 0, power);
    // a worn-down army goes home to recruit instead of marching on (fights cost a lot, so it only attacks with clear odds)
    if ((power < 1200 || power < 0.45 * h.peak) && towns.length) { if (!here) await aiWalk(ai, h, nearest()); return; }
    for (const tg of aiTargets(ai, h, power).slice(0, 5)) { if (await aiWalk(ai, h, tg)) return; }
    if (towns.length && !here) await aiWalk(ai, h, nearest());
  }
  // walk toward a target tile; returns false if there is no path
  async function aiWalk(ai, h, tg) {
    const path = findPath(G, h.x, h.y, tg.x, tg.y, false, false, { block: borderBlock(ai.id, h.x, h.y) });
    if (!path || !path.length) return false;
    for (let i = 0; i < path.length; i++) {
      const s = path[i];
      if (s.cost > h.move) return true;
      h.move -= s.cost; h.dir = dirOf(h.x, h.y, s.x, s.y); h.x = s.x; h.y = s.y;
      const ph = !atWar(ai.id, 0) ? [] : heroesAt(s.x, s.y);
      if (ph.length) {
        const d = ph.reduce((a, b) => armyCount(a) >= armyCount(b) ? a : b);
        centerOn(s.x, s.y); renderAll(); toast(`${h.name} of the ${FACTIONS[ai.fac].name} attacks ${d.name}!`); note(`⚔ ${h.name} of the ${FACTIONS[ai.fac].name} attacked ${d.name}`, s.x, s.y); await sleep(350);
        await fightAiHero(d, h, false);
        if (!ai.heroes.includes(h)) return true;
        const so = objAt(G, h.x, h.y);
        if (so && so.owner === 0 && (so.t === 'fort' || so.t === 'town')) await defendStructure(so, h);
        return true;
      }
      const other = G.ais.flatMap(a => a.heroes).find(x => x !== h && x.x === s.x && x.y === s.y && atWar(ai.id, x.ai));
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
    if (!last || o.owner === ai.id || !atWar(ai.id, o.owner)) return false;
    if (o.owner === 0 && o.t !== 'town' && o.t !== 'fort') { centerOn(o.x, o.y); renderAll(); toast(`${h.name} of the ${FACTIONS[ai.fac].name} attacks your ${o.t === 'mine' ? o.kind + ' mine' : o.t}!`); await sleep(700); }
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

  // ---------- Borders: every building you hold claims the land around it; the strongest claim on a tile wins ----------
  // [radius, bonus]: towns reach far and win close contests, a captured mine or dwelling claims a small patch of its own. A fort or town also keeps its whole zone as a weak base claim.
  const CLAIM = { town: [8, 2], fort: [5, 1], mine: [3, 0], dwelling: [3, 0], lair: [4, 0] };
  let terrA = null, terrSig = 0, terrG = null;
  function terrGrid() {
    let h = G.objs.length;
    for (const o of G.objs) if (CLAIM[o.t] || o.t === 'fort') h = (h * 31 + (o.owner === null || o.owner === undefined ? 0 : o.owner + 1) * 7 + o.x * 13 + o.y * 17) | 0;
    if (terrA && terrG === G && terrSig === h) return terrA;
    const W = G.W, H = G.H, a = new Uint8Array(W * H), best = new Float32Array(W * H);
    const zo = {}; for (const o of G.objs) if ((o.t === 'fort' || o.t === 'town') && o.owner !== null && o.owner !== undefined) zo[o.zone] = o.owner;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const ow = zo[G.zone[y][x]]; if (ow !== undefined && G.tiles[y][x] !== T.WATER) { a[y * W + x] = ow + 1; best[y * W + x] = 0.5; } }
    for (const o of G.objs) {
      const c = CLAIM[o.t]; if (!c || o.owner === null || o.owner === undefined) continue;
      const seen = new Map([[o.y * W + o.x, 0]]); let frontier = [[o.x, o.y]];
      for (let d = 0; d <= c[0] && frontier.length; d++) {
        const next = [], s = c[0] + c[1] - d + 0.6;
        for (const [x, y] of frontier) {
          const i = y * W + x;
          if (G.tiles[y][x] !== T.WATER && s > best[i]) { best[i] = s; a[i] = o.owner + 1; }
          if (d < c[0]) for (const [nx, ny] of hexNb(x, y)) { if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const k = ny * W + nx; if (!seen.has(k)) { seen.set(k, d + 1); next.push([nx, ny]); } }
        }
        frontier = next;
      }
    }
    terrA = a; terrSig = h; terrG = G; return a;
  }
  // land held per realm and how long each realm's border runs against yours (cached until the borders change)
  let tstat = null, tstatSig = -1, tstatG = null;
  function terrStats() {
    const a = terrGrid(); if (tstat && tstatSig === terrSig && tstatG === G) return tstat;
    const W = G.W, H = G.H, count = {}, edges = {};
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = a[y * W + x]; if (!v) continue; count[v - 1] = (count[v - 1] || 0) + 1;
      if (v === 1) for (const [nx, ny] of hexNb(x, y)) { if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const u = a[ny * W + nx]; if (u > 1) edges[u - 1] = (edges[u - 1] || 0) + 1; }
    }
    tstatSig = terrSig; tstatG = G; return (tstat = { count, edges });
  }
  const terrOwner = (x, y) => { const v = terrGrid()[y * G.W + x]; return v ? v - 1 : null; };
  // crossing borders: you may not enter another realm's land unless you are allied, at war with them, or they gave you open borders (a hero already standing inside may move about and leave)
  function pairObj(a, b) { const key = relKey(a, b); G.rel = G.rel || {}; return G.rel[key] || (G.rel[key] = { s: 'peace', since: 0, truce: 0 }); }
  const pairOb = (a, b) => { const r = (G.rel || {})[relKey(a, b)]; return !!(r && r.s === 'peace' && r.ob); };
  const canCross = (mover, land) => land === null || land === mover || isAlly(mover, land) || atWar(mover, land) || pairOb(mover, land);
  function borderBlock(owner, sx, sy) {
    const home = terrOwner(sx, sy);
    return (x, y) => { const l = terrOwner(x, y); return !(l === null || l === home || canCross(owner, l)); };
  }
  // a mine pays the realm that holds the land it stands on
  const mineSupplied = (o) => o.owner !== null && o.owner !== undefined && terrOwner(o.x, o.y) === o.owner;

  // ---------- Diplomacy: everyone starts at peace; war has to be declared; trade, demands, alliances ----------
  const FN = (id) => FACTIONS[aiById(id).fac].name;
  const met = (id) => !G.dip || !fogOn() || !!(G.met && G.met[id]);
  // each realm has a temperament: timid ones give in easily, proud ones need a lot of pressure, iron-willed ones never listen to a demand
  const PERS = { meek: { n: 'Timid', mul: 0.55, aggr: 0.6, peace: 2.5, tip: 'gives in to demands easily' }, balanced: { n: 'Calculating', mul: 1, aggr: 1, peace: 1.6, tip: 'weighs the odds' }, proud: { n: 'Proud', mul: 1.6, aggr: 1.3, peace: 1.2, tip: 'only a crushing army makes them yield' }, stubborn: { n: 'Iron-willed', mul: Infinity, aggr: 1.5, peace: 0.9, tip: 'never listens to a demand' } };
  const persOf = (id) => PERS[aiById(id).pers] || PERS.balanced;
  // your diplomacy rank grows with your best hero's level: better trade rates and demands that need less strength
  const dipRank = () => Math.min(6, 1 + Math.floor((Math.max(1, ...G.heroes.map(h => h.lvl || 1)) - 1) / 4));
  const dipBonus = () => (dipRank() - 1) * 0.04;
  function persPick() { const r = Math.random(); return r < 0.25 ? 'meek' : r < 0.6 ? 'balanced' : r < 0.85 ? 'proud' : 'stubborn'; }
  const nm = (id) => id === 0 ? 'you' : `the ${FN(id)} realm`;
  const relWord = (id) => allyOfPlayer(id) ? 'allied' : atWar(0, id) ? 'enemy' : 'neutral';
  function realmPower(id) {
    let p = 1;
    const hs = id === 0 ? G.heroes : aiById(id).heroes;
    for (const h of hs) p += armyPower(h.army);
    for (const t of G.objs) if (t.t === 'town' && t.owner === id) p += armyPower(t.garrison || []);
    return p;
  }
  // opinion (like Civilization's attitudes): each realm feels something about you, from hostile (-100) to devoted (+100); every deed leaves a mark that fades
  const opOf = (id) => (aiById(id).op || 0);
  function addOp(id, v, why) { const ai = aiById(id); ai.op = Math.max(-100, Math.min(100, (ai.op || 0) + v)); (ai.opLog = ai.opLog || []).unshift({ v, why, day: G.day }); ai.opLog.length = Math.min(ai.opLog.length, 6); }
  const opWord = (v) => v <= -40 ? 'Hostile' : v <= -15 ? 'Unfriendly' : v < 15 ? 'Neutral' : v < 40 ? 'Friendly' : 'Devoted';
  // friendship and shared vision are flags on a peace; going to war wipes them
  const relObj = (a, b) => (G.rel = G.rel || {})[relKey(a, b)] || null;
  const hasFlag = (id, k) => { const r = relObj(0, id); return !!(r && r.s === 'peace' && r[k]); };
  const isFriend = (id) => hasFlag(id, 'f');
  function setFlag(id, k, v) { pairObj(0, id)[k] = v; }
  const sharesVision = (id) => allyOfPlayer(id) || (G.dip && hasFlag(id, 'ob'));
  const TRUCE = 10;
  function setRel(a, b, s) { (G.rel = G.rel || {})[relKey(a, b)] = { s, since: G.day, truce: s === 'peace' ? G.day + TRUCE : 0 }; }   // a made peace holds for 10 days: nobody may declare war until then
  const truceLeft = (a, b) => { const r = (G.rel || {})[relKey(a, b)]; return r && r.s === 'peace' && r.truce > G.day ? r.truce - G.day : 0; };
  const relLen = (a, b) => { const r = (G.rel || {})[relKey(a, b)]; return r ? G.day - r.since : 99; };
  function declareWar(a, b, joint) {
    if (a === 0 || b === 0) {
      const o = aiById(a === 0 ? b : a);
      if (o.team === 1) { o.team = 10 + o.id; for (const x of G.ais) if (x.alive && x !== o && met(x.id)) addOp(x.id, -10, 'You betrayed an ally'); }
      // starting a war with a realm that has done you no harm is a warmonger's act: everyone who has met you thinks less of you
      else if (a === 0 && !joint && (o.op || 0) > -20 && !(relObj(0, o.id) && relObj(0, o.id).den > G.day - 15)) for (const x of G.ais) if (x.alive && x !== o && met(x.id)) addOp(x.id, atWar(x.id, o.id) ? 4 : -8, atWar(x.id, o.id) ? `You fight our enemy` : `You declared war on the ${FN(o.id)} realm unprovoked`);
      if (a === 0) addOp(o.id, -30, 'You declared war'); else addOp(o.id, -5, 'They are at war with us');
    }
    setRel(a, b, 'war'); if (joint) toast(`⚔ The ${a === 0 ? FN(b) : FN(a)} realm is now at war.`); note(`⚔ War: ${nm(a)} against ${nm(b)}`);
  }
  // attacking someone you are at peace with means declaring war first
  async function confirmWar(owner) {
    if (atWar(0, owner)) return true;
    if (truceLeft(0, owner)) { await showModal(`<h2>🕊 Peace treaty</h2><p>You made peace with the ${FN(owner)} realm. Neither side may declare war for <b>${truceLeft(0, owner)}</b> more day(s).</p>`); return false; }
    const i = await showModal(`<h2>🕊 At peace with the ${FN(owner)} realm</h2><p>You have no quarrel with them yet. Attacking means <b>declaring war</b> — they will fight back with everything they have.</p>`, ['Cancel', '⚔ Declare war']);
    if (i !== 1) return false;
    declareWar(0, owner); renderAll(); return true;
  }
  async function aiDiplomacy() {
    if (!G.dip) return;
    const live = G.ais.filter(a => a.alive), ids = [0, ...live.map(a => a.id)];
    const aggr = ({ easy: 0.03, normal: 0.06, hard: 0.1, expert: 0.14 }[G.diff] || 0.06);
    G.dipLog = G.dipLog || {};
    // standing trade deals run every day; whoever cannot pay breaks the deal (and the other side remembers)
    G.deals = (G.deals || []).filter(d => {
      const ai = aiById(d.id); if (!ai.alive || atWar(0, d.id)) return false;
      const pOk = G.res[d.g] >= d.gq, have = d.t === 'gold' ? ai.gold : d.t === 'food' ? (ai.food || 0) : ai.gold / RES_VALUE[d.t], aOk = have >= d.tq;
      if (!pOk || !aOk) { toast(`⚖ The daily deal with the ${FN(d.id)} realm collapsed (${pOk ? 'they' : 'you'} could not pay).`); addOp(d.id, pOk ? 0 : -6, 'You missed a payment'); return false; }
      G.res[d.g] -= d.gq; if (d.g === 'food') ai.food = (ai.food || 0) + d.gq; else ai.gold += d.g === 'gold' ? d.gq : Math.round(d.gq * RES_VALUE[d.g] * 0.9);
      G.res[d.t] += d.tq; if (d.t === 'food') ai.food = (ai.food || 0) - d.tq; else ai.gold -= d.t === 'gold' ? d.tq : Math.round(d.tq * RES_VALUE[d.t]);
      d.left--; return d.left > 0;
    });
    // rivals at peace with each other sometimes open their borders
    for (const a of live) for (const b of live) if (a.id < b.id && !atWar(a.id, b.id) && !isAlly(a.id, b.id) && !pairOb(a.id, b.id) && Math.random() < 0.04) pairObj(a.id, b.id).ob = true;
    // opinions drift toward what the relationship deserves: long peace warms, war chills
    for (const ai of live) { const tgt = isAlly(ai.id, 0) ? 45 : atWar(ai.id, 0) ? -45 : isFriend(ai.id) ? 30 : 18; ai.op = (ai.op || 0) + Math.sign(tgt - (ai.op || 0)) * Math.min(1, Math.abs(tgt - (ai.op || 0))); }
    // wars wear out: a losing side asks for peace (you are asked, rivals just agree)
    for (const ai of live) for (const o of ids) {
      if (o === ai.id || (o !== 0 && o < ai.id) || !atWar(ai.id, o)) continue;
      const len = relLen(ai.id, o); if (len < 6) continue;
      const weaker = realmPower(ai.id) < realmPower(o) * 0.8;
      if (!(weaker ? Math.random() < 0.3 : len > 14 && Math.random() < 0.1)) continue;
      if (o === 0) {
        const i = await showModal(`<h2>🕊 The ${FN(ai.id)} realm proposes peace</h2><p>The war has gone on for ${len} days. They offer to lay down their arms.</p>`, ['Keep fighting', '🕊 Accept peace']);
        if (i === 1) { setRel(ai.id, 0, 'peace'); note(`🕊 Peace with the ${FN(ai.id)} realm`); }
      } else { setRel(ai.id, o, 'peace'); toast(`🕊 The ${FN(ai.id)} and ${FN(o)} realms make peace.`); }
    }
    // a realm that is at peace with everyone may pick a neighbour that looks weak
    for (const ai of live) {
      if (G.day < 10 + ai.id * 2 || ids.some(o => o !== ai.id && atWar(ai.id, o)) || Math.random() > aggr * (PERS[ai.pers] || PERS.balanced).aggr) continue;
      const mine = realmPower(ai.id), homes = G.objs.filter(t => t.t === 'town' && t.owner === ai.id); if (!homes.length) continue;
      let best = null;
      for (const o of ids) {
        if (o === ai.id || isAlly(ai.id, o) || (o === 0 && !met(ai.id)) || truceLeft(ai.id, o)) continue;
        const ot = G.objs.filter(t => t.t === 'town' && t.owner === o); if (!ot.length) continue;
        const them = realmPower(o); if (mine < them * 0.7) continue;
        if (o === 0 && opOf(ai.id) > 25) continue;   // a friend does not attack you
        const d = Math.min(...ot.flatMap(t => homes.map(h => hexDist(t, h)))), sc = (mine / them) * (o === 0 ? 1.15 * (1 + Math.max(0, -opOf(ai.id)) / 40) : 1) / (1 + d / 40);
        if (!best || sc > best.sc) best = { o, sc };
      }
      if (!best) continue;
      declareWar(ai.id, best.o);
      if (best.o === 0) await showModal(`<h2>⚔ The ${FN(ai.id)} realm declares war!</h2><p>Their heroes will march on your lands. You can still seek peace in the <b>Diplomacy</b> screen (Menu).</p>`, ['To arms!']);
      else toast(`⚔ The ${FN(ai.id)} realm declares war on the ${FN(best.o)} realm.`);
    }
    // friends and allies at war ask you to join; a proud giant may betray a weak friend
    for (const ai of live) {
      if (!ai.alive || !met(ai.id) || !(isAlly(ai.id, 0) || isFriend(ai.id))) continue;
      const foes = live.filter(x => x.id !== ai.id && atWar(ai.id, x.id) && !atWar(0, x.id) && !isAlly(0, x.id) && !truceLeft(0, x.id));
      if (foes.length && Math.random() < 0.08 && (G.dipLog['j' + ai.id] || -99) < G.day - 12) {
        G.dipLog['j' + ai.id] = G.day; const x = foes[0];
        const i = await showModal(`<h2>⚔ The ${FN(ai.id)} realm asks for help</h2><p>They are at war with the ${FN(x.id)} realm and ask you to join them. Refusing will cost their goodwill.</p>`, ['Refuse', '⚔ Join the war']);
        if (i === 1) { declareWar(0, x.id, true); addOp(ai.id, 10, 'You joined our war'); } else addOp(ai.id, -8, 'You refused to help');
        continue;
      }
      if (G.day > 20 && (ai.pers === 'proud' || ai.pers === 'stubborn') && opOf(ai.id) < 40 && realmPower(ai.id) > realmPower(0) * 3 && Math.random() < 0.02) {
        if (isAlly(ai.id, 0)) ai.team = 10 + ai.id;
        declareWar(ai.id, 0);
        await showModal(`<h2>🗡 Betrayal!</h2><p>The ${FN(ai.id)} realm saw your weakness and breaks its word: <b>they declare war on you!</b></p>`, ['Curse them']);
      }
    }
    // a much stronger neighbour at peace with you may demand tribute
    for (const ai of live) {
      if (G.day < 15 || !ai.alive || !met(ai.id) || truceLeft(ai.id, 0) || atWar(ai.id, 0) || isAlly(ai.id, 0) || Math.random() > 0.05 || (G.dipLog['t' + ai.id] || -99) > G.day - 12) continue;
      if (realmPower(ai.id) < realmPower(0) * 2.2) continue;
      const gold = Math.round(Math.min(G.res.gold * 0.35, 800 + G.day * 60) / 50) * 50; if (gold < 300) continue;
      G.dipLog['t' + ai.id] = G.day;
      const i = await showModal(`<h2>💰 The ${FN(ai.id)} realm demands tribute</h2><p>Their armies dwarf yours. They want <b>${RES_ICON.gold}${gold}</b> gold. Refuse, and it means war.</p>`, ['⚔ Refuse (war)', `💰 Pay ${gold}`]);
      if (i === 1) { G.res.gold -= gold; ai.gold += gold; renderAll(); } else declareWar(ai.id, 0);
    }
  }
  const ART_VAL = { 1: 1500, 2: 3500, 3: 7000, 4: 12000, 5: 20000 }, artVal = (id) => ART_VAL[ART[id].tier] || 3000;
  const heroArts = (h) => [...Object.entries(h.arts || {}).filter(([, v]) => v).map(([s, id]) => ({ id, where: 'slot', ref: s })), ...(h.pack || []).map((id, i) => ({ id, where: 'pack', ref: i }))];
  function openDiplomacy() {
    if (!G.dip) return toast('Diplomacy is off in this game: every rival is your enemy.');
    G.dipLog = G.dipLog || {};
    const word = (p) => p < 0.6 ? 'weaker than you' : p < 1.4 ? 'about your strength' : p < 2.5 ? 'stronger than you' : 'far stronger';
    const rows = G.ais.map(ai => {
      if (!met(ai.id) && ai.alive) return `<div class="trow" style="display:block"><span class="zdot" style="background:#777"></span> <b>❓ An unknown realm</b><br><span class="small">You have not met them yet. Explore until you see their heroes or lands.</span></div>`;
      const id = ai.id, tw = G.objs.filter(o => o.t === 'town' && o.owner === id).length;
      const ally = isAlly(0, id), war = atWar(0, id);
      const st = !ai.alive ? 'eliminated' : ally ? '🤝 allied' : war ? '⚔ at war' : isFriend(id) ? '🙂 friends' : '🕊 at peace';
      const fr = isFriend(id), ob = hasFlag(id, 'ob'), cw = G.ais.some(o => o.alive && o.id !== id && atWar(0, o.id) && !atWar(id, o.id) && !isAlly(id, o.id));
      const btns = !ai.alive ? '' : ally ? `<button data-d="trade:${id}">⚖ Trade</button><button data-d="gift:${id}">🎁 Gift</button>${cw ? `<button data-d="join:${id}">⚔ Call to war</button>` : ''}<button data-d="break:${id}">Break alliance</button>`
        : war ? `<button data-d="peace:${id}">🕊 Propose peace</button><button data-d="demand:${id}">📜 Demand</button>`
          : `<button data-d="trade:${id}">⚖ Trade</button><button data-d="gift:${id}">🎁 Gift</button><button data-d="demand:${id}">📜 Demand</button>${fr ? '' : `<button data-d="friend:${id}">🙂 Friendship</button>`}<button data-d="ob:${id}">${ob ? '🚪 Close borders' : '🚪 Open borders'}</button>${fr ? `${cw ? `<button data-d="join:${id}">⚔ Call to war</button>` : ''}<button data-d="ally:${id}">🤝 Alliance</button>` : ''}<button data-d="denounce:${id}">📢 Denounce</button><button data-d="war:${id}"${truceLeft(0, id) ? ' disabled' : ''} title="${truceLeft(0, id) ? 'Peace treaty: no war for ' + truceLeft(0, id) + ' more day(s)' : ''}">⚔ Declare war${truceLeft(0, id) ? ' (truce ' + truceLeft(0, id) + 'd)' : ''}</button>`;
      return `<div class="trow" style="display:block"><div><span class="zdot" style="background:${ownCol(id)};color:${ownCol(id)}"></span> <b>${FACTIONS[ai.fac].icon} ${FACTIONS[ai.fac].name} realm</b> — ${st}${ai.alive ? `<br><span class="small" title="${(ai.opLog || []).map(l => (l.v > 0 ? '+' : '') + l.v + ' ' + l.why).join('\n') || 'Nothing has happened yet.'}">Opinion of you: <b>${opWord(opOf(id))} (${opOf(id) > 0 ? '+' : ''}${Math.round(opOf(id))})</b> · ${PERS[ai.pers].n} — ${PERS[ai.pers].tip}. ${tw} town${tw === 1 ? '' : 's'}, ${ai.heroes.length} hero${ai.heroes.length === 1 ? '' : 'es'} — ${word(realmPower(id) / realmPower(0))}</span>` : ''}</div><div class="acts" style="margin-top:6px">${btns}</div></div>`;
    }).join('');
    const dealsHtml = (G.deals || []).length ? `<h4>Standing deals</h4>` + G.deals.map((d, i) => `<div class="trow" style="display:flex;justify-content:space-between;align-items:center"><span>${RES_ICON[d.g]}${d.gq} ⇄ ${RES_ICON[d.t]}${d.tq} a day with the ${FN(d.id)} realm — ${d.left} day(s) left</span><button data-d="cancel:${i}">Cancel</button></div>`).join('') : '';
    modalOpen(`<h2>🕊 Diplomacy</h2><p class="small">Your <b>diplomacy rank ${dipRank()}</b> (from your best hero's level): trades are ${Math.round(dipBonus() * 100)}% fairer and demands need ${Math.round(dipBonus() * 100)}% less strength. It rises as your heroes level up.</p><p class="small">Everyone starts at peace: nobody may attack until war is declared. Trade resources and artifacts, demand towns from the weak, seek an alliance — or break the peace yourself.</p>${rows}${dealsHtml}<div class="mb"><button class="primary" id="dpClose">Close</button></div>`);
    $('dpClose').onclick = closeModal;
    $('mbox').querySelectorAll('[data-d]').forEach(b => b.onclick = async () => {
      const [k, s] = b.dataset.d.split(':'), id = +s, ai = aiById(id), mine = realmPower(0), theirs = ai ? realmPower(id) : 0;
      if (k === 'war') { const i = await showModal(`<h2>⚔ Declare war on the ${FN(id)} realm?</h2><p>Their heroes and armies will come for you.</p>`, ['Cancel', '⚔ Declare war']); if (i === 1) declareWar(0, id); }
      else if (k === 'friend') {
        const r = relObj(0, id);
        if (r && r.den > G.day - 20) await showModal(`<h2>✋ Refused</h2><p>"You denounced us not long ago."</p>`);
        else if (opOf(id) >= 20 && relLen(0, id) >= 3) { setFlag(id, 'f', true); addOp(id, 6, 'Declared friendship'); await showModal(`<h2>🙂 Friendship</h2><p>The ${FN(id)} realm declares friendship with you. Opinions between friends warm quickly, and you may now ask for shared vision, a call to arms or an alliance.</p>`); }
        else await showModal(`<h2>✋ Refused</h2><p>"${opOf(id) < 20 ? 'We do not know you well enough — we need to think of you as friendly first (opinion +20).' : 'Give it a little more time.'}"</p>`);
      }
      else if (k === 'ob') {
        if (hasFlag(id, 'ob')) { setFlag(id, 'ob', false); toast('Borders closed again.'); }
        else if (opOf(id) >= 10) { setFlag(id, 'ob', true); recomputeVision(); await showModal(`<h2>🚪 Open borders</h2><p>Your heroes may cross the ${FN(id)} realm's land and theirs may cross yours. You also share what you see.</p>`); }
        else await showModal(`<h2>✋ Refused</h2><p>"${opOf(id) < 0 ? 'Keep out of our land.' : 'We do not let strangers cross our land. Earn our goodwill first (opinion +10).'}"</p>`);
      }
      else if (k === 'denounce') {
        const i = await showModal(`<h2>📢 Denounce the ${FN(id)} realm?</h2><p>They will think much less of you, and any friendship or shared vision ends. Realms at war with them approve. It is a step toward war — going to war soon after is seen as justified.</p>`, ['Cancel', '📢 Denounce']);
        if (i === 1) { addOp(id, -25, 'You denounced them'); for (const x of G.ais) if (x.alive && x.id !== id && met(x.id) && atWar(x.id, id)) addOp(x.id, 5, `You denounced our enemy`); setFlag(id, 'f', false); setFlag(id, 'ob', false); setFlag(id, 'den', G.day); }
      }
      else if (k === 'join') {
        const cands = G.ais.filter(o => o.alive && o.id !== id && atWar(0, o.id) && !atWar(id, o.id) && !isAlly(id, o.id));
        if (!cands.length) await showModal(`<h2>⚔ Call to war</h2><p>You have no enemy they could join against.</p>`);
        else {
          const j = await showModal(`<h2>⚔ Call the ${FN(id)} realm to war</h2><p>Against whom?</p>`, [...cands.map(o => `${FACTIONS[o.fac].icon} ${FACTIONS[o.fac].name}`), 'Cancel']);
          if (j < cands.length) {
            const tg = cands[j];
            if (truceLeft(id, tg.id)) await showModal(`<h2>✋ Refused</h2><p>"We have a peace treaty with them that we cannot break yet."</p>`);
            else if (isAlly(0, id) || opOf(id) >= 30) { declareWar(id, tg.id, true); await showModal(`<h2>⚔ They join you</h2><p>The ${FN(id)} realm declares war on the ${FN(tg.id)} realm.</p>`); }
            else await showModal(`<h2>✋ Refused</h2><p>"It is not our war."</p>`);
          }
        }
      }
      else if (k === 'cancel') { const d = G.deals[id]; if (d) { G.deals.splice(id, 1); addOp(d.id, -2, 'You cancelled a deal'); } }
      else if (k === 'gift') {
        const gold = 500;
        if (G.res.gold < gold) await showModal(`<h2>🎁 Gift</h2><p>You need ${gold} gold.</p>`);
        else if ((G.dipLog['g' + id] || -99) > G.day - 4) await showModal(`<h2>🎁 Gift</h2><p>You gave them something very recently — a second gift so soon means little.</p>`);
        else { G.res.gold -= gold; ai.gold += gold; G.dipLog['g' + id] = G.day; addOp(id, 8, 'A gift of gold'); await showModal(`<h2>🎁 Gift accepted</h2><p>The ${FN(id)} realm thinks better of you (${opWord(opOf(id))}).</p>`); }
      }
      else if (k === 'peace') {
        if (relLen(0, id) >= 2 && theirs < mine * PERS[ai.pers].peace * (1 + opOf(id) / 200)) { setRel(0, id, 'peace'); await showModal(`<h2>🕊 Peace</h2><p>The ${FN(id)} realm accepts. The war is over.</p>`); }
        else await showModal(`<h2>✋ Refused</h2><p>"${relLen(0, id) < 2 ? 'The war has hardly begun.' : 'We are winning. There will be no peace.'}"</p>`);
      } else if (k === 'break') { ai.team = 10 + id; setRel(0, id, 'peace'); toast('The alliance is over — you are at peace.'); }
      else if (k === 'ally') {
        const common = G.ais.some(o => o.alive && o.id !== id && (atWar(id, o.id) || atWar(0, o.id)));
        if (!isFriend(id)) await showModal(`<h2>✋ Refused</h2><p>"We are not even friends. Let us start with friendship."</p>`);
        else if (relLen(0, id) >= 5 && opOf(id) >= 12 && (common || theirs < mine * 0.8)) { ai.team = 1; await showModal(`<h2>🤝 Alliance</h2><p>The ${FN(id)} realm joins you. They will never attack you, and you share what you see.</p>`); }
        else await showModal(`<h2>✋ Refused</h2><p>"${relLen(0, id) < 5 ? 'We hardly know you.' : opOf(id) < 12 ? 'We do not trust you enough yet.' : 'We have no common cause.'}"</p>`);
      } else if (k === 'trade') return openTrade(id);
      else if (k === 'demand') return openDemand(id);
      openDiplomacy(); renderAll();
    });
  }
  function openDemand(id) {
    const ai = aiById(id), fear = realmPower(0) / realmPower(id), mine = G.objs.filter(o => o.t === 'town' && o.owner === id);
    const tribute = Math.floor(ai.gold * 0.4 / 50) * 50, pm = persOf(id).mul * (1 - dipBonus()), needG = 1.6 * pm, needT = 2.5 * pm, never = pm === Infinity;
    const fmt = (v) => never ? 'never' : v.toFixed(1) + '×';
    const rows = mine.filter(t => mine.length > 1 && !ai.heroes.some(h => h.x === t.x && h.y === t.y)).map(t => `<div class="trow" style="display:flex;justify-content:space-between;align-items:center"><span><b>${t.name}</b></span><button data-dm="town:${G.objs.indexOf(t)}">Demand this town</button></div>`).join('');
    modalOpen(`<h2>📜 Demands on the ${FN(id)} realm</h2><p class="small">They give in only to fear: your armies must be clearly stronger than theirs (now <b>${fear.toFixed(1)}×</b>). The ${persOf(id).n.toLowerCase()} ${FN(id)} realm needs <b>${fmt(needG)}</b> for tribute and <b>${fmt(needT)}</b> for a town${never ? ' — they will not listen to any demand' : ''}. Refusing at peace can end in war.</p>
      <div class="trow" style="display:flex;justify-content:space-between;align-items:center"><span><b>Tribute</b> — ${RES_ICON.gold}${tribute}</span><button data-dm="gold:0"${tribute < 100 ? ' disabled' : ''}>Demand gold</button></div>${rows || '<p class="small">They have no town to spare.</p>'}
      <div class="mb"><button id="dmBack">Back</button></div>`);
    $('dmBack').onclick = openDiplomacy;
    $('mbox').querySelectorAll('[data-dm]').forEach(b => b.onclick = async () => {
      const [k, s] = b.dataset.dm.split(':'), need = k === 'town' ? needT : needG;
      if (fear >= need) {
        if (k === 'gold') { ai.gold -= tribute; G.res.gold += tribute; sfx('coin'); await showModal(`<h2>💰 Tribute paid</h2><p>The ${FN(id)} realm hands over ${RES_ICON.gold}${tribute}.</p>`); }
        else { addOp(id, -12, 'You forced them to cede a town'); const t = G.objs[+s]; takeTown(t, 0); await showModal(`<h2>🏰 ${t.name} surrendered</h2><p>The ${FN(id)} realm cedes the town to you rather than face your armies.</p>`); }
      } else {
        const war = !atWar(0, id) && !truceLeft(0, id) && (never ? Math.random() < 0.6 : fear < 1.1 && Math.random() < 0.5);
        addOp(id, -6, 'You made a demand');
        if (war) declareWar(id, 0);
        await showModal(`<h2>😠 Refused</h2><p>"${never ? 'We take no orders from anyone.' : 'You do not frighten us.'}"${war ? ' <b>They declare war!</b>' : ''}</p>`);
      }
      openDiplomacy(); renderAll();
    });
  }
  function openTrade(id) {
    const ai = aiById(id), ally = isAlly(0, id), war = atWar(0, id);
    const gives = [...RES.filter(k => G.res[k] > 0).map(k => ({ k: 'r:' + k, res: k, label: `${RES_ICON[k]} ${k} (${G.res[k]})` })),
      ...G.heroes.flatMap((h, hi) => heroArts(h).map(a => ({ k: `a:${hi}:${a.where}:${a.ref}`, art: a, hero: h, label: `${ART[a.id].i} ${ART[a.id].n} (${h.name})` })))];
    const gets = [...RES.map(k => ({ k: 'r:' + k, res: k, label: `${RES_ICON[k]} ${k}` })),
      ...ai.heroes.flatMap((h, hi) => heroArts(h).map(a => ({ k: `a:${hi}:${a.where}:${a.ref}`, art: a, hero: h, label: `${ART[a.id].i} ${ART[a.id].n} (${h.name})` })))];
    const st = openTrade.st = openTrade.st || { g: 0, q: 100, t: 0, r: 1 };
    const sel = (list, cur, idn) => `<select id="${idn}">${list.map((x, i) => `<option value="${i}"${i === cur ? ' selected' : ''}>${x.label}</option>`).join('')}</select>`;
    modalOpen(`<h2>⚖ Trade with the ${FN(id)} realm</h2><p class="small">${war ? 'They will not trade with an enemy.' : ally ? 'Allies trade at fair value.' : `They buy at a discount and sell at a premium (your rank ${dipRank()} narrows the gap). Artifacts are worth more to them than the market says.`}</p>
      <div class="trow" style="grid-template-columns:1fr 90px"><div>You give<br>${sel(gives, Math.min(st.g, gives.length - 1), 'tgG')}</div><div>Amount<br><input type="number" id="tgQ" min="1" value="${st.q}"></div></div>
      <div class="trow" style="grid-template-columns:1fr 90px"><div>You get<br>${sel(gets, Math.min(st.t, gets.length - 1), 'tgT')}</div><div>Amount<br><input type="number" id="tgR" min="1" value="${st.r}"></div></div>
      <div class="small" style="margin-top:6px">Duration: <select id="tgD"><option value="1">once</option><option value="10">every day for 10 days (resources only)</option></select></div>
      <div id="tgV" style="margin:10px 0"></div><div class="mb"><button class="primary" id="tgGo">Offer</button><button id="tgBack">Back</button></div>`);
    const eval1 = () => {
      st.g = +$('tgG').value; st.t = +$('tgT').value; st.q = Math.max(1, parseInt($('tgQ').value) || 1); st.r = Math.max(1, parseInt($('tgR').value) || 1);
      const g = gives[st.g], t = gets[st.t]; if (!g || !t) return { ok: false, why: 'Choose what to trade.' };
      if (war) return { ok: false, why: 'They refuse: you are at war.' };
      if (g.res && g.res === t.res) return { ok: false, why: 'Choose two different things.' };
      const qg = g.art ? 1 : st.q, qt = t.art ? 1 : st.r;
      if (g.res && G.res[g.res] < qg) return { ok: false, why: 'You do not have that much.' };
      if (opOf(id) <= -30) return { ok: false, why: 'They despise you too much to deal with you.' };
      const b = dipBonus() + opOf(id) / 500, buy = ally ? 1 : 0.85 + b, sell = ally ? 1 : 1.15 - b;
      const vg = g.art ? artVal(g.art.id) * (ally ? 1 : 0.8 + b) : qg * RES_VALUE[g.res] * buy, vt = t.art ? artVal(t.art.id) * (ally ? 1 : 1.3 - b) : qt * RES_VALUE[t.res] * sell;
      if (t.res) { const have = t.res === 'gold' ? ai.gold : t.res === 'food' ? (ai.food || 0) : ai.gold / RES_VALUE[t.res]; if (have < qt) return { ok: false, why: 'They do not have that much to spare.' }; }
      if (t.art && !G.heroes.some(h => h.pack.length < MAX_PACK || slotFor(h, ART[t.art.id]))) return { ok: false, why: 'No hero of yours can carry another artifact.' };
      return vg >= vt ? { ok: true, why: `✔ They accept (${Math.round(vg)} offered for ${Math.round(vt)}).`, g, t, qg, qt } : { ok: false, why: `✘ Not enough: they value your offer at ${Math.round(vg)}, the price is ${Math.round(vt)}.` };
    };
    const upd = () => { const e = eval1(); $('tgV').innerHTML = `<span style="color:${e.ok ? '#9be59b' : '#f0a090'}">${e.why}</span>`; $('tgGo').disabled = !e.ok; return e; };
    ['tgG', 'tgT', 'tgQ', 'tgR'].forEach(x => { $(x).oninput = upd; $(x).onchange = upd; });
    $('tgBack').onclick = openDiplomacy;
    $('tgGo').onclick = () => {
      const e = upd(); if (!e.ok) return; const { g, t, qg, qt } = e;
      // what the rival receives
      if (g.res) { if (g.res === 'food') ai.food = (ai.food || 0) + qg; else ai.gold += g.res === 'gold' ? qg : Math.round(qg * RES_VALUE[g.res] * 0.9); G.res[g.res] -= qg; }
      else { const a = g.art; if (a.where === 'slot') g.hero.arts[a.ref] = null; else g.hero.pack.splice(a.ref, 1); g.hero.av++; if (ai.heroes[0]) giveArt(ai.heroes[0], a.id); }
      // what you receive
      if (t.res) { if (t.res === 'food') ai.food = (ai.food || 0) - qt; else ai.gold -= t.res === 'gold' ? qt : Math.round(qt * RES_VALUE[t.res]); G.res[t.res] += qt; }
      else { const a = t.art; if (a.where === 'slot') t.hero.arts[a.ref] = null; else t.hero.pack.splice(a.ref, 1); t.hero.av++; [G.hero, ...G.heroes].filter(Boolean).find(h => giveArt(h, a.id) !== 'full'); }
      const days = +$('tgD').value; if (days > 1 && g.res && t.res) (G.deals = G.deals || []).push({ id, g: g.res, gq: qg, t: t.res, tq: qt, left: days - 1 });
      addOp(id, 2, 'A fair trade'); sfx('coin'); toast('Deal done.'); openDiplomacy(); renderAll();
    };
    upd();
  }
  async function aiPhase() {
    await aiDiplomacy();
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
      if (o.t === 'mine' && o.owner === 0 && terrOwner(o.x, o.y) === 0) gain[o.kind] += MINE_YIELD[o.kind] * ((G.wk && G.wk.mineMul) || 1);
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
    try { await doEndTurn0(); }
    catch (e) { console.error('end turn failed', e); toast('Something went wrong ending the turn — the game carried on.'); try { $('modal').classList.add('hide'); } catch (e2) { /* ignore */ } }
    finally { busy = false; try { renderAll(); } catch (e) { /* ignore */ } }
  }
  async function doEndTurn0() {
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
    G.over = true; if (win) Ach.event('win', { diff: G.diff, size: G.size, day: G.day }); if (win) { if (!(typeof Sfx !== 'undefined' && Sfx.victory && Sfx.victory())) sfx('fanfare'); } else sfx('lose'); if (win && typeof Celebrate !== 'undefined') Celebrate.game();
    try { localStorage.removeItem(SAVE); } catch (e) { /* ignore */ }
    if (win) { await victoryScreen(); $('title').classList.remove('hide'); refreshTitle(); return; }
    await showModal(win ? `<h2>🏆 Victory!</h2><p>Every rival has lost its towns: you rule the realm on day ${G.day} (${DF().name}). Well fought!</p>` : window.vicBanner('Defeat', why || 'Your hero has fallen.', 'lose'), ['Main menu']);
    $('title').classList.remove('hide'); refreshTitle();
  }

  // ---------- title / selection / help ----------
  const HELP = `<h2>How to Play</h2><p><b>Goal:</b> eliminate every rival by capturing all of their towns. Rival AI players build, recruit, hire several heroes and expand across the map — and they will attack your forts and towns. If you hold no town for 7 days you lose.</p>
    <p><b>Towns:</b> capture neutral and rival towns for more castles (each keeps its own faction, creatures and buildings). Use the tabs in the town screen to switch towns, and station a garrison so a town defends itself when no hero is inside.</p>
    <p><b>Map:</b> click a tile to preview the path (the footprints are gold if you arrive today, blue on day 2, red on day 3 or later), click again to walk. Click another hero to select it (Tab cycles). Monsters facing an army ${FLEE_RATIO}× stronger offer to flee (or pay tribute); with the Silver Tongue perk they can join you instead. A rival hero who is hopelessly outmatched may offer gold to be let go, and if you are the outmatched one you can pay a ransom to retreat to your nearest castle with your army intact. Walk onto resources to grab them; mines give daily income; monsters, mines and artifacts are guarded. Merchants ⛺ sell missing resources.<br>
    Keys: arrows/WASD scroll · +/- zoom · H center hero · Space go · E end turn · T town · Tab next hero. Drag the map to pan, mouse wheel / pinch to zoom.<br>
    <b>On a phone:</b> drag to pan, pinch to zoom, tap a tile to preview the path and tap it again to go; in battle, tap a hex twice to confirm. Use the bottom bar for End Turn, Town and heroes.</p>
    <p><b>Sea:</b> build a Shipyard in town, then boats at the port by the bay. Walk a hero onto a boat to sail; collect floating treasures, salvage shipwrecks, fight sea monsters, and disembark on any shore tile. Pick the map type, size and seed when starting a game.</p>
    <p><b>Events:</b> every new week brings a weekly event (double growth for a creature, plague, bountiful harvest, merchant caravans, heroic training...) and most days a random event may strike — treasure, bandits, mercenaries, storms, rumors.</p>
    <p><b>Borders:</b> every building you hold claims the land around it (towns reach furthest, a captured mine or dwelling claims a small patch); where claims meet, the stronger one wins, and your mines pay when they stand on your land. <b>Territory:</b> the map is split into zones, each ruled by a fort. Capture a fort to own the zone: +${FORT_INCOME} gold/day, your mines there pay, +${MILITIA} militia/week. <b>Station troops in forts</b> — the enemy hero raids undefended forts.</p>
    <p><b>Town:</b> Town Hall levels 1-5 raise income and unlock dwellings (tiers 3-7) and creature upgrades (up to 5 levels). Arcane Lodge teaches spells, the Merchant Row trades resources, the Tavern hires up to ${MAX_HEROES} heroes.</p>
    <p><b>Fog of war:</b> unexplored land is black; explored land you no longer see is dimmed and hides monsters and rival heroes. Heroes see 6 tiles (+1 per Far-Sight rank), towns 9, forts 6. Observation towers and scouts reveal large areas. <b>Adventure sites:</b> dwellings (capture, then recruit weekly), windmills / water wheels / gardens (weekly resources), learning stones (experience), shrines (spells), creature banks (guarded treasure), monoliths (teleport pairs), seers (trade resources for an artifact) and springs (mana, movement or luck).</p>
    <p><b>Defenses:</b> build Fortifications (Citadel → Castle → Fortress) to strengthen walls, gate and arrow towers, and a Minefield for hidden mines in front of the walls — mines hurt and halt attackers. When you defend, you can also lay mines yourself (💣 button, key M); even without a minefield you get ${EMERGENCY_MINES}. Forts can be fortified too.</p>
    <p><b>Spells:</b> 18 spells in four schools — 🌬️ Air, ⛰️ Earth, 🔥 Fire, 💧 Water. Each school is a skill (Basic → Expert) that makes its spells stronger; at <b>Expert</b> buffs and debuffs become mass spells and areas grow. A spell of level L needs Insight rank L-2 (levels 1-2 are free). The Arcane Lodge teaches higher-level spells; shrines teach one each. You cast one spell per round.</p>
    <p><b>Skills &amp; artifacts:</b> each hero starts with two skills and, at every level-up, picks one of two offered skills (Basic → Advanced → Expert; up to ${MAX_SKILLS} skills; the offers favour the hero's class). Artifacts are equipment: they have slots (head, neck, armor, weapon, shield, feet, cape, two rings), tiers, special effects (movement, mana, morale, luck, extra skill ranks such as Wave Treading) and <b>sets</b> that give bonuses when completed. Use 🎒 Equipment on the hero panel; heroes standing together can hand artifacts to each other.</p>
    <p><b>Battle:</b> click a green hex to move, click an enemy to attack (archers shoot — +25% at close range, weaker the farther the target, and <b>half damage beyond 10 hexes: the broken arrow 💔</b>; flyers ignore obstacles). Your hero stands beside the field: cast one spell per round and make one Hero Strike per round. Castle assaults are <b>sieges</b>: break the gate or walls (your catapult helps), beware arrow towers and the moat; flyers can cross the walls. Level-ups let you pick one of two perks.</p>`;
  function refreshTitle() { $('tCont').disabled = !localStorage.getItem(SAVE); $('tLoad').disabled = !['h3js_save_v7', 'h3js_slot_1', 'h3js_slot_2', 'h3js_slot_3'].some(k => localStorage.getItem(k)); }
  function showDifficultySelect() {
    const cards = Object.entries(DIFFICULTY).map(([k, d]) => `<div class="card dif${Settings.mem('lastDiff') === k ? ' on' : ''}" data-d="${k}"><div class="big">${d.icon}</div><b>${d.name}</b><div class="small">${d.desc}</div>
      <div class="difstats"><div><span>Start gold</span><b>${d.gold.toLocaleString()}</b></div><div><span>Guards</span><b>×${d.neutral}</b></div><div><span>Your income</span><b>×${d.income}</b></div><div><span>Rivals march</span><b>day ${d.ehDay}</b></div><div><span>Rival armies</span><b>×${d.ehMul}</b></div><div><span>Rival income</span><b>×${d.aiInc}</b></div></div></div>`).join('');
    $('mbox').innerHTML = `<span data-bg="difficulty_select"></span><h2>Choose difficulty</h2><div class="grid two">${cards}</div><div class="mb"><button id="sBack">Back</button></div>`;
    $('sBack').onclick = () => $('modal').classList.add('hide');
    $('mbox').querySelectorAll('.card').forEach(c => c.onclick = () => { Settings.mem('lastDiff', c.dataset.d); showMapSelect(c.dataset.d); });
    $('modal').classList.remove('hide');
  }
  function showMapSelect(diff, st = Object.assign({ preset: 'plains', size: 'medium', seed: '', wrap: true }, Settings.mem('lastMap') || {})) {
    Settings.mem('lastMap', { preset: st.preset, size: st.size, fog: st.fog, ais: st.ais, color: st.color, wrap: st.wrap, dip: st.dip });     // the next game starts with the same options
    const cards = Object.entries(MAPS).map(([k, m]) => `<div class="card${st.preset === k ? ' on' : ''}" data-m="${k}"><img class="mprev" src="${mapPreview(k, undefined, k)}" alt="" draggable="false"><b>${m.name}</b><div class="small">${m.desc}</div></div>`).join('');
    const sizes = Object.entries(SIZES).map(([k, s]) => `<button class="${st.size === k ? 'primary' : ''}" data-s="${k}">${s.name} (${s.w}×${s.h})</button>`).join(' ');
    $('mbox').innerHTML = `<div class="setup"><span data-bg="map_select"></span><h2>Choose your map<span class="small">${DIFFICULTY[diff].icon} ${DIFFICULTY[diff].name}</span></h2><div class="grid two">${cards}</div>
      <div class="optpanel">
        <div class="opt"><label>Map size</label><div class="optc"><div class="opts">${Object.entries(SIZES).map(([k, s]) => `<button class="${st.size === k ? 'primary' : ''}" data-s="${k}"><b>${s.name}</b><small>${s.w}×${s.h}</small></button>`).join('')}</div></div></div>
        <div class="opt"><label>Fog of war</label><div class="optc"><div class="opts">${[[true, 'On'], [false, 'Off']].map(([v, n]) => `<button class="${(st.fog !== false) === v ? 'primary' : ''}" data-fog="${v}"><b>${n}</b></button>`).join('')}</div><small>Unexplored land is hidden; scouts, towers and your heroes reveal it.</small></div></div>
        <div class="opt"><label>Map edges</label><div class="optc"><div class="opts">${[[true, 'Globe'], [false, 'Walled']].map(([v, n]) => `<button class="${(st.wrap !== false) === v ? 'primary' : ''}" data-wrap="${v}"><b>${n}</b></button>`).join('')}</div><small>Globe: the world has no edge, walk east to come out in the west. Walled: the edges cannot be crossed.</small></div></div>
        <div class="opt"><label>Diplomacy</label><div class="optc"><div class="opts">${[[true, 'On'], [false, 'Old rules']].map(([v, n]) => `<button class="${(st.dip !== false) === v ? 'primary' : ''}" data-dip="${v}"><b>${n}</b></button>`).join('')}</div><small>On: everyone starts at peace — war must be declared, and you can trade, make demands and ally. Old rules: every rival is your enemy from the start, no diplomacy.</small></div></div>
        <div class="opt"><label>Rivals</label><div class="optc"><div class="opts">${[0, 1, 2, 3, 4].map(n => `<button class="${(st.ais || 0) === n ? 'primary' : ''}" data-a="${n}"><b>${n ? n : 'Auto'}</b></button>`).join('')}</div><small>AI players that expand and fight you.</small></div></div>
        <div class="opt"><label>Seed</label><div class="optc"><div class="seedrow"><input id="mSeed" placeholder="empty = random map" value="${st.seed}"><button id="mDice" title="Pick a random seed">🎲 Random</button></div><small>Share a seed to replay the same map.</small></div></div>
        <div class="opt"><label>Your flag</label><div class="optc"><div class="flags">${PALETTE.map((p, i) => `<button class="swatch flagbtn${(st.color || 0) === i ? ' on' : ''}" data-col="${i}" title="${p[0]}">${flagImg(i, 34)}</button>`).join('')}</div></div></div>
        ${(() => { const n = st.ais || ({ small: 1, medium: 2, large: 3, huge: 4, giant: 4 }[st.size] || 1), free = PALETTE.map((p, i) => i).filter(i => i !== (st.color || 0)); st.teams = st.teams || []; return Array.from({ length: n }, (_, i) => `<div class="opt"><label class="rivlab">${flagImg(free[i % free.length], 24)}<span>Rival ${i + 1}</span></label><div class="optc"><div class="opts">${[['enemy', '⚔ Enemy'], ['ally', '🤝 Ally'], ['bloc', '⚔⚔ Bloc']].map(([v, l]) => `<button data-tm="${i}:${v}" class="${(st.teams[i] || 'enemy') === v ? 'primary' : ''}"><b>${l}</b></button>`).join('')}</div></div></div>`).join(''); })()}
        <div class="optnote">Allies never attack you, share vision and let you swap troops; an enemy bloc fights together. You win when every enemy realm is gone.</div>
      </div>
      <div class="mb"><button id="sBack">Back</button><button class="primary" id="sNext">Next: castle</button></div></div>`;
    const keep = () => { st.seed = $('mSeed').value; };
    $('mDice').onclick = () => { $('mSeed').value = String(Math.floor(Math.random() * 900000) + 100000); };
    $('mbox').querySelectorAll('[data-col]').forEach(b => b.onclick = () => { keep(); st.color = +b.dataset.col; showMapSelect(diff, st); });
    $('mbox').querySelectorAll('[data-tm]').forEach(b => b.onclick = () => { keep(); const [i, v] = b.dataset.tm.split(':'); (st.teams = st.teams || [])[+i] = v; showMapSelect(diff, st); });
    $('mbox').querySelectorAll('[data-m]').forEach(c => c.onclick = () => { keep(); st.preset = c.dataset.m; showMapSelect(diff, st); });
    $('mbox').querySelectorAll('[data-s]').forEach(b => b.onclick = () => { keep(); st.size = b.dataset.s; showMapSelect(diff, st); });
    $('mbox').querySelectorAll('[data-dip]').forEach(b => b.onclick = () => { keep(); st.dip = b.dataset.dip === 'true'; showMapSelect(diff, st); });
    $('mbox').querySelectorAll('[data-wrap]').forEach(b => b.onclick = () => { keep(); st.wrap = b.dataset.wrap === 'true'; showMapSelect(diff, st); });
    $('mbox').querySelectorAll('[data-fog]').forEach(b => b.onclick = () => { keep(); st.fog = b.dataset.fog === 'true'; showMapSelect(diff, st); });
    $('mbox').querySelectorAll('[data-a]').forEach(b => b.onclick = () => { keep(); st.ais = +b.dataset.a; showMapSelect(diff, st); });
    $('sBack').onclick = showDifficultySelect;
    $('sNext').onclick = () => { keep(); showFactionSelect(diff, { ...st }); };
    $('modal').classList.remove('hide');
    Assets.need(['terrain/grass', 'terrain/water']).then(() => { if (!prevCache[Object.keys(MAPS)[0]] || !prevCache[Object.keys(MAPS)[0]].full) { const d = $('mbox').querySelectorAll('.mprev'); Object.keys(MAPS).forEach((k, i) => { delete prevCache[k]; if (d[i]) d[i].src = mapPreview(k, undefined, k); }); } });
  }
  // ---------- setup screens (wide layout): painted map previews, castle pictures with banners, hero chooser with detail panel ----------
  const FLAGS = ['blue', 'red', 'green', 'orange', 'purple', 'teal', 'pink', 'tan'];
  const flagImg = (i, px = 36) => { const u = Assets.url('flags/' + FLAGS[i]); return u ? `<img class="flagimg" src="${u}" alt="" draggable="false" style="height:${px}px">` : `<span class="zdot" style="background:${PALETTE[i][1]};width:${px * 0.5}px;height:${px * 0.5}px"></span>`; };
  const prevCache = {};
  // map previews are real maps: one is generated for each type and painted with the game's own terrain and building pictures
  function mapPreview(kind0, biome, asset) {
    const hand = asset && Assets.url('maps/' + asset); if (hand) return hand; // hand-made picture in art/maps/ wins
    const ck = kind0 + (biome || '');
    if (prevCache[ck] && prevCache[ck].full) return prevCache[ck].url;
    const full = !!(Assets.get('terrain/grass') && Assets.get('terrain/water'));
    let url = '';
    try {
      const mp = genMap(20260 + kind0.length * 31 + (biome ? biome.length * 7 : 0), ['necropolis'], 'normal', { preset: kind0, size: 'small', biome: biome || 'mixed' }); WRAP_W = G && G.wrap ? G.W : 0;
      const PW = (mp.W + 0.5) * 32, PH = mp.H * RH + HR * 0.5, big = document.createElement('canvas'); big.width = Math.ceil(PW); big.height = Math.ceil(PH);
      const bc = big.getContext('2d'), GF = { W: mp.W, H: mp.H, tiles: mp.tiles, biome: mp.biome, river: mp.river, zone: mp.zone, objs: mp.objs };
      for (let y = 0; y < mp.H; y++) for (let x = 0; x < mp.W; x++) Art.tile(bc, mp.tiles[y][x], x, y, GF);
      for (let y = 0; y < mp.H; y++) for (let x = 0; x < mp.W; x++) Art.tileOverlay(bc, mp.tiles[y][x], x, y, GF);
      for (const o of mp.objs.slice().sort((p, q) => p.y - q.y)) {
        if (!['town', 'mine', 'fort', 'lair', 'tower', 'shrine', 'chest'].includes(o.t)) continue;
        const spr = Art.obj(o, o.fac); if (!spr) continue; const px = (o.x + 0.5 + (o.y & 1) * 0.5) * 32, py = o.y * RH + HR, sz = o.t === 'town' ? 58 : 36;
        bc.drawImage(spr, px - sz / 2, py - sz * 0.62, sz, sz);
      }
      const W2 = 360, H2 = Math.round(W2 * PH / PW), c = document.createElement('canvas'); c.width = W2; c.height = H2; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(big, 0, 0, W2, H2);
      const sh = g.createLinearGradient(0, H2 * 0.6, 0, H2); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.4)'); g.fillStyle = sh; g.fillRect(0, 0, W2, H2);
      url = c.toDataURL('image/jpeg', 0.84);
    } catch (e) { url = ''; }
    prevCache[ck] = { url, full }; return url;
  }
  const facBanner = (k) => { const h = Art.facHue(k); return h === null ? '#6b4f24' : `hsl(${h},48%,30%)`; };
  const goalLine = (g) => g.type === 'gold' ? `Hold <b>${g.n.toLocaleString()}</b> gold before day ${g.days}` : g.type === 'towns' ? `Own <b>${g.n}</b> towns before day ${g.days}` : g.type === 'survive' ? `Hold a town until <b>day ${g.days}</b>` : 'Defeat every rival realm';
  function showScenarios(pick) {
    const cur = SCENARIOS.find(s => s.id === pick) || SCENARIOS[0];
    const tiles = SCENARIOS.map(s => `<div class="card scn${s === cur ? ' on' : ''}" data-sc="${s.id}"><img class="mprev" src="${mapPreview(s.map.preset, s.map.biome, 'scn_' + s.id)}" alt="" draggable="false"><b>${s.icon} ${s.name}</b><div class="small">${DIFFICULTY[s.diff].icon} ${DIFFICULTY[s.diff].name} · ${SIZES[s.map.size].name} · ${s.map.ais} rival${s.map.ais > 1 ? 's' : ''}</div></div>`).join('');
    const tm = (cur.map.teams || []).filter(Boolean), ally = tm.filter(t => t === 'ally').length, bloc = tm.filter(t => t === 'bloc').length;
    const panel = `<div class="hspan scnpan"><img class="mprev" src="${mapPreview(cur.map.preset, cur.map.biome, 'scn_' + cur.id)}" alt="" draggable="false"><h3>${cur.icon} ${cur.name}</h3><div class="hscls">${DIFFICULTY[cur.diff].icon} ${DIFFICULTY[cur.diff].name}</div><p class="scnb">${cur.blurb}</p>
      <h4>Objective</h4><div class="scngoal">🎯 ${goalLine(cur.goal)}</div>
      <h4>Setup</h4><div class="hsspells"><span>${MAPS[cur.map.preset].name}</span><span>${SIZES[cur.map.size].name} ${SIZES[cur.map.size].w}×${SIZES[cur.map.size].h}</span><span>${cur.map.ais} rival${cur.map.ais > 1 ? 's' : ''}</span>${ally ? '<span>🤝 ally</span>' : ''}${bloc ? '<span>⚔⚔ allied rivals</span>' : ''}<span>Fog ${cur.map.fog === false ? 'off' : 'on'}</span>${cur.map.biome && cur.map.biome !== 'mixed' && cur.map.biome !== 'none' ? `<span>${cur.map.biome} lands</span>` : ''}${cur.bonus ? `<span>+${cur.bonus.gold} gold</span>` : ''}</div>
      <button class="primary hsgo" id="scGo">Choose your castle →</button></div>`;
    $('mbox').innerHTML = `<div class="setup"><span data-bg="scenarios"></span><h2>Scenarios<span class="small">ready-made maps with an objective</span></h2><div class="hsbody"><div class="grid scngrid">${tiles}</div>${panel}</div><div class="mb"><button id="sBack">Back</button></div></div>`;
    $('sBack').onclick = () => $('modal').classList.add('hide');
    $('mbox').querySelectorAll('[data-sc]').forEach(c => { c.onclick = () => showScenarios(c.dataset.sc); c.ondblclick = () => go(); });
    const go = () => showFactionSelect(cur.diff, { ...cur.map, color: 0, scn: cur });
    $('scGo').onclick = go; $('modal').classList.remove('hide');
  }
  function showFactionSelect(diff = 'normal', map = {}) {
    const need = Object.keys(FACTIONS).map(k => 'ui/town_' + k);
    const draw = () => {
      const cards = Object.entries(FACTIONS).map(([k, f]) => `<div class="card fac${Settings.mem('lastFac') === k ? ' on' : ''}" data-f="${k}" style="--ban:${facBanner(k)}"><div class="facpic">${Assets.url('ui/town_' + k) ? `<img src="${Assets.url('ui/town_' + k)}" alt="" draggable="false">` : `<span class="facicon">${f.icon}</span>`}<div class="ribbon">${f.icon} ${f.name}</div></div>
        <div class="small blurb">${f.blurb}</div>
        <div class="crow">${factionTiers(k).map(id => `<span title="${C[id].n} → ${C[lineType(id, 2)].n}">${Art.pic(id, 44)}</span>`).join('')}</div></div>`).join('');
      $('mbox').innerHTML = `<div class="setup"><span data-bg="castle_select"></span><h2>Choose your castle <span class="small">${DIFFICULTY[diff].icon} ${DIFFICULTY[diff].name}</span></h2><div class="grid facgrid">${cards}</div><div class="mb"><button id="sBack">Back</button></div></div>`;
      $('sBack').onclick = () => map.scn ? showScenarios(map.scn.id) : showMapSelect(diff, map.preset ? map : undefined);
      $('mbox').querySelectorAll('.card').forEach(c => c.onclick = () => showHeroSelect(c.dataset.f, diff, map));
    };
    draw(); $('modal').classList.remove('hide');
    Assets.need(need).then(() => { if ($('mbox').querySelector('.facgrid')) draw(); });
  }
  // each castle can have its own hero-selection picture (art/ui/hero_select_<castle>.webp); without one the Castle picture is used for Castle and the castle's town scene for the others
  const heroBg = (f) => typeof Assets !== 'undefined' && Assets.has('ui/hero_select_' + f) ? 'hero_select_' + f : f === 'castle' ? 'hero_select' : 'town_' + f;
  // the hero's full painted art (a framed square, not a round crop); falls back to the round portrait when the art is missing
  const heroArt = (icon, px, pid) => typeof Assets !== 'undefined' && pid && Assets.has('heroes/' + pid) ? `<img class="hart" draggable="false" width="${px}" height="${px}" alt="" src="${Assets.src('heroes/' + pid)}">` : Art.heroPic(icon, ownCol(0), px, pid);
  function showHeroSelect(f, diff = 'normal', map = {}, pick) {
    const ti = factionTiers(f), list = FACTIONS[f].heroes.map(([n]) => Object.assign({ key: n }, HEROES[n])); pick = pick || Settings.mem('lastHero:' + f) || list[0].key;
    { const miss = list.map(d => 'heroes/' + d.id).filter(s => Assets.has(s) && !Assets.get(s)); if (miss.length) Assets.need(miss).then(() => { if ($('mbox').querySelector('.hsgrid')) showHeroSelect(f, diff, map, pick); }); }
    const cur = list.find(d => d.key === pick) || list[0];
    const tiles = list.map(d => `<button class="htile${d === cur ? ' on' : ''}" data-hid="${d.key}">${heroArt(d.i, 84, d.id)}<span>${d.name}</span><small>${clsLabel(d.cls)}</small></button>`).join('');
    const army = startArmy(cur, f).filter(Boolean).map(a => [a.t, a.n]);
    const panel = `<div class="hspan"><div class="hsbig">${heroArt(cur.i, 150, cur.id)}</div><h3>${cur.name}</h3><div class="hscls">${clsLabel(cur.cls)}${cur.sk ? ` · ${PERKS[cur.sk].i} ${PERKS[cur.sk].n}` : ''}</div>
      <div class="hsstats"><div><b>${cur.att}</b><span>Attack</span></div><div><b>${cur.def}</b><span>Defence</span></div><div><b>${cur.sp}</b><span>Spell power</span></div><div><b>${cur.kn}</b><span>Knowledge</span></div></div>
      <h4>Spells</h4><div class="hsspells">${[...START_SPELLS, ...cur.spells].map(k => `<span>${SPELLS[k].i} ${SPELLS[k].n}</span>`).join('')}</div>
      <h4>Starting army</h4><div class="hsarmy">${army.map(([id, n]) => `<div>${Art.pic(id, 60)}<small>${n} ${C[id].n}</small></div>`).join('')}</div>
      <button class="primary hsgo" id="hsGo">Play as ${cur.name}</button></div>`;
    $('mbox').innerHTML = `<div class="setup"><span data-bg="${heroBg(f)}"></span><h2>${FACTIONS[f].icon} ${FACTIONS[f].name} — choose your hero</h2><div class="hsbody"><div class="hsgrid">${tiles}</div>${panel}</div>
      <div class="small">Your rival will command a different castle. Fight them across zones, forts and sieges.</div><div class="mb"><button id="sBack">Back</button><button class="primary hsgo2" id="hsGo2">Play as ${cur.name}</button></div></div>`;
    $('sBack').onclick = () => showFactionSelect(diff, map);
    const go = (id) => { Settings.mem('lastFac', f); Settings.mem('lastHero:' + f, id); $('modal').classList.add('hide'); $('title').classList.add('hide'); newGame(f, id, diff, map); };
    $('mbox').querySelectorAll('.htile').forEach(b => { b.onclick = () => showHeroSelect(f, diff, map, b.dataset.hid); b.ondblclick = () => go(b.dataset.hid); });
    $('hsGo').onclick = () => go(cur.key); $('hsGo2').onclick = () => go(cur.key);
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
    const i = await showModal('<h2>Return to the main menu?</h2><p class="small">The game autosaves as you play, so your game is kept for Continue.</p>', ['💾 Save & exit', 'Exit', 'Cancel']);
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
  // with several towns the Town button asks which one to open
  function chooseTown() {
    const mt = myTowns(); if (mt.length < 2) return openTown();
    const pic = (t) => { const u = Assets.has('ui/town_' + t.fac) ? Assets.src('ui/town_' + t.fac) : ''; return u ? `<img src="${u}" alt="" draggable="false">` : ''; };
    $('mbox').innerHTML = `<h2>🏰 Which town?</h2><div class="townpick">${mt.map((t, i) => `<button class="tcard" data-pt="${i}">${pic(t)}<span class="tcn">${t.name}</span><span class="tci">${FACTIONS[t.fac].icon} ${FACTIONS[t.fac].name}${heroesAt(t.x, t.y).length ? ' · 🏇 hero inside' : ''}</span></button>`).join('')}</div><div class="mb"><button id="ptClose">Close</button></div>`;
    $('mbox').querySelectorAll('[data-pt]').forEach(b => b.onclick = () => { const t = mt[+b.dataset.pt]; centerOn(t.x, t.y); openTown(t); });
    $('ptClose').onclick = () => $('modal').classList.add('hide');
    $('modal').classList.remove('hide');
  }
  $('bTown').onclick = () => G && !busy && chooseTown();
  function fitZoom() { if (!G) return; setZoom(Math.min(cmap.clientWidth / ((G.W + 0.5) * TS), cmap.clientHeight / (G.H * RH + HR * 0.5)), 0, 0); clampCam(); }
  $('mEnd').onclick = endTurn;
  $('mapEnd').onclick = endTurn;
  // the right-hand panels fold down to their title (click it); the choice is remembered
  ['terr', 'townsPanel'].forEach(id => { const el = $(id); if (!el) return; const key = 'fold_' + id; if (Settings.mem(key)) el.classList.add('folded');
    el.addEventListener('click', (e) => { if (!e.target.closest('h3')) return; const f = el.classList.toggle('folded'); try { Settings.mem(key, f ? 1 : 0); } catch (err) { /* ignore */ } }); });
  { const tog = $('mTog'), apply = (v) => { document.body.classList.toggle('barhid', v); tog.firstChild.textContent = v ? '▲' : '▼'; try { Settings.mem('barhid', v ? 1 : 0); } catch (e) { /* ignore */ } };
    apply(!!(Settings.mem('barhid'))); tog.onclick = () => apply(!document.body.classList.contains('barhid')); }
  $('mTown').onclick = () => G && !busy && chooseTown();
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
  $('mLand').onclick = () => sheetOpen('🗺️ Territory', [$('minipanel'), $('terr')]);
  $('mMenu').onclick = () => openMenu();
  $('mDip').onclick = $('bDip').onclick = () => G && !busy && (G.dip ? openDiplomacy() : toast('Diplomacy is off in this game (old rules: everyone is an enemy).'));

  // custom art from art/ finished loading: rebuild every cached picture, set the title artwork
  document.addEventListener('assets-ready', () => {
    try { Art.reload(); TownArt.reload(); Icons.reload(); } catch (e) { /* ignore */ }
    document.body.classList.toggle('skin', Assets.has('ui/btn_normal') && Assets.has('ui/frame_scroll'));
    const bg = Assets.get('ui/title'); if (bg) $('title').style.background = `url(${bg.src}) center / cover no-repeat`;
    const logo = Assets.get('ui/logo'); if (logo) { const h1 = document.querySelector('#title h1'); if (h1) h1.innerHTML = `<img src="${logo.src}" alt="Day &amp; Night" style="max-width:100%;max-height:150px">`; const cr = document.querySelector('#title .crest'); if (cr) cr.style.display = 'none'; }
    if (G) { buildTerrain(); renderAll(); }
  });
  document.addEventListener('assets-progress', (e) => { const d = e.detail, el = $('loadmsg'); if (el) el.textContent = d.done >= d.total ? '' : 'Loading art… ' + Math.round(100 * d.done / d.total) + '%'; });
  // some screens carry a data-bg marker: the picture behind the dialog comes from art/ui/<name>
  // some screens carry a data-bg marker: the picture behind the dialog comes from art/ui/<name>.
  // castle and hero selection (on a wide screen) show the picture undimmed: the menu sits in its dark left panel and the painted scene stays visible on the right
  const SPLIT_SCREENS = ['castle_select', 'hero_select'], wide = () => matchMedia('(min-width: 1000px) and (min-height: 560px)').matches;
  new MutationObserver(() => {
    const mk = $('mbox').querySelector('[data-bg]'), u = mk && Assets.url('ui/' + mk.dataset.bg), split = !!(mk && u && SPLIT_SCREENS.some(n => mk.dataset.bg.indexOf(n) === 0) && wide());
    $('mbox').classList.toggle('art-split', split);
    const banner = !split && matchMedia('(max-width: 700px) and (orientation: portrait)').matches && !!(mk && u && SPLIT_SCREENS.some(n => mk.dataset.bg.indexOf(n) === 0)); $('mbox').classList.toggle('art-banner', banner); if (banner) $('mbox').style.setProperty('--scr-art', 'url(' + u + ')');      // on a phone held upright the painted scene is a banner above the menu
    $('mbox').style.backgroundImage = banner ? '' : u ? (split ? '' : 'linear-gradient(rgba(14,9,4,.72), rgba(14,9,4,.86)), ') + 'url(' + u + ')' : ''; $('mbox').style.backgroundSize = 'cover'; $('mbox').style.backgroundPosition = 'center';
  }).observe($('mbox'), { childList: true });
  // ==== UI SCREENS ====
  const modalOpen = (html) => { $('mbox').innerHTML = html; $('modal').classList.remove('hide'); };
  const closeModal = () => { $('modal').classList.add('hide'); renderAll(); };
  const when = (t) => { const d = new Date(t), p = (n) => String(n).padStart(2, '0'); return `${d.getDate()}/${d.getMonth() + 1} ${p(d.getHours())}:${p(d.getMinutes())}`; };

  function openMenu() {
    if (!G) return;
    modalOpen(`<h2>☰ Menu</h2><div class="menugrid">
      <button data-mn="save">💾 Save / Load</button><button data-mn="set">⚙ Settings</button>
      <button data-mn="dip">🕊 Diplomacy</button><button data-mn="kd">📋 Kingdom</button><button data-mn="ach">🏆 Achievements</button>
      <button data-mn="lb">📊 Leaderboard</button><button data-mn="hint">💡 Hints on/off</button>
      <button data-mn="rep">📜 Turn report</button><button data-mn="help">📖 Help & glossary</button>
      <button data-mn="snd">${Sfx.on ? '🔇 Sound off' : '🔊 Sound on'}</button><button data-mn="fit">🗺 Zoom to fit</button>${$('bFs').style.display === 'none' ? '' : `<button data-mn="fs">${fsOn() ? '🗗 Exit full screen' : '⛶ Full screen'}</button>`}
      </div><div class="mb"><button data-mn="exit" id="mnExit">🚪 Main menu</button><button class="primary" id="mnClose">Resume</button></div>`);
    $('mnClose').onclick = closeModal;
    $('mbox').querySelectorAll('[data-mn]').forEach(b => b.onclick = () => {
      const k = b.dataset.mn;
      if (k === 'dip') openDiplomacy(); else if (k === 'save') openSlots(); else if (k === 'set') openSettings(); else if (k === 'kd') openKingdom(); else if (k === 'ach') openAchievements(); else if (k === 'lb') openLeaderboard(); else if (k === 'hint') { Settings.set('hints', !Settings.hints); if (Settings.hints) Settings.resetHints(); toast(Settings.hints ? 'Hints on.' : 'Hints off.'); }
      else if (k === 'rep') openReport(); else if (k === 'help') openHelp();
      else if (k === 'snd') { Sfx.toggle(); $('bSnd').textContent = Sfx.on ? '🔊' : '🔇'; openMenu(); }
      else if (k === 'fs') { closeModal(); toggleFs(); }
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
  // safety net: if the game says it is busy but nothing is happening (no window, no battle, no rival turn) for a while, unlock it
  let idleBusy = 0;
  setInterval(() => {
    const quiet = G && busy && $('modal').classList.contains('hide') && !document.body.classList.contains('inbattle') && !document.body.classList.contains('aiturn') && $('title').classList.contains('hide');
    idleBusy = quiet ? idleBusy + 1 : 0;
    if (idleBusy >= 4) { idleBusy = 0; busy = false; console.warn('unlocked a stuck game'); try { renderAll(); toast('The game was stuck and has been unlocked.'); } catch (e) { /* ignore */ } }
  }, 2500);

  // ---- glossary + help ----
  const GLOSSARY = [
    ['Morale', 'Each point gives your creatures a 4% chance of an extra turn (negative: a 4% chance to lose one). Mixing creatures of different castles lowers it; undead and golems are immune.'],
    ['Luck', 'Each point gives a 4% chance of double damage (bad luck: half).'],
    ['Retaliation', 'A creature that is attacked in melee hits back once per round, unless the attacker has "no retaliation" or the defender already retaliated.'],
    ['Zones', 'The map is divided into zones, each ruled from a town or fort. Mines pay you only while you hold their zone.'],
    ['Threat tags', 'The coloured dot next to a guard compares its strength with your selected hero\'s army: Trivial, Easy, Even, Hard, Deadly. It is an estimate, not a promise.'],
    ['Outposts', 'Dwellings and the Dragon Lair you have conquered deliver their weekly recruits to every castle — buy them in the Warriors tab.'],
    ['Dragon Lair', 'Guarded by a dragon horde. Conquer it to buy the Tiny, Acid, Gem and Blue Dragons, found in no castle.'],
    ['Caravans', 'Troops sent from one castle garrison to another travel for several days, depending on distance.'],
    ['Rarity colours', 'The frame of a creature portrait shows its rarity: Common (bronze), Uncommon (green), Rare (blue), Epic (purple), Legendary (gold), Mythic (red), Ancient (silver), Divine (prismatic). Stars show the upgrade level.'],
    ['Surrender & ransom', 'A hopelessly outmatched rival hero may offer gold to be let go. If you are the outmatched one, you can pay a ransom and retreat to your nearest castle with your army intact.'],
    ['Siege', 'Attacking a town or fort means storming walls, a gate, a moat and arrow towers; Fortifications make them stronger and minefields hurt attackers.'],
    ['Spell schools', 'Air, Earth, Fire and Water skills raise the rank of their spells. Insight unlocks higher-level spells; Sorcery and Mysticism help spell power and mana.'],
    ['Silver Tongue', 'Weak monsters can join you instead of fighting when your army is much stronger.'],
    ['Broken arrow', 'Archers shoot best point-blank; beyond 10 hexes their damage is halved.'],
  ];
  function openHelp(g) {
    modalOpen(HELP.replace('</h2>', '</h2><div class="helpbody">') + `</div><div class="mb"><button id="hlGl">📖 Glossary</button><button class="primary" id="hlOk">Close</button></div>`);
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
      modalOpen(`${window.vicBanner('Victory', `Every rival has lost its towns — you rule the realm on day ${G.day} (${DF().name}).`)}
        <div class="vic-score">${sc.parts.map(([l, v]) => `<div class="vic-row"><span>${l}</span><b>+${fmtN(v)}</b></div>`).join('')}<div class="vic-row mult"><span>Difficulty × map size × rivals</span><b>×${sc.mult.toFixed(2)}</b></div></div>
        <div class="vic-total"><span>Final score</span><b>${fmtN(sc.score)}</b></div>
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
    for (const h of G.heroes) if (perk(h, 'estates')) lines.push({ l: `🏠 ${h.name} — Stewardship`, r: { gold: 300 * perk(h, 'estates') } });
    for (const o of G.objs) {
      if (o.t === 'mine' && o.owner === 0) { const ok = terrOwner(o.x, o.y) === 0; lines.push({ l: `⛏ ${cap(o.kind)} mine`, r: ok ? { [o.kind]: MINE_YIELD[o.kind] * mm } : {}, warn: ok ? '' : 'pays nothing — you do not hold its zone (capture the fort or town of that zone)', x: o.x, y: o.y }); }
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
    const hRows = G.heroes.map((h, i) => `<div class="trow" style="grid-template-columns:42px 1fr auto"><div class="ic">${Art.heroPic(h.icon, ownCol(0), 38, h.pid)}</div><div><b>${h.name}</b> <span class="small">${clsLabel(h.cls)} L${h.lvl}${h.sleep ? ' · 💤' : ''}</span><br><span class="small">${armyList(h.army, false) || 'no army'} · move ${Math.round(100 * h.move / maxMove(h))}%</span></div><div class="acts"><button data-kh="${i}">Select</button>${locBtn(h.x, h.y)}</div></div>`).join('');
    const holds = G.objs.filter(o => o.owner === 0 && (o.t === 'mine' || o.t === 'fort' || o.t === 'dwelling' || o.t === 'lair')).map(o => {
      const nm = o.t === 'mine' ? `⛏ ${cap(o.kind)} mine${terrOwner(o.x, o.y) === 0 ? '' : ' ⚠ not paying'}` : o.t === 'fort' ? `🏯 ${o.name}` : o.t === 'lair' ? '🐲 Dragon Lair' : `🛖 ${C[dwId(o)].n} dwelling (${o.avail})`;
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
      ${row('Show walkable tiles', seg('showReach', [[true, 'On'], [false, 'Off']]), 'Lights up every tile your hero can reach today')}
      ${row('Warn before deadly fights', seg('confirmDanger', [[true, 'On'], [false, 'Off']]), 'Asks before attacking something far stronger than you')}
      ${row('Confirm before ending a turn', seg('confirmEnd', [[true, 'On'], [false, 'Off']]), 'Warns about idle heroes and unspent recruits')}
      ${row('Resume on refresh', seg('resume', [[true, 'On'], [false, 'Off']]), 'Refreshing the page jumps straight back into your game (otherwise you land on the title screen; Continue always works)')}
      ${row('Building names in town', seg('townNames', [[true, 'Always'], [false, 'On hover']]), 'Off keeps the town picture clear; a name shows when you point at a building')}
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

  // ---- the Back button (browser back, phone swipe-back, Android hardware back) ----
  // Inside a running game it never leaves silently: an open dialog is closed first, a battle asks to be finished, and otherwise a box asks
  // "Save & exit / Exit without saving / Cancel". On the title screen Back leaves the page (web) or the app (Android) as usual.
  const CapApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  let backAsking = false;
  async function onBack() {            // true = the press was handled here
    const closeBtn = () => [...$('mbox').querySelectorAll('button')].find(x => /^(close|cancel|back|leave|ok|not now|leave town|keep fighting)/i.test(x.textContent.replace(/^[^A-Za-z]+/, '').trim()));
    if (backAsking) { const c = [...$('mbox').querySelectorAll('button')].find(x => /cancel/i.test(x.textContent)); if (c) c.click(); return true; }
    if (!$('modal').classList.contains('hide')) { const b = closeBtn(); if (b) b.click(); else $('modal').classList.add('hide'); return true; }
    if (document.body.classList.contains('inbattle')) { toast('Finish the battle first, or use Retreat.'); return true; }
    if (G && !G.over && $('title').classList.contains('hide')) {
      if (busy) { toast('Please wait a moment…'); return true; }
      backAsking = true; try { await exitToMenu(); } finally { backAsking = false; }
      return true;
    }
    return false;
  }
  const guardHistory = () => { try { history.pushState({ guard: 1 }, '', location.href); } catch (e) { /* ignore */ } };
  guardHistory();
  window.addEventListener('popstate', async () => { guardHistory(); if (!(await onBack())) history.go(-2); });   // put the guard back first, so a second Back while the box is open just cancels it
  if (CapApp && CapApp.addListener) CapApp.addListener('backButton', async () => { if (!(await onBack()) && CapApp.exitApp) CapApp.exitApp(); });

  // menu music while the title screen is up
  const syncMood = () => { if (document.body.classList.contains('inbattle')) return; Sfx.mood($('title').classList.contains('hide') ? 'map' : 'menu'); };
  new MutationObserver(syncMood).observe($('title'), { attributes: true, attributeFilter: ['class'] });
  syncMood();

  refreshTitle();
  requestAnimationFrame(loop);
  // ?demo opens a ready-made game with several towns and heroes, to see how the screens handle a bigger realm
  function demo() {
    const towns = G.objs.filter(o => o.t === 'town' && o.owner === null && o.b).slice(0, 3);
    towns.forEach(t => takeTown(t, 0));
    const home = G.objs.find(o => o.t === 'town' && o.owner === 0);
    Object.keys(HEROES).filter(id => !G.heroes.some(h => h.name === HEROES[id].name)).slice(0, 3).forEach((id, i) => {
      const t = towns[i] || home, h = makeHero(HEROES[id], t.x, t.y); G.heroes.push(h); learn(HEROES[id].spells);
    });
    [home, ...towns].forEach(t => markView(t.x, t.y, 9, false)); G.res.gold += 20000; renderAll();
  }
  // refreshing the page picks the game up where it was
  if (!/[?&]demo/.test(location.search) && Settings.resume && localStorage.getItem(SAVE)) Assets.ready.then(() => { if (!G && load()) $('title').classList.add('hide'); });
  if (/[?&]demo/.test(location.search)) Assets.ready.then(() => setTimeout(() => { try { newGame('castle', 'Orrin', 'normal', { size: 'medium', seed: 'demo', wrap: true }); $('title').classList.add('hide'); demo(); } catch (e) { console.error('demo failed', e); } }, 400));
  window.__G = () => G;
  window.__dbg = { borderBlock, canCross, terrOwner, openDiplomacy, aiDiplomacy, declareWar, atWar, realmPower, demo, takeTown, negotiate, fightAiHero, centerOn, interact, renderAll, newGame, fight, gainXp, openTown, view: () => ({ Z, VW, VH, cam: { ...cam } }) };
})();
