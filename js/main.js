'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const TS = 32, VW = 960, VH = 640, FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
  const SAVE = 'h3js_save_v4';
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
  const town = () => G.objs.find(o => o.t === 'town' && o.owner === 0);
  const eTown = () => G.objs.find(o => o.t === 'town' && o.owner === 1);
  const armyCount = (h) => h.army.reduce((s, a) => s + (a ? a.n : 0), 0);
  const maxMana = (h) => h.kn * 10 + 15 * perk(h, 'wisdom');
  const maxMove = (h) => Math.round(MOVE_PER_DAY * (1 + 0.1 * perk(h, 'logistics')));
  const need = (l) => 150 * l * l;
  const heroesAt = (x, y) => G.heroes.filter(h => h.x === x && h.y === y);
  const heroAtTown = (h) => h.x === town().x && h.y === town().y;
  const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const setActive = (i) => { G.sel = i; G.hero = G.heroes[i]; };
  const townHero = () => { const at = heroesAt(town().x, town().y); return at.includes(G.hero) ? G.hero : at[0] || null; };
  const emptyArmy = () => [null, null, null, null, null, null, null];
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
  function newGame(faction, heroId, diff = 'normal', map = {}) {
    const others = Object.keys(FACTIONS).filter(f => f !== faction);
    const ef = others[Math.floor(Math.random() * others.length)];
    const D = DIFFICULTY[diff], r = (n) => Math.max(1, Math.round(n * D.res));
    const preset = map.preset || 'plains', size = map.size || 'medium', seed = seedFrom(map.seed), m = genMap(seed, ef, diff, { preset, size });
    setFaction(faction);
    G = { seed, preset, size, W: m.W, H: m.H, tiles: m.tiles, zone: m.zone, objs: m.objs, dock: m.dock, boats: [], nextBoat: 1, day: 1, over: false, path: null, faction, efaction: ef, diff,
      res: { gold: D.gold, wood: r(20), ore: r(20), mercury: r(5), sulfur: r(5), crystal: r(5), gems: r(5) }, spells: [...START_SPELLS],
      wk: {}, heroes: [], sel: 0, hero: null, eh: null, ehTimer: 0, ehWave: 0, tavern: [] };
    const t = town(); t.name = FACTIONS[faction].town;
    t.b = { 1: 1, 2: 1, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, hall: 0, guild: 0, market: 0, ship: 0 };
    t.up = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1 };
    t.avail = { 1: GROWTH[0], 2: GROWTH[1] };
    const def = HEROES[heroId], h = makeHero(def, m.P.x, m.P.y), ti = factionTiers(faction);
    h.army = [{ t: ti[0], n: 20 }, { t: ti[1], n: 10 }, { t: ti[2], n: 5 }, null, null, null, null];
    G.heroes.push(h); setActive(0); learn(def.spells); rollTavern();
    reindex(G); buildTerrain(); sizeMini(); centerOn(h.x, h.y); renderAll();
    toast(`${MAPS[preset].name} (${SIZES[size].name}, seed ${seed}) · ${D.name}: capture the ${FACTIONS[ef].name} stronghold in the NE to win. Good luck, ${h.name}!`);
  }
  const saveJSON = () => JSON.stringify(G, (k, v) => (k === 'omap' || k === 'hero') ? undefined : v);
  function save() { try { localStorage.setItem(SAVE, saveJSON()); toast('Game saved.'); } catch (e) { toast('Save failed.'); } }
  function load() {
    try {
      const s = localStorage.getItem(SAVE); if (!s) return false;
      G = JSON.parse(s); if (!G.zone || !G.heroes) return false;
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
  let MK = 6;
  function sizeMini() { MK = Math.max(3, Math.floor(240 / G.W)); mini.width = G.W * MK; mini.height = G.H * MK; }
  function centerOn(x, y) {
    cam.x = Math.max(0, Math.min(G.W * TS - VW, x * TS + TS / 2 - VW / 2));
    cam.y = Math.max(0, Math.min(G.H * TS - VH, y * TS + TS / 2 - VH / 2));
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
    cx.fillStyle = '#000'; cx.fillRect(0, 0, VW, VH);
    cx.drawImage(terrain, cam.x, cam.y, VW, VH, 0, 0, VW, VH);
    const x0 = Math.floor(cam.x / TS), y0 = Math.floor(cam.y / TS);
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    const ZC = { 0: 'rgba(60,130,255,.20)', 1: 'rgba(230,60,60,.20)' };
    cx.lineWidth = 2; cx.strokeStyle = 'rgba(255,255,255,.45)';
    const zo = {}; for (const o of G.objs) if (o.t === 'fort' || o.t === 'town') zo[o.zone] = o.owner;
    for (let y = Math.max(0, y0); y < Math.min(G.H, y0 + 22); y++) for (let x = Math.max(0, x0); x < Math.min(G.W, x0 + 31); x++) {
      const z = G.zone[y][x], ow = zo[z], px = x * TS - cam.x, py = y * TS - cam.y;
      if (ow !== null && ow !== undefined && G.tiles[y][x] !== T.WATER) { cx.fillStyle = ZC[ow]; cx.fillRect(px, py, TS, TS); }
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
    }
    for (const o of G.objs) {
      if (o.x < x0 - 1 || o.x > x0 + 31 || o.y < y0 - 1 || o.y > y0 + 21) continue;
      const px = o.x * TS - cam.x + TS / 2, py = o.y * TS - cam.y + TS / 2;
      if (o.t === 'monster' || o.t === 'art' || o.t === 'mine' || o.t === 'wreck') {
        cx.beginPath(); cx.arc(px, py, 15, 0, 7);
        cx.fillStyle = o.t === 'monster' ? 'rgba(90,10,10,.65)' : 'rgba(0,0,0,.45)'; cx.fill();
      }
      cx.font = `${o.t === 'town' ? 40 : o.t === 'fort' ? 34 : 26}px ${FONT}`; cx.fillStyle = '#fff';
      cx.fillText(objIcon(o), px, py + 1);
      if (o.t === 'fort') {
        cx.beginPath(); cx.arc(px + 14, py - 16, 6, 0, 7); cx.fillStyle = o.owner === 0 ? '#3a8aff' : o.owner === 1 ? '#e03a3a' : '#999'; cx.fill(); cx.strokeStyle = '#000'; cx.lineWidth = 1; cx.stroke();
        const gn = o.garrison.reduce((s, a) => s + (a ? a.n : 0), 0);
        if (o.owner === 0 && gn) { cx.font = 'bold 11px sans-serif'; cx.fillStyle = '#000b'; cx.fillRect(px - 14, py + 10, 28, 13); cx.fillStyle = '#fff'; cx.fillText(gn, px, py + 17); }
      }
      if (o.t === 'mine') { cx.beginPath(); cx.arc(px + 12, py - 12, 5, 0, 7); cx.fillStyle = o.owner === 0 ? '#3a8aff' : '#999'; cx.fill(); cx.strokeStyle = '#000'; cx.lineWidth = 1; cx.stroke(); }
      if (o.t === 'town') { cx.beginPath(); cx.arc(px + 16, py - 18, 6, 0, 7); cx.fillStyle = o.owner === 0 ? '#3a8aff' : '#e03a3a'; cx.fill(); cx.strokeStyle = '#000'; cx.lineWidth = 1; cx.stroke(); }
    }
    for (const b of G.boats) {
      const px = b.x * TS - cam.x + TS / 2, py = b.y * TS - cam.y + TS / 2;
      cx.font = `30px ${FONT}`; cx.fillStyle = '#fff'; cx.fillText('⛵', px, py + 2);
    }
    if (G.eh) {
      const px = G.eh.x * TS - cam.x + TS / 2, py = G.eh.y * TS - cam.y + TS / 2;
      cx.beginPath(); cx.arc(px, py, 15, 0, 7); cx.fillStyle = '#a02020'; cx.fill(); cx.strokeStyle = '#000'; cx.lineWidth = 2; cx.stroke();
      cx.font = `22px ${FONT}`; cx.fillStyle = '#fff'; cx.fillText(G.eh.icon, px, py + 1);
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
    for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) {
      mx.fillStyle = MC[G.tiles[y][x]]; mx.fillRect(x * k, y * k, k, k);
      const ow = zo[G.zone[y][x]];
      if (ow !== null && ow !== undefined) { mx.fillStyle = ow === 0 ? 'rgba(60,130,255,.35)' : 'rgba(230,60,60,.35)'; mx.fillRect(x * k, y * k, k, k); }
    }
    for (const o of G.objs) {
      mx.fillStyle = o.t === 'fort' ? (o.owner === 0 ? '#9cf' : o.owner === 1 ? '#f88' : '#ffa') : o.t === 'town' ? (o.owner === 0 ? '#4af' : '#f44') : o.t === 'monster' ? '#a33' : o.t === 'mine' ? (o.owner === 0 ? '#4af' : '#ddd') : o.t === 'merchant' ? '#fa0' : '#ee6';
      mx.fillRect(o.x * k, o.y * k, k, k);
    }
    mx.fillStyle = '#8df'; for (const b of G.boats) mx.fillRect(b.x * k, b.y * k, k, k);
    if (G.eh) { mx.fillStyle = '#f0f'; mx.fillRect(G.eh.x * k - 1, G.eh.y * k - 1, k + 2, k + 2); }
    mx.fillStyle = '#fff'; for (const h of G.heroes) mx.fillRect(h.x * k - 1, h.y * k - 1, k + 2, k + 2);
    mx.strokeStyle = '#fff'; mx.lineWidth = 1; mx.strokeRect(cam.x / TS * k, cam.y / TS * k, VW / TS * k, VH / TS * k);
  }
  function loop() { if (G && !document.body.classList.contains('inbattle')) draw(); requestAnimationFrame(loop); }

  // ---------- UI panels ----------
  function renderAll() {
    if (!G) return;
    $('res').innerHTML = RES.map(k => `<span title="${k}">${RES_ICON[k]} ${G.res[k]}</span>`).join('');
    const d = G.day - 1;
    $('date').textContent = `Month ${Math.floor(d / 28) + 1} · Week ${Math.floor(d % 28 / 7) + 1} · Day ${d % 7 + 1} · ${DF().icon} ${DF().name}`;
    const h = G.hero;
    const perkTxt = Object.keys(h.perks).filter(k => h.perks[k]).map(k => `${PERKS[k].i}${PERKS[k].n} ${'★'.repeat(h.perks[k])}`).join(' · ');
    $('hero').innerHTML = `<div class="hlist">${G.heroes.map((x, i) => `<button class="hbtn${x === h ? ' on' : ''}" data-h="${i}" title="${x.name} (${x.cls})">${x.icon}</button>`).join('')}</div>
      <h3>${h.icon} ${h.name} <span class="small">${h.cls} — Level ${h.lvl}</span></h3>
      <div class="stats"><span>⚔️ Attack ${h.att}</span><span>🛡 Defense ${h.def}</span><span>✨ Spell Pow ${h.sp}</span><span>📚 Knowledge ${h.kn}</span></div>
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
    $('terr').innerHTML = `<h3>🗺 Territory — ${zs.filter(z => z.owner === 0).length}/${zs.length} zones</h3>` +
      zs.map(z => { const gn = z.garrison ? z.garrison.reduce((s, a) => s + (a ? a.n : 0), 0) : 0;
        return `<div class="zrow"><span class="zdot z${z.owner === 0 ? 'p' : z.owner === 1 ? 'e' : 'n'}"></span>${z.name}${z.t === 'fort' && z.owner === 0 ? ` <span class="small">garrison ${gn}</span>` : ''}</div>`; }).join('') +
      `<div class="small">Paying mines: ${mineIncome}</div>`;
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
    if (heroAtTown(h)) return toast('Already in your castle.');
    if (h.mana < PORTAL_COST) return toast(`Town Portal needs ${PORTAL_COST} mana.`);
    h.mana -= PORTAL_COST; h.x = town().x; h.y = town().y; h.boat = null; h.move = Math.min(h.move, 400); G.path = null;
    centerOn(h.x, h.y); renderAll(); toast(`${h.name} teleports home.`);
  }

  // ---------- map input ----------
  function tileFromEvent(ev) {
    const r = cmap.getBoundingClientRect();
    const px = (ev.clientX - r.left) * VW / r.width + cam.x, py = (ev.clientY - r.top) * VH / r.height + cam.y;
    const x = Math.floor(px / TS), y = Math.floor(py / TS);
    return x >= 0 && y >= 0 && x < G.W && y < G.H ? { x, y } : null;
  }
  function armyList(arr, vague) { return arr.filter(Boolean).map(a => vague ? `${groupLabel(a.n)} ${C[a.t].n}s` : `${a.n} ${C[a.t].n}`).join(', '); }
  function describe(x, y) {
    if (G.eh && G.eh.x === x && G.eh.y === y) return `<b>${G.eh.name}</b> (enemy hero)<br>${armyList(G.eh.army, true)}`;
    const hs = heroesAt(x, y); if (hs.length) return hs.map(h => `<b>${h.name}</b> (${h.cls} L${h.lvl})${h.boat != null ? ' ⛵ sailing' : ''}`).join('<br>');
    if (G.boats.some(b => b.x === x && b.y === y)) return '<b>⛵ Your boat</b><br>Walk onto it from the shore to set sail.';
    const o = objAt(G, x, y);
    if (!o) return ['Grass', 'Forest (impassable)', 'Mountains (impassable)', 'Water (needs a boat)', 'Road (fast)', 'Sand (slow)'][G.tiles[y][x]];
    const g = o.guard && o.guard.length ? `<br>Guarded by: ${armyList(o.guard, true)}` : '';
    switch (o.t) {
      case 'town': return o.owner === 0 ? `<b>${o.name}</b> — your castle` : `<b>${o.name}</b> — enemy stronghold${g}<br>Assaulting it is a siege battle.`;
      case 'merchant': return '<b>Wandering Merchant</b><br>Buy missing resources';
      case 'wreck': return `<b>Shipwreck</b><br>Salvage: ${RES_ICON.gold}${o.gold} + ${RES_ICON[o.res]}${g}`;
      case 'mine': {
        const supplied = o.owner === 0 && zoneOwner(G, G.zone[o.y][o.x]) === 0;
        return `<b>${o.kind[0].toUpperCase() + o.kind.slice(1)} mine</b> (${o.owner === 0 ? 'yours' : 'unclaimed'}) +${MINE_YIELD[o.kind]}/day` +
          (o.owner === 0 && !supplied ? '<br>⚠ Pays nothing: you do not hold this zone' : o.owner !== 0 ? '<br>Pays only if you also hold its zone' : '') + g;
      }
      case 'fort': {
        const gn = o.garrison.reduce((s, a) => s + (a ? a.n : 0), 0);
        return `<b>${o.name}</b> — ${o.owner === 0 ? `your fort (garrison ${gn})` : o.owner === 1 ? `held by the enemy${gn ? ' — garrison: ' + armyList(o.garrison, true) : ''}` : 'neutral zone stronghold'}<br>Holding it: +${FORT_INCOME} 🪙/day and zone mine income${o.owner === null ? g : ''}<br>Assault = siege battle`;
      }
      case 'pile': return `${RES_ICON[o.kind]} ${o.amt} ${o.kind}`;
      case 'chest': return 'Treasure chest';
      case 'art': return `<b>${ARTIFACTS[o.art].n}</b> (+${ARTIFACTS[o.art].v} ${ARTIFACTS[o.art].stat})${g}`;
      case 'monster': return `Monsters: ${armyList(o.guard, true)}`;
    }
  }
  cmap.addEventListener('mousemove', (ev) => {
    if (!G) return;
    hover = tileFromEvent(ev);
    const tip = $('tip');
    if (hover) {
      tip.innerHTML = describe(hover.x, hover.y);
      const r = $('stage').getBoundingClientRect();
      tip.style.left = Math.min(ev.clientX - r.left + 14, r.width - 270) + 'px'; tip.style.top = (ev.clientY - r.top + 14) + 'px';
      tip.classList.remove('hide');
    } else tip.classList.add('hide');
  });
  cmap.addEventListener('mouseleave', () => { hover = null; $('tip').classList.add('hide'); });
  cmap.addEventListener('click', (ev) => {
    if (!G || busy || G.over) return;
    const t = tileFromEvent(ev); if (!t) return;
    const here = heroesAt(t.x, t.y);
    if (here.length) {
      if (!here.includes(G.hero)) { setActive(G.heroes.indexOf(here[0])); G.path = null; renderAll(); return; }
      const o = objAt(G, t.x, t.y);
      if (heroAtTown(G.hero)) openTown(); else if (o && o.t === 'fort' && o.owner === 0) openFort(o, G.hero);
      return;
    }
    const last = G.path && G.path[G.path.length - 1];
    if (last && last.x === t.x && last.y === t.y) return moveHero();
    const p = findPath(G, G.hero.x, G.hero.y, t.x, t.y, false, G.hero.boat != null);
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
    if (k === 'arrowleft' || k === 'a') cam.x = Math.max(0, cam.x - s);
    else if (k === 'arrowright' || k === 'd') cam.x = Math.min(G.W * TS - VW, cam.x + s);
    else if (k === 'arrowup' || k === 'w') cam.y = Math.max(0, cam.y - s);
    else if (k === 'arrowdown' || k === 's') cam.y = Math.min(G.H * TS - VH, cam.y + s);
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
      h.x = s.x; h.y = s.y; centerOn(h.x, h.y); renderAll();
      await sleep(70);
      const last = i === path.length - 1, o = objAt(G, s.x, s.y);
      if (G.eh && G.eh.x === s.x && G.eh.y === s.y) { await fightEnemyHero(h, true); break; }
      if (o && (o.t === 'pile' || o.t === 'chest')) { collect(o); continue; }
      if (o && last) { await interact(o, h); break; }
    }
    busy = false; renderAll();
  }
  function collect(o) {
    if (o.t === 'pile') { G.res[o.kind] += o.amt; toast(`Collected ${o.amt} ${RES_ICON[o.kind]} ${o.kind}.`); }
    else { G.res.gold += o.gold; toast(`The chest holds ${o.gold} 🪙 gold!`); }
    G.objs.splice(G.objs.indexOf(o), 1); reindex(G);
  }
  async function interact(o, h) {
    if (o.t === 'wreck') {
      if (o.guard && o.guard.length) { if (!(await fight(h, o.guard, { att: 0, def: 0 }, 'Shipwreck guardians'))) return; o.guard = []; }
      const n = 3 + Math.floor(Math.random() * 4);
      G.res.gold += o.gold; G.res[o.res] += n; G.objs.splice(G.objs.indexOf(o), 1); reindex(G); renderAll();
      return showModal(`<h2>🚢 Shipwreck salvaged</h2><p>${h.name}'s crew recovers ${RES_ICON.gold}${o.gold} and ${RES_ICON[o.res]}${n} from the wreck.</p>`);
    }
    if (o.t === 'merchant') return openMarket(MERCHANT_RATE + ((G.wk && G.wk.rateBonus) || 0), 'Wandering Merchant', false);
    if (o.t === 'town') {
      if (o.owner === 0) { for (const x of heroesAt(o.x, o.y)) x.mana = maxMana(x); return openTown(); }
      const win = await fight(h, o.guard, { att: 6, def: 6 }, `Siege of ${o.name}`, { dside: 1 }, { name: FACTIONS[G.efaction].heroes[0][0], icon: CLASSES[FACTIONS[G.efaction].heroes[0][1]].i });
      if (win) return endGame(true);
      return;
    }
    if (o.t === 'fort') {
      if (o.owner === 0) return openFort(o, h);
      const army = o.owner === 1 ? o.garrison.filter(Boolean) : o.guard;
      if (army.length && !(await fight(h, army, { att: o.owner === 1 ? 4 : 0, def: o.owner === 1 ? 4 : 0 }, `Siege of ${o.name}`, { dside: 1 }))) return;
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
    h.army = emptyArmy(); h.x = town().x; h.y = town().y; h.boat = null; G.path = null;
    if (h === G.hero) centerOn(h.x, h.y);
    toast(`${h.name} returns to the castle with no army. Recruit new troops!`);
  }
  async function fight(h, guard, eStats, title, siege, eHero) {
    if (!armyCount(h)) { toast(`${h.name} has no army! Recruit in town first.`); return false; }
    const res = await Battle.run({ hero: { att: h.att, def: h.def, sp: h.sp, mana: h.mana, spells: G.spells, perks: h.perks, name: h.name, icon: h.icon },
      army: h.army, enemy: guard.map(a => ({ ...a })), eStats, eHero, title, siege, canRetreat: true });
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
      h.xp -= need(h.lvl); h.lvl++;
      const r = Math.random(), st = r < .3 ? 'att' : r < .6 ? 'def' : r < .8 ? 'sp' : 'kn';
      h[st]++;
      const statName = { att: 'Attack', def: 'Defense', sp: 'Spell Power', kn: 'Knowledge' }[st];
      const opts = shuffle(Object.keys(PERKS).filter(k => perk(h, k) < MAX_PERK)).slice(0, 2);
      const head = `<h2>⭐ ${h.name} reaches level ${h.lvl}!</h2><p>+1 ${statName}</p>`;
      if (!opts.length) { await showModal(head); continue; }
      const i = await showModal(`${head}<p>Choose a perk:</p><div class="small">${opts.map(k => `${PERKS[k].i} <b>${PERKS[k].n}</b> (rank ${perk(h, k) + 1}) — ${PERKS[k].d}`).join('<br>')}</div>`, opts.map(k => `${PERKS[k].i} ${PERKS[k].n}`));
      h.perks[opts[i]] = perk(h, opts[i]) + 1;
    }
  }
  async function fightEnemyHero(h, playerAttacks) {
    const e = G.eh;
    const atTown = heroAtTown(h), fo = objAt(G, h.x, h.y), atFort = fo && fo.t === 'fort' && fo.owner === 0;
    if (!armyCount(h)) {
      if (atTown) { await endGame(false, 'Your castle had no army to defend it.'); return false; }
      retreat(h); return false;
    }
    const siege = !playerAttacks && (atTown || atFort) ? { dside: 0 } : null;
    const win = await fight(h, e.army, { att: e.att, def: e.def }, `${e.name}'s army`, siege, e);
    if (win) { G.eh = null; G.ehTimer = 5; toast('Enemy hero defeated! He will return in time...'); return true; }
    if (atTown && !heroesAt(town().x, town().y).some(x => armyCount(x) > 0)) await endGame(false, 'Your castle has fallen to the enemy hero.');
    return false;
  }

  // ---------- generic army exchange ----------
  function openExchange(title, note, A, nameA, B, nameB, back) {
    let sel = null;
    const arr = (r) => r === 'a' ? A : B;
    const render = () => {
      const row = (a, rk) => a.map((s, i) => `<button class="slot${s ? '' : ' empty'}${sel && sel.r === rk && sel.i === i ? ' sel' : ''}" data-r="${rk}" data-i="${i}">${s ? `${C[s.t].i}<small>${s.n}</small>` : ''}</button>`).join('');
      $('mbox').innerHTML = `<h2>${title}</h2><div class="small">${note}</div>
        <h4>${nameA}</h4><div class="armyrow">${row(A, 'a')}</div><h4>${nameB}</h4><div class="armyrow">${row(B, 'b')}</div>
        <div class="small">Click a slot, then another: move / merge / swap.</div>
        <div class="mb"><button class="primary" id="xClose">${back ? 'Back' : 'Close'}</button></div>`;
      $('xClose').onclick = () => { if (back) back(); else { $('modal').classList.add('hide'); renderAll(); } };
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
  const tierType = (t, tier) => lineType(CASTLE_TIERS[tier - 1], (t.up && t.up[tier]) || 1);
  const starStr = (lv, max = MAX_LV) => '★'.repeat(lv) + '☆'.repeat(max - lv);
  function startTownAnim(kind, slot) { townAnim = { kind, slot, t0: performance.now() }; }
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
    const g = cv.getContext('2d'), now = performance.now(), t = town(), W = cv.width, H = cv.height;
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
    $('mClose').onclick = () => { if (back) openTown(); else { $('modal').classList.add('hide'); renderAll(); } };
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
    $('hBack').onclick = openTown;
    $('mbox').querySelectorAll('[data-hire]').forEach(b => b.onclick = () => {
      if (G.heroes.length >= MAX_HEROES) return toast(`You can command at most ${MAX_HEROES} heroes.`);
      if (G.res.gold < price) return toast('Not enough gold.');
      const d = HEROES[b.dataset.hire], t = town();
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

  function openTown() {
    const t = town(), th = townHero(), here = !!th;
    let html = `<h2>🏰 ${t.name} <span class="small">${t.b.hall ? HALL_LEVELS[t.b.hall].n : 'Settlement'}</span></h2><canvas id="tcv" width="780" height="150" style="width:100%;border-radius:6px;border:1px solid #6b4f24"></canvas>
      <div class="small">${here ? `${th.name} is in town — recruits join the army.` : '⚠ No hero in the castle; return a hero to recruit or upgrade troops.'} Higher Town Hall levels unlock new dwellings and creature upgrades.</div>`;
    CASTLE_TIERS.forEach((id, i) => {
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
      <div class="trow"><div class="ic">⚓</div><div><b>Shipyard</b><br><span class="small">${t.b.ship ? `Boats ${G.boats.length}/${MAX_BOATS}. A new boat appears at the port by the bay (${fmtCost(BOAT_COST)} each). Walk a hero onto a boat to sail; collect treasures at sea.` : G.dock ? `Build boats to sail the sea and collect its treasures — ${fmtCost(SHIPYARD_COST)}` : 'There is no coast near this castle.'}</span></div>
        <div class="acts">${!G.dock ? '' : t.b.ship ? `<button data-boat="1" ${G.boats.length >= MAX_BOATS ? 'disabled' : ''}>⛵ Build boat</button>` : '<button data-build="ship">Build</button>'}</div></div>
      <div class="trow"><div class="ic">🍺</div><div><b>Tavern</b><br><span class="small">Heroes ${G.heroes.length}/${MAX_HEROES}. Hire more heroes and exchange troops between heroes in town.</span></div>
        <div class="acts"><button data-tavern="1">Hire heroes</button>${heroesAt(t.x, t.y).length > 1 ? '<button data-xhero="1">Exchange troops</button>' : ''}</div></div>
      <div class="small" style="margin-top:8px">${RES.map(k => RES_ICON[k] + ' ' + G.res[k]).join('  ')}</div>
      <div class="mb"><button class="primary" id="tClose">Leave town</button></div>`;
    $('mbox').innerHTML = html; $('modal').classList.remove('hide');
    if (!townLoop) { townLoop = true; requestAnimationFrame(drawTown); }
    $('tClose').onclick = () => { $('modal').classList.add('hide'); renderAll(); };
    const again = () => { openTown(); renderAll(); };
    const q = (sel, fn) => $('mbox').querySelectorAll(sel).forEach(fn);
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
      toast(`${C[lineType(CASTLE_TIERS[tier - 1], t.up[tier])].n} unlocked!`);
      startTownAnim('upgrade', tier - 1); again();
    });
    q('[data-uparmy]', b => b.onclick = () => {
      const tier = +b.dataset.uparmy, id = CASTLE_TIERS[tier - 1], to = lineType(id, t.up[tier]);
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
      openExchange('🤝 Exchange troops', 'Heroes in the castle can share their armies.', a.army, a.name, c2.army, c2.name, openTown);
    });
  }

  // ---------- forts & garrisons ----------
  function openFort(f, h) {
    const hs = heroesAt(f.x, f.y), hero = hs.includes(h) ? h : hs[0];
    const note = `+${FORT_INCOME} 🪙/day · zone mine income · +${MILITIA} militia/week · the garrison fights enemy heroes inside the walls with +3 Defense`;
    if (!hero) {
      $('mbox').innerHTML = `<h2>🏯 ${f.name}</h2><div class="small">${note}</div><p>Garrison: ${armyList(f.garrison, false) || 'empty'}</p><p class="small">Visit the fort with a hero to transfer troops.</p><div class="mb"><button class="primary" id="fClose">Close</button></div>`;
      $('fClose').onclick = () => $('modal').classList.add('hide'); $('modal').classList.remove('hide'); return;
    }
    openExchange(`🏯 ${f.name}`, note, f.garrison, 'Garrison', hero.army, hero.name);
  }
  async function defendFort(f) {
    const e = G.eh, gar = f.garrison;
    const res = await Battle.run({ hero: { att: 0, def: 3, sp: 0, mana: 0, spells: [], perks: {}, name: 'Garrison', icon: '🏯' }, army: gar, enemy: e.army.map(a => ({ ...a })),
      eStats: { att: e.att, def: e.def }, eHero: e, title: `Defending ${f.name}`, siege: { dside: 0 }, canRetreat: false });
    res.survivors.forEach((n, i) => { if (gar[i]) { if (n > 0) gar[i].n = n; else gar[i] = null; } });
    if (res.win) { G.eh = null; G.ehTimer = 4; toast(`${f.name} held! The enemy hero is slain.`); return true; }
    f.owner = 1; f.garrison = [{ t: factionTiers(G.efaction)[0], n: 10 }, null, null, null, null, null, null];
    await showModal(`<h2>🏯 ${f.name} has fallen!</h2><p>The enemy now holds this zone. Retake it by defeating its garrison.</p>`);
    return false;
  }

  // ---------- turn / day ----------
  function spawnEnemyHero() {
    const e = eTown(); G.ehWave++;
    const w = G.ehWave, ti = factionTiers(G.efaction), hd = FACTIONS[G.efaction].heroes[0];
    G.eh = { name: hd[0], icon: CLASSES[hd[1]].i, x: e.x - 2, y: e.y + 2, att: 4 + w, def: 4 + w, sp: 2, kn: 2,
      army: [{ t: ti[0], n: 10 + w * 10 }, { t: ti[1], n: 5 + w * 4 }, { t: ti[2], n: 2 + w * 3 }, w > 1 ? { t: ti[3], n: w * 2 } : null, w > 2 ? { t: ti[4], n: w * 2 } : null].filter(Boolean)
        .map(a => ({ ...a, n: Math.max(1, Math.round(a.n * DF().ehMul)) })) };
    toast(`${G.eh.name} emerges from the enemy stronghold!`);
  }
  async function enemyTurn() {
    const eForts = G.objs.filter(o => o.t === 'fort' && o.owner === 1).length;
    if (G.day >= DF().ehDay && !G.eh) { G.ehTimer = Math.max(0, G.ehTimer - 1 - eForts); if (G.ehTimer <= 0) spawnEnemyHero(); return; }
    if (!G.eh) return;
    const eh = G.eh, tw = town();
    const mine = G.objs.filter(o => o.t === 'fort' && o.owner === 0).sort((a, b) => dist(eh, a) - dist(eh, b));
    const near = G.heroes.reduce((a, b) => dist(eh, a) <= dist(eh, b) ? a : b);
    const cands = [];
    if (dist(eh, near) < 12) cands.push(near);
    cands.push(...mine, tw);
    let target = null, path = null;
    for (const c of cands) { const p = findPath(G, eh.x, eh.y, c.x, c.y, true); if (p) { target = c; path = p; break; } }
    if (!path) return;
    let left = DF().ehMove;
    for (const s of path) {
      if (s.cost > left) break;
      left -= s.cost; eh.x = s.x; eh.y = s.y; await sleep(45);
      const hs = heroesAt(s.x, s.y);
      if (hs.length) {
        const h = hs.reduce((a, b) => armyCount(a) >= armyCount(b) ? a : b);
        centerOn(s.x, s.y); toast('The enemy hero attacks!'); await fightEnemyHero(h, false); return;
      }
      if (s.x === tw.x && s.y === tw.y) { await endGame(false, 'The enemy hero captured your castle while it stood undefended.'); return; }
      const o = objAt(G, s.x, s.y);
      if (o && o.t === 'fort' && o.owner === 0) {
        centerOn(o.x, o.y);
        if (!o.garrison.some(Boolean)) {
          o.owner = 1; o.garrison = [{ t: factionTiers(G.efaction)[0], n: 10 }, null, null, null, null, null, null];
          await showModal(`<h2>🏯 ${o.name} has fallen!</h2><p>The enemy hero seized the undefended fort. Garrison your forts to hold your zones.</p>`);
        } else { toast(`The enemy hero assaults ${o.name}!`); await defendFort(o); }
        return;
      }
    }
    toast(`Enemy hero is ${dist(eh, target)} tiles from ${target.cls ? target.name : target.name || 'your castle'}.`);
  }
  // ---------- events ----------
  function rollWeekEvent() {
    const t = town();
    const builtTiers = [1, 2, 3, 4, 5, 6, 7].filter(k => t.b[k]);
    const list = [
      () => {
        const tier = builtTiers[Math.floor(Math.random() * builtTiers.length)], c = C[tierType(t, tier)];
        return { icon: c.i, title: `Week of the ${c.n}`, text: `Recruitment is booming: ${c.n} dwellings produce double this week.`, apply() { t.avail[tier] = (t.avail[tier] || 0) + GROWTH[tier - 1]; renderAll(); } };
      },
      () => ({ icon: '☠️', title: 'Week of the Plague', text: 'Disease sweeps the land: all available recruits are halved.', apply() { for (const k in t.avail) t.avail[k] = Math.floor(t.avail[k] / 2); } }),
      () => { G.wk.mineMul = 2; return { icon: '⛏️', title: 'Bountiful Harvest', text: 'Your mines yield double this week.', apply() {} }; },
      () => { G.wk.rateBonus = 0.15; return { icon: '🐪', title: 'Merchant Caravans', text: 'Trade flourishes: the marketplace and wandering merchants give 15% better rates this week.', apply() {} }; },
      () => ({ icon: '🏋️', title: 'Heroic Training', text: 'Veterans drill your heroes: each gains 150 XP per level.', async apply() { for (const h of G.heroes) await gainXp(h, 150 * h.lvl); renderAll(); } }),
      () => ({ icon: '🐺', title: 'Hungry Beasts', text: 'Wild monsters multiply: all neutral stacks grow by 20%.', apply() { for (const o of G.objs) if (o.t === 'monster') o.guard.forEach(g => { g.n = Math.ceil(g.n * 1.2); }); } }),
      () => ({ icon: '🦠', title: 'Plague on the Enemy', text: 'Sickness strikes your foe: the enemy hero loses a quarter of his troops.', apply() { if (G.eh) G.eh.army.forEach(a => { a.n = Math.max(1, Math.floor(a.n * 0.75)); }); } }),
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
      () => ['📜', 'Rumors', G.eh ? `Scouts report ${G.eh.name} ${dist(G.eh, town())} tiles from your castle.` : 'Scouts see no enemy army on the roads.'],
      () => { const h = rh(); h.kn++; return ['📖', 'Visiting Scholar', `A wandering scholar tutors ${h.name}: +1 Knowledge.`]; },
      () => { const h = rh(), a = h.army.find(Boolean); if (!a || a.n < 8) return ['🍀', 'Quiet Day', 'Nothing of note happens.']; const lost = Math.max(1, Math.floor(a.n * 0.06)); a.n -= lost; return ['🤒', 'Camp Fever', `Sickness spreads in ${h.name}'s camp: ${lost} ${C[a.t].n}s fall ill and leave.`]; },
    ];
    return list[Math.floor(Math.random() * list.length)]();
  }

  async function endTurn() {
    if (!G || busy || G.over) return;
    busy = true; G.path = null; selSlot = -1;
    await enemyTurn();
    if (G.over) { busy = false; return; }
    G.day++;
    const t = town();
    const newWeek = (G.day - 1) % 7 === 0;
    let wev = null;
    if (newWeek) { G.wk = {}; wev = rollWeekEvent(); }
    for (const h of G.heroes) { h.move = maxMove(h); h.mana = Math.min(maxMana(h), h.mana + 4); if (heroAtTown(h)) h.mana = maxMana(h); }
    const gain = Object.fromEntries(RES.map(k => [k, 0]));
    if (t.b.hall) gain.gold += HALL_LEVELS[t.b.hall].inc;
    for (const h of G.heroes) gain.gold += 300 * perk(h, 'estates');
    for (const o of G.objs) {
      if (o.t === 'mine' && o.owner === 0 && zoneOwner(G, G.zone[o.y][o.x]) === 0) gain[o.kind] += MINE_YIELD[o.kind] * ((G.wk && G.wk.mineMul) || 1);
      if (o.t === 'fort' && o.owner === 0) gain.gold += FORT_INCOME;
    }
    RES.forEach(k => { gain[k] = Math.round(gain[k] * DF().income); G.res[k] += gain[k]; });
    const parts = RES.filter(k => gain[k]).map(k => `+${gain[k]}${RES_ICON[k]}`);
    if ((G.day - 1) % 7 === 0) {
      CASTLE_TIERS.forEach((id, i) => { if (t.b[i + 1]) t.avail[i + 1] = (t.avail[i + 1] || 0) + GROWTH[i]; });
      for (const o of G.objs) if (o.t === 'fort' && o.owner === 0) {
        const mil = CASTLE_TIERS[0];
        const s = o.garrison.find(a => a && a.t === mil);
        if (s) s.n += MILITIA; else { const i = o.garrison.findIndex(a => !a); if (i >= 0) o.garrison[i] = { t: mil, n: MILITIA }; }
      }
      rollTavern();
      toast('A new week begins — dwellings replenish, forts raise militia, new heroes arrive at the tavern!');
      if (G.eh) { const m = DF().ehGrow + 0.1 * G.objs.filter(o => o.t === 'fort' && o.owner === 1).length; G.eh.army.forEach(a => a.n = Math.ceil(a.n * m)); }
    }
    toast(`Day ${G.day}${parts.length ? ' · ' + parts.join(' ') : ''}`);
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
    G.over = true;
    try { localStorage.removeItem(SAVE); } catch (e) { /* ignore */ }
    await showModal(win ? `<h2>🏆 Victory!</h2><p>You conquered the enemy stronghold on day ${G.day} on ${DF().name} difficulty. The realm is saved!</p>` : `<h2>💀 Defeat</h2><p>${why || 'Your hero has fallen.'}</p>`, ['Main menu']);
    $('title').classList.remove('hide'); refreshTitle();
  }

  // ---------- title / selection / help ----------
  const HELP = `<h2>How to Play</h2><p><b>Goal:</b> defeat the enemy stronghold in the north-east and capture it. Don't let the enemy hero take your castle.</p>
    <p><b>Map:</b> click a tile to preview the path (green = reachable today, red = next turn), click again to walk. Click another hero to select it (Tab cycles). Monsters facing an army ${FLEE_RATIO}× stronger offer to flee; with the Charisma perk they can join you instead. Walk onto resources to grab them; mines give daily income; monsters, mines and artifacts are guarded. Merchants ⛺ sell missing resources.<br>
    Keys: arrows/WASD scroll · H center hero · Space go · E end turn · T town · Tab next hero.</p>
    <p><b>Sea:</b> build a Shipyard in town, then boats at the port by the bay. Walk a hero onto a boat to sail; collect floating treasures, salvage shipwrecks, fight sea monsters, and disembark on any shore tile. Pick the map type, size and seed when starting a game.</p>
    <p><b>Events:</b> every new week brings a weekly event (double growth for a creature, plague, bountiful harvest, merchant caravans, heroic training...) and most days a random event may strike — treasure, bandits, mercenaries, storms, rumors.</p>
    <p><b>Territory:</b> the map is split into zones, each ruled by a fort. Capture a fort to own the zone: +${FORT_INCOME} gold/day, your mines there pay, +${MILITIA} militia/week. <b>Station troops in forts</b> — the enemy hero raids undefended forts.</p>
    <p><b>Town:</b> Town Hall levels 1-5 raise income and unlock dwellings (tiers 3-7) and creature upgrades (up to 5 levels). Mage Guild teaches spells, the Marketplace trades resources, the Tavern hires up to ${MAX_HEROES} heroes.</p>
    <p><b>Battle:</b> click a green hex to move, click an enemy to attack (archers shoot, flyers ignore obstacles). Your hero stands beside the field: cast one spell per round and make one Hero Strike per round. Castle assaults are <b>sieges</b>: break the gate or walls (your catapult helps), beware arrow towers and the moat; flyers can cross the walls. Level-ups let you pick one of two perks.</p>`;
  function refreshTitle() { $('tCont').disabled = !localStorage.getItem(SAVE); }
  function showDifficultySelect() {
    const cards = Object.entries(DIFFICULTY).map(([k, d]) => `<div class="card" data-d="${k}"><div class="big">${d.icon}</div><b>${d.name}</b><div class="small">${d.desc}</div>
      <div class="small">Start: ${RES_ICON.gold}${d.gold} · guards ×${d.neutral} · income ×${d.income}<br>Enemy hero: day ${d.ehDay}, army ×${d.ehMul}</div></div>`).join('');
    $('mbox').innerHTML = `<h2>Choose difficulty</h2><div class="grid two">${cards}</div><div class="mb"><button id="sBack">Back</button></div>`;
    $('sBack').onclick = () => $('modal').classList.add('hide');
    $('mbox').querySelectorAll('.card').forEach(c => c.onclick = () => showMapSelect(c.dataset.d));
    $('modal').classList.remove('hide');
  }
  function showMapSelect(diff, st = { preset: 'plains', size: 'medium', seed: '' }) {
    const cards = Object.entries(MAPS).map(([k, m]) => `<div class="card${st.preset === k ? ' on' : ''}" data-m="${k}"><div class="big">${m.icon}</div><b>${m.name}</b><div class="small">${m.desc}</div></div>`).join('');
    const sizes = Object.entries(SIZES).map(([k, s]) => `<button class="${st.size === k ? 'primary' : ''}" data-s="${k}">${s.name} (${s.w}×${s.h})</button>`).join(' ');
    $('mbox').innerHTML = `<h2>Choose your map <span class="small">${DIFFICULTY[diff].icon} ${DIFFICULTY[diff].name}</span></h2><div class="grid two">${cards}</div>
      <p>Size: ${sizes}</p><p>Seed: <input id="mSeed" placeholder="empty = random map" value="${st.seed}" style="width:230px;background:#120d08;color:#f1e6c4;border:1px solid #6b4f24;padding:4px"> <span class="small">Share a seed to replay the same map.</span></p>
      <div class="mb"><button id="sBack">Back</button><button class="primary" id="sNext">Next: castle</button></div>`;
    const keep = () => { st.seed = $('mSeed').value; };
    $('mbox').querySelectorAll('[data-m]').forEach(c => c.onclick = () => { keep(); st.preset = c.dataset.m; showMapSelect(diff, st); });
    $('mbox').querySelectorAll('[data-s]').forEach(b => b.onclick = () => { keep(); st.size = b.dataset.s; showMapSelect(diff, st); });
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

  refreshTitle();
  requestAnimationFrame(loop);
  window.__G = () => G;
  window.__dbg = { centerOn, interact, renderAll, newGame, fight, gainXp, openTown };
})();
